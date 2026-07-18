#!/usr/bin/env node
/**
 * migrate-non-latin-slugs.mjs — one-time retroactive migration for the slugify() diacritics bug
 * (fixed going forward in na-authors v19).
 *
 * Input: a JSON mapping file of [{ oldSlug, newSlug, filename, title }, ...] — see
 * MAPPING_PATH below. Generated once via a corpus audit + (for Lúcia Ferreira) the fixed
 * slugify() re-run on each title, or (for Kenji Mori) a real per-title romanization, since
 * mechanical transliteration doesn't work for Japanese — see the 2026-07-18 work log.
 *
 * For every mapping entry this:
 *   1. Renames articles/OLD.html -> articles/NEW.html, rewriting every internal self-reference
 *      inside the file (canonical, og:url, og:image, twitter:image, JSON-LD url/image.url) via a
 *      global string replace of the old slug -> new slug (safe here: these slugs are long,
 *      specific alphanumeric strings that don't collide with anything else in the file).
 *   2. Renames the matching images/articles/OLD.webp -> NEW.webp, if present.
 *   3. Updates generated-articles.json's slug + filename fields for that entry.
 *   4. Scans every OTHER article's body for an internal AIOSEO cross-link to the old slug
 *      (`/articles/OLD-SLUG`) and rewrites it to the new slug.
 *   5. Appends a real 301 rule to _redirects: `/articles/OLD /articles/NEW 301`.
 *
 * Does NOT touch sitemap.xml/RSS directly — those regenerate from generated-articles.json on the
 * next `node newsanarchist-content.mjs publish` run. See updateSitemap()'s MIGRATED_SLUG_RE
 * exclusion (added alongside this script) for why the old URLs won't get resurrected by the
 * "preserve prior indexed URLs" logic once the file backing them no longer exists.
 *
 * Usage:
 *   node scripts/migrate-non-latin-slugs.mjs --dry-run
 *   node scripts/migrate-non-latin-slugs.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_DIR = path.resolve(__dirname, '..');
const ARTICLES_DIR = path.join(SITE_DIR, 'articles');
const IMAGES_DIR = path.join(SITE_DIR, 'images', 'articles');
const MANIFEST_PATH = path.join(SITE_DIR, 'generated-articles.json');
const REDIRECTS_PATH = path.join(SITE_DIR, '_redirects');
const MAPPING_PATH = process.env.SLUG_MIGRATION_MAPPING || '/tmp/claude-1001/-home-ubuntu/de3beae8-587f-493d-82de-65a359c81e62/scratchpad/slug_migration_mapping.json';

const DRY_RUN = process.argv.includes('--dry-run');

function main() {
  const mapping = JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf8'));
  console.log(`Loaded ${mapping.length} migration entries${DRY_RUN ? ' [DRY RUN]' : ''}`);

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const manifestBySlug = new Map(manifest.map(a => [a.slug, a]));

  const oldToNew = new Map(mapping.map(m => [m.oldSlug, m.newSlug]));
  const redirectLines = [];
  let filesRenamed = 0, imagesRenamed = 0, manifestUpdated = 0, crossLinksFixed = 0;
  const crossLinkDetail = [];

  // ── Step 1-3: rename article files + images, update manifest ──────────────────────────────
  for (const m of mapping) {
    const oldPath = path.join(ARTICLES_DIR, `${m.oldSlug}.html`);
    const newPath = path.join(ARTICLES_DIR, `${m.newSlug}.html`);

    if (!fs.existsSync(oldPath)) {
      console.warn(`  WARN: ${oldPath} does not exist, skipping`);
      continue;
    }
    if (fs.existsSync(newPath)) {
      console.warn(`  WARN: target ${newPath} already exists, skipping to avoid overwrite`);
      continue;
    }

    let html = fs.readFileSync(oldPath, 'utf8');
    const before = html;
    html = html.split(m.oldSlug).join(m.newSlug);
    if (html === before) {
      console.warn(`  WARN: old slug "${m.oldSlug}" not found anywhere in its own file — self-references may use a different form, check manually`);
    }

    if (!DRY_RUN) {
      fs.writeFileSync(newPath, html, 'utf8');
      fs.unlinkSync(oldPath);
    }
    filesRenamed++;

    const oldImg = path.join(IMAGES_DIR, `${m.oldSlug}.webp`);
    const newImg = path.join(IMAGES_DIR, `${m.newSlug}.webp`);
    if (fs.existsSync(oldImg)) {
      if (!DRY_RUN) fs.renameSync(oldImg, newImg);
      imagesRenamed++;
    }

    const manifestEntry = manifestBySlug.get(m.oldSlug);
    if (manifestEntry) {
      manifestEntry.slug = m.newSlug;
      manifestEntry.filename = `${m.newSlug}.html`;
      manifestUpdated++;
    } else {
      console.warn(`  WARN: no manifest entry found for old slug "${m.oldSlug}"`);
    }

    redirectLines.push(`/articles/${m.oldSlug} /articles/${m.newSlug} 301`);
  }

  if (!DRY_RUN) {
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
  }

  // ── Step 4: fix internal cross-links from every OTHER article to any migrated old slug ────
  const allFiles = fs.readdirSync(ARTICLES_DIR).filter(f => f.endsWith('.html'));
  for (const f of allFiles) {
    const fp = path.join(ARTICLES_DIR, f);
    let html;
    try { html = fs.readFileSync(fp, 'utf8'); } catch { continue; }
    let changed = false;
    for (const [oldSlug, newSlug] of oldToNew) {
      const oldHref = `/articles/${oldSlug}`;
      if (html.includes(oldHref)) {
        html = html.split(oldHref).join(`/articles/${newSlug}`);
        changed = true;
        crossLinksFixed++;
        crossLinkDetail.push(`${f}: /articles/${oldSlug} -> /articles/${newSlug}`);
      }
    }
    if (changed && !DRY_RUN) fs.writeFileSync(fp, html, 'utf8');
  }

  // ── Step 5: append real 301 redirects ──────────────────────────────────────────────────────
  if (!DRY_RUN && redirectLines.length) {
    const existing = fs.existsSync(REDIRECTS_PATH) ? fs.readFileSync(REDIRECTS_PATH, 'utf8') : '';
    const header = `\n# Non-Latin-script slug migration (2026-07-18) — na-authors v19 fixed slugify() going\n# forward; these 301s cover the ${redirectLines.length} already-published articles (Kenji Mori,\n# Lúcia Ferreira) whose slugs were generated before that fix. Permanent (301), not temporary —\n# any existing backlinks/bookmarks/search-engine trust on the old URL should carry over.\n`;
    fs.writeFileSync(REDIRECTS_PATH, existing + header + redirectLines.join('\n') + '\n', 'utf8');
  }

  console.log(`\n${DRY_RUN ? '[DRY RUN] Would do' : 'Done'}:`);
  console.log(`  Article files renamed:   ${filesRenamed}`);
  console.log(`  Image files renamed:     ${imagesRenamed}`);
  console.log(`  Manifest entries updated:${manifestUpdated}`);
  console.log(`  Internal cross-links fixed: ${crossLinksFixed}`);
  console.log(`  Redirect rules added:    ${redirectLines.length}`);
  if (crossLinkDetail.length) {
    console.log(`\nCross-link fixes:`);
    crossLinkDetail.forEach(d => console.log(`  ${d}`));
  }
}

main();
