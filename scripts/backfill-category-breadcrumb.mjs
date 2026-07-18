#!/usr/bin/env node
/**
 * backfill-category-breadcrumb.mjs
 *
 * 2026-07-18: the na-authors content-category convergence sweep (commit 81f189d2d) corrected
 * article:section / JSON-LD articleSection / generated-articles.json category fields on 3835 of
 * 8361 checked articles, but explicitly did NOT touch the visible on-page breadcrumb
 * (`<div class="art-cat">...</div>`) — readers were still seeing the stale category even on
 * articles whose meta tags were already fixed. This script closes that gap: it re-runs the same
 * remapArticleCategory() keyword ladder (copied verbatim below from newsanarchist-content.mjs —
 * see that function for the canonical source) against every article file on disk and rewrites
 * BOTH the visible breadcrumb and any straggler meta tags (articles published between the prior
 * sweep and the na-authors v18 deploy were never covered by either) wherever they disagree with
 * the resolved category. Only ever touches the single art-cat div's text and the two meta/JSON-LD
 * category fields — never regenerates or restyles anything else in the file.
 *
 * Skips the non-canonical side of any resolved duplicate pair (via the exact same
 * isNonCanonicalArticleFile() check newsanarchist-content.mjs's listing/sitemap code uses) —
 * no reason to rewrite content that's already excluded from every listing.
 *
 * Usage:
 *   node scripts/backfill-category-breadcrumb.mjs --dry-run          # report only, no writes
 *   node scripts/backfill-category-breadcrumb.mjs --dry-run --files=a.html,b.html
 *   node scripts/backfill-category-breadcrumb.mjs                    # write for real
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_DIR = path.resolve(__dirname, '..');
const ARTICLES_DIR = path.join(SITE_DIR, 'articles');
const MANIFEST_PATH = path.join(SITE_DIR, 'generated-articles.json');
const CANONICAL_STATUS_CACHE_PATH = path.join(SITE_DIR, '.canonical-status-cache.json');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const filesArg = args.find(a => a.startsWith('--files='));
const ONLY_FILES = filesArg ? filesArg.slice('--files='.length).split(',').map(s => s.trim()) : null;

// 2026-07-18: consolidated into /home/ubuntu/shared/category-ladder.js (same pattern as
// shared/pre-send-guard.js) — this used to be a standalone verbatim copy of the ladder; now
// imported so it can never drift from the fixed, canonical version. Local name kept as
// remapArticleCategory so the call sites below this point don't need to change.
import { resolveCategory as remapArticleCategory } from '../../../../shared/category-ladder.js';

// ─── Canonical-duplicate skip (same check newsanarchist-content.mjs's listing/sitemap code uses) ─

let _canonStatusCache = null;
function loadCanonicalStatusCache() {
  if (_canonStatusCache) return _canonStatusCache;
  try { _canonStatusCache = JSON.parse(fs.readFileSync(CANONICAL_STATUS_CACHE_PATH, 'utf-8')); }
  catch { _canonStatusCache = {}; }
  return _canonStatusCache;
}

function isNonCanonicalArticleFile(filename, html) {
  const slug = filename.replace(/\.html$/, '');
  const m = html.match(/<link rel="canonical" href="https:\/\/newsanarchist\.com\/articles\/([^"]+)">/);
  return !!(m && m[1] !== slug);
}

// ─── HTML field extraction (read-only) ─────────────────────────────────────────────────────────

function unescapeHtml(s) {
  return String(s || '')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function extractFields(html) {
  const artCatMatch = html.match(/<div class="art-cat">([^<]*)<\/div>/);
  const titleMatch = html.match(/<title>([^<]*)\s*—\s*NewsAnarchist<\/title>/);
  const descMatch = html.match(/<meta name="description" content="([^"]*)">/);
  const sectionMatch = html.match(/<meta property="article:section" content="([^"]*)">/);
  const ldMatch = html.match(/"articleSection":"((?:[^"\\]|\\.)*)"/);
  const authorImgMatch = html.match(/<img src="\/images\/authors\/([^"]+)\.webp"/);
  const authorLdMatch = html.match(/\/authors\/([a-z0-9-]+)"/);

  return {
    artCat: artCatMatch ? artCatMatch[1] : null,
    title: titleMatch ? unescapeHtml(titleMatch[1]) : null,
    description: descMatch ? unescapeHtml(descMatch[1]) : '',
    articleSection: sectionMatch ? unescapeHtml(sectionMatch[1]) : null,
    ldArticleSection: ldMatch ? ldMatch[1] : null,
    authorSlug: authorImgMatch ? authorImgMatch[1] : (authorLdMatch ? authorLdMatch[1] : ''),
  };
}

// ─── Manifest (for categoryLocked / author fallback) ───────────────────────────────────────────

function loadManifestByFilename() {
  const map = new Map();
  try {
    const rows = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    for (const r of rows) if (r.filename) map.set(r.filename, r);
  } catch (e) { console.warn('WARN: could not read manifest:', e.message); }
  return map;
}

// ─── Main ───────────────────────────────────────────────────────────────────────────────────────

function main() {
  const manifestByFilename = loadManifestByFilename();
  const files = ONLY_FILES
    ? ONLY_FILES
    : fs.readdirSync(ARTICLES_DIR).filter(f => f.endsWith('.html'));

  console.log(`Scanning ${files.length} article file(s)${DRY_RUN ? ' [DRY RUN]' : ''}...`);

  let skippedNonCanonical = 0;
  let skippedNoData = 0;
  let alreadyCorrect = 0;
  let breadcrumbFixed = 0;
  let metaFixed = 0;
  let bothFixed = 0;
  const sampleChanges = [];
  const sampleFailures = [];

  for (const filename of files) {
    const filePath = path.join(ARTICLES_DIR, filename);
    let html;
    try { html = fs.readFileSync(filePath, 'utf8'); }
    catch (e) { skippedNoData++; continue; }

    if (isNonCanonicalArticleFile(filename, html)) { skippedNonCanonical++; continue; }

    const f = extractFields(html);
    if (!f.artCat || !f.title) { skippedNoData++; sampleFailures.push(filename); continue; }

    const manifestEntry = manifestByFilename.get(filename);
    const rawCategoryInput = f.articleSection || f.artCat;
    const resolved = remapArticleCategory({
      title: f.title,
      description: f.description,
      author: manifestEntry ? manifestEntry.author : f.authorSlug,
      category: rawCategoryInput,
      categoryLocked: manifestEntry ? !!manifestEntry.categoryLocked : false,
    });

    const needsBreadcrumb = f.artCat !== resolved;
    const needsMetaSection = f.articleSection !== null && f.articleSection !== resolved;
    const needsMetaLd = f.ldArticleSection !== null && f.ldArticleSection !== resolved;
    const needsMeta = needsMetaSection || needsMetaLd;

    if (!needsBreadcrumb && !needsMeta) { alreadyCorrect++; continue; }

    let newHtml = html;
    if (needsBreadcrumb) {
      newHtml = newHtml.replace(
        `<div class="art-cat">${f.artCat}</div>`,
        `<div class="art-cat">${resolved}</div>`
      );
    }
    if (needsMetaSection) {
      newHtml = newHtml.replace(
        `<meta property="article:section" content="${f.articleSection}">`,
        `<meta property="article:section" content="${resolved}">`
      );
    }
    if (needsMetaLd) {
      newHtml = newHtml.replace(
        `"articleSection":"${f.ldArticleSection}"`,
        `"articleSection":"${resolved}"`
      );
    }

    if (needsBreadcrumb && needsMeta) bothFixed++;
    else if (needsBreadcrumb) breadcrumbFixed++;
    else if (needsMeta) metaFixed++;

    if (sampleChanges.length < 15) {
      sampleChanges.push(`${filename}: art-cat "${f.artCat}" -> "${resolved}"${needsMeta ? ' (+ meta)' : ''}`);
    }

    if (!DRY_RUN && newHtml !== html) {
      fs.writeFileSync(filePath, newHtml, 'utf8');
    }
  }

  console.log(`\n${DRY_RUN ? '[DRY RUN] Would fix' : 'Fixed'}:`);
  console.log(`  Breadcrumb only:     ${breadcrumbFixed}`);
  console.log(`  Meta tags only:      ${metaFixed}`);
  console.log(`  Both:                ${bothFixed}`);
  console.log(`  Already correct:     ${alreadyCorrect}`);
  console.log(`  Skipped (non-canon): ${skippedNonCanonical}`);
  console.log(`  Skipped (no data):   ${skippedNoData}`);
  console.log(`  Total scanned:       ${files.length}`);
  if (sampleChanges.length) {
    console.log(`\nSample changes:`);
    sampleChanges.forEach(s => console.log(`  ${s}`));
  }
  if (sampleFailures.length) {
    console.log(`\nSample extraction failures (first ${Math.min(10, sampleFailures.length)}):`);
    sampleFailures.slice(0, 10).forEach(s => console.log(`  ${s}`));
  }
}

main();
