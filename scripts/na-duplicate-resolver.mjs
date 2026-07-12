#!/usr/bin/env node
// na-duplicate-resolver.mjs
//
// Applies Samantha Voss's (na-samantha-voss DO) duplicate-coverage triage decisions to the
// actual published site. Voss adjudicates possible_duplicate_coverage flags (from
// na-duplicate-detector.mjs) and decides genuine-duplicate vs false-positive herself — but she
// is a Cloudflare Worker/DO with no filesystem access and no wrangler/git credentials, so she
// cannot touch the published HTML or deploy. On a confirmed genuine duplicate she writes a
// resolution directive to KV (na:dedup-resolution:{water_cooler row id}) and this script
// applies it — the same handoff pattern AuthorDO already uses to publish new articles
// (na:pending-article:*, consumed by na-publisher-daemon.mjs) and na-image-retention.mjs uses
// for surgical HTML patches.
//
// What it does to the non-canonical article's HTML (never the canonical one, never deletes
// anything):
//   - <link rel="canonical" href="..."> -> points at the canonical article's URL
//   - <meta property="og:url" content="..."> -> same
//   - JSON-LD "url":"...articles/..." -> same
//   - if Voss decided add_cross_link=true: a small "Related coverage" note linking to the
//     canonical article, visually consistent with the existing primary-source box, inserted
//     right before the take-box/subscribe-box boundary (one-directional — only the
//     non-canonical page gets this; the canonical page is never touched, to keep zero risk of
//     corrupting the article being kept as the real one).
//
// Usage:
//   node na-duplicate-resolver.mjs --apply-pending [--dry-run]
//   node na-duplicate-resolver.mjs --test <canonicalSlug> <nonCanonicalSlug> [--cross-link] [--dry-run]
//
// Cron (every 4h — real editorial/SEO content, more time-sensitive than image cleanup, but
// deploys purge the full site cache so this shouldn't run on every 5-min publish cycle):
//   0 */4 * * * node /home/ubuntu/.openclaw/workspace/scripts/na-duplicate-resolver.mjs --apply-pending >> /home/ubuntu/.openclaw/logs/na-duplicate-resolver.log 2>&1

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const WORKSPACE   = '/home/ubuntu/.openclaw/workspace';
const SITE_DIR     = path.join(WORKSPACE, 'newsanarchist-website');
const ARTICLES     = path.join(SITE_DIR, 'articles');
const CREDS_PATH   = '/home/ubuntu/.openclaw/secrets/credentials.env';
const CF_ZONE      = '2b30983b0c36254440e8262db846a1f8';
const CF_ACCOUNT   = '5cba15db85116f1426a122db0c5178fa';
const NA_D1_DATABASE = '0da0c627-dfd5-406e-9af8-7d48734b4922'; // na-editorial (water_cooler)
const KV_NS_STATE  = '44b94a0518b24cef80342fa37c71bffd'; // NA_INTERVIEW_STATE / KV_STATE

const LOG = (m) => console.log(`[${new Date().toISOString()}] [dup-resolver] ${m}`);

function loadCreds() {
  const raw = fs.readFileSync(CREDS_PATH, 'utf-8');
  const get = k => raw.match(new RegExp(`^(?:export\\s+)?${k}=(.+)$`, 'm'))?.[1]?.trim();
  return {
    CF_ACCT: get('CLOUDFLARE_ACCOUNT_ID'),
    CF_KEY:  get('CLOUDFLARE_GLOBAL_API_KEY') || get('CLOUDFLARE_API_KEY'),
    CF_EMAIL: get('CLOUDFLARE_EMAIL'),
  };
}

function kvHdr() {
  const { CF_EMAIL, CF_KEY } = loadCreds();
  return `-H "X-Auth-Email: ${CF_EMAIL}" -H "X-Auth-Key: ${CF_KEY}"`;
}

function kvList(prefix) {
  const base = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/storage/kv/namespaces/${KV_NS_STATE}`;
  const raw = execSync(`curl -sL "${base}/keys?prefix=${encodeURIComponent(prefix)}&limit=100" ${kvHdr()}`, { encoding: 'utf8', timeout: 15000 });
  const d = JSON.parse(raw);
  return (d.result || []).map(k => k.name);
}

function kvGet(key) {
  const base = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/storage/kv/namespaces/${KV_NS_STATE}`;
  const raw = execSync(`curl -sL "${base}/values/${encodeURIComponent(key)}" ${kvHdr()}`, { encoding: 'utf8', timeout: 15000 });
  try { return JSON.parse(raw); } catch { return null; }
}

