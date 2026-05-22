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
const SITE_DIR = '/home/user/newsanarchist-website';
const ARTICLES_DIR = path.join(SITE_DIR, 'articles');
const DB_PATH = path.join(SITE_DIR, 'generated-articles.json');
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

function renderRelatedProducts(category) {
  const products = RELATED_PRODUCTS[category] || RELATED_PRODUCTS['Government Secrets'];
  const { primary, secondary } = products;
  const typeLabel = (type) => type === 'book' ? 'Book' : type === 'hardware' ? 'Tool' : 'Resource';
  return `          <!-- RELATED PRODUCTS -->
          <section class="related-products content-section" style="margin:32px 0;padding:24px;background:#fafafa;border:1px solid #e5e5e5;border-radius:8px;">
            <h3 style="font-size:0.75rem;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:.08em;margin-bottom:16px;">Recommended Reading &amp; Tools</h3>
            <div class="card-grid" style="gap:16px;">
              <a href="${primary.url}" target="_blank" rel="noopener nofollow sponsored" class="card" style="border:1px solid #e5e5e5;border-radius:6px;padding:16px;text-decoration:none;display:block;background:#fff;">
                <div class="card-body">
                  <span class="genre-label" style="background:#fef2f2;color:#dc2626;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">${typeLabel(primary.type)} &middot; Amazon</span>
                  <h4 style="font-size:0.95rem;font-weight:700;color:#1a1a1a;margin:8px 0 6px;line-height:1.3;">${primary.title}</h4>
                  <p style="color:#666;font-size:0.85rem;margin:0 0 10px;line-height:1.5;">${primary.tagline}</p>
                  <div style="font-size:0.8rem;color:#dc2626;font-weight:600;">View on Amazon &rarr;</div>
                </div>
              </a>
              <a href="${secondary.url}" target="_blank" rel="noopener nofollow sponsored" class="card" style="border:1px solid #e5e5e5;border-radius:6px;padding:16px;text-decoration:none;display:block;background:#fff;">
                <div class="card-body">
                  <span class="genre-label" style="background:#fef2f2;color:#dc2626;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">${typeLabel(secondary.type)} &middot; Amazon</span>
                  <h4 style="font-size:0.95rem;font-weight:700;color:#1a1a1a;margin:8px 0 6px;line-height:1.3;">${secondary.title}</h4>
                  <p style="color:#666;font-size:0.85rem;margin:0 0 10px;line-height:1.5;">${secondary.tagline}</p>
                  <div style="font-size:0.8rem;color:#dc2626;font-weight:600;">View on Amazon &rarr;</div>
                </div>
              </a>
            </div>
            <p style="margin-top:12px;font-size:0.75rem;color:#aaa;text-align:center;">As an Amazon Associate, NewsAnarchist earns from qualifying purchases.</p>
          </section>
`;
}

// ─── Body extraction ──────────────────────────────────────────────────────────

/**
 * Extracts the inner content of <div class="article-body"> from existing HTML.
 * Uses depth tracking to handle nested divs correctly.
 * Returns the raw inner HTML string, or null if the marker is not found.
 */
function extractArticleBody(html) {
  const OPEN_MARKER = '<div class="article-body">';
  const startIdx = html.indexOf(OPEN_MARKER);
  if (startIdx === -1) return null;

  const bodyStart = startIdx + OPEN_MARKER.length;
  let depth = 1;
  let i = bodyStart;

  while (i < html.length && depth > 0) {
    if (html[i] === '<') {
      if (html.startsWith('</div', i)) {
        depth--;
        if (depth === 0) break;
        i += 5;
        continue;
      }
      if (html.startsWith('<div', i)) {
        depth++;
      }
    }
    i++;
  }

  return html.slice(bodyStart, i).trim();
}

// ─── HTML template ────────────────────────────────────────────────────────────

