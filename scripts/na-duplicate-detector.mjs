#!/usr/bin/env node
// na-duplicate-detector.mjs
//
// Embedding-based near-duplicate-coverage detector for NewsAnarchist. Replaces the old
// exact-title-prefix dedup that used to live in newsanarchist-content.mjs's runPublish().
//
// Why that one had to go, not just get patched again: it only matched a literal 60-char
// normalized title PREFIX. Real duplicate coverage across authors is paraphrased, not
// prefix-identical — confirmed directly: two different authors' articles on the same UK FCA
// crypto-rules story (same event, same cited source, 3 days apart) had ZERO exact-prefix
// match but a 0.88 cosine similarity on their embeddings. And when the old logic DID find a
// match, it silently dropped one article from the manifest (and therefore the sitemap) —
// which is what orphaned 2,633 legitimate, unrelated articles (see na-seo-recovery-stage1
// memory). This version never removes anything. It only flags real candidates to
// water_cooler (event='possible_duplicate_coverage') for a human or Copy Desk to review.
//
// Model: @cf/baai/bge-base-en-v1.5 (768-dim, cosine metric) — confirmed current and available
// on Workers AI without extra provider keys (checked the live model catalog before picking
// this; also considered @cf/baai/bge-small-en-v1.5 (cheaper, 384-dim) and
// @cf/qwen/qwen3-embedding-0.6b (longer context) — token volume here is tiny (titles + short
// snippets), so cost isn't a real differentiator between any of them; bge-base is the
// best-documented, most broadly proven of the group).
//
// Window: 7 days. The one real confirmed duplicate pair was 72h apart; same-day paraphrase
// duplicates were also confirmed (Epstein Files, Cold Cases). 7 days gives >2x margin on the
// confirmed case while staying clearly bounded and "recent" — not the unbounded
// entire-history comparison that caused the orphaning bug this replaces.
//
// Threshold: 0.85 — RAISED from an initial 0.78 after real precision measurement showed 0.78
// was miscalibrated. The initial calibration only tested isolated known pairs; once measured
// against a real 60-pair random sample of ACTUAL flagged rows (each hand-checked against one
// explicit test: same specific underlying event, or same broad topic/beat with different
// specific facts?), overall precision at 0.78 was only 61.7% (37/60). Precision by threshold:
//   >=0.78: 61.7%  |  >=0.82: 72.0%  |  >=0.85: 85.4%  |  >=0.88: 90.0%  |  >=0.90: 92.6%
// There's a real, sharp break at 0.85 (85.4% precision above it, only 10.5% below), and the
// one real confirmed case (UK Crypto Firms Face New Rules, two authors, 0.8796) stays safely
// above 0.85 with real margin — unlike 0.88, which would put that exact case AT the boundary.
// 0.85 was chosen over 0.88/0.90 specifically to keep that margin rather than chase a few more
// points of precision. Recall still matters more than precision for a review queue, but 0.78
// let through too much same-beat/different-facts noise (e.g. two distinct Medicare fraud
// cases with similar phrasing) to be worth the review cost at real publish volume.

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const CF_ACCOUNT      = '5cba15db85116f1426a122db0c5178fa';
const NA_D1_DATABASE   = '0da0c627-dfd5-406e-9af8-7d48734b4922'; // na-editorial (water_cooler)
const CREDS_PATH       = '/home/ubuntu/.openclaw/secrets/credentials.env';
const EMBEDDING_MODEL  = '@cf/baai/bge-base-en-v1.5';
const STORE_DIR        = '/home/ubuntu/.openclaw/workspace/na-duplicate-detection';
const STORE_PATH       = path.join(STORE_DIR, 'embeddings-store.json');
const WINDOW_MS        = 7 * 24 * 60 * 60 * 1000;
const SIMILARITY_THRESHOLD = 0.85;

const LOG = (m) => console.log(`[dup-detector] ${m}`);

function loadCreds() {
  const raw = fs.readFileSync(CREDS_PATH, 'utf-8');
  const get = (k) => raw.match(new RegExp(`^(?:export\\s+)?${k}=(.+)$`, 'm'))?.[1]?.trim();
  return { email: get('CLOUDFLARE_EMAIL'), key: get('CLOUDFLARE_GLOBAL_API_KEY') };
}

function loadStore(storePath) {
  try { return JSON.parse(fs.readFileSync(storePath, 'utf-8')); } catch { return {}; }
}

function saveStore(store, storePath) {
  const dir = path.dirname(storePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(store));
}