function kvDelete(key) {
  const base = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/storage/kv/namespaces/${KV_NS_STATE}`;
  execSync(`curl -sL -X DELETE "${base}/values/${encodeURIComponent(key)}" ${kvHdr()}`, { encoding: 'utf8', timeout: 10000 });
}

function d1Run(sql, params) {
  const body = JSON.stringify({ sql, params });
  const raw = execSync(
    `curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/d1/database/${NA_D1_DATABASE}/query" ${kvHdr()} -H "Content-Type: application/json" --data-binary @-`,
    { input: body, encoding: 'utf8' }
  );
  const parsed = JSON.parse(raw);
  if (!parsed.success) throw new Error(`D1 query failed: ${JSON.stringify(parsed.errors)}`);
  return parsed.result?.[0]?.results || [];
}

// Publish-pipeline kill switch — same na:publish-halt flag every other publish-adjacent script
// checks. Fails CLOSED: unreadable = treated as halted. HTML is still patched+committed locally
// either way (that's just a local edit); only the actual deploy step is gated.
function isPublishHalted() {
  try {
    const raw = execSync(
      `curl -sL "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/storage/kv/namespaces/${KV_NS_STATE}/values/na%3Apublish-halt" ${kvHdr()}`,
      { encoding: 'utf8', timeout: 10000 }
    );
    if (!raw || raw.includes('"key not found"')) return false;
    return !!JSON.parse(raw)?.paused;
  } catch (e) {
    LOG(`Publish-halt check failed (${e.message}) — failing CLOSED, treating as halted`);
    return true;
  }
}

const CROSS_LINK_BOX = (canonicalUrl, canonicalTitle) => `
<div style="background:#f5f4f0;border:1px solid #e5e3de;padding:14px 18px;margin:32px 0;font-size:12px;color:#666;">
  <strong>Related coverage:</strong> <a href="${canonicalUrl}" style="color:#dc2626;">${canonicalTitle || 'See our related reporting on this story'}</a>
</div>`;

// Patches ONE non-canonical article's self-referential tags to point at the canonical article,
// and optionally inserts a related-coverage note. Never touches the canonical article's file.
// Returns null (no-op) if the file doesn't exist or none of the expected tags were found.
function applyResolution({ canonicalSlug, canonicalUrl, nonCanonicalSlug, addCrossLink }, { dryRun = false } = {}) {
  const htmlPath = path.join(ARTICLES, `${nonCanonicalSlug}.html`);
  if (!fs.existsSync(htmlPath)) throw new Error(`no such article HTML: ${htmlPath}`);
  let html = fs.readFileSync(htmlPath, 'utf-8');
  const before = html;

  let canonicalTitle = '';
  const canonicalPath = path.join(ARTICLES, `${canonicalSlug}.html`);
  if (fs.existsSync(canonicalPath)) {
    const canonicalHtml = fs.readFileSync(canonicalPath, 'utf-8');
    const m = canonicalHtml.match(/<h1 class="art-hed">([\s\S]*?)<\/h1>/);
    if (m) canonicalTitle = m[1].replace(/<[^>]+>/g, '').trim();
  }

  let canonicalPatched = false, ogUrlPatched = false, jsonLdPatched = false, crossLinkAdded = false;

  if (/<link rel="canonical" href="[^"]*">/.test(html)) {
    html = html.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${canonicalUrl}">`);
    canonicalPatched = true;
  }
  if (/<meta property="og:url" content="[^"]*">/.test(html)) {
    html = html.replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${canonicalUrl}">`);
    ogUrlPatched = true;
  }
  if (/"url":"[^"]*\/articles\/[^"]*"/.test(html)) {
    html = html.replace(/"url":"[^"]*\/articles\/[^"]*"/, `"url":"${canonicalUrl}"`);
    jsonLdPatched = true;
  }

  if (addCrossLink) {
    const boundary = /<div class="author-take-box"|<div class="na-subscribe-inline"|<\/article>/;
    if (boundary.test(html)) {
      html = html.replace(boundary, (match) => `${CROSS_LINK_BOX(canonicalUrl, canonicalTitle)}\n${match}`);
      crossLinkAdded = true;
    }
  }

  const changed = html !== before;
  if (changed && !dryRun) fs.writeFileSync(htmlPath, html);
  return { canonicalPatched, ogUrlPatched, jsonLdPatched, crossLinkAdded, changed };
}

