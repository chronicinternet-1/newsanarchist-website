#!/usr/bin/env node
/**
 * NewsAnarchist Interview Article Publisher
 * Polls Cloudflare KV for article_ready interview states
 * Builds HTML, generates image, publishes to site
 *
 * Usage:
 *   node generate-interview-article.mjs          # check all, publish any ready
 *   node generate-interview-article.mjs --dry    # show what would publish
 *
 * Cron: 15 5,11,17,23 * * * (runs after content pipeline)
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE  = path.resolve(__dirname, '..');
const SITE_DIR   = path.join(WORKSPACE, 'newsanarchist-website');
const ARTICLES_DIR = path.join(SITE_DIR, 'articles');
const IMAGES_DIR   = path.join(SITE_DIR, 'images/articles');
const CREDS_PATH   = '/home/ubuntu/.openclaw/secrets/credentials.env';
const SITE_URL     = 'https://newsanarchist.com';
const DRY          = process.argv.includes('--dry');

// Load credentials
const creds = fs.readFileSync(CREDS_PATH, 'utf-8');
const CF_API_KEY   = creds.match(/^CLOUDFLARE_GLOBAL_API_KEY=(.+)$/m)?.[1]?.trim();
const CF_EMAIL     = creds.match(/^CLOUDFLARE_EMAIL=(.+)$/m)?.[1]?.trim();
const CF_ACCOUNT   = '5cba15db85116f1426a122db0c5178fa';
const KV_NS        = '44b94a0518b24cef80342fa37c71bffd';
const X_API_KEY        = creds.match(/^NA_X_API_KEY="(.+)"$/m)?.[1]?.trim();
const X_API_SECRET     = creds.match(/^NA_X_API_SECRET="(.+)"$/m)?.[1]?.trim();
const X_ACCESS_TOKEN   = creds.match(/^NA_X_ACCESS_TOKEN="(.+)"$/m)?.[1]?.trim();
const X_ACCESS_SECRET  = creds.match(/^NA_X_ACCESS_SECRET="(.+)"$/m)?.[1]?.trim();

const LOG = (m) => console.log(`[${new Date().toISOString()}] ${m}`);

// ── Cloudflare KV helpers ─────────────────────────────────────────
async function kvList(prefix) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/storage/kv/namespaces/${KV_NS}/keys?prefix=${encodeURIComponent(prefix)}&limit=100`,
    { headers: { 'X-Auth-Email': CF_EMAIL, 'X-Auth-Key': CF_API_KEY } }
  );
  const data = await res.json();
  return data.result || [];
}

async function kvGet(key) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/storage/kv/namespaces/${KV_NS}/values/${encodeURIComponent(key)}`,
    { headers: { 'X-Auth-Email': CF_EMAIL, 'X-Auth-Key': CF_API_KEY } }
  );
  if (!res.ok) return null;
  const text = await res.text();
  try { return JSON.parse(text); } catch { return null; }
}

async function kvPut(key, value, ttlDays = 90) {
  await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/storage/kv/namespaces/${KV_NS}/values/${encodeURIComponent(key)}?expiration_ttl=${ttlDays * 86400}`,
    {
      method:  'PUT',
      headers: { 'X-Auth-Email': CF_EMAIL, 'X-Auth-Key': CF_API_KEY, 'Content-Type': 'application/json' },
      body:    JSON.stringify(value),
    }
  );
}

// ── Helpers ───────────────────────────────────────────────────────
// ── Post to X via OAuth 1.0a ─────────────────────────────────────────────────
async function postToX(tweetText) {
  const url = 'https://api.twitter.com/2/tweets';
  const method = 'POST';
  const oauthParams = {
    oauth_consumer_key: X_API_KEY,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: X_ACCESS_TOKEN,
    oauth_version: '1.0',
  };
  const sigParams = { ...oauthParams };
  const paramStr = Object.keys(sigParams).sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(sigParams[k])}`)
    .join('&');
  const baseStr = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramStr)}`;
  const sigKey = `${encodeURIComponent(X_API_SECRET)}&${encodeURIComponent(X_ACCESS_SECRET)}`;
  const signature = crypto.createHmac('sha1', sigKey).update(baseStr).digest('base64');
  oauthParams.oauth_signature = signature;
  const authHeader = 'OAuth ' + Object.keys(oauthParams).sort()
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(', ');
  const res = await fetch(url, {
    method,
    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: tweetText }),
  });
  const data = await res.json();
  if (res.ok) {
    LOG(`X post published: ${data.data?.id}`);
    return data.data?.id;
  } else {
    LOG(`X post failed: ${JSON.stringify(data)}`);
    return null;
  }
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function estimateReadTime(text) {
  return Math.max(5, Math.ceil(text.split(/\s+/).length / 200)) + ' min read';
}

// ── Build interview HTML ──────────────────────────────────────────
function buildInterviewHTML(state) {
  const { authorKey, candidate, article, promotion } = state;

  const AUTHOR_MAP = {
    marcus_webb:     { name: 'Marcus Webb',     slug: 'marcus-webb',     beat: 'Surveillance State & Tech Privacy' },
    elena_vasquez:   { name: 'Elena Vasquez',   slug: 'elena-vasquez',   beat: 'Global Power & Geopolitics' },
    jordan_calloway: { name: 'Jordan Calloway', slug: 'jordan-calloway', beat: 'Government Secrets & FOIA' },
    diana_reeves:    { name: 'Diana Reeves',    slug: 'diana-reeves',    beat: 'Corporate Watchdog & Money & Markets' },
    sam_okafor:      { name: 'Sam Okafor',      slug: 'sam-okafor',      beat: 'True Crime & Justice' },
    casey_north:     { name: 'Casey North',     slug: 'casey-north',     beat: 'Unexplained & Emerging Tech' },
    rafael_reyes:    { name: 'Rafael Reyes',    slug: 'rafael-reyes',    beat: 'Conflict & Emerging Wars' },
    jordan_ames:     { name: 'Jordan Ames',     slug: 'jordan-ames',     beat: 'Government Benefits Fraud & Financial Crime' },
    vera_solano:     { name: 'Vera Solano',     slug: 'vera-solano',     beat: 'Metaphysical & Consciousness' },
  };

  const author   = AUTHOR_MAP[authorKey] || { name: authorKey, slug: authorKey, beat: 'Investigative Journalism' };
  const pubDate  = new Date().toISOString();
  const dateDisp = formatDate(pubDate);
  const slug     = `${pubDate.slice(0, 10)}-interview-${slugify(candidate.name)}-${slugify(author.name)}`;
  const artUrl   = `${SITE_URL}/articles/${slug}.html`;
  const hasImage = fs.existsSync(path.join(IMAGES_DIR, slug + '.webp'));

  // Build Q&A HTML
  const qaHTML = (article.qa || []).map((pair, i) => `
<div class="qa-pair" style="margin-bottom:2.5rem;">
  <div class="qa-q" style="font-family:'DM Sans',sans-serif;font-size:1rem;font-weight:700;color:#E11D48;margin-bottom:0.75rem;padding-left:16px;border-left:3px solid #E11D48;">
    Q${i+1}: ${pair.q}
  </div>
  <div class="qa-a" style="font-family:'Source Serif 4',serif;font-size:1.05rem;line-height:1.85;color:#1a1a1a;padding-left:16px;">
    ${pair.a}
  </div>
</div>`).join('\n');

  const takeHTML = article.the_take ? `
<div style="background:#fef2f2;border-left:4px solid #E11D48;border-radius:0 8px 8px 0;padding:24px 28px;margin:40px 0;">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
    <img src="/images/authors/${author.slug}.webp" alt="${author.name}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid #E11D48;" onerror="this.src='/images/authors/${author.slug}.jpg'">
    <div>
      <div style="font-size:0.75rem;font-weight:700;color:#E11D48;text-transform:uppercase;letter-spacing:.08em;">The ${author.name} Take</div>
      <div style="font-size:0.8rem;color:#666;">${author.beat}</div>
    </div>
  </div>
  <div style="font-family:'Source Serif 4',serif;font-size:1rem;line-height:1.75;color:#333;">${article.the_take}</div>
</div>` : '';

  const guestBioHTML = article.guest_bio ? `
<div style="background:#f5f4f0;border:1px solid #e5e3de;padding:20px 24px;margin:32px 0;border-radius:4px;">
  <div style="font-size:0.75rem;font-weight:700;color:#E11D48;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;">About ${candidate.name}</div>
  <div style="font-family:'Source Serif 4',serif;font-size:0.95rem;line-height:1.7;color:#444;">${article.guest_bio}</div>
  ${article.promotion_callout ? `<div style="margin-top:12px;font-size:0.9rem;color:#666;font-style:italic;">${article.promotion_callout}</div>` : ''}
</div>` : '';

  const imageHTML = hasImage
    ? `<img src="/images/articles/${slug}.webp" alt="${article.headline}" style="width:100%;height:auto;border-radius:4px;display:block;margin-bottom:24px;" loading="lazy">`
    : `<div style="width:100%;height:280px;border-radius:4px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);margin-bottom:24px;"><span style="color:#E11D48;font-size:0.9rem;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;border:2px solid #E11D48;padding:10px 24px;">NEWSANARCHIST INTERVIEW</span></div>`;

  const readTime = estimateReadTime((article.intro || '') + (article.the_take || '') + qaHTML);

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

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${article.headline} — NewsAnarchist</title>
<meta name="description" content="${article.subheadline || article.headline}">
<meta property="og:title" content="${article.headline}">
<meta property="og:description" content="${article.subheadline || article.headline}">
<meta property="og:url" content="${artUrl}">
<meta property="og:image" content="${SITE_URL}/images/articles/${slug}.webp">
<meta property="og:type" content="article">
<meta property="article:section" content="Interview">
<meta property="article:published_time" content="${pubDate}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${article.headline}">
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
.interview-badge{display:inline-block;background:#111;color:#fff;font-size:9px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;padding:4px 10px;margin-bottom:12px}
.art-hed{font-family:'DM Sans',sans-serif;font-size:2rem;font-weight:700;line-height:1.2;color:#111;margin-bottom:12px}
.art-dek{font-family:'Source Serif 4',serif;font-size:1.1rem;color:#444;line-height:1.6;border-left:4px solid #E11D48;padding-left:16px;margin:0 0 20px;font-style:italic}
.art-meta{display:flex;gap:12px;align-items:center;flex-wrap:wrap;font-size:0.8rem;color:#666;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #e5e3de}
.art-author{display:inline-flex;align-items:center;gap:8px;font-weight:600}
.art-author img{width:30px;height:30px;border-radius:50%;object-fit:cover;border:2px solid #e5e3de}
.art-body{font-family:'Source Serif 4',serif;font-size:1.05rem;line-height:1.85;color:#1a1a1a}
.art-body p{margin-bottom:1.4em}
.section-label{font-family:'DM Sans',sans-serif;font-size:0.75rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#E11D48;margin:40px 0 16px;padding-bottom:8px;border-bottom:2px solid #E11D48}
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
<div class="interview-badge">NewsAnarchist Interview</div>
<h1 class="art-hed">${article.headline}</h1>
${article.subheadline ? `<p class="art-dek">${article.subheadline}</p>` : ''}
<div class="art-meta">
  <span class="art-author">
    <img src="/images/authors/${author.slug}.webp" alt="${author.name}" onerror="this.src='/images/authors/${author.slug}.jpg'">
    <a href="/authors/${author.slug}.html">${author.name}</a>
  </span>
  <span>with ${candidate.name}</span>
  <span>AI-ASSISTED</span>
  <time datetime="${pubDate}">${dateDisp}</time>
  <span>${readTime}</span>
</div>
${imageHTML}
<div class="art-body">
<div class="section-label">Introduction</div>
${(article.intro || '').split('\n\n').filter(p => p.trim()).map(p => `<p>${p.trim()}</p>`).join('\n')}
<div class="section-label">The Interview</div>
${qaHTML}
${takeHTML}
${guestBioHTML}
<p><em>Disclosure: This interview was conducted via written Q&A. Responses have been lightly edited for clarity. NewsAnarchist uses AI-assisted editorial synthesis.</em></p>
</div>
</div>
<footer class="na-footer">
<a href="/">Home</a><a href="/about.html">About</a><a href="/editorial.html">Editorial Standards</a><a href="/tip-line.html">Tip Line</a><a href="/advertise.html">Advertise</a><a href="/subscribe.html">Subscribe</a>
<div style="margin-top:12px">&copy; 2026 NewsAnarchist. A Chronic Internet Company.</div>
</footer>
</body>
</html>`;

  return { slug, html, pubDate, author };
}

// ── Generate image ────────────────────────────────────────────────
function generateImage(headline, guestName, slug) {
  const imgPath = path.join(IMAGES_DIR, slug + '.webp');
  const pngPath = path.join(IMAGES_DIR, slug + '.png');
  if (fs.existsSync(imgPath)) return true;
  try {
    const prompt = `Editorial interview photograph, newsroom aesthetic, professional journalism. Subject matter: ${headline.slice(0, 100)}. Wide landscape format, photorealistic, documentary style, no faces, no text, professional lighting, neutral background with subtle visual elements suggesting the interview topic.`;
    execSync(
      `openclaw infer image generate --model fal/fal-ai/flux/dev --prompt "${prompt.replace(/"/g, '\\"')}" --size 1024x1024 --output-format webp --output "${imgPath}" --json`,
      { timeout: 120000 }
    );
    if (!fs.existsSync(imgPath) && fs.existsSync(pngPath)) {
      execSync(`/usr/local/bin/convert "${pngPath}" -quality 85 "${imgPath}"`, { timeout: 15000 });
      fs.unlinkSync(pngPath);
    }
    return fs.existsSync(imgPath);
  } catch (e) {
    LOG(`Image failed: ${e.message}`);
    return false;
  }
}

// ── Main ──────────────────────────────────────────────────────────
async function main() {
  LOG('=== Interview Article Publisher ===');

  // List all candidate keys
  const keys = await kvList('candidate:');
  LOG(`Found ${keys.length} candidate keys in KV`);

  const ready = [];
  for (const { name: key } of keys) {
    const state = await kvGet(key);
    if (state?.status === 'article_ready') {
      ready.push({ key, state });
    }
  }

  LOG(`Found ${ready.length} article(s) ready to publish`);

  if (!ready.length) {
    LOG('Nothing to publish — done');
    return;
  }

  for (const { key, state } of ready) {
    const { candidate, article, authorKey } = state;
    LOG(`Processing: ${candidate.name} — "${article.headline}"`);

    if (DRY) {
      LOG(`DRY RUN — would publish: ${article.headline}`);
      console.log(JSON.stringify({
        headline:    article.headline,
        author:      authorKey,
        guest:       candidate.name,
        qa_count:    article.qa?.length,
        has_take:    !!article.the_take,
        has_bio:     !!article.guest_bio,
      }, null, 2));
      continue;
    }

    // Build HTML
    const { slug, html, pubDate, author } = buildInterviewHTML(state);
    const filepath = path.join(ARTICLES_DIR, slug + '.html');
    fs.writeFileSync(filepath, html);
    LOG(`Saved: articles/${slug}.html`);

    // Generate image
    LOG('Generating image...');
    const imgOk = generateImage(article.headline, candidate.name, slug);
    LOG(`Image: ${imgOk ? 'OK' : 'failed (using fallback)'}`);

    // Update KV state
    state.status      = 'published';
    state.publishedAt = pubDate;
    state.articleSlug = slug;
    state.articleUrl  = `${SITE_URL}/articles/${slug}.html`;
    await kvPut(key, state);
    LOG(`KV updated: ${key} → published`);

    // Add this interview to the article manifest BEFORE publishing so the publish step's
    // sitemap.xml + index rebuilds include the interview URL (root cause: interviews wrote HTML
    // but were never in generated-articles.json, so updateSitemap never saw them).
    try {
      const manifestPath = path.join(SITE_DIR, 'generated-articles.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const filename = slug + '.html';
      if (!manifest.some(a => (a.filename === filename) || (a.slug === slug))) {
        manifest.unshift({
          slug, filename,
          title: state.article?.headline || article.headline || slug,
          description: (article.qa?.[0]?.a || article.guest_bio || '').slice(0, 180),
          category: author?.category || 'Interview',
          author: author?.slug || state.authorKey || null,
          generatedAt: pubDate, type: 'interview',
        });
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        LOG(`Manifest +interview: ${filename} (sitemap will include it)`);
      }
    } catch (e) { LOG(`Manifest update failed (sitemap may miss this URL): ${e.message}`); }

    // Publish site (rebuilds sitemap.xml + index/category pages from the manifest, then deploys)
    LOG('Publishing site...');
    try {
      execSync(`cd ${WORKSPACE} && node scripts/newsanarchist-content.mjs publish`, {
        stdio: 'inherit', timeout: 180000,
      });
      LOG(`Live: ${SITE_URL}/articles/${slug}.html`);
    } catch (e) {
      LOG(`Publish failed: ${e.message}`);
    }

    // Post to X — interview articles only, $0.20/URL
    try {
      const authorName = AUTHOR_MAP[state.authorKey]?.name || state.authorKey;
      const headline = state.article?.headline || article.headline;
      const artUrl = state.articleUrl;
      const tweetText = `${headline} — An exclusive interview by ${authorName} | ${artUrl}`;
      const tweetId = await postToX(tweetText.slice(0, 280));
      if (tweetId) {
        state.xTweetId = tweetId;
        await kvPut(key, state);
        LOG(`X post live: https://x.com/newsanarchist/status/${tweetId}`);
      }
    } catch (e) {
      LOG(`X post error: ${e.message}`);
    }

    // Delay between multiple articles
    if (ready.length > 1) await new Promise(r => setTimeout(r, 5000));
  }

  LOG('=== Done ===');
}

main().catch(e => {
  console.error(`FATAL: ${e.message}`);
  process.exit(1);
});
