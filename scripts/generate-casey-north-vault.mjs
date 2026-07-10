#!/usr/bin/env node
/**
 * Casey North — Weekly Investigative Synthesis
 * Clusters the last 7 days of Unexplained source material and
 * synthesizes a 1,200-word original investigation via Claude Haiku.
 * Run: node generate-casey-north-vault.mjs
 * Cron: every Tuesday 16:00 UTC
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_DIR   = path.resolve(__dirname, '../newsanarchist-website');
const ARTICLES_DIR = path.join(SITE_DIR, 'articles');
const DB_FILE    = path.join(SITE_DIR, 'generated-articles.json');
const CREDS      = path.resolve(process.env.HOME, '.openclaw/secrets/credentials.env');
const SITE_URL   = 'https://newsanarchist.com';
const GA4_ID     = 'G-7N6W04M3XW';

// Load credentials
function loadCreds() {
  if (!fs.existsSync(CREDS)) return;
  for (const line of fs.readFileSync(CREDS,'utf-8').split('\n')) {
    const m = line.match(/^(?:export\s+)?(\w+)=(.+)$/);
    if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g,'').trim();
  }
}

// Slugify title
function slugify(t) {
  return t.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);
}

// Cluster articles by shared keywords
function clusterArticles(articles) {
  const clusters = {};
  const stopWords = new Set(['the','a','an','and','or','but','in','on','at','to','for',
    'of','with','by','from','is','are','was','were','that','this','have','has',
    'been','will','would','could','should','they','their','about','after','said']);

  for (const art of articles) {
    const words = (art.title + ' ' + (art.description||'')).toLowerCase()
      .replace(/[^a-z0-9\s]/g,' ').split(/\s+/)
      .filter(w => w.length > 4 && !stopWords.has(w));

    for (const word of words.slice(0,8)) {
      if (!clusters[word]) clusters[word] = [];
      clusters[word].push(art);
    }
  }

  // Find the richest cluster with 3+ unique articles
  const ranked = Object.entries(clusters)
    .map(([kw, arts]) => {
      const unique = [...new Map(arts.map(a => [a.title, a])).values()];
      return { keyword: kw, articles: unique, score: unique.length };
    })
    .filter(c => c.score >= 3)
    .sort((a, b) => b.score - a.score);

  return ranked.slice(0, 5); // top 5 clusters
}

// Pick most diverse cluster (mix of sources)
function pickBestCluster(clusters) {
  if (!clusters.length) return null;
  // Prefer clusters with multiple sources
  return clusters.sort((a, b) => {
    const sourcesA = new Set(a.articles.map(x => x.source)).size;
    const sourcesB = new Set(b.articles.map(x => x.source)).size;
    return (sourcesB * 10 + b.score) - (sourcesA * 10 + a.score);
  })[0];
}

// Build Casey North HTML article (Version D)
function buildCaseyArticleHTML(topic) {
  const author = { name: 'Casey North', slug: 'casey-north', credential: 'Science journalist' };
  const category = 'Unexplained';
  const catSlug = 'unexplained';
  const now = new Date();
  const dateISO = topic.pubDate || now.toISOString();
  const dateDisplay = now.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  const seoTitle = topic.title.length > 110 ? topic.title.slice(0,107)+'...' : topic.title;
  const metaDesc = (topic.description||topic.title).slice(0,155);
  const articleUrl = `${SITE_URL}/articles/${topic.slug}.html`;
  // Generate hero image via openclaw infer (same as main pipeline)
  const imgPath = `${process.env.HOME}/.openclaw/workspace/newsanarchist-website/images/articles/${topic.slug}.webp`;
  const imgExists = (() => { try { fs.statSync(imgPath); return true; } catch { return false; } })();
  if (!imgExists) {
    const imgPrompt = `Wide landscape editorial news photograph, Reuters or Associated Press style, for article: "${topic.title}". Visual subject: UAP disclosure, government transparency, anomalous phenomena. Fill the entire frame edge to edge — no black bars, no letterboxing. Bright natural daylight or clean indoor lighting. Sharp focus. Documentary realism. No people, no faces, no portraits. No text, no words. Full bleed landscape. Photorealistic.`;
    try {
      const pngPath = imgPath.replace(/\.webp$/, '.png');
      execSync(`openclaw infer image generate --model fal/fal-ai/flux/dev --prompt "${imgPrompt.replace(/"/g, "'")}" --size 1024x1024 --output-format webp --output "${pngPath}" --json`, { stdio: 'pipe' });
      if (fs.existsSync(pngPath)) fs.renameSync(pngPath, imgPath);
      console.log('  ✅ Casey North hero image generated');
    } catch (e) {
      console.warn('  ⚠ Image generation failed:', e.message);
    }
  }
  const ogImage = `${SITE_URL}/images/articles/${topic.slug}.webp`;
  const kw = [category.toLowerCase(), 'unexplained', 'investigation', 'casey north', ...topic.keywords||[]];
  const keywordsStr = kw.slice(0,8).join(', ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${seoTitle} — NewsAnarchist</title>
<meta name="description" content="${metaDesc.replace(/"/g,'&quot;')}">
<meta name="keywords" content="${keywordsStr}">
<meta name="robots" content="max-snippet:-1, max-image-preview:large, max-video-preview:-1">
<link rel="icon" href="/images/favicon.ico">
<link rel="canonical" href="${articleUrl}">
<link rel="alternate" type="application/rss+xml" title="NewsAnarchist RSS" href="/rss">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Syne:wght@700;800&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap" rel="stylesheet">
<meta property="og:type" content="article">
<meta property="og:title" content="${seoTitle.replace(/"/g,'&quot;')}">
<meta property="og:description" content="${metaDesc.replace(/"/g,'&quot;')}">
<meta property="og:url" content="${articleUrl}">
<meta property="og:image" content="${ogImage}">
<meta property="og:site_name" content="NewsAnarchist">
<meta property="article:published_time" content="${dateISO}">
<meta property="article:modified_time" content="${now.toISOString()}">
<meta property="article:author" content="${author.name}">
<meta property="article:section" content="${category}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${seoTitle.replace(/"/g,'&quot;')}">
<meta name="twitter:description" content="${metaDesc.replace(/"/g,'&quot;').slice(0,180)}">
<meta name="twitter:image" content="${ogImage}">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"NewsArticle","headline":${JSON.stringify(seoTitle)},"description":${JSON.stringify(metaDesc)},"url":"${articleUrl}","datePublished":"${dateISO}","dateModified":"${now.toISOString()}","author":{"@type":"Person","name":"${author.name}","url":"${SITE_URL}/authors/${author.slug}.html"},"publisher":{"@type":"Organization","name":"NewsAnarchist","logo":{"@type":"ImageObject","url":"${SITE_URL}/images/logo.png"}},"image":{"@type":"ImageObject","url":"${ogImage}","width":1200,"height":630},"articleSection":"${category}","keywords":${JSON.stringify(kw)},"isAccessibleForFree":true}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"${SITE_URL}/"},{"@type":"ListItem","position":2,"name":"${category}","item":"${SITE_URL}/category/${catSlug}.html"},{"@type":"ListItem","position":3,"name":${JSON.stringify(seoTitle)},"item":"${articleUrl}"}]}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"SpeakableSpecification","cssSelector":["h1.na-article-headline",".na-article-lede",".na-take-body"]}</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA4_ID}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA4_ID}');</script>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8570942144538499" crossorigin="anonymous"></script>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'DM Sans',sans-serif;background:#F5F4F0;color:#111;line-height:1.6;font-size:16px}
a{color:inherit;text-decoration:none}
img{max-width:100%;display:block}
.na-mast{background:#F5F4F0;border-bottom:1px solid #E5E3DE;padding:18px 0 0}
.na-mast-inner{max-width:1200px;margin:0 auto;padding:0 24px}
.na-mast-top{display:flex;align-items:center;justify-content:space-between;padding-bottom:14px}
.na-wm{font-family:'Syne',sans-serif;font-size:28px;font-weight:800;letter-spacing:-0.5px;color:#111}
.na-wm em{color:#E11D48;font-style:normal}
.na-tagline{font-size:12px;color:#666;margin-top:2px;letter-spacing:0.02em}
.na-sub-btn{background:#E11D48;color:#fff;border:none;padding:8px 18px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;letter-spacing:0.02em;text-decoration:none}
.na-sub-btn:hover{background:#c41230}
.na-nav{background:#111;position:relative}.na-nav::after{content:'';position:absolute;top:0;right:0;bottom:0;width:28px;background:linear-gradient(to right,transparent,#111);pointer-events:none;z-index:2}
.na-nav-inner{max-width:1200px;margin:0 auto;padding:0 24px;display:flex;align-items:center;overflow-x:auto;scrollbar-width:none}
.na-nav-inner::-webkit-scrollbar{display:none}
.na-nav-inner a{color:#fff;font-size:12px;font-weight:500;padding:10px 14px;white-space:nowrap;opacity:0.85;letter-spacing:0.02em;display:block;flex-shrink:0}
.na-nav-inner a:hover,.na-nav-inner a.active{opacity:1;color:#E11D48}
.na-layout{max-width:1200px;margin:0 auto;padding:32px 24px;display:grid;grid-template-columns:1fr 300px;gap:40px;align-items:start}
@media(max-width:768px){.na-layout{grid-template-columns:1fr;padding:16px}}
.na-article{max-width:720px}
.na-article-cat{font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#E11D48;display:block;margin-bottom:8px}
.na-investigation-badge{display:inline-block;background:#E11D48;color:#fff;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:3px 8px;margin-bottom:12px}
.na-article-headline{font-family:'Syne',sans-serif;font-size:clamp(24px,4vw,38px);font-weight:800;line-height:1.15;letter-spacing:-0.5px;color:#111;margin-bottom:16px}
.na-article-dek{font-size:18px;color:#444;line-height:1.5;margin-bottom:20px;font-style:italic}
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
.na-sources{background:#fff;border:1px solid #E5E3DE;padding:20px 24px;margin:32px 0;font-size:13px}
.na-sources-label{font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#888;margin-bottom:12px}
.na-sources ul{list-style:none;padding:0}
.na-sources li{padding:4px 0;border-bottom:1px solid #F5F4F0;color:#555}
.na-sources li:last-child{border-bottom:none}
.na-sources a{color:#E11D48;text-decoration:underline}
.the-take{background:#111;color:#fff;padding:24px 28px;margin:32px 0;border-left:4px solid #E11D48}
.the-take-label{font-size:10px;font-weight:700;letter-spacing:0.12em;color:#E11D48;text-transform:uppercase;margin-bottom:10px}
.na-take-body{font-family:'Source Serif 4',serif;font-size:16px;line-height:1.65;color:#eee}
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
.na-cat-link{display:block;padding:7px 0;border-bottom:1px solid #F5F4F0;font-size:13px;font-weight:500;color:#333}
.na-cat-link:last-child{border-bottom:none}
.na-cat-link:hover{color:#E11D48}
.na-footer{background:#111;color:#888}
.na-fgrid{display:grid;grid-template-columns:1fr;gap:24px;padding:28px 20px;border-bottom:1px solid #1A1A1A;max-width:1200px;margin:0 auto}
@media(min-width:600px){.na-fgrid{grid-template-columns:repeat(2,1fr)}}
@media(min-width:900px){.na-fgrid{grid-template-columns:repeat(4,1fr)}}
.na-fwm{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:#fff;letter-spacing:-1px;margin-bottom:6px}.na-fwm em{color:#E11D48;font-style:normal}
.na-fdesc{font-size:11px;color:#555;line-height:1.6;margin-bottom:12px}
.na-fct{font-size:9px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#E11D48;margin-bottom:11px}
.na-flink{display:block;font-size:11px;color:#555;padding:3px 0}.na-flink:hover{color:#fff}
.na-flink-acc{color:#E11D48;font-weight:600}
.na-fbot{padding:12px 20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;max-width:1200px;margin:0 auto}
.na-fcopy{font-size:10px;color:#333}.na-fchronic{font-size:10px;color:#333}.na-fchronic:hover{color:#888}
.na-footer-legal{display:flex;gap:16px}.na-fext{display:flex;align-items:center;justify-content:space-between;font-size:11px;color:#555;padding:3px 0}.na-fext:hover{color:#fff}.na-fbadge{font-size:9px;background:#222;color:#888;padding:2px 6px;letter-spacing:.05em}.na-fdiv{margin-top:12px;padding-top:12px;border-top:1px solid #1A1A1A}
.na-footer-legal a{font-size:12px;color:#666}
.na-footer-legal a:hover{color:#fff}
</style>
</head>
<body>
<header class="na-mast">
  <div class="na-mast-inner">
    <div class="na-mast-top">
      <div>
        <a href="/" class="na-wm">News<em>Anarchist</em></a>
        <div class="na-tagline">The stories buried, spiked, or spun.</div>
      </div>
      <a href="/subscribe.html" class="na-sub-btn">Subscribe</a>
    </div>
  </div>
  <nav class="na-nav">
    <div class="na-nav-inner">
      <a href="/">Home</a>
      <a href="/category/surveillance-state.html">Surveillance State</a>
      <a href="/category/corporate-watchdog.html">Corporate Watchdog</a>
      <a href="/category/government-secrets.html">Government Secrets</a>
      <a href="/category/tech-privacy.html">Tech &amp; Privacy</a>
      <a href="/category/global-power.html">Global Power</a>
      <a href="/category/money-markets.html">Money &amp; Markets</a>
      <a href="/category/unexplained.html" class="active">Unexplained</a>
      <a href="/category/true-crime.html">True Crime</a>
      <a href="/trending.html">Trending</a>
      <a href="/buried-week.html">The Buried Week</a>
    </div>
  </nav>
</header>
<main class="na-layout">
  <article class="na-article">
    <span class="na-article-cat">${category}</span>
    <div class="na-investigation-badge">&#128269; Investigation</div>
    <h1 class="na-article-headline">${topic.title}</h1>
    <p class="na-article-dek">${metaDesc}</p>
    <div class="na-byline">
      <div class="na-byline-avatar" style="background-image:url('/images/authors/${author.slug}.webp')"></div>
      <div>
        <div class="na-byline-name"><a href="/authors/${author.slug}.html">${author.name}</a></div>
        <div class="na-byline-role">${author.credential} &mdash; NewsAnarchist</div>
      </div>
      <div class="na-byline-meta">${dateDisplay}</div>
    </div>
    <div class="na-hero-img" style="background-image:url('${ogImage}')"></div>
    <div class="na-article-body">
      <div class="art-body">${topic.body}</div>
      ${topic.sources && topic.sources.length ? `
      <div class="na-sources">
        <div class="na-sources-label">Source Documents</div>
        <ul>${topic.sources.map(s => `<li><a href="${s.url}" target="_blank" rel="noopener">${s.title}</a> — ${s.source}</li>`).join('')}</ul>
      </div>` : ''}
      ${topic.theTake ? `
      <div class="the-take">
        <div class="the-take-label">The Take — Casey North</div>
        <div class="na-take-body">${topic.theTake}</div>
      </div>` : ''}
    </div>
  </article>
  <aside class="na-sidebar">
    <div class="na-sidebar-widget">
      <div class="na-widget-header">Daily Briefing</div>
      <div class="na-widget-body">
        <p class="na-email-text">The stories legacy media won't touch. Free daily.</p>
        <form id="na-sidebar-form" onsubmit="return false">
          <input type="email" class="na-email-input" placeholder="your@email.com" id="na-sidebar-email">
          <div class="cf-turnstile" data-sitekey="0x4AAAAAADVJs0w8w_ZovZgT" data-theme="auto" data-appearance="interaction-only"></div>
          <button class="na-btn-subscribe" onclick="naSubscribe()">Subscribe Free</button>
          <div class="na-email-disclaimer">No spam. Unsubscribe anytime.</div>
        </form>
      </div>
    </div>
    <div class="na-sidebar-widget">
      <div class="na-widget-header">Browse Categories</div>
      <div class="na-widget-body">
        <a href="/category/surveillance-state.html" class="na-cat-link">Surveillance State</a>
        <a href="/category/corporate-watchdog.html" class="na-cat-link">Corporate Watchdog</a>
        <a href="/category/government-secrets.html" class="na-cat-link">Government Secrets</a>
        <a href="/category/tech-privacy.html" class="na-cat-link">Tech &amp; Privacy</a>
        <a href="/category/global-power.html" class="na-cat-link">Global Power</a>
        <a href="/category/money-markets.html" class="na-cat-link">Money &amp; Markets</a>
        <a href="/category/unexplained.html" class="na-cat-link">Unexplained</a>
        <a href="/category/true-crime.html" class="na-cat-link">True Crime</a>
      </div>
    </div>

  </aside>
</main>
<footer class="na-footer">
<div class="na-fgrid">
<div><div class="na-fwm">News<em>Anarchist</em></div><div class="na-fdesc">Independent investigative news. The stories buried, spiked, or spun.</div>
<a href="/subscribe.html" class="na-flink na-flink-acc">Subscribe — Free &amp; Paid →</a>
<a href="/about.html" class="na-flink">About Us</a><a href="/editorial.html" class="na-flink">Editorial Standards</a><a href="/tip-line.html" class="na-flink">Tip Line</a><a href="/advertise.html" class="na-flink">Advertise</a></div>
<div><div class="na-fct">Steve Ysreal Monas</div>
<a href="https://www.stevemonas.com/blog#business" class="na-flink">Business</a>
<a href="https://www.stevemonas.com/blog#cuisine" class="na-flink">Cuisine</a>
<a href="https://www.stevemonas.com/blog#writing" class="na-flink">Writing</a>
<a href="https://www.stevemonas.com/blog#history" class="na-flink">History &amp; Culture</a>
<a href="https://www.stevemonas.com/blog#growth" class="na-flink">Personal Growth</a>
<div class="na-fdiv"><div class="na-fct">Books</div><a href="https://amzn.to/4qQAD2U" class="na-flink">Steve Ysreal Monas on Amazon →</a></div></div>
<div><div class="na-fct">Also From Chronic Internet</div>
<a href="https://brieftape.com" class="na-fext"><span>BriefTape</span><span class="na-fbadge">Financial News</span></a>
<a href="https://bevoza.com" class="na-fext" style="margin-top:5px"><span>Bevoza</span><span class="na-fbadge">Digital Products</span></a>
<a href="https://5minutemiracleapp.com" class="na-fext" style="margin-top:5px"><span>5 Minute Miracle</span><span class="na-fbadge">Mobile App</span></a>
<div class="na-fdiv"><div class="na-fct">Categories</div>
<a href="/category/surveillance-state.html" class="na-flink">Surveillance State</a>
<a href="/category/corporate-watchdog.html" class="na-flink">Corporate Watchdog</a>
<a href="/category/government-secrets.html" class="na-flink">Government Secrets</a>
<a href="/category/tech-privacy.html" class="na-flink">Tech &amp; Privacy</a>
</div></div>
<div><div class="na-fct">More Categories</div>
<a href="/category/global-power.html" class="na-flink">Global Power</a>
<a href="/category/money-markets.html" class="na-flink">Money &amp; Markets</a>
<a href="/category/unexplained.html" class="na-flink">Unexplained</a>
<a href="/category/true-crime.html" class="na-flink">True Crime</a>
<div class="na-fdiv"><div class="na-fct">Legal</div>
<a href="/privacy.html" class="na-flink">Privacy Policy</a>
<a href="/terms.html" class="na-flink">Terms of Service</a>
<a href="/dmca.html" class="na-flink">DMCA</a>
<a href="/rss" class="na-flink">RSS Feed</a>
<div style="font-size:10px;color:#333;margin-top:8px;line-height:1.5">As an Amazon Associate,<br>I earn from qualifying purchases.</div>
</div></div>
</div>
<div class="na-fbot"><div class="na-fcopy">&copy; ${now.getFullYear()} NewsAnarchist. All rights reserved. AI-assisted editorial content disclosed in bylines.</div><a href="https://chronicinternet.com/" class="na-fchronic">A Chronic Internet Company</a></div>
    </div>
  </div>
</footer>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<script>
async function naSubscribe(){
  const email=document.getElementById('na-sidebar-email').value.trim();
  if(!email||!email.includes('@'))return;
  const token=(document.querySelector('[name="cf-turnstile-response"]')||{}).value||'';
  try{
    const r=await fetch('https://brevo-subscribe.steve-5cb.workers.dev',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,source:'casey-north-investigation',turnstileToken:token})});
    if(r.ok){document.getElementById('na-sidebar-form').innerHTML='<p style="color:#E11D48;font-weight:600;font-size:14px">✓ You\'re subscribed.</p>';}
  }catch(e){}
}
</script>
</body>
</html>`;
}

// Main
async function main() {
  loadCreds();
  console.log('\n🔍 Casey North — Weekly Investigative Synthesis');
  console.log('================================================\n');

  // Load last 7 days of Unexplained articles from DB
  const db = JSON.parse(fs.readFileSync(DB_FILE,'utf-8'));
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const UNEXPLAINED_SOURCES = new Set([
    'The Debrief','The Debrief UAP','The Debrief Science',
    'The Black Vault','Liberation Times','Open Minds UFO',
    'Anomalien','Mysterious Universe','Forbidden Knowledge',
    'Skeptoid','Consciousness & IONS','MUFON News',
    'Casey North Investigation'
  ]);
  const UNEXPLAINED_KEYWORDS = /\bufo\b|\buap\b|unidentified aerial|paranormal|\bskinwalker\b|extraterrestrial|non-human intelligence|recovered craft|whistleblower ufo|david grusch|pentagon uap|near-death experience|\bnde\b|consciousness research|anomalous phenomenon|black vault|debrief uap|\bmufon\b|liberation times|uap disclosure|uap sighting|ufos|uaps|unexplained phenomenon|alien|abduction|roswell|area 51/i;
  // Primary: trusted sources within cutoff
  let recent = db.filter(a =>
    (UNEXPLAINED_SOURCES.has(a.source) || a.isInvestigation) &&
    new Date(a.generatedAt || a.pubDate || 0) > cutoff
  );
  // Fallback: any DB entry with strong Unexplained keywords in title
  if (recent.length < 5) {
    console.log('  Expanding — scanning all DB entries for Unexplained keywords...');
    recent = db.filter(a => {
      const text = (a.title||'') + ' ' + (a.description||'');
      return UNEXPLAINED_KEYWORDS.test(text);
    }).sort((a,b) => new Date(b.generatedAt||0) - new Date(a.generatedAt||0)).slice(0,20);
  }

  console.log(`📚 Found ${recent.length} Unexplained articles from last 7 days`);

  if (recent.length < 5) {
    console.log('⚠ Not enough recent Unexplained articles — expanding to 14 days');
    const cutoff14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const extended = db.filter(a =>
      a.category === 'Unexplained' &&
      new Date(a.generatedAt || a.pubDate || 0) > cutoff14
    );
    recent.push(...extended.filter(a => !recent.includes(a)));
  }

  if (recent.length < 3) {
    console.error('❌ Insufficient Unexplained content to synthesize. Run scrape first.');
    process.exit(1);
  }

  // Cluster articles
  const clusters = clusterArticles(recent);
  const best = pickBestCluster(clusters);

  if (!best) {
    console.error('❌ No strong clusters found. Falling back to top stories.');
  }

  const sourceArticles = best ? best.articles.slice(0,8) : recent.slice(0,8);
  const clusterTheme = best ? best.keyword : 'anomalous phenomena';

  console.log(`🎯 Cluster theme: "${clusterTheme}" — ${sourceArticles.length} source articles`);
  sourceArticles.forEach(a => console.log(`   • ${a.title.slice(0,70)}`));

  // Load editorial brief for context
  let briefContext = '';
  try {
    const brief = JSON.parse(fs.readFileSync(
      path.resolve(process.env.HOME, '.openclaw/workspace/scripts/editorial-brief.json'), 'utf-8'
    ));
    const topCountries = brief.summary?.top_countries?.slice(0,3).join(', ') || 'US';
    briefContext = `\nEditorial note: Top reader countries are ${topCountries}. Unexplained is currently the bottom-performing category — this investigation needs to be exceptional to drive traffic.`;
  } catch(e) {}

  // Build synthesis prompt
  const sourceList = sourceArticles.map((a,i) =>
    `[${i+1}] "${a.title}" (${a.source||'unknown source'})\n${(a.description||'').slice(0,300)}`
  ).join('\n\n');

  const prompt = `You are Casey North, science journalist for NewsAnarchist.com. Your beat is unexplained phenomena, consciousness research, UAP disclosure, and anomalous events. You are skeptical but open — you follow evidence without partisan mockery.

Write a 1,200-word original investigative synthesis article based on the following source materials. This is NOT a summary — it is an original investigation that:
1. Opens with a specific, surprising finding or pattern you've identified across these sources
2. Traces the connecting thread between them (same agency, same time period, same suppressed topic, same pattern of denial)
3. Provides YOUR analysis of what the pattern suggests
4. Names specific documents, agencies, dates where available
5. Closes with what questions remain unanswered and why that matters

Theme: ${clusterTheme}
${briefContext}

SOURCE MATERIALS:
${sourceList}

FORMAT YOUR RESPONSE AS:
TITLE: [compelling investigation headline, max 100 characters]
DESCRIPTION: [2-sentence summary for SEO, max 155 characters]
THE TAKE: [Casey North's 150-word editorial conclusion — skeptical, evidence-based, no partisan mockery]
BODY:
[full 1,200-word article body in HTML paragraphs using <p> tags and <h2> subheadings. No markdown.]`;

  // Call Claude Haiku
  console.log('\n🤖 Generating investigation via Claude Haiku...');
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { console.error('❌ ANTHROPIC_API_KEY not set'); process.exit(1); }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('❌ API error:', err);
    process.exit(1);
  }

  const data = await response.json();
  const raw = (data.content?.[0]?.text || '').replace(/^```[\w]*\n?/m, '').replace(/\n?```$/m, '').trim();

  // Parse response
  const titleMatch = raw.match(/^#?\s*TITLE[:\s]+(.+)$/m);
  const descMatch  = raw.match(/^#?\s*DESCRIPTION[:\s]+(.+)$/m);
  const takeMatch  = raw.match(/#?\s*THE TAKE[:\s]+([\s\S]*?)(?=\n#?\s*BODY)/);
  const bodyMatch  = raw.match(/#?\s*BODY[:\s\n]+((?:<[^>]+>|[\s\S])+)$/);

  // Check if Haiku refused due to insufficient source material
  if (raw.includes("don't contain actual investigative") || raw.includes("significant problem") || raw.includes("can't write") || raw.includes("cannot write")) {
    console.error('❌ Haiku refused — insufficient source material. Need real Unexplained feed articles.');
    console.log('   Run scrape first to populate Unexplained feeds, then retry.');
    process.exit(1);
  }

  if (!titleMatch || !bodyMatch) {
    console.error('❌ Failed to parse AI response. Raw output saved to /tmp/casey-debug.txt');
    fs.writeFileSync('/tmp/casey-debug.txt', raw);
    process.exit(1);
  }

  const title    = titleMatch[1].trim();
  const desc     = descMatch ? descMatch[1].trim() : title.slice(0,155);
  const theTake  = takeMatch ? takeMatch[1].trim() : '';
  const body     = bodyMatch[1].trim();

  // Build article object
  const dateStr  = new Date().toISOString().slice(0,10);
  const slug     = `${dateStr}-${slugify(title)}`;
  const keywords = [clusterTheme, 'investigation', 'casey north', 'unexplained', ...
    sourceArticles.map(a => (a.title||'').toLowerCase().split(/\s+/).filter(w=>w.length>5).slice(0,2)).flat()
  ].filter((v,i,a) => a.indexOf(v) === i).slice(0,10);

  const topic = {
    title, slug, description: desc, body, theTake,
    category: 'Unexplained', keywords,
    pubDate: new Date().toISOString(),
    sources: sourceArticles.map(a => ({ title: a.title, url: a.url || (a.filename ? `https://newsanarchist.com/articles/${a.filename}` : '#'), source: a.source||'unknown' })),
    image: null
  };

  // Write article HTML
  const html = buildCaseyArticleHTML(topic);
  const filepath = path.join(ARTICLES_DIR, `${slug}.html`);
  fs.writeFileSync(filepath, html);
  console.log(`\n✅ Investigation written: articles/${slug}.html`);
  console.log(`   Title: ${title}`);

  // Add to DB
  const dbEntry = {
    slug, filename: `${slug}.html`, title,
    description: desc, category: 'Unexplained',
    author: 'Casey North', authorSlug: 'casey-north',
    keywords, pubDate: new Date().toISOString(),
    source: 'Casey North Investigation',
    isInvestigation: true, generatedAt: new Date().toISOString()
  };

  const dbData = JSON.parse(fs.readFileSync(DB_FILE,'utf-8'));
  dbData.push(dbEntry);
  fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2));

  // Git commit + push
  try {
    execSync(`cd ${SITE_DIR} && git add articles/${slug}.html generated-articles.json && git commit -m "feat: Casey North investigation — ${title.slice(0,60)}" && git push`, { stdio:'inherit' });
    console.log('✅ Pushed to GitHub');
  } catch(e) {
    console.log('⚠ Git push failed — run manually');
  }

  console.log('\n✅ Done. Run wrangler deploy to publish.\n');
}

main().catch(e => { console.error('❌ Fatal:', e.message); process.exit(1); });