function buildShellHTML(article, extractedBody, sidebarTrendingHTML) {
  const category = remapArticleCategory(article);
  const catSlug = CATEGORY_SLUGS[category] || 'government-secrets';
  const author = getAuthor(category);
  const slug = (article.filename || article.slug || '').replace(/\.html$/, '');
  const filename = article.filename || slug + '.html';
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
    .replace(/^[\s\-–—:,.]+/, '')
    .trim();
  const subheadHTML = (!rawSubhead || rawSubhead.toLowerCase().startsWith(seoTitle.toLowerCase().slice(0, 40)))
    ? ''
    : `<p class="article-dek">${rawSubhead}</p>`;

  const hasImage = fs.existsSync(path.join(SITE_DIR, 'images/articles', slug + '.webp'));
  const ogImage = hasImage ? `${SITE_URL}/images/articles/${slug}.webp` : `${SITE_URL}/images/og-default.webp`;
  const heroImageStyle = hasImage
    ? `background-image:url(/images/articles/${slug}.webp);background-size:cover;background-position:center;`
    : 'background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);';

  const readTime = estimateReadTime(extractedBody);

  const sidebarCategoriesHTML = CATEGORIES.map((cat, i) => {
    const cSlug = CATEGORY_SLUGS[cat] || 'government-secrets';
    return `<a href="/category/${cSlug}.html" class="trending-item"><span class="trending-num">${i + 1}</span><div><div class="trending-title">${cat}</div></div></a>`;
  }).join('');

  const navLinks = CATEGORIES.map(cat => {
    const cs = CATEGORY_SLUGS[cat];
    const active = cat === category ? ' class="active"' : '';
    return `<li><a href="/category/${cs}.html"${active}>${cat}</a></li>`;
  }).join('\n        ');

  const footerCatLinks = CATEGORIES.map(cat => {
    const cs = CATEGORY_SLUGS[cat];
    return `<a href="/category/${cs}.html">${cat}</a>`;
  }).join('\n        ');

  const relatedArticles = Array.isArray(article.relatedArticles) ? article.relatedArticles.slice(0, 2) : [];
  let relatedHTML = '';
  for (const rel of relatedArticles) {
    const relSlug = (rel.slug || rel.filename || '').replace(/\.html$/, '');
    const relCat = rel.category || category;
    relatedHTML += `<a href="/articles/${relSlug}.html" class="card">
              <div class="card-image" style="background-image:url(/images/articles/${relSlug}.webp);background-size:cover;background-position:center;"></div>
              <div class="card-body">
                <div class="card-meta">
                  <span class="genre-label">${relCat}</span>
                  <span class="dot-sep">&middot;</span>
                  <span class="card-date">${dateDisplay}</span>
                </div>
                <div class="card-title">${rel.title || 'Related Story'}</div>
              </div>
            </a>`;
  }

  const nowISO = new Date().toISOString();
  const yearNow = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${seoTitle} — NewsAnarchist</title>
  <meta name="description" content="${metaDesc.replace(/"/g, '&quot;')}">
  <meta name="keywords" content="${keywordsStr}">
  <meta name="robots" content="index, follow">
  <link rel="icon" href="/favicon.ico" type="image/x-icon">
  <link rel="canonical" href="${articleUrl}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,400&family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,600;1,8..60,400&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/style.css">
  <link rel="alternate" type="application/rss+xml" title="NewsAnarchist RSS" href="/rss">

  <meta property="og:type" content="article">
  <meta property="og:title" content="${seoTitle.replace(/"/g, '&quot;')}">
  <meta property="og:description" content="${metaDesc.replace(/"/g, '&quot;')}">
  <meta property="og:url" content="${articleUrl}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:site_name" content="NewsAnarchist">
  <meta property="article:published_time" content="${dateISO}">
  <meta property="article:modified_time" content="${nowISO}">
  <meta property="article:author" content="${author.name}">
  <meta property="article:section" content="${category}">
  <meta property="article:tag" content="${kw.slice(0, 5).join(', ')}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${seoTitle.replace(/"/g, '&quot;')}">
  <meta name="twitter:description" content="${truncate(metaDesc, 180).replace(/"/g, '&quot;')}">
  <meta name="twitter:image" content="${ogImage}">

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": ${JSON.stringify(seoTitle)},
    "description": ${JSON.stringify(metaDesc)},
    "url": "${articleUrl}",
    "datePublished": "${dateISO}",
    "dateModified": "${nowISO}",
    "author": {
      "@type": "Person",
      "name": "${author.name}",
      "url": "${author.slug ? SITE_URL + '/authors/' + author.slug + '.html' : SITE_URL + '/about.html'}"
    },
    "publisher": {
      "@type": "Organization",
      "name": "NewsAnarchist",
      "logo": { "@type": "ImageObject", "url": "${SITE_URL}/images/logo.png" }
    },
    "image": { "@type": "ImageObject", "url": "${ogImage}", "width": 1200, "height": 630 },
    "articleSection": "${category}",
    "keywords": ${JSON.stringify(kw)},
    "isAccessibleForFree": true
  }
  </script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "${SITE_URL}/" },
      { "@type": "ListItem", "position": 2, "name": "${category}", "item": "${SITE_URL}/category/${catSlug}.html" },
      { "@type": "ListItem", "position": 3, "name": ${JSON.stringify(seoTitle)}, "item": "${articleUrl}" }
    ]
  }
  </script>

  <script async src="https://www.googletagmanager.com/gtag/js?id=${GA4_ID}"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA4_ID}');</script>
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8570942144538499" crossorigin="anonymous"></script>
</head>
<body>

