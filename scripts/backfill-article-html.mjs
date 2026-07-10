#!/usr/bin/env node
/**
 * backfill-article-html.mjs
 *
 * One-time script: regenerates all existing article HTML files using the
 * v2 CSS design system (Fraunces / Source Serif 4 / Inter, new layout classes).
 *
 * Preserves body content, THE TAKE blocks, affiliate links, and internal links
 * extracted from existing HTML. Only the shell (masthead, layout, sidebar,
 * footer, CSS classes) is updated.
 *
 * Run from VPS terminal (NOT via MCP API — backslashes in regex patterns would
 * be corrupted):
 *   node scripts/backfill-article-html.mjs
 *
 * Commits in batches of 200 articles and pushes each batch to master.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_DIR = path.resolve(__dirname, '..');
const ARTICLES_DIR = path.resolve(SITE_DIR, 'articles');
const DB_FILE = path.resolve(SITE_DIR, 'generated-articles.json');
const SITE_URL = 'https://newsanarchist.com';
const GA4_ID = 'G-7N6W04M3XW';
const BATCH_SIZE = 200;

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Surveillance State',
  'Corporate Watchdog',
  'Government Secrets',
  'Tech & Privacy',
  'Global Power',
  'Money & Markets',
  'Unexplained',
  'True Crime',
];

const CATEGORY_SLUGS = {
  'Surveillance State': 'surveillance-state',
  'Corporate Watchdog': 'corporate-watchdog',
  'Government Secrets': 'government-secrets',
  'Tech & Privacy': 'tech-privacy',
  'Global Power': 'global-power',
  'Money & Markets': 'money-markets',
  'Unexplained': 'unexplained',
  'True Crime': 'true-crime',
};

const CATEGORY_AUTHORS = {
  'Surveillance State':  { name: 'Marcus Webb',     slug: 'marcus-webb',     credential: 'Former intelligence contractor' },
  'Tech & Privacy':      { name: 'Marcus Webb',     slug: 'marcus-webb',     credential: 'Former intelligence contractor' },
  'Global Power':        { name: 'Elena Vasquez',   slug: 'elena-vasquez',   credential: 'Former foreign correspondent' },
  'Government Secrets':  { name: 'Jordan Calloway', slug: 'jordan-calloway', credential: 'Investigative journalist' },
  'Corporate Watchdog':  { name: 'Diana Reeves',    slug: 'diana-reeves',    credential: 'Former SEC examiner' },
  'Money & Markets':     { name: 'Diana Reeves',    slug: 'diana-reeves',    credential: 'Former SEC examiner' },
  'True Crime':          { name: 'Sam Okafor',       slug: 'sam-okafor',      credential: 'Former assistant district attorney' },
  'Unexplained':         { name: 'Casey North',     slug: 'casey-north',     credential: 'Science journalist' },
};

const RELATED_PRODUCTS = {
  'Surveillance State': {
    primary:   { url: 'https://www.amazon.com/dp/B079MCPJGH?tag=chronicinte02-20', title: 'CloudValley Webcam Cover Slide', tagline: 'Block your webcam in seconds. No residue, no drama.', type: 'hardware' },
    secondary: { url: 'https://www.amazon.com/dp/B00QRRZ2QM?tag=chronicinte02-20', title: 'PortaPow USB Data Blocker', tagline: 'Charge anywhere without exposing your data.', type: 'hardware' },
  },
  'Corporate Watchdog': {
    primary:   { url: 'https://www.amazon.com/dp/0374279551?tag=chronicinte02-20', title: 'The Chickenshit Club — Jesse Eisinger', tagline: "Why the Justice Department fails to prosecute executives.", type: 'book' },
    secondary: { url: 'https://www.amazon.com/dp/B09N991KVT?tag=chronicinte02-20', title: 'Bonsaii 12-Sheet Cross-Cut Paper Shredder', tagline: 'Destroy documents before they destroy you.', type: 'hardware' },
  },
  'Government Secrets': {
    primary:   { url: 'https://www.amazon.com/dp/1250237238?tag=chronicinte02-20', title: 'Permanent Record — Edward Snowden', tagline: "The insider account of mass surveillance no one wanted published.", type: 'book' },
    secondary: { url: 'https://www.amazon.com/dp/B007H4VT7A?tag=chronicinte02-20', title: 'Baofeng UV-5R Two-Way Radio', tagline: 'When the grid goes down, communication is everything.', type: 'hardware' },
  },
  'Tech & Privacy': {
    primary:   { url: 'https://www.amazon.com/dp/B07HBW2YMT?tag=chronicinte02-20', title: 'YubiKey 5 NFC Security Key', tagline: 'The strongest two-factor authentication available.', type: 'hardware' },
    secondary: { url: 'https://www.amazon.com/dp/B079X31BQD?tag=chronicinte02-20', title: 'Wisdompro Faraday Bag', tagline: 'Block all signals. No tracking, no remote wipe.', type: 'hardware' },
  },
  'Global Power': {
    primary:   { url: 'https://www.amazon.com/dp/0307947211?tag=chronicinte02-20', title: 'The Silk Roads — Peter Frankopan', tagline: 'The real history of the world — and who controls it now.', type: 'book' },
    secondary: { url: 'https://www.amazon.com/dp/B007H4VT7A?tag=chronicinte02-20', title: 'Baofeng UV-5R Two-Way Radio', tagline: 'Emergency comms when infrastructure fails.', type: 'hardware' },
  },
  'Money & Markets': {
    primary:   { url: 'https://www.amazon.com/dp/091298645X?tag=chronicinte02-20', title: 'The Creature from Jekyll Island — G. Edward Griffin', tagline: "The Fed explained. Everything they don't want you to know.", type: 'book' },
    secondary: { url: 'https://www.amazon.com/dp/B09W66VHFH?tag=chronicinte02-20', title: 'Ledger Nano S Plus Crypto Hardware Wallet', tagline: 'Your crypto. Offline. Unconfiscatable.', type: 'hardware' },
  },
  'Unexplained': {
    primary:   { url: 'https://www.amazon.com/dp/0063235560?tag=chronicinte02-20', title: 'Imminent — Luis Elizondo', tagline: 'The Pentagon insider account of UAP disclosure.', type: 'book' },
    secondary: { url: 'https://www.amazon.com/dp/B0CGLZGVWT?tag=chronicinte02-20', title: 'FNIRSI GC-01 Geiger Counter', tagline: "Measure what they tell you isn't there.", type: 'hardware' },
  },
  'True Crime': {
    primary:   { url: 'https://www.amazon.com/dp/0743477154?tag=chronicinte02-20', title: 'Postmortem — Patricia Cornwell', tagline: 'The forensic thriller that launched a genre.', type: 'book' },
    secondary: { url: 'https://www.amazon.com/dp/B008XZTBMW?tag=chronicinte02-20', title: 'HQRP 365nm Forensic Blacklight Flashlight', tagline: 'See what the naked eye misses.', type: 'hardware' },
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAuthor(category) {
  return CATEGORY_AUTHORS[category] || {
    name: 'NewsAnarchist Desk',
    slug: null,
    credential: 'NewsAnarchist Editorial Team',
  };
}

function formatDate(dateStr) {
  const d = new Date(dateStr || Date.now());
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function truncate(str, len) {
  if (!str) return '';
  str = String(str);
  return str.length > len ? str.slice(0, len - 1) + '…' : str;
}

function stripHtml(html) {
  if (!html) return '';
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
  text = text.replace(/https?:\/\/\S+/g, '');
  return text.replace(/\s+/g, ' ').trim();
}

function buildSeoTitle(rawTitle) {
  let title = rawTitle.replace(/\s+/g, ' ').trim();
  if (title.length > 70) title = title.slice(0, 67) + '...';
  return title;
}

function buildMetaDescription(title, description) {
  const base = description ? stripHtml(description) : title;
  const clean = base.replace(/\s+/g, ' ').trim();
  if (clean.length >= 150) return clean.slice(0, 177) + '…';
  return truncate(clean + " — NewsAnarchist covers the stories mainstream media won't.", 180);
}

function estimateReadTime(text) {
  const words = text.split(/\s+/).length;
  return Math.max(1, Math.round(words / 200)) + ' min read';
}

function remapArticleCategory(article) {
  const rawCat = article.category || '';
  const text = (article.title + ' ' + (article.description || '')).toLowerCase();

  if (/surveillance|nsa|fbi|cia|wiretap|tracking|facial recognition|biometric|spy|stingray|warrantless|bulk collection|metadata collection/.test(text))
    return 'Surveillance State';
  if (/federal reserve|fed rate|inflation|stock market|wall street|crypto|bitcoin|etf|hedge fund|trillion|gdp|tariff|trade war|economic|market crash|nasdaq|dow jones/.test(text))
    return 'Money & Markets';
  if (/pentagon|classified|leaked|dossier|coup|shadow|deep state|whistleblower|cia document|nsa document|foia|muckrock|blacksite|secret operation/.test(text))
    return 'Government Secrets';
  if (/big tech|google|facebook|meta|apple|amazon|microsoft|tiktok|data breach|hack|algorithm|antitrust|monopoly|censorship|deplatform/.test(text))
    return 'Corporate Watchdog';
  if (/ai |artificial intelligence|cybersecurity|encryption|vpn|surveillance tech|smart home|tracking app|location data|data privacy|signal|proton/.test(text))
    return 'Tech & Privacy';
  if (/nyc|new york city|mayor|governor|commie|communist|socialist|marxist|legislation|city council|city hall|executive order|municipal|borough|alderman/.test(text))
    return 'Government Secrets';
  if (/ufo|uap|unidentified aerial|alien|paranormal|skinwalker|anomalous phenomenon|uap sighting|extraterrestrial|non.human|recovered craft|abduction|roswell|area 51/.test(text))
    return 'Unexplained';
  if (/murder|crime|serial killer|fraud|arrest|indicted|convicted|drug cartel|trafficking|corruption|bribery|scandal|embezzle/.test(text))
    return 'True Crime';
  if (/nato|china|russia|iran|middle east|ukraine|israel|gaza|taiwan|north korea|global|geopolit|troops|sanctions|diplomacy|war/.test(text))
    return 'Global Power';

  if (rawCat.toLowerCase() === 'politics') return 'Government Secrets';
  if (rawCat.toLowerCase() === 'world') return 'Global Power';
  if (rawCat.toLowerCase() === 'tech') return 'Tech & Privacy';
  if (rawCat.toLowerCase() === 'culture') return 'Corporate Watchdog';

  return 'Government Secrets';
}

function extractArticleBody(html) {
  // Try new Version D class first, then old class names
  const patterns = [
    /class="na-article-body"[^>]*>([\s\S]*?)<\/div>\s*(?:<!--|\s*<div class="na-products|<\/article)/,
    /class="article-body"[^>]*>([\s\S]*?)<\/div>\s*(?:<!--|\s*<div class="na-products|<div class="related-products|<\/article)/,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1] && m[1].trim().length > 50) return m[1].trim();
  }
  // Broader fallback: grab everything between the body div open and the products/footer section
  const start = html.search(/class="(?:na-article-body|article-body)"/);
  if (start === -1) return null;
  const openTag = html.indexOf('>', start);
  if (openTag === -1) return null;
  // Find closing landmark
  const landmarks = ['na-products', 'related-products', 'renderRelatedProducts', 'site-footer', 'na-footer'];
  let end = -1;
  for (const lm of landmarks) {
    const idx = html.indexOf(lm, openTag);
    if (idx !== -1 && (end === -1 || idx < end)) end = idx;
  }
  if (end === -1) return null;
  // Walk back to find the closing </div>
  const chunk = html.slice(openTag + 1, end);
  // Remove trailing partial div tags
  const body = chunk.replace(/<div[^>]*>\s*$/, '').trim();
  return body.length > 50 ? body : null;
}

function renderRelatedProducts(category) {
  const prods = RELATED_PRODUCTS[category];
  if (!prods) return '';
  const cards = [prods.primary, prods.secondary].filter(Boolean).map(p => `
    <div class="na-product-card">
      <a href="${p.url}" target="_blank" rel="noopener nofollow sponsored">
        <div class="na-product-type">${p.type || 'book'}</div>
        <div class="na-product-title">${p.title}</div>
        <div class="na-product-tagline">${p.tagline}</div>
        <div class="na-product-cta">View on Amazon →</div>
      </a>
    </div>`).join('');
  return `
  <div class="na-products">
    <div class="na-products-label">From the Anarchist Reading List</div>
    <div class="na-product-cards">${cards}</div>
    <div class="na-affiliate-note">As an Amazon Associate, NewsAnarchist earns from qualifying purchases.</div>
  </div>`;
}

function buildShellHTML(article, extractedBody, sidebarTrendingHTML) {
  const category = remapArticleCategory(article);
  const catSlug = CATEGORY_SLUGS[category] || 'government-secrets';
  const author = getAuthor(category);
  const slug = (article.filename || article.slug || '').replace(/\.html$/, '');
  const dateISO = article.pubDate || new Date().toISOString();
  const dateDisplay = formatDate(dateISO);
  const title = article.title || 'Untitled';
  const description = article.description || '';
  const seoTitle = buildSeoTitle(title);
  const metaDesc = buildMetaDescription(title, description);
  const articleUrl = SITE_URL + '/articles/' + slug;
  const kw = Array.isArray(article.keywords) ? article.keywords : [];
  const keywordsStr = kw.join(', ');

  const rawSubhead = stripHtml(description)
    .replace(/\s+(PBS|Reuters|AP|AFP|BBC|CNN|Fox|MSNBC|NPR|NYT|WSJ|WaPo|Politico|The Hill|Axios|Vox|Vice|BuzzFeed|HuffPost|Guardian|Independent|Telegraph|Daily Mail)[.\ s]*$/i, '')
    .replace(/\s*Submitted by[^.]+\.?/i, '')
    .replace(/\s*By [A-Z][a-z]+ [A-Z][a-z]+\s+of\s+\w+/, '')
    .replace(/^[\s\-\u2013\u2014:,.]+/, '')
    .trim();
  const subheadHTML = (!rawSubhead || rawSubhead.toLowerCase().startsWith(seoTitle.toLowerCase().slice(0, 40)))
    ? ''
    : `<p class="na-article-dek">${rawSubhead}</p>`;

  const hasImage = fs.existsSync(path.join(SITE_DIR, 'images/articles', slug + '.webp'));
  const ogImage = hasImage ? `${SITE_URL}/images/articles/${slug}.webp` : `${SITE_URL}/images/og-default.webp`;
  const heroImageStyle = hasImage
    ? `background-image:url(/images/articles/${slug}.webp);background-size:cover;background-position:center;`
    : 'background:#1a1a2e;';

  const readTime = estimateReadTime(extractedBody);

  const navLinks = CATEGORIES.map(cat => {
    const cs = CATEGORY_SLUGS[cat];
    const active = cat === category ? ' class="active"' : '';
    return `<a href="/category/${cs}.html"${active}>${cat}</a>`;
  }).join('');

  const footerCatLinks = CATEGORIES.map(cat => {
    const cs = CATEGORY_SLUGS[cat];
    return `<a href="/category/${cs}.html">${cat}</a>`;
  }).join('');

  const sidebarCatsHTML = CATEGORIES.map((cat, i) => {
    const cs = CATEGORY_SLUGS[cat];
    return `<a href="/category/${cs}.html" class="na-trending-item"><span class="na-trending-num">${i + 1}</span><div class="na-trending-title">${cat}</div></a>`;
  }).join('');

  const nowISO = new Date().toISOString();
  const yearNow = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${seoTitle} \u2014 NewsAnarchist</title>
<meta name="description" content="${metaDesc.replace(/"/g, '&quot;')}">
<meta name="keywords" content="${keywordsStr}">
<meta name="robots" content="max-snippet:-1, max-image-preview:large, max-video-preview:-1">
<link rel="icon" href="/favicon.ico" type="image/x-icon">
<link rel="canonical" href="${articleUrl}">
<link rel="alternate" type="application/rss+xml" title="NewsAnarchist RSS" href="/rss">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Syne:wght@700;800&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap" rel="stylesheet">
<meta property="og:type" content="article">
<meta property="og:title" content="${seoTitle.replace(/"/g, '&quot;')}">
<meta property="og:description" content="${metaDesc.replace(/"/g, '&quot;')}">
<meta property="og:url" content="${articleUrl}">
<meta property="og:image" content="${ogImage}">
<meta property="og:site_name" content="NewsAnarchist">
<meta property="article:published_time" content="${dateISO}">
<meta property="article:author" content="${author.name}">
<meta property="article:section" content="${category}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${seoTitle.replace(/"/g, '&quot;')}">
<meta name="twitter:description" content="${metaDesc.replace(/"/g, '&quot;').slice(0, 180)}">
<meta name="twitter:image" content="${ogImage}">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"NewsArticle","headline":${JSON.stringify(seoTitle)},"description":${JSON.stringify(metaDesc)},"url":"${articleUrl}","datePublished":"${dateISO}","dateModified":"${nowISO}","author":{"@type":"Person","name":"${author.name}","url":"${author.slug ? SITE_URL + '/authors/' + author.slug + '.html' : SITE_URL + '/about.html'}"},"publisher":{"@type":"Organization","name":"NewsAnarchist","logo":{"@type":"ImageObject","url":"${SITE_URL}/images/logo.png"}},"image":{"@type":"ImageObject","url":"${ogImage}","width":1200,"height":630},"articleSection":"${category}","keywords":${JSON.stringify(kw)},"isAccessibleForFree":true}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"${SITE_URL}/"},{"@type":"ListItem","position":2,"name":"${category}","item":"${SITE_URL}/category/${catSlug}.html"},{"@type":"ListItem","position":3,"name":${JSON.stringify(seoTitle)},"item":"${articleUrl}"}]}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"SpeakableSpecification","cssSelector":["h1.na-article-headline",".na-article-lede",".na-take-body"]}</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA4_ID}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA4_ID}');</script>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8570942144538499" crossorigin="anonymous"></script>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'DM Sans',sans-serif;background:#F5F4F0;color:#111111;line-height:1.6;font-size:16px}
a{color:inherit;text-decoration:none}
img{max-width:100%;display:block}
.na-mast{background:#F5F4F0;border-bottom:1px solid #E5E3DE;padding:18px 0 0}
.na-mast-inner{max-width:1200px;margin:0 auto;padding:0 24px}
.na-mast-top{display:flex;align-items:center;justify-content:space-between;padding-bottom:14px}
.na-wm{font-family:'Syne',sans-serif;font-size:28px;font-weight:800;letter-spacing:-0.5px;color:#111}
.na-wm span{color:#E11D48}
.na-tagline{font-size:12px;color:#666;margin-top:2px;letter-spacing:0.02em}
.na-sub-btn{background:#E11D48;color:#fff;border:none;padding:8px 18px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;letter-spacing:0.02em}
.na-sub-btn:hover{background:#c41230}
.na-nav{background:#111;overflow:hidden;position:relative}.na-nav::after{content:'';position:absolute;top:0;right:0;bottom:0;width:28px;background:linear-gradient(to right,transparent,#111);pointer-events:none;z-index:2}
.na-nav-inner{max-width:1200px;margin:0 auto;padding:0 24px;display:flex;align-items:center;overflow-x:auto;scrollbar-width:none}
.na-nav-inner::-webkit-scrollbar{display:none}
.na-nav-inner a{color:#fff;font-size:12px;font-weight:500;padding:10px 14px;white-space:nowrap;opacity:0.85;letter-spacing:0.02em;display:block}
.na-nav-inner a:hover,.na-nav-inner a.active{opacity:1;color:#E11D48}
.na-ticker{background:#E11D48;color:#fff;overflow:hidden;height:32px;display:flex;align-items:center}
.na-ticker-label{background:#a00;font-size:10px;font-weight:700;letter-spacing:0.1em;padding:0 14px;white-space:nowrap;height:100%;display:flex;align-items:center}
.na-ticker-track{display:flex;animation:na-scroll 40s linear infinite;white-space:nowrap}
.na-ticker-track:hover{animation-play-state:paused}
.na-ticker-item{font-size:12px;font-weight:500;padding:0 32px}
@keyframes na-scroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
.na-layout{max-width:1200px;margin:0 auto;padding:32px 24px;display:grid;grid-template-columns:1fr 300px;gap:40px;align-items:start}
@media(max-width:768px){.na-layout{grid-template-columns:1fr;padding:16px}}
.na-article{max-width:720px}
.na-article-cat{font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#E11D48;display:block;margin-bottom:12px}
.na-article-headline{font-family:'DM Sans',sans-serif;font-size:clamp(24px,4vw,40px);font-weight:700;line-height:1.15;letter-spacing:-0.5px;color:#111;margin-bottom:16px}
.na-article-dek{font-size:18px;color:#444;line-height:1.5;margin-bottom:20px}
.na-byline{display:flex;align-items:center;gap:12px;padding:16px 0;border-top:1px solid #E5E3DE;border-bottom:1px solid #E5E3DE;margin-bottom:24px}
.na-byline-avatar{width:44px;height:44px;border-radius:50%;background-size:cover;background-position:center;flex-shrink:0;border:2px solid #E5E3DE}
.na-byline-name{font-size:14px;font-weight:600;color:#111}
.na-byline-name a{color:#111}
.na-byline-name a:hover{color:#E11D48}
.na-byline-role{font-size:12px;color:#666;margin-top:2px}
.na-byline-meta{font-size:12px;color:#888;margin-left:auto;white-space:nowrap}
.na-hero-img{width:100%;height:420px;background:#ccc no-repeat center/cover;margin-bottom:28px}
@media(max-width:768px){.na-hero-img{height:220px}}
.na-article-body{font-family:'Source Serif 4',serif;font-size:18px;line-height:1.72;color:#111;max-width:680px}
.na-article-body p{margin-bottom:1.4em}
.na-article-body h2{font-family:'DM Sans',sans-serif;font-size:22px;font-weight:700;margin:2em 0 0.7em;color:#111}
.na-article-body h3{font-family:'DM Sans',sans-serif;font-size:18px;font-weight:600;margin:1.5em 0 0.5em}
.na-article-body blockquote{border-left:3px solid #E11D48;padding-left:20px;margin:1.5em 0;color:#444;font-style:italic}
.na-article-body a,.na-ilink{color:#E11D48;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:2px}
.na-article-body strong{font-weight:600}
.the-take{background:#111;color:#fff;padding:24px 28px;margin:32px 0;border-left:4px solid #E11D48}
.the-take-label{font-size:10px;font-weight:700;letter-spacing:0.12em;color:#E11D48;text-transform:uppercase;margin-bottom:10px}
.the-take-body{font-family:'Source Serif 4',serif;font-size:16px;line-height:1.65;color:#eee}
.na-products{margin:40px 0 32px;padding-top:24px;border-top:1px solid #E5E3DE}
.na-products-label{font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#888;margin-bottom:16px}
.na-product-cards{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:600px){.na-product-cards{grid-template-columns:1fr}}
.na-product-card{border:1px solid #E5E3DE;padding:16px;background:#fff}
.na-product-card a{display:block;color:#111}
.na-product-card a:hover .na-product-title{color:#E11D48}
.na-product-type{font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#E11D48;margin-bottom:6px}
.na-product-title{font-size:14px;font-weight:600;line-height:1.3;margin-bottom:6px}
.na-product-tagline{font-size:12px;color:#666;line-height:1.4;margin-bottom:10px}
.na-product-cta{font-size:12px;font-weight:600;color:#E11D48}
.na-affiliate-note{font-size:11px;color:#999;margin-top:12px}
.na-sidebar{display:flex;flex-direction:column;gap:24px;position:sticky;top:24px}
@media(max-width:768px){.na-sidebar{position:static}}
.na-sidebar-widget{border:1px solid #E5E3DE;background:#fff;overflow:hidden}
.na-widget-header{background:#111;color:#fff;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:10px 16px}
.na-widget-body{padding:16px}
.na-email-text{font-size:13px;color:#555;margin-bottom:12px;line-height:1.5}
.na-email-input{width:100%;padding:9px 12px;border:1px solid #E5E3DE;font-family:'DM Sans',sans-serif;font-size:14px;outline:none;background:#F5F4F0;margin-bottom:8px}
.na-email-input:focus{border-color:#E11D48}
.na-btn-subscribe{width:100%;background:#E11D48;color:#fff;border:none;padding:10px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;cursor:pointer}
.na-btn-subscribe:hover{background:#c41230}
.na-email-disclaimer{font-size:11px;color:#999;margin-top:8px}
.na-trending-item,.trending-item{display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid #F5F4F0;color:#111;text-decoration:none}
.na-trending-item:last-child,.trending-item:last-child{border-bottom:none}
.na-trending-num,.trending-num{font-size:18px;font-weight:700;color:#E5E3DE;flex-shrink:0;line-height:1;min-width:24px}
.na-trending-title,.trending-title{font-size:13px;font-weight:500;line-height:1.3}
.na-trending-count,.trending-count{font-size:11px;color:#999;margin-top:3px}
.na-trending-item:hover .na-trending-title,.trending-item:hover .trending-title{color:#E11D48}
.na-footer{background:#111;color:#ccc;padding:48px 24px 32px;margin-top:64px}
.na-footer-inner{max-width:1200px;margin:0 auto}
.na-footer-wm{font-family:'Syne',sans-serif;font-size:24px;font-weight:800;color:#fff;margin-bottom:8px}
.na-footer-wm span{color:#E11D48}
.na-footer-tagline{font-size:13px;color:#888;margin-bottom:32px}
.na-footer-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:32px;margin-bottom:32px}
@media(max-width:768px){.na-footer-grid{grid-template-columns:repeat(2,1fr);gap:20px}}
.na-footer-col-title{font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#fff;margin-bottom:12px}
.na-footer-col a{display:block;font-size:13px;color:#888;margin-bottom:8px}
.na-footer-col a:hover{color:#E11D48}
.na-footer-legal{font-size:12px;color:#555;border-top:1px solid #222;padding-top:24px;line-height:1.6}
</style>
</head>
<body>
<header class="na-mast">
  <div class="na-mast-inner">
    <div class="na-mast-top">
      <div>
        <a href="/" class="na-wm">News<span>Anarchist</span></a>
        <div class="na-tagline">The stories buried, spiked, or spun.</div>
      </div>
      <button class="na-sub-btn" onclick="document.getElementById('na-subscribe-anchor').scrollIntoView({behavior:'smooth'})">Subscribe Free</button>
    </div>
  </div>
  <nav class="na-nav">
    <div class="na-nav-inner">
      <a href="/">Home</a>
      ${navLinks}
      <a href="/trending.html">Trending</a>
      <a href="/buried-week.html">The Buried Week</a>
    </div>
  </nav>
</header>
<div class="na-ticker">
  <div class="na-ticker-label">BREAKING</div>
  <div class="na-ticker-track">
    <span class="na-ticker-item">Independent investigative news \u2014 unfiltered, unspiked.</span>
    <span class="na-ticker-item">The Buried Week publishes every Friday.</span>
    <span class="na-ticker-item">Subscribe free for the daily briefing.</span>
    <span class="na-ticker-item">Tips: zeno@newsanarchist.com or Signal.</span>
    <span class="na-ticker-item">Independent investigative news \u2014 unfiltered, unspiked.</span>
    <span class="na-ticker-item">The Buried Week publishes every Friday.</span>
    <span class="na-ticker-item">Subscribe free for the daily briefing.</span>
    <span class="na-ticker-item">Tips: zeno@newsanarchist.com or Signal.</span>
  </div>
</div>
<div class="na-layout">
  <main>
    <article class="na-article">
      <span class="na-article-cat">${category}</span>
      <h1 class="na-article-headline">${title}</h1>
      ${subheadHTML}
      <div class="na-byline">
        ${author.slug ? '<div class="na-byline-avatar" style="background-image:url(/images/authors/' + author.slug + '.webp);"></div>' : ''}
        <div>
          ${author.slug ? '<div class="na-byline-name"><a href="/authors/' + author.slug + '.html">' + author.name + '</a></div>' : '<div class="na-byline-name">' + author.name + '</div>'}
          <div class="na-byline-role">${author.credential || ''}</div>
        </div>
        <div class="na-byline-meta">${dateDisplay} &middot; ${readTime}</div>
      </div>
      <div class="na-hero-img" style="${heroImageStyle}" role="img" aria-label="${seoTitle}"></div>
      <div class="na-article-body">
        ${extractedBody}
      </div>
      ${renderRelatedProducts(category)}
    </article>
  </main>
  <aside class="na-sidebar">
    <div class="na-sidebar-widget" id="na-subscribe-anchor">
      <div class="na-widget-header">Daily Briefing</div>
      <div class="na-widget-body">
        <div class="na-email-text">The stories buried, spiked, or spun. Every morning &mdash; free.</div>
        <form onsubmit="naSubmitEmail(event)">
          <input type="email" id="na-sidebar-email" class="na-email-input" placeholder="your@email.com" required>
          <button type="submit" id="na-sidebar-btn" class="na-btn-subscribe">Subscribe Free</button>
        </form>
        <div class="na-email-disclaimer">Unsubscribe anytime.</div>
      </div>
    </div>
    <div class="na-sidebar-widget">
      <div class="na-widget-header">Trending Now</div>
      <div class="na-widget-body">${sidebarTrendingHTML}</div>
    </div>
    <div class="na-sidebar-widget">
      <div class="na-widget-header">Browse Categories</div>
      <div class="na-widget-body">${sidebarCatsHTML}</div>
    </div>
  </aside>
</div>
<footer class="na-footer">
  <div class="na-footer-inner">
    <div class="na-footer-wm">News<span>Anarchist</span></div>
    <div class="na-footer-tagline">Independent investigative news. AI-assisted editorial voices. Facts first.</div>
    <div class="na-footer-grid">
      <div class="na-footer-col">
        <div class="na-footer-col-title">Coverage</div>
        ${footerCatLinks}
      </div>
      <div class="na-footer-col">
        <div class="na-footer-col-title">Site</div>
        <a href="/about.html">About</a>
        <a href="/editorial.html">Editorial Standards</a>
        <a href="/about-our-authors.html">Our Authors</a>
        <a href="/tip-line.html">Tip Line</a>
        <a href="/advertise.html">Advertise</a>
        <a href="/trending.html">Trending</a>
        <a href="/buried-week.html">The Buried Week</a>
      </div>
      <div class="na-footer-col">
        <div class="na-footer-col-title">Legal</div>
        <a href="/privacy.html">Privacy Policy</a>
        <a href="/terms.html">Terms of Service</a>
        <a href="/dmca.html">DMCA</a>
      </div>
      <div class="na-footer-col">
        <div class="na-footer-col-title">Subscribe</div>
        <a href="/subscribe.html">All Plans</a>
        <a href="/subscribe.html">Subscribe</a>
        <a href="/rss">RSS Feed</a>
      </div>
    </div>
    <div class="na-footer-legal">&copy; ${yearNow} NewsAnarchist. All rights reserved. AI-assisted editorial content disclosed in bylines. As an Amazon Associate, we earn from qualifying purchases.</div>
  </div>
</footer>
<script>
async function naSubmitEmail(e) {
  e.preventDefault();
  const email = document.getElementById('na-sidebar-email').value;
  const btn = document.getElementById('na-sidebar-btn');
  btn.textContent = 'Subscribing...';
  btn.disabled = true;
  try {
    const res = await fetch('https://brevo-subscribe.steve-5cb.workers.dev', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email, source: 'newsanarchist-sidebar'})
    });
    const data = await res.json();
    if (data.success) { btn.textContent = '\u2713 Subscribed!'; }
    else { btn.textContent = 'Try again'; btn.disabled = false; }
  } catch(err) { btn.textContent = 'Try again'; btn.disabled = false; }
}
</script>
</body>
</html>`;
}



function gitCommitAndPush(batchNum, count) {
  try {
    execSync('git add articles/', { cwd: SITE_DIR, stdio: 'pipe' });
    const msg = `backfill: restyle articles batch ${batchNum} (${count} articles) to CSS v2`;
    execSync(`git commit -m "${msg}"`, { cwd: SITE_DIR, stdio: 'pipe' });
    console.log(`  Committed batch ${batchNum}`);
    let pushed = false;
    for (let attempt = 1; attempt <= 4 && !pushed; attempt++) {
      try {
        execSync('git push -u origin master', { cwd: SITE_DIR, stdio: 'pipe' });
        pushed = true;
        console.log(`  Pushed batch ${batchNum} to master`);
      } catch (pushErr) {
        if (attempt < 4) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`  Push attempt ${attempt} failed, retrying in ${delay / 1000}s...`);
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay);
        } else {
          console.error(`  Push failed after 4 attempts for batch ${batchNum}:`, pushErr.message);
        }
      }
    }
  } catch (err) {
    if (err.message && err.message.includes('nothing to commit')) {
      console.log(`  Batch ${batchNum}: nothing to commit, skipping.`);
    } else {
      console.error(`  Git error on batch ${batchNum}:`, err.message);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Reading generated-articles.json...');
  const rawDb = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  const allArticles = Array.isArray(rawDb) ? rawDb : [];

  // De-duplicate by filename, keeping the last entry (most complete data)
  const byFilename = new Map();
  for (const a of allArticles) {
    if (a.filename) byFilename.set(a.filename, a);
  }
  const articles = Array.from(byFilename.values());
  console.log(`Found ${articles.length} unique articles (${allArticles.length} total entries).`);

  // Build sidebar trending HTML once (reused across all articles)
  let sidebarTrendingHTML = '';
  try {
    const recent = allArticles.slice(-7).reverse();
    sidebarTrendingHTML = recent.map((a, i) => {
      const sl = a.filename || a.slug || '';
      const ti = (a.title || 'Article').slice(0, 60);
      const rd = (Math.floor(Math.random() * 30 + 5)) + '.' + Math.floor(Math.random() * 9) + 'K reads';
      return `<a href="/articles/${sl}" class="trending-item"><span class="trending-num">${i + 1}</span><div><div class="trending-title">${ti}</div><div class="trending-count">${rd}</div></div></a>`;
    }).join('');
  } catch (e) {
    sidebarTrendingHTML = CATEGORIES.map((cat, i) => {
      const cSlug = CATEGORY_SLUGS[cat] || 'government-secrets';
      return `<a href="/category/${cSlug}.html" class="trending-item"><span class="trending-num">${i + 1}</span><div><div class="trending-title">${cat}</div></div></a>`;
    }).join('');
  }

  let processed = 0;
  let skipped = 0;
  let batchNum = 0;
  let batchCount = 0;

  for (let idx = 0; idx < articles.length; idx++) {
    const article = articles[idx];
    const filename = article.filename;
    if (!filename) { skipped++; continue; }

    const filePath = path.join(ARTICLES_DIR, filename);
    if (!fs.existsSync(filePath)) { skipped++; continue; }

    let existingHtml;
    try {
      existingHtml = fs.readFileSync(filePath, 'utf8');
    } catch (e) {
      console.warn(`  WARN: Could not read ${filename}: ${e.message}`);
      skipped++;
      continue;
    }

    const extractedBody = extractArticleBody(existingHtml);
    if (extractedBody === null) {
      console.warn(`  WARN: No article-body found in ${filename}, skipping.`);
      skipped++;
      continue;
    }

    let newHtml;
    try {
      newHtml = buildShellHTML(article, extractedBody, sidebarTrendingHTML);
    } catch (e) {
      console.warn(`  WARN: Failed to build HTML for ${filename}: ${e.message}`);
      skipped++;
      continue;
    }

    fs.writeFileSync(filePath, newHtml, 'utf8');
    processed++;
    batchCount++;

    if ((idx + 1) % 100 === 0 || idx === articles.length - 1) {
      console.log(`  Progress: ${idx + 1}/${articles.length} (processed: ${processed}, skipped: ${skipped})`);
    }

    if (batchCount >= BATCH_SIZE || idx === articles.length - 1) {
      batchNum++;
      gitCommitAndPush(batchNum, batchCount);
      batchCount = 0;
    }
  }

  console.log(`\nDone. Processed: ${processed}, Skipped: ${skipped}, Batches: ${batchNum}`);
}

main().catch(err => { console.error(err); process.exit(1); });
