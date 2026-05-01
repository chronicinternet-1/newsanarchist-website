/**
 * Patches newsanarchist-content.mjs to strip garbled Reddit/RSS descriptions
 * before they are written into index.html card excerpts.
 * Run once on the VPS: node ~/newsanarchist-website/scripts/patch-description-filter.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';

const FILE = `${process.env.HOME}/.openclaw/workspace/scripts/newsanarchist-content.mjs`;

if (!existsSync(FILE)) {
  console.error('File not found:', FILE);
  process.exit(1);
}

let src = readFileSync(FILE, 'utf8');

// ── 1. Inject cleanExcerpt() helper after slugBase() ─────────────────────────
const HELPER = `
/** Strip HTML and Reddit boilerplate from an RSS description, fall back to title. */
function cleanExcerpt(description, title, maxLen = 160) {
  const JUNK = [
    /^\\s*&#32;\\s*/,           // Reddit leading whitespace entity
    /submitted by\\s*/gi,       // Reddit "submitted by u/..."
    /<table[\\s\\S]*?<\\/table>/gi,
    /<tr[\\s\\S]*?<\\/tr>/gi,
    /<td[\\s\\S]*?<\\/td>/gi,
    /<a\\s[^>]*>[\\s\\S]*?<\\/a>/gi,
    /<img[^>]*>/gi,
    /<[^>]+>/g,                 // all remaining tags
    /&[a-z]+;|&#\\d+;/g,        // HTML entities
    /\\s+/g,                    // collapse whitespace
  ];
  let text = description || '';
  for (const re of JUNK) text = text.replace(re, ' ');
  text = text.trim();

  // Reject if it's still boilerplate-looking or too short
  const isJunk = !text || text.length < 30
    || /^submitted/i.test(text)
    || /^\\s*\\/u\\//i.test(text);

  if (isJunk) text = title || '';

  return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;
}
`;

if (src.includes('function cleanExcerpt')) {
  console.log('cleanExcerpt() already present — skipping helper injection.');
} else {
  src = src.replace(
    /function slugBase\(slug\)[^}]*\}\n/,
    m => m + HELPER
  );
  console.log('Injected cleanExcerpt() helper.');
}

// ── 2. Replace raw description usage in card excerpt HTML ────────────────────
// Pattern: the script likely does something like topic.description in the excerpt <p>
// Common patterns to patch:
const PATTERNS = [
  // Pattern A: template literal with topic.description directly
  {
    find: /`<p class="card-excerpt">\$\{[^}]*\.description[^}]*\}<\/p>`/g,
    replace: (m) => {
      const inner = m.match(/\$\{([^}]+)\}/)?.[1] ?? 'topic.description';
      // extract the object prefix (topic, article, a, etc.)
      const obj = inner.split('.')[0];
      return m.replace(/\$\{[^}]+\}/, `\${cleanExcerpt(${obj}.description, ${obj}.title)}`);
    },
    label: 'Pattern A (template literal)',
  },
  // Pattern B: excerpt or description variable assigned then used
  {
    find: /const excerpt\s*=\s*[^;]+\.description[^;]*;/g,
    replace: (m) => {
      return m.replace(
        /(=\s*)([^;]+\.description[^;]*)/,
        (_, eq, val) => `${eq}cleanExcerpt(${val.trim()}, topic.title)`
      );
    },
    label: 'Pattern B (excerpt variable)',
  },
];

let patched = false;
for (const { find, replace, label } of PATTERNS) {
  if (find.test(src)) {
    src = src.replace(find, replace);
    console.log(`Patched ${label}.`);
    patched = true;
  }
}

if (!patched) {
  // Fallback: show the user where descriptions are used
  const lines = src.split('\n');
  const hits = lines
    .map((l, i) => ({ n: i + 1, l }))
    .filter(({ l }) => l.includes('description') && (l.includes('excerpt') || l.includes('card-excerpt') || l.includes('p class')));
  if (hits.length) {
    console.warn('WARNING: Could not auto-patch. Replace the description in these lines manually:');
    hits.forEach(({ n, l }) => console.warn(`  Line ${n}: ${l.trim()}`));
    console.warn('\nReplace the raw description value with: cleanExcerpt(topic.description, topic.title)');
  } else {
    console.warn('WARNING: Could not find description usage. Search the file for where card-excerpt text is built.');
  }
}

writeFileSync(FILE, src, 'utf8');
console.log('\nDone.');