function applyPending({ dryRun = false } = {}) {
  const keys = kvList('na:dedup-resolution:');
  if (!keys.length) { LOG('No pending duplicate resolutions'); return; }
  LOG(`${keys.length} pending resolution(s)`);

  const applied = [];
  for (const key of keys) {
    const payload = kvGet(key);
    if (!payload?.canonicalSlug || !payload?.nonCanonicalSlug) { LOG(`Bad payload: ${key}`); continue; }
    try {
      const r = applyResolution(payload, { dryRun });
      LOG(`  ${payload.nonCanonicalSlug} -> canonical ${payload.canonicalSlug}: canonical=${r.canonicalPatched} og:url=${r.ogUrlPatched} jsonld=${r.jsonLdPatched} crossLink=${r.crossLinkAdded} changed=${r.changed}`);
      applied.push({ key, payload, result: r });
    } catch (e) {
      LOG(`  FAILED ${key} (${payload.nonCanonicalSlug}): ${e.message}`);
    }
  }

  const realChanges = applied.filter(a => a.result.changed);
  if (!realChanges.length) { LOG('Nothing actually patched — done.'); return; }

  if (dryRun) { LOG(`[dry-run] Would commit/deploy ${realChanges.length} file(s), then update D1 + clear KV.`); return; }

  // Commit
  try {
    execSync(`cd ${SITE_DIR} && git add articles/`, { stdio: 'inherit' });
    const status = execSync(`cd ${SITE_DIR} && git status --porcelain`, { encoding: 'utf8' });
    if (!status.trim()) { LOG('No git changes to commit — done.'); return; }
    execSync(
      `cd ${SITE_DIR} && git commit -m "chore: duplicate-coverage triage — ${realChanges.length} article(s) canonicalized [${new Date().toISOString().slice(0, 10)}]"`,
      { stdio: 'inherit' }
    );
  } catch (e) { LOG(`Git commit failed: ${e.message} — not deploying, not marking resolved.`); return; }

  let deployed = false;
  if (isPublishHalted()) {
    LOG('Publish halt active — HTML committed locally but NOT deployed. Leaving KV directives in place for next run.');
  } else {
    try {
      const { CF_ACCT, CF_KEY, CF_EMAIL } = loadCreds();
      const env = Object.assign({}, process.env);
      delete env.CLOUDFLARE_API_TOKEN;
      env.CLOUDFLARE_API_KEY = CF_KEY;
      env.CLOUDFLARE_EMAIL = CF_EMAIL;
      env.CLOUDFLARE_ACCOUNT_ID = CF_ACCT;
      execSync(
        'npx wrangler@4.93.1 pages deploy . --project-name newsanarchist-website --branch=master --commit-dirty=true',
        { cwd: SITE_DIR, env, stdio: 'inherit', timeout: 180000 }
      );
      execSync(
        `curl -sL -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/purge_cache" -H "X-Auth-Email: ${CF_EMAIL}" -H "X-Auth-Key: ${CF_KEY}" -H "Content-Type: application/json" --data '{"purge_everything":true}'`,
        { timeout: 15000 }
      );
      deployed = true;
      LOG(`Deployed + cache purged — ${realChanges.length} article(s) canonicalized this run.`);
    } catch (e) { LOG(`Deploy failed: ${e.message} — HTML committed but not live yet.`); }
  }

  // Only mark resolved in D1 and clear the KV directive once the change is actually live
  // (or, if halted, we leave the directive so a future run re-applies/re-deploys — the file
  // patch itself is idempotent since it matches on the CURRENT href, not a hardcoded old one).
  if (!deployed) return;
  for (const { key, payload } of realChanges) {
    try {
      const rows = d1Run('SELECT metrics FROM water_cooler WHERE id = ?', [payload.waterCoolerId]);
      if (rows[0]) {
        let metrics = {};
        try { metrics = JSON.parse(rows[0].metrics || '{}'); } catch {}
        metrics.fileEditStatus = 'applied';
        metrics.appliedAt = new Date().toISOString();
        d1Run('UPDATE water_cooler SET metrics = ? WHERE id = ?', [JSON.stringify(metrics), payload.waterCoolerId]);
      }
      kvDelete(key);
    } catch (e) { LOG(`Post-deploy D1/KV cleanup failed for ${key}: ${e.message}`); }
  }
}

const args = process.argv.slice(2);
if (args[0] === '--apply-pending') {
  applyPending({ dryRun: args.includes('--dry-run') });
} else if (args[0] === '--test') {
  const canonicalSlug = args[1], nonCanonicalSlug = args[2];
  if (!canonicalSlug || !nonCanonicalSlug) {
    console.log('Usage: node na-duplicate-resolver.mjs --test <canonicalSlug> <nonCanonicalSlug> [--cross-link] [--dry-run]');
    process.exit(1);
  }
  const dryRun = args.includes('--dry-run');
  const addCrossLink = args.includes('--cross-link');
  const canonicalUrl = `https://newsanarchist.com/articles/${canonicalSlug}`;
  const result = applyResolution({ canonicalSlug, canonicalUrl, nonCanonicalSlug, addCrossLink }, { dryRun });
  console.log(JSON.stringify({ canonicalSlug, nonCanonicalSlug, addCrossLink, dryRun, ...result }, null, 2));
} else {
  console.log('Usage: node na-duplicate-resolver.mjs --apply-pending [--dry-run]');
  console.log('       node na-duplicate-resolver.mjs --test <canonicalSlug> <nonCanonicalSlug> [--cross-link] [--dry-run]');
}
