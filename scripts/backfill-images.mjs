#!/usr/bin/env node
/**
 * backfill-images.mjs — generate fal.ai images for all articles missing one.
 *
 * Required env vars:
 *   FAL_API_KEY   — fal.ai API key
 *
 * Optional:
 *   FAL_MODEL     — fal.ai model ID (default: fal-ai/flux/schnell)
 *   CONCURRENCY   — parallel requests (default: 3)
 *
 * Usage:
 *   node scripts/backfill-images.mjs               # generate all missing
 *   node scripts/backfill-images.mjs --dry-run      # show which slugs are missing
 *   node scripts/backfill-images.mjs --slug <slug>  # regenerate one specific article
 *   node scripts/backfill-images.mjs --limit 10     # process at most N articles
 *
 * After running:
 *   - Images saved to images/articles/{slug}.png
 *   - generated-articles.json updated with falUrl field
 *   - Article HTML og:image / twitter:image / JSON-LD image updated
 *   - Commit + push to trigger Cloudflare Pages redeploy
 */

import { createWriteStream, existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dir, '..');

const ARTICLES_DB = join(ROOT, 'generated-articles.json');
const IMG_DIR     = join(ROOT, 'images', 'articles');
const SITE_BASE   = 'https://newsanarchist.com';

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args       = process.argv.slice(2);
const DRY_RUN    = args.includes('--dry-run');
const SLUG_IDX   = args.indexOf('--slug');
const FORCE_SLUG = SLUG_IDX !== -1 ? args[SLUG_IDX + 1] : null;
const LIMIT_IDX  = args.indexOf('--limit');
const LIMIT      = LIMIT_IDX !== -1 ? parseInt(args[LIMIT_IDX + 1], 10) : Infinity;
const CONCURRENCY = parseInt(process.env.CONCURRENCY ?? '3', 10);
const FAL_MODEL   = process.env.FAL_MODEL ?? 'fal-ai/flux/schnell';

// ─── fal.ai ───────────────────────────────────────────────────────────────────

/**
 * Generate an image via fal.ai synchronous REST API.
 * Returns the first image URL from the response.
 */
async function generateImage(prompt) {
  const key = process.env.FAL_API_KEY;
  if (!key) throw new Error('FAL_API_KEY not set');

  const res = await fetch(`https://fal.run/${FAL_MODEL}`, {
    method:  'POST',
    headers: {
      Authorization:  `Key ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      image_size:        'landscape_16_9',
      num_inference_steps: 4,
      num_images:          1,
    }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(`fal.ai error ${res.status}: ${JSON.stringify(json)}`);

  const imgUrl = json.images?.[0]?.url ?? json.image?.url;
  if (!imgUrl) throw new Error(`No image URL in response: ${JSON.stringify(json)}`);
  return imgUrl;
}

/** Download a URL to a local file path. */
async function downloadImage(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  const writer = createWriteStream(destPath);
  await pipeline(Readable.fromWeb(res.body), writer);
}

// ─── Article HTML patching ────────────────────────────────────────────────────

/** Build an image prompt from the article title and category. */
function buildPrompt(article) {
  const cat = article.category ?? 'news';
  return `News article hero image for: "${article.title}". Category: ${cat}. Dramatic, editorial photography style, wide-angle, high contrast. No text, no logos.`;
}

/**
 * Patch og:image, twitter:image, and JSON-LD image in article HTML.
 * Returns the patched HTML string.
 */
function patchArticleHtml(html, newImageUrl) {
  // og:image
  html = html.replace(
    /(<meta property="og:image" content=")[^"]*(")/,
    `$1${newImageUrl}$2`
  );
  // twitter:image
  html = html.replace(
    /(<meta name="twitter:image" content=")[^"]*(")/,
    `$1${newImageUrl}$2`
  );
  // JSON-LD "image": { "@type": "ImageObject", "url": "..." }
  html = html.replace(
    /("image":\s*\{\s*"@type":\s*"ImageObject",\s*"url":\s*")[^"]*(")/,
    `$1${newImageUrl}$2`
  );
  return html;
}

// ─── Core processing ──────────────────────────────────────────────────────────

async function processArticle(article, articles) {
  const slug      = article.slug;
  const localPath = join(IMG_DIR, `${slug}.png`);
  const hostedUrl = `${SITE_BASE}/images/articles/${slug}.png`;

  try {
    const prompt  = buildPrompt(article);
    console.log(`  Generating: ${slug.slice(0, 60)}`);

    const falUrl = await generateImage(prompt);
    console.log(`  fal URL:    ${falUrl.slice(0, 80)}`);

    await downloadImage(falUrl, localPath);
    console.log(`  Saved:      images/articles/${slug}.png`);

    // Patch article HTML
    const htmlPath = join(ROOT, 'articles', `${slug}.html`);
    if (existsSync(htmlPath)) {
      const patched = patchArticleHtml(readFileSync(htmlPath, 'utf8'), hostedUrl);
      writeFileSync(htmlPath, patched, 'utf8');
    }

    // Update generated-articles.json entry in-place
    const idx = articles.findIndex(a => a.slug === slug);
    if (idx !== -1) {
      articles[idx] = { ...articles[idx], falUrl, imageUrl: hostedUrl };
    }

    return { slug, ok: true, falUrl };
  } catch (err) {
    console.error(`  FAILED ${slug}: ${err.message}`);
    return { slug, ok: false, error: err.message };
  }
}

/** Run tasks with a concurrency cap. */
async function pLimit(tasks, concurrency) {
  const results = [];
  let i = 0;

  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]();
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(IMG_DIR, { recursive: true });

  const articles = JSON.parse(readFileSync(ARTICLES_DB, 'utf8'));

  // Determine which articles need images
  let targets;
  if (FORCE_SLUG) {
    const a = articles.find(a => a.slug === FORCE_SLUG);
    if (!a) { console.error(`Slug not found: ${FORCE_SLUG}`); process.exit(1); }
    targets = [a];
  } else {
    targets = articles.filter(a => !existsSync(join(IMG_DIR, `${a.slug}.png`)));
  }

  if (LIMIT < Infinity) targets = targets.slice(0, LIMIT);

  console.log(`Articles needing images: ${targets.length}`);

  if (DRY_RUN) {
    for (const a of targets) console.log(`  missing: ${a.slug}`);
    return;
  }

  if (!targets.length) {
    console.log('All articles have images. Nothing to do.');
    return;
  }

  if (!process.env.FAL_API_KEY) {
    console.error('FAL_API_KEY is not set. Aborting.');
    process.exit(1);
  }

  const tasks   = targets.map(a => () => processArticle(a, articles));
  const results = await pLimit(tasks, CONCURRENCY);

  // Persist updated generated-articles.json
  writeFileSync(ARTICLES_DB, JSON.stringify(articles, null, 2), 'utf8');

  const ok     = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);

  console.log(`\nDone: ${ok}/${targets.length} generated.`);
  if (failed.length) {
    console.error(`Failed (${failed.length}):`);
    for (const f of failed) console.error(`  ${f.slug}: ${f.error}`);
    process.exitCode = 1;
  }
}

main().catch(err => { console.error(err); process.exit(1); });
