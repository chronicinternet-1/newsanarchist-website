#!/usr/bin/env node
/**
 * Casey North — PURSUE Investigation
 * Downloads war.gov/ufo documents, enhances them, generates investigation
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_DIR = `${process.env.HOME}/.openclaw/workspace/newsanarchist-website`;
const SCRIPTS_DIR = `${process.env.HOME}/.openclaw/workspace/scripts`;
const PURSUE_DIR = `${SITE_DIR}/images/pursue`;
const SITE_URL = 'https://newsanarchist.com';

// Load credentials
const credsPath = `${process.env.HOME}/.openclaw/secrets/credentials.env`;
for (const line of fs.readFileSync(credsPath,'utf-8').split('\n')) {
  const m = line.match(/^(?:export )?([^=]+)=(.+)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g,'');
}

if (!fs.existsSync(PURSUE_DIR)) fs.mkdirSync(PURSUE_DIR, { recursive: true });

const BASE = 'https://www.war.gov/portals/1/Interactive/2026/UFO/Slideshow-2/';
const DOCS = [
  { file: 'DOW-UAP-PR051.jpg', desc: 'Infrared sensor footage — unidentified object, high contrast anomaly' },
  { file: 'DOW-UAP-PR052.jpg', desc: 'Infrared sensor — multiple objects, bottom-left formation' },
  { file: 'DOW-UAP-D017_General_Correspondence_Of_Sandia.jpg', desc: 'Sandia National Laboratory UAP correspondence 1948-1950, New Mexico' },
  { file: 'CIA-UAP-D001_Intelligence_Information_Report_USSR_1973.jpg', desc: 'CIA intelligence report — UAP sighting in the USSR, 1973' },
  { file: 'ODNI-UAP-D001_USPER_Narrative_Senior_USIC.jpg', desc: 'First-hand narrative from senior US Intelligence Community official' },
  { file: 'NASA-UAP-D008_Apollo12_Medical_Debriefing.jpg', desc: 'Apollo 12 medical debriefing — NASA UAP reference' },
  { file: 'DOE-UAP-D001_PANTEX_Image.jpg', desc: 'PANTEX radar tower — unidentified object report with enhanced imagery' },
  { file: 'DOW-UAP-PR050_4UAP_Formation_Iran_26_Aug_2022.jpg', desc: '4 UAP formation over Iran, August 26 2022 — redacted sensor data' },
  { file: 'DOW-UAP-PR086-UAP_from_Dec_2019_East_Coast.jpg', desc: 'East Coast UAP, December 2019 — water surface, crosshair tracking' },
];

// Download a file
function download(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) { resolve(); return; }
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 'Referer': 'https://www.war.gov/ufo/' } }, res => {
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', reject);
  });
}

// Enhance image using Python PIL
function enhanceImage(inputPath, outputPath) {
  const script = `
from PIL import Image, ImageEnhance, ImageFilter
import sys
img = Image.open('${inputPath}').convert('RGB')
# Enhance contrast
img = ImageEnhance.Contrast(img).enhance(1.4)
# Enhance sharpness
img = ImageEnhance.Sharpness(img).enhance(1.6)
# Enhance brightness slightly
img = ImageEnhance.Brightness(img).enhance(1.1)
# Remove noise
img = img.filter(ImageFilter.UnsharpMask(radius=1, percent=120, threshold=3))
img.save('${outputPath}', 'JPEG', quality=92, optimize=True)
print('enhanced')
`;
  try {
    execSync(`python3 -c "${script.replace(/"/g, '\\"').replace(/\n/g, ';')}"`, { stdio: 'pipe' });
    return true;
  } catch(e) {
    return false;
  }
}

async function main() {
  console.log('📥 Downloading PURSUE Release 02 documents...');
  
  const downloaded = [];
  for (const doc of DOCS) {
    const url = BASE + encodeURIComponent(doc.file);
    const dest = path.join(PURSUE_DIR, doc.file);
    const enhanced = path.join(PURSUE_DIR, 'enhanced_' + doc.file);
    
    try {
      await download(url, dest);
      const ok = enhanceImage(dest, enhanced);
      downloaded.push({ ...doc, localPath: ok ? enhanced : dest, webPath: `/images/pursue/${ok ? 'enhanced_' : ''}${doc.file}` });
      console.log(`  ✅ ${doc.file.slice(0,40)}...`);
    } catch(e) {
      console.warn(`  ⚠ ${doc.file}: ${e.message}`);
    }
  }

  console.log(`\n📄 Downloaded ${downloaded.length} documents. Generating investigation...`);

  if (downloaded.length === 0) {
    console.error('❌ No documents downloaded. war.gov may be blocking requests.');
    process.exit(1);
  }

  // Build document context for Claude
  const docContext = downloaded.map((d,i) => `${i+1}. ${d.desc} (${d.file})`).join('\n');

  const prompt = `You are Casey North, science journalist and investigative reporter for NewsAnarchist.com. You cover unexplained phenomena with rigorous skepticism — neither dismissive nor credulous.

The U.S. Department of War (formerly Department of Defense, rebranded under Trump) has launched PURSUE — the Presidential Unsealing and Reporting System for UAP Encounters. They have released two tranches of declassified documents. Release 01 was May 8, 2026. Release 02 was May 22, 2026.

You have direct access to these primary source documents from war.gov/ufo:

${docContext}

Write a 1,500-word investigative analysis in Casey North's voice. Structure:

TITLE: [punchy, specific, newsworthy]
DESCRIPTION: [2-sentence summary, max 155 chars]
THE TAKE: [150-word Casey North commentary — skeptical but open, institutional analysis]
BODY: [full article with H2 subheadings. Cover: what PURSUE is and its legal basis, analysis of what the documents actually show, what's notable about specific documents (Sandia 1948, CIA USSR 1973, Apollo 12, F-16 shoot-down, Iran formation), what remains redacted and why that matters, institutional analysis of DOW's disclosure approach]

Use primary source language. Reference specific documents by name. Link analysis to the pattern of controlled disclosure Casey North has covered previously.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await response.json();
  console.log('API response:', JSON.stringify(data).slice(0,300));
  if (!data.content || !data.content[0]) {
    console.error('API error:', JSON.stringify(data));
    process.exit(1);
  }
  const raw = data.content[0].text;

  // Parse response
  const titleMatch = raw.match(/TITLE:\s*(.+)/);
  const descMatch = raw.match(/DESCRIPTION:\s*(.+)/);
  const takeMatch = raw.match(/THE TAKE:\s*([\s\S]+?)(?=BODY:|$)/);
  const bodyMatch = raw.match(/BODY:\s*([\s\S]+)$/);

  const title = titleMatch ? titleMatch[1].trim() : 'PURSUE: Inside the Pentagon\'s UAP Disclosure Machine';
  const description = descMatch ? descMatch[1].trim().slice(0,155) : 'An analysis of the Department of War\'s PURSUE program and its two tranches of declassified UAP documents.';
  const theTake = takeMatch ? takeMatch[1].trim() : '';
  const body = bodyMatch ? bodyMatch[1].trim() : raw;

  // Build document gallery HTML
  const galleryHTML = downloaded.slice(0,6).map(d => `
<div style="margin:24px 0;border:1px solid #E5E3DE;background:#fff">
  <img src="${d.webPath}" alt="${d.desc}" style="width:100%;height:auto;display:block">
  <div style="padding:10px 14px;font-size:12px;color:#666;font-family:'DM Sans',sans-serif;border-top:1px solid #E5E3DE">
    <strong style="color:#E11D48">PURSUE Release 02</strong> — ${d.desc}
  </div>
</div>`).join('');

  // Insert gallery after first H2
  const bodyWithGallery = body.replace(/(<\/h2>)/, `$1\n${galleryHTML}`);

  // Generate slug and filename
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);
  const now = new Date();
  const dateStr = now.toISOString().slice(0,10);
  const filename = `${dateStr}-${slug}.html`;

  // Load DB
  const dbPath = `${SITE_DIR}/generated-articles.json`;
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

  // Check for existing
  if (db.find(a => a.slug === slug)) {
    console.log('⚠ Investigation already exists, skipping.');
    process.exit(0);
  }

  // Generate hero image
  const imgPath = `${SITE_DIR}/images/articles/${filename.replace('.html','.png')}`;
  const imgWebPath = `${filename.replace('.html','.webp')}`;
  const imgPrompt = `Wide landscape editorial news photograph, Reuters style, for article about government UAP declassification and military transparency. Official government documents, military sensor imagery, institutional opacity. Bright clinical lighting. No people. No text. Full bleed landscape. Photorealistic.`;
  
  try {
    execSync(`openclaw infer image generate --model fal/fal-ai/flux/dev --prompt "${imgPrompt.replace(/"/g,"'")}" --size 1024x1024 --output-format webp --output "${imgPath}" --json`, { stdio: 'pipe' });
    const webpPath = imgPath.replace(/\.png$/, '.webp');
    if (fs.existsSync(imgPath)) fs.renameSync(imgPath, webpPath);
    console.log('  ✅ Hero image generated');
  } catch(e) {
    console.warn('  ⚠ Hero image failed:', e.message);
  }

  const ogImage = `${SITE_URL}/images/articles/${filename.replace('.html','.webp')}`;

  // Load briefing
  let briefContext = '';
  try {
    const brief = JSON.parse(fs.readFileSync(`${SCRIPTS_DIR}/editorial-brief.json`, 'utf8'));
    briefContext = brief.summary || '';
  } catch(e) {}

  const author = { name: 'Casey North', slug: 'casey-north', role: 'Science journalist', beat: 'Unexplained & Emerging Tech' };
  const dateISO = now.toISOString();
  const dateDisplay = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const seoTitle = title.length > 110 ? title.slice(0,107)+'...' : title;
  const articleUrl = `${SITE_URL}/articles/${filename}`;

  // Build HTML — full Version D template (same as main pipeline)
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${seoTitle} — NewsAnarchist</title>
<meta name="description" content="${description}">
<meta name="robots" content="max-snippet:-1, max-image-preview:large, max-video-preview:-1">
<link rel="icon" href="/images/favicon.ico">
<link rel="canonical" href="${articleUrl}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Syne:wght@700;800&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap" rel="stylesheet">
<meta property="og:type" content="article">
<meta property="og:title" content="${title.replace(/"/g,'&quot;')}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${articleUrl}">
<meta property="og:image" content="${ogImage}">
<meta property="og:site_name" content="NewsAnarchist">
<meta property="article:published_time" content="${dateISO}">
<meta property="article:author" content="${author.name}">
<meta property="article:section" content="Unexplained">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${ogImage}">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"NewsArticle","headline":${JSON.stringify(seoTitle)},"description":${JSON.stringify(description)},"url":"${articleUrl}","datePublished":"${dateISO}","author":{"@type":"Person","name":"${author.name}","url":"${SITE_URL}/authors/${author.slug}.html"},"publisher":{"@type":"Organization","name":"NewsAnarchist","logo":{"@type":"ImageObject","url":"${SITE_URL}/images/logo.png"}},"image":{"@type":"ImageObject","url":"${ogImage}","width":1200,"height":630},"articleSection":"Unexplained","isAccessibleForFree":true}</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-7N6W04M3XW"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-7N6W04M3XW');</script>
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
.na-tagline{font-size:12px;color:#666;margin-top:2px}
.na-sub-btn{background:#E11D48;color:#fff;border:none;padding:8px 18px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;text-decoration:none}
.na-nav{background:#111}
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
.na-article-body blockquote{border-left:3px solid #E11D48;padding-left:20px;margin:1.5em 0;color:#444;font-style:italic}
.na-article-body a{color:#E11D48;text-decoration:underline}
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
.na-fext{display:flex;align-items:center;gap:6px;font-size:11px;color:#555;padding:3px 0}.na-fext:hover{color:#fff}
.na-fbadge{font-size:8px;background:#1A1A1A;color:#555;padding:1px 5px;letter-spacing:.06em;text-transform:uppercase}
.na-fdiv{margin-top:12px;padding-top:12px;border-top:1px solid #1A1A1A}
.na-fbot{padding:12px 20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;max-width:1200px;margin:0 auto}
.na-fcopy{font-size:10px;color:#333}.na-fchronic{font-size:10px;color:#333}.na-fchronic:hover{color:#888}
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
    <span class="na-article-cat">Unexplained</span>
    <div class="na-investigation-badge">&#128269; Investigation</div>
    <h1 class="na-article-headline">${title}</h1>
    <p class="na-article-dek">${description}</p>
    <div class="na-byline">
      <div class="na-byline-avatar" style="background-image:url('/images/authors/${author.slug}.webp')"></div>
      <div>
        <div class="na-byline-name"><a href="/authors/${author.slug}.html">${author.name}</a></div>
        <div class="na-byline-role">${author.role} &mdash; NewsAnarchist</div>
      </div>
      <div class="na-byline-meta">${dateDisplay}</div>
    </div>
    <div class="na-hero-img" style="background-image:url('${ogImage}')"></div>
    <div class="na-article-body">
      ${bodyWithGallery}
    </div>
    <div class="na-sources">
      <div class="na-sources-label">Primary Sources</div>
      <ul>
        <li><a href="https://www.war.gov/ufo/" target="_blank" rel="noopener">PURSUE — Presidential Unsealing and Reporting System for UAP Encounters</a> — U.S. Department of War</li>
        <li><a href="https://www.war.gov/ufo/?releaseDate=Release+02#records" target="_blank" rel="noopener">Release 02 Documents — May 22, 2026</a> — Department of War</li>
        <li><a href="https://www.war.gov/ufo/?releaseDate=Release+01#records" target="_blank" rel="noopener">Release 01 Documents — May 8, 2026</a> — Department of War</li>
      </ul>
    </div>
    <div class="the-take">
      <div class="the-take-label">The Take &mdash; Casey North</div>
      <div class="na-take-body">${theTake}</div>
    </div>
  </article>
  <aside class="na-sidebar">
    <div class="na-sidebar-widget">
      <div class="na-widget-header">Daily Briefing</div>
      <div class="na-widget-body">
        <p class="na-email-text">The stories legacy media won't touch. Free daily.</p>
        <form id="na-sidebar-form" onsubmit="return false">
          <input type="email" class="na-email-input" placeholder="your@email.com" id="na-sidebar-email">
          <button class="na-btn-subscribe" onclick="naSubscribe()">Subscribe Free</button>
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
    <div class="na-sidebar-widget" style="background:#111;border:1px solid #333">
      <div class="na-widget-header" style="background:#E11D48">NewsAnarchist Files</div>
      <div class="na-widget-body" style="padding:12px 13px">
        <p style="font-size:13px;color:#ccc;margin:0 0 10px;line-height:1.5">Document-driven investigations. Primary sources. Named authors.</p>
        <a href="/newsanarchist-files.html" style="display:block;background:#E11D48;color:#fff;text-align:center;padding:9px;font-size:12px;font-weight:600;text-decoration:none">Read the Investigations →</a>
      </div>
    </div>
  </aside>
</main>
<footer class="na-footer">
<div class="na-fgrid">
<div><div class="na-fwm">News<em>Anarchist</em></div><div class="na-fdesc">Independent investigative news. The stories buried, spiked, or spun.</div>
<a href="/subscribe.html" class="na-flink na-flink-acc">Subscribe — Free &amp; Paid →</a>
<a href="/about.html" class="na-flink">About Us</a><a href="/editorial.html" class="na-flink">Editorial Standards</a><a href="/tip-line.html" class="na-flink">Tip Line</a></div>
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
</footer>
<script>
async function naSubscribe(){
  const email=document.getElementById('na-sidebar-email').value.trim();
  if(!email||!email.includes('@'))return;
  try{
    const r=await fetch('https://brevo-subscribe.steve-5cb.workers.dev',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,source:'pursue-investigation'})});
    if(r.ok){document.getElementById('na-sidebar-form').innerHTML='<p style="color:#E11D48;font-weight:600;font-size:14px">✓ Subscribed.</p>';}
  }catch(e){}
}
</script>
</body>
</html>`;

  // Write article
  const articlePath = `${SITE_DIR}/articles/${filename}`;
  fs.writeFileSync(articlePath, html);

  // Update DB
  db.push({
    title,
    slug,
    filename,
    category: 'Unexplained',
    author: 'casey-north',
    isInvestigation: true,
    isPursue: true,
    generatedAt: dateISO,
    pubDate: dateISO,
    description,
    source: 'war.gov/ufo PURSUE'
  });
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

  // Commit and push
  execSync(`cd ${SITE_DIR} && git add -A && git -c user.name="newsanarchist-bot" -c user.email="bot@newsanarchist.com" commit -m "feat: Casey North PURSUE investigation — ${title.slice(0,60)}" && git push`, { stdio: 'inherit' });

  console.log(`\n✅ Investigation published: articles/${filename}`);
  console.log(`   Title: ${title}`);
  console.log(`   Documents embedded: ${downloaded.length}`);
  console.log('\n✅ Done. Run wrangler deploy to publish.');
}

main().catch(e => { console.error(e); process.exit(1); });