<header class="masthead">
  <div class="masthead-inner">
    <div class="masthead-top">
      <div style="width:120px;"></div>
      <div class="masthead-brand">
        <a href="/" class="masthead-wordmark">News<span>Anarchist</span></a>
        <div class="masthead-tagline">The stories buried, spiked, or spun.</div>
      </div>
      <button class="masthead-subscribe" onclick="document.getElementById('subscribe-anchor').scrollIntoView({behavior:'smooth'})">Subscribe Free</button>
    </div>
    <nav class="nav-bar">
      <ul class="nav-list">
        <li><a href="/">Home</a></li>
        ${navLinks}
        <li><a href="/trending.html">Trending</a></li>
        <li><a href="/buried-week.html">The Buried Week</a></li>
      </ul>
    </nav>
  </div>
</header>

<div class="page-layout-with-sidebar">
  <main>
    <article class="article-wrapper">
      <span class="article-category-label">${category}</span>
      <h1 class="article-headline">${title}</h1>
      ${subheadHTML}
      <div class="article-byline">
        ${author.slug ? `<div class="byline-avatar" style="background-image:url(/images/authors/${author.slug}.webp);"></div>` : ''}
        <div>
          ${author.slug ? `<a href="/authors/${author.slug}.html" class="byline-name">${author.name}</a>` : `<div class="byline-name">${author.name}</div>`}
          <div class="byline-role">${author.credential || ''}</div>
        </div>
        <div class="byline-meta">${dateDisplay} &middot; ${readTime}</div>
      </div>
      <div class="article-hero-image" style="${heroImageStyle}"></div>
      <div class="article-body">
        ${extractedBody}
      </div>
      ${renderRelatedProducts(category)}
      <section>
        <div class="section-label">
          <h2>More They're Not Covering</h2>
        </div>
        <div class="card-grid">
          ${relatedHTML || `<a href="/category/${catSlug}.html" class="card">
          <div class="card-image" style="background-color:var(--color-border);"></div>
          <div class="card-body">
            <div class="card-meta"><span class="genre-label">${category}</span></div>
            <div class="card-title">More ${category} Coverage</div>
          </div>
        </a>`}
        </div>
      </section>
    </article>
  </main>
  <aside class="sidebar">
    <div class="sidebar-widget" id="subscribe-anchor">
      <div class="sidebar-widget-header">Daily Briefing</div>
      <div class="sidebar-widget-body">
        <div class="email-widget-text">The stories buried, spiked, or spun. Every morning &mdash; free.</div>
        <form id="sidebarEmailForm" onsubmit="submitSidebarEmail(event)">
          <input type="email" id="sidebarEmailInput" class="email-input" placeholder="your@email.com" required>
          <button type="submit" class="btn-subscribe">Subscribe Free</button>
        </form>
        <div class="email-disclaimer">Unsubscribe anytime.</div>
      </div>
    </div>
    <div class="sidebar-widget">
      <div class="sidebar-widget-header">Trending Now</div>
      <div class="trending-list">${sidebarTrendingHTML}</div>
    </div>
    <div class="sidebar-widget">
      <div class="sidebar-widget-header">Browse Categories</div>
      <div class="trending-list">${sidebarCategoriesHTML}</div>
    </div>
  </aside>
</div>

<footer class="site-footer">
  <div class="footer-inner">
    <div class="footer-wordmark">News<span>Anarchist</span></div>
    <div class="footer-tagline">Independent investigative news. AI-assisted editorial voices. Facts first.</div>
    <div class="footer-links">
      ${footerCatLinks}
    </div>
    <div class="footer-links">
      <a href="/about.html">About</a>
      <a href="/editorial.html">Editorial Standards</a>
      <a href="/subscribe.html">Subscribe</a>
      <a href="/trending.html">Trending</a>
      <a href="/privacy.html">Privacy</a>
      <a href="/terms.html">Terms</a>
      <a href="/rss">RSS</a>
    </div>
    <div class="footer-legal">&copy; ${yearNow} NewsAnarchist. All rights reserved. AI-assisted editorial content disclosed in bylines. As an Amazon Associate, we earn from qualifying purchases.</div>
  </div>
</footer>

<script>
async function submitSidebarEmail(e) {
  e.preventDefault();
  const email = document.getElementById('sidebarEmailInput').value;
  const btn = e.target.querySelector('button');
  btn.textContent = 'Subscribing...';
  btn.disabled = true;
  try {
    const res = await fetch('https://brevo-subscribe.steve-5cb.workers.dev', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({email, source: 'newsanarchist-sidebar'})
    });
    const data = await res.json();
    if (data.success) { btn.textContent = '✓ Subscribed!'; }
    else { btn.textContent = 'Try again'; btn.disabled = false; }
  } catch(err) { btn.textContent = 'Try again'; btn.disabled = false; }
}
</script>
<script src="/js/main.js"></script>
</body>
</html>`;
}

// ─── Git helpers ──────────────────────────────────────────────────────────────

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
  const rawDb = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
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