function getEmbedding(text) {
  const { email, key } = loadCreds();
  const body = JSON.stringify({ text: [String(text).slice(0, 2000)] });
  const raw = execSync(
    `curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/ai/run/${EMBEDDING_MODEL}" ` +
    `-H "X-Auth-Email: ${email}" -H "X-Auth-Key: ${key}" -H "Content-Type: application/json" --data-binary @-`,
    { input: body, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
  );
  const d = JSON.parse(raw);
  if (!d.success) throw new Error(`embedding call failed: ${JSON.stringify(d.errors)}`);
  return d.result.data[0];
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// First ~400 chars of the article body, stripped of markup — same snippet length used during
// threshold calibration.
function bodySnippet(filename, articlesDir) {
  try {
    const html = fs.readFileSync(path.join(articlesDir, filename), 'utf-8');
    const m = html.match(/<div class="art-body">([\s\S]*?)<div id="ezoic/);
    const body = m ? m[1] : '';
    return body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400);
  } catch { return ''; }
}

function articleText(article, articlesDir) {
  const snippet = bodySnippet(article.filename, articlesDir);
  return `${article.title || ''}. ${article.description || ''} ${snippet}`.slice(0, 2000);
}

function flagDuplicate(newArticle, matchEntry, similarity) {
  const { email, key } = loadCreds();
  const newSlug = (newArticle.filename || '').replace(/\.html$/, '');
  const sql = 'INSERT INTO water_cooler (ts, agent, event, summary, metrics, status) VALUES (?, ?, ?, ?, ?, ?)';
  const params = [
    Date.now(),
    'na-duplicate-detector',
    'possible_duplicate_coverage',
    `"${newArticle.title}" (${newArticle.author || '?'}) may duplicate "${matchEntry.title}" (${matchEntry.author || '?'}) — similarity ${similarity.toFixed(3)}`,
    JSON.stringify({
      newSlug, newAuthor: newArticle.author, newUrl: `https://newsanarchist.com/articles/${newSlug}`,
      matchSlug: matchEntry.slug, matchAuthor: matchEntry.author, matchUrl: `https://newsanarchist.com/articles/${matchEntry.slug}`,
      similarity, windowDays: WINDOW_MS / 86400000,
    }),
    // water_cooler.status has a CHECK constraint: only 'ok'|'warn'|'error'|'skip' — 'warn' is
    // the closest fit ("not an error, but needs a human look"). Confirmed by testing: any
    // other value fails the constraint and the INSERT silently does nothing unless the
    // response is actually checked (see below — this bit us once already while verifying).
    'warn',
  ];
  const body = JSON.stringify({ sql, params });
  const raw = execSync(
    `curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/d1/database/${NA_D1_DATABASE}/query" ` +
    `-H "X-Auth-Email: ${email}" -H "X-Auth-Key: ${key}" -H "Content-Type: application/json" --data-binary @-`,
    { input: body, encoding: 'utf8' }
  );
  const parsed = JSON.parse(raw);
  if (!parsed.success) throw new Error(`D1 insert failed: ${JSON.stringify(parsed.errors)}`);
}

// Runs once per publish cycle. Only computes an embedding for articles not already in the
// store (each article is embedded exactly once, ever), and only compares against store
// entries within WINDOW_MS of the candidate's own publish time — bounded on both axes, unlike
// the bug this replaces. Never mutates allArticles.
export function detectAndFlagDuplicates(allArticles, articlesDir, { dryRun = false, storePath = STORE_PATH } = {}) {
  const store = loadStore(storePath);
  const results = { checked: 0, flagged: 0, errors: 0, matches: [] };

  // The production store starts empty — the first real run has ~4,850 existing articles to
  // backfill, one embedding call each, and the daemon that calls this only gives it a 5-minute
  // budget per cycle. Save incrementally (not just once at the end) so a mid-backfill timeout
  // loses at most the last few embeddings, not the whole run — later cycles pick up exactly
  // where they left off (already-stored filenames are skipped up top).
  let sinceLastSave = 0;
  const maybeSave = () => {
    sinceLastSave++;
    if (sinceLastSave >= 20) { saveStore(store, storePath); sinceLastSave = 0; }
  };

  for (const article of allArticles) {
    const filename = article.filename;
    if (!filename || store[filename]) continue;

    let emb;
    try {
      emb = getEmbedding(articleText(article, articlesDir));
    } catch (e) {
      LOG(`embedding failed for ${filename}: ${e.message}`);
      results.errors++;
      continue;
    }
    results.checked++;

    const genTime = new Date(article.generatedAt || 0).getTime();
    let bestMatch = null, bestScore = 0;
    for (const [otherFilename, entry] of Object.entries(store)) {
      if (otherFilename === filename) continue;
      if (!Number.isFinite(genTime) || !Number.isFinite(entry.generatedAt)) continue;
      if (Math.abs(genTime - entry.generatedAt) > WINDOW_MS) continue;
      const score = cosine(emb, entry.embedding);
      if (score > bestScore) { bestScore = score; bestMatch = entry; }
    }

    if (bestMatch && bestScore >= SIMILARITY_THRESHOLD) {
      results.matches.push({ title: article.title, matchTitle: bestMatch.title, score: bestScore });
      if (dryRun) {
        LOG(`[dry-run] would flag "${article.title}" ~ "${bestMatch.title}" (${bestScore.toFixed(3)})`);
      } else {
        try {
          flagDuplicate(article, bestMatch, bestScore);
          LOG(`FLAGGED "${article.title}" ~ "${bestMatch.title}" (${bestScore.toFixed(3)})`);
        } catch (e) {
          LOG(`flag write failed for ${filename}: ${e.message}`);
        }
      }
      results.flagged++;
    }

    store[filename] = {
      embedding: emb,
      title: article.title,
      author: article.author,
      slug: filename.replace(/\.html$/, ''),
      generatedAt: genTime,
    };
    maybeSave();
  }

  saveStore(store, storePath);
  return results;
}

// CLI entry — used for calibration/verification, not part of the normal publish flow.
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const manifestPath = '/home/ubuntu/.openclaw/workspace/newsanarchist-website/generated-articles.json';
  const articlesDir = '/home/ubuntu/.openclaw/workspace/newsanarchist-website/articles';

  if (args[0] === '--range-check') {
    // A sparse random sample can't test the window logic (it needs real chronological
    // density — the whole point is comparing against what was ACTUALLY published nearby in
    // time). Takes a real, contiguous date-range slice instead and runs it through the
    // detector exactly as production would, in chronological order, against a scratch store
    // (never touches the real one or writes real water_cooler flags unless --live is passed).
    const since = args[1]; // 'YYYY-MM-DD'
    const until = args[2]; // 'YYYY-MM-DD'
    const live = args.includes('--live');
    const storePath = '/home/ubuntu/.openclaw/workspace/na-duplicate-detection/scratch-store.json';
    const all = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    all.sort((a, b) => new Date(a.generatedAt || 0) - new Date(b.generatedAt || 0));
    const slice = all.filter(a => {
      const d = (a.generatedAt || '').slice(0, 10);
      return d >= since && d <= until;
    });
    LOG(`range-check ${since}..${until}: ${slice.length} articles (of ${all.length} total), live=${live}`);
    fs.writeFileSync(storePath, '{}'); // fresh scratch store each run
    const results = detectAndFlagDuplicates(slice, articlesDir, { dryRun: !live, storePath });
    console.log(JSON.stringify({ checked: results.checked, flagged: results.flagged, errors: results.errors, matches: results.matches }, null, 2));
  } else if (args[0] === '--test-pair') {
    // Targeted test: seed the store with one real article as if already published, then run
    // detection on a second real article as if it were about to publish, and confirm it's
    // flagged against the first — the exact real confirmed case (UK FCA crypto rules).
    const storePath = '/home/ubuntu/.openclaw/workspace/na-duplicate-detection/scratch-store.json';
    const all = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const byTitle = Object.fromEntries(all.map(a => [a.title, a]));
    const firstTitle = args[1], secondTitle = args[2];
    const first = byTitle[firstTitle], second = byTitle[secondTitle];
    if (!first || !second) { console.error('article title(s) not found in manifest'); process.exit(1); }
    fs.writeFileSync(storePath, '{}');
    const live = args.includes('--live');
    // Seed: process only the first (earlier) article — populates the store as if it were
    // already live when the second one is about to publish.
    detectAndFlagDuplicates([first], articlesDir, { dryRun: true, storePath });
    // Now check the second article against that seeded window.
    const result = detectAndFlagDuplicates([second], articlesDir, { dryRun: !live, storePath });
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('Usage: node na-duplicate-detector.mjs --range-check <since> <until> [--live]');
    console.log('       node na-duplicate-detector.mjs --test-pair "<first title>" "<second title>"');
  }
}
