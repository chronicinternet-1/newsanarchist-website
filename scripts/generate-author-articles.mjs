#!/usr/bin/env node
/**
 * NewsAnarchist Autonomous Author Pipeline
 * Each author finds today's news, writes an original article, publishes.
 *
 * Usage:
 *   node generate-author-articles.mjs                    # rotate through all authors
 *   node generate-author-articles.mjs --author marcus_webb  # specific author
 *   node generate-author-articles.mjs --dry              # show what would be written, no publish
 *
 * Cron: added to newsanarchist-cron.sh after content generation
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE   = path.resolve(__dirname, '..');
const ARTICLES_DIR = path.join(WORKSPACE, 'newsanarchist-website/articles');
const IMAGES_DIR   = path.join(WORKSPACE, 'newsanarchist-website/images/articles');
const SITE_DIR     = path.join(WORKSPACE, 'newsanarchist-website');
const CREDS_PATH   = '/home/ubuntu/.openclaw/secrets/credentials.env';
const STATE_FILE   = path.join(WORKSPACE, 'newsanarchist-website/author-articles-state.json');
const SITE_URL     = 'https://newsanarchist.com';
const DRY          = process.argv.includes('--dry');

// Load API key
const creds = fs.readFileSync(CREDS_PATH, 'utf-8');
const ANTHROPIC_KEY = creds.match(/^ANTHROPIC_API_KEY=(.+)$/m)?.[1]?.trim();
if (!ANTHROPIC_KEY) { console.error('ANTHROPIC_API_KEY not found'); process.exit(1); }

const LOG = (m) => console.log(`[${new Date().toISOString()}] ${m}`);

// ── Author definitions ────────────────────────────────────────────
const AUTHORS = {
  marcus_webb: {
    name: 'Marcus Webb', slug: 'marcus-webb',
    beat: 'Surveillance State & Tech Privacy',
    credential: 'Former NSA contractor turned privacy watchdog',
    role: 'Surveillance & Tech Privacy',
    voice: 'methodical, document-heavy, civil-liberties-focused, dry and precise',
    search_queries: [
      'NSA surveillance news today', 'facial recognition government 2026',
      'data privacy government today', 'warrantless surveillance news',
      'EFF surveillance civil liberties today',
    ],
    category: 'Surveillance State',
    category_slug: 'surveillance-state',
  },
  elena_vasquez: {
    name: 'Elena Vasquez', slug: 'elena-vasquez',
    beat: 'Global Power & Geopolitics',
    credential: 'Former foreign correspondent, 15 years covering conflict zones',
    role: 'Global Power & Geopolitics',
    voice: 'analytical, geopolitical realist, sharp foreign-policy framing',
    search_queries: [
      'geopolitics news today 2026', 'NATO sanctions foreign policy today',
      'China US relations news today', 'global power shift news',
      'international sanctions news today',
    ],
    category: 'Global Power',
    category_slug: 'global-power',
  },
  jordan_calloway: {
    name: 'Jordan Calloway', slug: 'jordan-calloway',
    beat: 'Government Secrets & FOIA',
    credential: 'Investigative journalist specializing in FOIA litigation',
    role: 'Government Secrets & FOIA',
    voice: 'tenacious, document-driven, transparency advocate, adversarial toward secrecy',
    search_queries: [
      'FOIA declassified documents 2026', 'government transparency news today',
      'whistleblower news today', 'inspector general report today',
      'congressional oversight investigation today',
    ],
    category: 'Government Secrets',
    category_slug: 'government-secrets',
  },
  diana_reeves: {
    name: 'Diana Reeves', slug: 'diana-reeves',
    beat: 'Corporate Watchdog & Money & Markets',
    credential: 'Former financial analyst, follows regulatory capture',
    role: 'Corporate Watchdog & Markets',
    voice: 'sharp, antitrust-focused, follows the money, Stoller-esque',
    search_queries: [
      'SEC enforcement action today 2026', 'antitrust lawsuit news today',
      'corporate fraud news today', 'FTC enforcement today',
      'market manipulation investigation today',
    ],
    category: 'Corporate Watchdog',
    category_slug: 'corporate-watchdog',
  },
  sam_okafor: {
    name: 'Sam Okafor', slug: 'sam-okafor',
    beat: 'True Crime & Justice',
    credential: 'Former federal prosecutor, 12 years in DOJ',
    role: 'True Crime & Justice',
    voice: 'empathetic, evidence-based, wrongful-conviction-focused, narrative-driven',
    search_queries: [
      'wrongful conviction exoneration news today', 'forensic evidence case today',
      'criminal justice reform news today', 'cold case solved today 2026',
      'prosecutorial misconduct news today',
    ],
    category: 'True Crime',
    category_slug: 'true-crime',
  },
  casey_north: {
    name: 'Casey North', slug: 'casey-north',
    beat: 'Unexplained & Emerging Tech & Web3',
    credential: 'Science journalist, formerly at The Debrief',
    role: 'Unexplained & Emerging Tech',
    voice: 'skeptical but credible, evidence-first, not conspiracy-adjacent',
    search_queries: [
      'UAP disclosure news today 2026', 'AARO UFO news today',
      'DeFi crypto hack news today', 'blockchain enforcement SEC 2026',
      'unexplained phenomenon news today',
    ],
    category: 'Unexplained',
    category_slug: 'unexplained',
  },
  rafael_reyes: {
    name: 'Rafael Reyes', slug: 'rafael-reyes',
    beat: 'Conflict & Emerging Wars',
    credential: 'War correspondent, 11 years covering unreported conflicts',
    role: 'Conflict & Emerging Wars',
    voice: 'unflinching, ground-level, covers wars mainstream media ignores',
    search_queries: [
      'China military news today 2026', 'Sudan conflict news today',
      'Myanmar war news today', 'Sahel conflict news today',
      'Taiwan Strait military news today',
    ],
    category: 'Conflict & Wars',
    category_slug: 'conflict-wars',
  },
  jordan_ames: {
    name: 'Jordan Ames', slug: 'jordan-ames',
    beat: 'Government Benefits Fraud & Financial Crime',
    credential: 'Former federal fraud investigator, 9 years tracking benefits fraud',
    role: 'Financial Fraud & Crime',
    voice: 'data-driven, follows the money to the shell company, document-obsessed',
    search_queries: [
      'Medicaid fraud indictment today 2026', 'Medicare fraud DOJ today',
      'hospice fraud news today', 'SNAP food stamp fraud news today',
      'DOJ wire fraud indictment today',
    ],
    category: 'Financial Fraud',
    category_slug: 'financial-fraud',
  },
  vera_solano: {
    name: 'Vera Solano', slug: 'vera-solano',
    beat: 'Metaphysical & Consciousness',
    credential: 'Consciousness researcher and experiencer journalist',
    role: 'Metaphysical & Consciousness',
    voice: 'open-minded, experiential, takes the subject seriously without demanding proof',
    search_queries: [
      'near death experience research news 2026', 'consciousness science news today',
      'UAP experiencer news today', 'remote viewing declassified news',
      'ET contact news today 2026',
    ],
    category: 'Unexplained',
    category_slug: 'unexplained',
  },
};

// ── State management ──────────────────────────────────────────────
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')); }
  catch { return { lastRun: {}, published: [] }; }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function selectAuthor(authorArg) {
  if (authorArg && AUTHORS[authorArg]) return AUTHORS[authorArg];
  // Rotate through authors by day of week + hour
  const keys = Object.keys(AUTHORS);
  const idx = (new Date().getDay() * 3 + Math.floor(new Date().getHours() / 8)) % keys.length;
  return AUTHORS[keys[idx]];
}

function slugify(title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function estimateReadTime(text) {
  return Math.max(4, Math.ceil(text.split(/\s+/).length / 200)) + ' min read';
}

// ── Claude API with web search ────────────────────────────────────
async function findAndWriteArticle(author) {
  const query = author.search_queries[Math.floor(Math.random() * author.search_queries.length)];
  LOG(`${author.name} searching: "${query}"`);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 6000,
      tools: [{
        type: 'web_search_20250305',
        name: 'web_search',
      }],
      system: `You are ${author.name}, ${author.credential}, writing for NewsAnarchist.com — an independent investigative news site with 128,000+ monthly pageviews and DR 75. Your beat: ${author.beat}. Your voice: ${author.voice}.

You will search the web for today's most important story on your beat, then write an original 800-1,200 word article about it. The article must be genuinely newsworthy — not advice, not opinion without news, not personal stories. It must be about a real, verifiable recent event or development.

Return ONLY valid JSON, no preamble, no markdown fences:
{
  "title": "Compelling headline under 80 chars",
  "lede": "One devastating sentence that states the core revelation",
  "body": "800-1200 word article body in plain text paragraphs separated by double newlines. No markdown. Include specific facts, names, dollar amounts, dates. Write in your voice.",
  "the_take": "150-200 word first-person editorial take. State your thesis. Name who wins if nothing changes.",
  "source_url": "Primary source URL used",
  "source_name": "Name of primary source",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "eic_worthy": true or false,
  "image_prompt": "A specific, detailed image generation prompt that visually represents this exact story. Written for fal.ai flux/dev. Must be: wide landscape format, photorealistic, no text, no faces, no people. Capture the mood and subject of THIS specific story — not generic news photography. Include lighting direction, color palette, and specific visual elements that match the story's content and the author's visual identity."
}`,
      messages: [{
        role: 'user',
        content: `Search for today's most important story about: ${query}\n\nBeat: ${author.beat}\nToday's date: ${new Date().toISOString().slice(0, 10)}\n\nFind a real, recent, verifiable story. Then write the full article as described.`,
      }],
    }),
  });

  if (!response.ok) throw new Error(`Claude API error: ${response.status}`);
  const data = await response.json();

  // Extract text from response (may include tool use blocks)
  const textBlocks = data.content.filter(b => b.type === 'text');
  const raw = textBlocks.map(b => b.text).join('');

  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    // Find JSON — from first { to last }
    const start = cleaned.indexOf('{');
    const end   = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No JSON object found');
    const jsonStr = cleaned.slice(start, end + 1);
    return JSON.parse(jsonStr);
  } catch (e) {
    LOG(`JSON parse error: ${e.message}`);
    LOG(`Raw response: ${raw.slice(0, 300)}`);
    return null;
  }
}

// ── EIC post-publish review ───────────────────────────────────────
async function eicReview(article, author) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system:     `You are the Editor-in-Chief of NewsAnarchist.com — an independent investigative news site. Today's date is ${new Date().toISOString().slice(0,10)}. Review this article. Return ONLY valid JSON: {"approve": true/false, "reason": "one sentence"}

APPROVE if the article:
- Covers a real, recent news event or development
- Is on-beat for this author
- Has at least one specific fact (name, date, amount, institution)
- Cites a real source (government, court, news outlet, official statement)

REJECT only if the article:
- Is clearly fabricated with no real-world basis
- Is pure advice/opinion with zero news hook
- Is completely off-beat (e.g. lifestyle article from a surveillance reporter)
- Has no sources at all

Do NOT reject because sources are classified, because claims are disputed, or because you cannot personally verify government statements. Investigative journalism reports on what sources say — verification is the reader's responsibility.`,
      messages: [{
        role: 'user',
        content: `Author: ${author.name} (${author.beat})
Title: ${article.title}
Lede: ${article.lede || ''}
Source: ${article.source_name || ''} — ${article.source_url || ''}
Body (first 800 chars): ${(article.body || '').slice(0, 800)}
EIC worthy flag: ${article.eic_worthy}`,
      }],
    }),
  });

  if (!response.ok) return { approve: true, reason: 'EIC check failed — defaulting to approve' };
  const data = await response.json();
  const raw = data.content?.[0]?.text ?? '{}';
  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch {
    return { approve: true, reason: 'EIC parse error — defaulting to approve' };
  }
}

// ── Build article HTML ────────────────────────────────────────────
function buildHTML(article, author, pubDate) {
  const slug      = `${pubDate.slice(0, 10)}-${slugify(article.title)}`;
  const dateISO   = pubDate;
  const dateDisp  = formatDate(dateISO);
  const artUrl    = `${SITE_URL}/articles/${slug}.html`;
  const readTime  = estimateReadTime(article.body || '');
  const catSlug   = author.category_slug;
  const category  = author.category;
  const imgPath   = path.join(IMAGES_DIR, slug + '.webp');
  const hasImage  = fs.existsSync(imgPath);

  const bodyHTML = (article.body || '')
    .split('\n\n')
    .filter(p => p.trim().length > 10)
    .map(p => `<p>${p.trim()}</p>`)
    .join('\n');

  const takeHTML = article.the_take ? `
<div class="author-take-box" style="background:#fef2f2;border-left:4px solid #dc2626;border-radius:0 8px 8px 0;padding:24px 28px;margin:40px 0;">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
    <img src="/images/authors/${author.slug}.webp" alt="${author.name}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid #dc2626;" onerror="this.src='/images/authors/${author.slug}.jpg'">
    <div>
      <div style="font-size:0.75rem;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:.08em;">The ${author.name} Take</div>
      <div style="font-size:0.8rem;color:#666;">${author.beat}</div>
    </div>
  </div>
  <p style="font-family:'Source Serif 4',serif;font-size:1rem;line-height:1.75;color:#333;margin:0;">${article.the_take}</p>
</div>` : '';

  const imageHTML = hasImage
    ? `<img src="/images/articles/${slug}.webp" alt="${article.title}" style="width:100%;height:auto;border-radius:4px;display:block;margin-bottom:24px;" loading="lazy">`
    : `<div style="width:100%;height:280px;border-radius:4px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);margin-bottom:24px;"><span style="color:#dc2626;font-size:0.9rem;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;border:2px solid #dc2626;padding:10px 24px;">ORIGINAL REPORTING</span></div>`;

  const sourceHTML = article.source_url ? `
<div style="background:#f5f4f0;border:1px solid #e5e3de;padding:14px 18px;margin:32px 0;font-size:12px;color:#666;">
  <strong>Primary source:</strong> <a href="${article.source_url}" rel="noopener noreferrer nofollow" target="_blank" style="color:#dc2626;">${article.source_name || article.source_url}</a><br>
  Cross-reference independently — don't take our word for it.
</div>` : '';

  const navLinks = [
    ['/', 'Home'],
    ['/category/surveillance-state.html', 'Surveillance State'],
    ['/category/corporate-watchdog.html', 'Corporate Watchdog'],
    ['/category/government-secrets.html', "Gov't Secrets"],
    ['/category/tech-privacy.html', 'Tech & Privacy'],
    ['/category/global-power.html', 'Global Power'],
    ['/category/money-markets.html', 'Money & Markets'],
    ['/category/financial-fraud.html', 'Financial Fraud'],
    ['/category/conflict-wars.html', 'Conflict & Wars'],
    ['/category/unexplained.html', 'Unexplained'],
    ['/category/true-crime.html', 'True Crime'],
    ['/trending.html', 'Trending'],
  ].map(([href, label]) => `<a href="${href}">${label}</a>`).join('\n');

  return {
    slug,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${article.title} — NewsAnarchist</title>
<meta name="description" content="${article.lede || article.title}">
<meta name="keywords" content="${(article.keywords || []).join(', ')}">
<meta property="og:title" content="${article.title}">
<meta property="og:description" content="${article.lede || article.title}">
<meta property="og:url" content="${artUrl}">
<meta property="og:image" content="${SITE_URL}/images/articles/${slug}.webp">
<meta property="og:type" content="article">
<meta property="article:section" content="${category}">
<meta property="article:published_time" content="${dateISO}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${article.title}">
<meta name="twitter:description" content="${article.lede || article.title}">
<meta name="twitter:image" content="${SITE_URL}/images/articles/${slug}.webp">
<link rel="icon" href="/images/favicon.ico">
<link rel="canonical" href="${artUrl}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'DM Sans',system-ui,sans-serif;background:#F5F4F0;color:#111;line-height:1.5;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
.na-mast{background:#fff;border-bottom:3px solid #111}.na-mast-inner{max-width:1200px;margin:0 auto;padding:12px 20px;display:flex;align-items:center;justify-content:space-between}
.na-wm{font-family:'DM Sans',sans-serif;font-size:26px;font-weight:700;color:#111}.na-wm em{color:#E11D48;font-style:normal}
.na-tgl{font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:#999;margin-top:3px}
.na-sbtn{background:#E11D48;color:#fff;border:none;padding:9px 20px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;cursor:pointer}
.na-nav{background:#111}.na-nav-inner{max-width:1200px;margin:0 auto;display:flex;flex-wrap:wrap}
.na-nav-inner a{font-size:10px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#999;padding:8px 10px;white-space:nowrap}
.na-nav-inner a:hover{color:#fff}
.art-wrap{max-width:860px;margin:32px auto;padding:0 20px 48px}
.art-cat{font-size:9px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#E11D48;margin-bottom:8px}
.art-hed{font-family:'DM Sans',sans-serif;font-size:2rem;font-weight:700;line-height:1.2;color:#111;margin-bottom:12px}
.art-dek{font-family:'Source Serif 4',serif;font-size:1.1rem;color:#444;line-height:1.6;border-left:4px solid #E11D48;padding-left:16px;margin:0 0 20px;font-style:italic}
.art-meta{display:flex;gap:12px;align-items:center;flex-wrap:wrap;font-size:0.8rem;color:#666;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #e5e3de}
.art-author{display:inline-flex;align-items:center;gap:8px;font-weight:600}
.art-author img{width:30px;height:30px;border-radius:50%;object-fit:cover;border:2px solid #e5e3de}
.art-body{font-family:'Source Serif 4',serif;font-size:1.05rem;line-height:1.85;color:#1a1a1a}
.art-body p{margin-bottom:1.4em}
.na-footer{background:#111;color:#888;padding:24px 20px;margin-top:48px;text-align:center;font-size:11px}
.na-footer a{color:#555;margin:0 8px}
</style>
</head>
<body>
<div class="na-mast"><div class="na-mast-inner">
<div><div class="na-wm"><a href="/">News<em>Anarchist</em></a></div><div class="na-tgl">The stories buried, spiked, or spun.</div></div>
<button class="na-sbtn" onclick="window.location='/subscribe.html'">Subscribe Free</button>
</div></div>
<nav class="na-nav"><div class="na-nav-inner">${navLinks}</div></nav>
<div class="art-wrap">
<div class="art-cat">${category}</div>
<h1 class="art-hed">${article.title}</h1>
${article.lede ? `<p class="art-dek">${article.lede}</p>` : ''}
<div class="art-meta">
  <span class="art-author">
    <img src="/images/authors/${author.slug}.webp" alt="${author.name}" onerror="this.src='/images/authors/${author.slug}.jpg'">
    <a href="/authors/${author.slug}.html">${author.name}</a>
  </span>
  <span>AI-ASSISTED</span>
  <time datetime="${dateISO}">${dateDisp}</time>
  <span>${readTime}</span>
</div>
${imageHTML}
<div class="art-body">
${bodyHTML}
${takeHTML}
${sourceHTML}
<p><em>Disclosure: NewsAnarchist uses AI-assisted reporting with web search. Always verify primary sources linked above.</em></p>
</div>
</div>
<footer class="na-footer">
<a href="/">Home</a><a href="/about.html">About</a><a href="/editorial.html">Editorial Standards</a><a href="/tip-line.html">Tip Line</a><a href="/subscribe.html">Subscribe</a>
<div style="margin-top:12px">&copy; 2026 NewsAnarchist. A Chronic Internet Company.</div>
</footer>
</body>
</html>`,
  };
}

// ── Generate image ────────────────────────────────────────────────
function generateImage(title, slug, imagePrompt) {
  const imgPath = path.join(IMAGES_DIR, slug + '.webp');
  const pngPath = path.join(IMAGES_DIR, slug + '.png');
  if (fs.existsSync(imgPath)) return true;
  try {
    // Use author-written prompt if available, fallback to generic
    const words = title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3).slice(0, 5).join(', ');
    const prompt = imagePrompt ||
      `Editorial news photograph, Reuters AP style, for story about: ${words}. Wide landscape, photorealistic, no text, no faces, bright natural lighting, sharp focus, documentary realism.`;
    execSync(
      `openclaw infer image generate --model fal/fal-ai/flux/dev --prompt "${prompt.replace(/"/g, '\"')}" --size 1024x1024 --output-format webp --output "${imgPath}" --json`,
      { timeout: 120000 }
    );
    // Convert PNG→WebP via ImageMagick if needed
    if (!fs.existsSync(imgPath) && fs.existsSync(pngPath)) {
      execSync(`/usr/local/bin/convert "${pngPath}" -quality 85 "${imgPath}"`, { timeout: 15000 });
      fs.unlinkSync(pngPath);
      LOG(`Converted PNG→WebP: ${slug}`);
    }
    return fs.existsSync(imgPath);
  } catch (e) {
    LOG(`Image failed: ${e.message}`);
    return false;
  }
}

// ── Main ──────────────────────────────────────────────────────────
async function main() {
  const authorArg = process.argv[process.argv.indexOf('--author') + 1];
  const author = selectAuthor(authorArg);

  LOG(`=== Autonomous Author Pipeline ===`);
  LOG(`Author: ${author.name} (${author.beat})`);

  const state = loadState();
  // ── Mason publish-request check ──────────────────────────────────────────
  try {
    const credsRaw = fs.readFileSync(CREDS_PATH, 'utf-8');
    const cfKey   = credsRaw.match(/^CLOUDFLARE_GLOBAL_API_KEY=(.+)$/m)?.[1]?.trim() || credsRaw.match(/^CLOUDFLARE_API_KEY=(.+)$/m)?.[1]?.trim();
    const cfEmail = credsRaw.match(/^CLOUDFLARE_EMAIL=(.+)$/m)?.[1]?.trim();
    const cfAcct  = credsRaw.match(/^CLOUDFLARE_ACCOUNT_ID=(.+)$/m)?.[1]?.trim();
    const kvNs    = '44b94a0518b24cef80342fa37c71bffd';
    const kvBase  = `https://api.cloudflare.com/client/v4/accounts/${cfAcct}/storage/kv/namespaces/${kvNs}`;
    const hdr     = `-H "X-Auth-Email: ${cfEmail}" -H "X-Auth-Key: ${cfKey}"`;
    const raw = execSync(`curl -sL "${kvBase}/values/na%3Apublish-request" ${hdr}`, { encoding: 'utf8', timeout: 10000 });
    const req = JSON.parse(raw);
    if (req?.requestedAt) {
      LOG('Mason publish-request detected — running publish + deploy');
      execSync(`cd ${WORKSPACE} && node scripts/newsanarchist-content.mjs publish`, { stdio: 'inherit', timeout: 180000 });
      const dEnv = Object.assign({}, process.env);
      delete dEnv.CLOUDFLARE_API_TOKEN;
      dEnv.CLOUDFLARE_API_KEY = cfKey; dEnv.CLOUDFLARE_EMAIL = cfEmail; dEnv.CLOUDFLARE_ACCOUNT_ID = cfAcct;
      execSync('npx wrangler@4.93.1 pages deploy . --project-name newsanarchist-website --branch=master --commit-dirty=true', { cwd: `${WORKSPACE}/newsanarchist-website`, env: dEnv, stdio: 'inherit', timeout: 180000 });
      execSync(`curl -sL -X POST "https://api.cloudflare.com/client/v4/zones/2b30983b0c36254440e8262db846a1f8/purge_cache" ${hdr} -H "Content-Type: application/json" --data '{"purge_everything":true}'`, { timeout: 10000 });
      execSync(`curl -sL -X DELETE "${kvBase}/values/na%3Apublish-request" ${hdr}`, { timeout: 10000 });
      LOG('Mason publish-request: completed and cleared');
    }
  } catch(e) { LOG(`Mason publish-request check: ${e.message}`); }

  // Find and write article
  const article = await findAndWriteArticle(author);
  if (!article) {
    LOG('Article generation failed — no valid JSON returned');
    process.exit(1);
  }

  LOG(`Title: ${article.title}`);
  LOG(`EIC worthy: ${article.eic_worthy}`);

  if (!article.eic_worthy) {
    LOG('Article flagged as not EIC-worthy by author — skipping');
    process.exit(0);
  }

  // EIC post-review
  const review = await eicReview(article, author);
  LOG(`EIC review: ${review.approve ? 'APPROVED' : 'REJECTED'} — ${review.reason}`);

  if (!review.approve) {
    LOG('EIC rejected article — not publishing');
    process.exit(0);
  }

  if (DRY) {
    LOG('DRY RUN — would publish:');
    console.log(JSON.stringify({ title: article.title, author: author.name, lede: article.lede }, null, 2));
    process.exit(0);
  }

  // Build and save HTML
  const pubDate = new Date().toISOString();
  const { slug, html } = buildHTML(article, author, pubDate);
  const filepath = path.join(ARTICLES_DIR, slug + '.html');
  fs.writeFileSync(filepath, html);
  LOG(`Saved: articles/${slug}.html`);

  // Generate image
  LOG('Generating image...');
  LOG(`Image prompt: ${(article.image_prompt || 'generic').slice(0, 80)}...`);
  const imgOk = generateImage(article.title, slug, article.image_prompt);
  LOG(`Image: ${imgOk ? 'OK' : 'failed (using fallback)'}`);

  // Update state
  state.lastRun[author.slug] = new Date().toISOString();
  state.published.push({ slug, title: article.title, author: author.slug, at: pubDate });
  if (state.published.length > 500) state.published = state.published.slice(-500);
  saveState(state);

  // Publish
  LOG('Publishing...');
  try {
    execSync(`cd ${WORKSPACE} && node scripts/newsanarchist-content.mjs publish`, {
      stdio: 'inherit', timeout: 180000,
    });
    LOG(`Published: ${SITE_URL}/articles/${slug}.html`);
  } catch (e) {
    LOG(`Publish failed: ${e.message}`);
  }

  LOG('=== Done ===');
}

main().catch(e => {
  console.error(`FATAL: ${e.message}`);
  process.exit(1);
});
