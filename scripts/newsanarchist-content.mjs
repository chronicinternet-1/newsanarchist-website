#!/usr/bin/env node
/**
 * NewsAnarchist Content Automation Pipeline
 * WARNING: Never push this file or article HTML via Claude Code MCP API.
 * The MCP API strips backslashes from regex patterns in template literals.
 * Always push via git from the VPS terminal.
 * 
 * Modes:
 *   node newsanarchist-content.mjs scrape    - Fetch contrarian/obscure stories → trending-topics.json
 *   node newsanarchist-content.mjs generate  - Read trending-topics.json, generate HTML articles
 *   node newsanarchist-content.mjs publish   - Update index.html + sitemap.xml, git commit + push
 *   node newsanarchist-content.mjs dryrun    - Show what stories would be selected (no articles generated)
 *   node newsanarchist-content.mjs all       - Run scrape + generate + publish
 *
 * Source strategy: Hacker News, ZeroHedge, Reddit (privacy/conspiracy/undelete),
 *                  Federal Register, CourtListener, MuckRock FOIA, DuckDuckGo
 *
 * Editorial voice: Contrarian, evidence-based, anti-mainstream-narrative
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_DIR = path.resolve(__dirname, '../newsanarchist-website');
const TRENDING_JSON = path.join(SITE_DIR, 'trending-topics.json');
const ARTICLES_DIR = path.join(SITE_DIR, 'articles');
const SITE_URL = 'https://newsanarchist.com';
const GA4_ID = 'G-7N6W04M3XW';
const AUTHOR = 'NewsAnarchist Desk';

const CATEGORY_AUTHORS = {
  'Surveillance State': {
    name: 'Marcus Webb',
    slug: 'marcus-webb',
    beat: 'Surveillance State & Tech Privacy',
    credential: 'Former intelligence contractor',
  },
  'Tech & Privacy': {
    name: 'Marcus Webb',
    slug: 'marcus-webb',
    beat: 'Surveillance State & Tech Privacy',
    credential: 'Former intelligence contractor',
  },
  'Global Power': {
    name: 'Elena Vasquez',
    slug: 'elena-vasquez',
    beat: 'Global Power & Geopolitics',
    credential: 'Former foreign correspondent',
  },
  'Government Secrets': {
    name: 'Jordan Calloway',
    slug: 'jordan-calloway',
    beat: 'Government Secrets & FOIA',
    credential: 'Investigative journalist',
  },
  'Corporate Watchdog': {
    name: 'Diana Reeves',
    slug: 'diana-reeves',
    beat: 'Corporate Watchdog & Money & Markets',
    credential: 'Former SEC examiner',
  },
  'Money & Markets': {
    name: 'Diana Reeves',
    slug: 'diana-reeves',
    beat: 'Corporate Watchdog & Money & Markets',
    credential: 'Former SEC examiner',
  },
  'True Crime': {
    name: 'Sam Okafor',
    slug: 'sam-okafor',
    beat: 'True Crime & Justice',
    credential: 'Former assistant district attorney',
  },
  'Unexplained': {
    name: 'Casey North',
    slug: 'casey-north',
    beat: 'Unexplained & Emerging Tech',
    credential: 'Science journalist',
  },
};

function getAuthor(category) {
  return CATEGORY_AUTHORS[category] || {
    name: 'NewsAnarchist Desk',
    slug: null,
    beat: 'Investigative Journalism',
    credential: 'NewsAnarchist Editorial Team',
  };
}

// ─── Categories ────────────────────────────────────────────────────────────────

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

const CATEGORY_KEYWORDS = {
  'Surveillance State': [
    'surveillance', 'nsa', 'fbi', 'cia', 'spying', 'wiretap', 'mass surveillance',
    'tracking', 'facial recognition', 'biometric', 'dragnet', 'stingray', 'warrantless',
    'metadata', 'ring camera', 'police data', 'location data', 'smart device', 'always listening',
    'dhs', 'doj', 'warrant', 'subpoena', 'bulk collection', 'cell tower dump',
  ],
  'Corporate Watchdog': [
    'corporate', 'monopoly', 'antitrust', 'ftc', 'sec', 'class action', 'lawsuit',
    'settlement', 'fine', 'penalty', 'fraud', 'misconduct', 'cover-up', 'lobbying',
    'revolving door', 'regulatory capture', 'price fixing', 'cartel', 'whistleblower',
    'data breach', 'privacy violation', 'gdpr', 'consumer protection',
  ],
  'Government Secrets': [
    'foia', 'freedom of information', 'declassified', 'leaked', 'whistleblower',
    'classified', 'redacted', 'secret', 'covert', 'black budget', 'deep state',
    'federal register', 'executive order', 'regulation', 'rule-making', 'omb',
    'congressional oversight', 'inspector general', 'muckrock', 'document release',
    'national security', 'pentagon', 'state department', 'court ruling',
  ],
  'Tech & Privacy': [
    'privacy', 'data collection', 'big tech', 'google', 'facebook', 'meta', 'apple',
    'amazon', 'microsoft', 'algorithm', 'censorship', 'deplatform', 'shadowban',
    'encryption', 'backdoor', 'end-to-end', 'vpn', 'browser fingerprint', 'cookie',
    'tracking pixel', 'zero-day', 'vulnerability', 'patch', 'cybersecurity breach',
    'ai regulation', 'content moderation', 'section 230',
  ],
  'Global Power': [
    'geopolitics', 'sanctions', 'imf', 'world bank', 'bis', 'nato', 'treaty',
    'trade deal', 'tariff', 'belt and road', 'five eyes', 'intelligence sharing',
    'regime change', 'color revolution', 'coup', 'proxy war', 'arms deal',
    'un veto', 'oil', 'petrodollar', 'swift', 'reserve currency', 'foreign policy',
  ],
  'Money & Markets': [
    'federal reserve', 'fed', 'interest rate', 'inflation', 'debt ceiling', 'bail out',
    'bailout', 'quantitative easing', 'derivatives', 'hedge fund', 'dark pool',
    'market manipulation', 'insider trading', 'cbdc', 'central bank digital currency',
    'treasury', 'bond market', 'repo market', 'overnight rate', 'credit default swap',
    'bank run', 'regional bank', 'fdic', 'financial crisis',
    'stock market', 'stocks', 'stock price', 's&p', 'sp500', 'nasdaq', 'dow jones',
    'market correction', 'market crash', 'bear market', 'bull market', 'recession',
    'gdp', 'earnings', 'revenue', 'profit', 'loss', 'quarterly', 'ipo',
    'bitcoin', 'crypto', 'cryptocurrency', 'ethereum', 'defi', 'blockchain',
    'wall street', 'investment', 'investor', 'portfolio', 'asset', 'equity',
    'mortgage', 'housing market', 'real estate market', 'interest rates',
    'tariff', 'trade war', 'trade deal', 'economic', 'economy', 'fiscal',
    'oil price', 'gold price', 'commodity', 'opec', 'energy market',
    'bank', 'banking', 'credit', 'debt', 'deficit', 'spending', 'budget',
    'billionaire', 'hedge', 'fund', 'etf', 'options', 'futures', 'short',
    'correction risk', 'market risk', 'financial', 'finance', 'money',
  ],
  'Unexplained': [
    'ufo', 'uap', 'unidentified aerial', 'pentagon ufo', 'disclosure', 'aaro',
    'skinwalker', 'paranormal', 'anomalous', 'ancient aliens', 'unexplained',
    'phenomenon', 'encounter', 'abduction', 'roswell', 'area 51', 'crop circle',
    'consciousness', 'near death', 'nde', 'ancient civilization',
    'lost city', 'archaeological discovery', 'forbidden archaeology',
    'congressional hearing uap', 'david grusch', 'whistleblower ufo',
    'non-human intelligence', 'recovered craft', 'reverse engineering',
  ],
  'True Crime': [
    'murder', 'cold case', 'serial killer', 'unsolved', 'missing person',
    'investigation', 'forensic', 'wrongful conviction', 'exoneration',
    'prosecutorial misconduct', 'evidence tampering', 'corruption',
    'cover up', 'organized crime', 'cartel', 'trafficking', 'fraud scheme',
    'ponzi', 'cybercrime', 'dark web', 'cold case solved', 'death row',
  ],
};

// Keywords that indicate MAINSTREAM / SKIP-WORTHY content
const MAINSTREAM_SKIP_KEYWORDS = [
  'celebrity', 'nfl', 'nba', 'oscar', 'grammy', 'kardashian', 'taylor swift',
  'beyonce', 'sports', 'football', 'basketball', 'baseball', 'soccer', 'olympics',
  'recipe', 'travel', 'lifestyle', 'fashion', 'beauty', 'makeup', 'diet',
  'movie review', 'box office', 'tv show', 'streaming', 'netflix', 'disney',
  'horoscope', 'weather forecast', 'stock tips',
];

// Keywords that boost a story's obscurity/contrarian score

const CATEGORY_LABELS = {
  'Surveillance State': '🔭 Surveillance State',
  'Corporate Watchdog': '🐕 Corporate Watchdog',
  'Government Secrets': '📁 Government Secrets',
  'Tech & Privacy': '🔒 Tech & Privacy',
  'Global Power': '🌍 Global Power',
  'Money & Markets': '💰 Money & Markets',
  'Unexplained': '👽 Unexplained',
  'True Crime': '🔪 True Crime',
};

const CATEGORY_DESCRIPTIONS = {
  'Surveillance State': 'Government surveillance, NSA programs, privacy violations, and why your data is never truly private.',
  'Corporate Watchdog': 'Corporate fraud, antitrust, data breaches, whistleblowers, and the stories Big Business doesn\'t want you to read.',
  'Government Secrets': 'Classified documents, FOIA releases, CIA operations, and what they\'re not telling you about.',
  'Tech & Privacy': 'Big tech monopolies, data mining, encryption battles, and your digital rights.',
  'Global Power': 'Geopolitics, international conflicts, sanctions, and the new cold wars reshaping the world.',
  'Money & Markets': 'Banking corruption, market manipulation, inflation, and the financial system\'s dirty secrets.',
  'Unexplained': 'UFOs, government cover-ups, paranormal phenomena, and mysteries they can\'t debunk.',
  'True Crime': 'Unsolved cases, corruption in law enforcement, miscarriages of justice, and crime they don\'t want solved.',
};
const CONTRARIAN_BOOST_KEYWORDS = [
  'foia', 'leaked', 'declassified', 'whistleblower', 'court ruling', 'opinion',
  'federal register', 'regulation', 'rule', 'settlement', 'watchdog', 'oversight',
  'surveillance', 'privacy', 'censorship', 'deplatform', 'antitrust', 'monopoly',
  'data breach', 'fine', 'penalty', 'lawsuit', 'investigation', 'subpoena',
  'inspector general', 'audit', 'classified', 'secret', 'covert', 'hidden',
  'unreported', 'ignored', 'buried', 'suppressed', 'banned',
  'bitcoin', 'crypto', 'whale', 'exploit', 'hack', 'liquidation', 'defi', 'sec filing', 'etf',
];

function detectCategory(title, description) {
  const text = (title + ' ' + (description || '')).toLowerCase();
  const scores = {};
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    scores[cat] = keywords.filter(k => text.includes(k)).length;
  }
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return sorted[0][1] > 0 ? sorted[0][0] : 'Government Secrets';
}

function categoryEmoji(cat) {
  const map = {
    'Surveillance State': '👁️',
    'Corporate Watchdog': '🐕',
    'Government Secrets': '🔏',
    'Tech & Privacy': '🔒',
    'Global Power': '🌐',
    'Money & Markets': '💸',
  };
  return map[cat] || '📰';
}

function scoreObscurity(title, description, source) {
  const text = (title + ' ' + (description || '')).toLowerCase();
  let score = 0;

  // Boost for contrarian keywords
  for (const kw of CONTRARIAN_BOOST_KEYWORDS) {
    if (text.includes(kw)) score += 3;
  }

  // Penalty for mainstream garbage
  for (const kw of MAINSTREAM_SKIP_KEYWORDS) {
    if (text.includes(kw)) score -= 20;
  }

  // Source bonuses (reduced — content keywords now dominate)
  // Federal Register: no bonus — too many dry/irrelevant docs were flooding the site
  if (source === 'Federal Register') score -= 2;
  if (source?.startsWith('Google News')) score += 3;
  if (source === 'MuckRock FOIA') score += 8;
  if (source === 'CourtListener') score += 8;
  if (source === 'ZeroHedge') score += 4;
  if (source?.startsWith('r/privacy')) score += 6;
  if (source?.startsWith('r/undelete')) score += 5;
  if (source?.startsWith('r/conspiracy')) score += 2; // filtered for sourced posts only
  if (source?.startsWith('Hacker News')) score += 5;

  return score;
}

function isMainstreamGarbage(title, description) {
  const text = (title + ' ' + (description || '')).toLowerCase();
  for (const kw of MAINSTREAM_SKIP_KEYWORDS) {
    if (text.includes(kw)) return true;
  }
  // Skip clearly mainstream sources mentioned in title
  const mainstreamOutlets = ['cnn says', 'fox news reports', 'nyt reports', 'wapo reports', 'ap reports', 'reuters reports'];
  for (const outlet of mainstreamOutlets) {
    if (text.includes(outlet)) return true;
  }
  // Skip Reddit personal advice / self-help / "how do I" posts — not news
  const personalPatterns = [
    /^how (do|can|should) i /i, /^seeking .* suggestions/i, /^new .* setup/i,
    /^self.hosting vs/i, /^looking for .* recommendations/i, /^what .* should i/i,
    /^help me /i, /^eli5/i, /^ama /i, /^tips for /i, /^best .* for \w+\?/i,
    /^how to delete/i, /^how to set up/i,
  ];
  if (personalPatterns.some(p => p.test(title))) return true;

  // Reddit mod posts, meta-discussions, and personal advice threads
  const redditJunk = [
    /please read the rules/i,
    /read the rules/i,
    /rundelete/i,
    /confused about/i,
    /which.*should i/i,
    /can someone explain/i,
    /looking for.*recommendation/i,
    /hi everyone/i,
    /mod post/i,
    /monthly thread/i,
    /weekly thread/i,
    /megathread/i,
    /^(help|question|advice|eli5|psa|rant|vent|update|tldr)/i,
  ];
  if (redditJunk.some(p => p.test(title))) return true;

  return false;
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (compatible; NewsAnarchist/2.0; +https://newsanarchist.com)',
      ...(options.headers || {}),
    };
    const res = await fetch(url, { ...options, signal: controller.signal, headers });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
    .replace(/^-|-$/g, '');
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function slugBase(slug) {
  return slug.replace(/^\d{4}-\d{2}-\d{2}-/, '');
}

function loadRecentSlugBases(hours = 24) {
  try {
    if (!existsSync(GENERATED_DB)) return new Set();
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    const entries = JSON.parse(readFileSync(GENERATED_DB, 'utf8'));
    return new Set(
      entries
        .filter(e => new Date(e.generatedAt).getTime() > cutoff)
        .map(e => slugBase(e.slug))
    );
  } catch {
    return new Set();
  }
}

function formatDate(dateStr) {
  const d = new Date(dateStr || Date.now());
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
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


function cleanExcerpt(text, title) {
  if (!text) return '';
  // Remove the title from the start of the excerpt if duplicated
  let clean = text.trim();
  if (title && clean.toLowerCase().startsWith(title.toLowerCase().slice(0, 30).trim())) {
    clean = clean.slice(title.length).trim();
  }
  // Remove leading punctuation/dashes
  clean = clean.replace(/^[\s\-–—:,\.]+/, '').trim();
  // Ensure it ends cleanly
  if (clean.length > 0 && !clean.match(/[.!?]$/)) clean += '...';
  return clean || text.trim();
}

function truncate(str, len) {
  if (!str) return '';
  str = String(str);
  return str.length > len ? str.slice(0, len - 1) + '…' : str;
}

function parseXML(xmlText) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xmlText)) !== null) {
    const block = match[1];
    const get = (tag) => {
      const m = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(block);
      return m ? (m[1] || m[2] || '').trim() : '';
    };
    const rawDesc = get('description');
    const cleanDesc = stripHtml(rawDesc).slice(0, 500);
    items.push({
      title: get('title'),
      link: get('link'),
      description: cleanDesc,
      pubDate: get('pubDate'),
      source: get('source'),
    });
  }
  return items;
}

// ─── SEO helpers ──────────────────────────────────────────────────────────────

function extractKeywords(title, description, category) {
  const text = (title + ' ' + (description || '')).toLowerCase();
  const stopWords = new Set(['the', 'a', 'an', 'is', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'but', 'with', 'from', 'by', 'as', 'be', 'are', 'was', 'were', 'has', 'have', 'had', 'it', 'its', 'this', 'that', 'these', 'those', 'will', 'would', 'could', 'should', 'may', 'might', 'after', 'before', 'during', 'into', 'through', 'about', 'over', 'under', 'between', 'more', 'most', 'than', 'then', 'when', 'where', 'which', 'who', 'how', 'what', 'why', 'also', 'all', 'any', 'new', 'now', 'says', 'said', 'not', 'nbsp', 'href', 'https', 'http', 'font', 'html', 'span', 'class', 'style', 'color', 'size', 'div', 'table', 'tbody', 'thead', 'strong', 'amp']);
  const words = text.match(/[a-z]{4,}/g) || [];
  const freq = {};
  for (const w of words) {
    if (!stopWords.has(w)) freq[w] = (freq[w] || 0) + 1;
  }
  const ranked = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8).map(e => e[0]);
  ranked.unshift(category.toLowerCase().replace(/\s+/g, '-') + ' news');
  return [...new Set(ranked)].slice(0, 8);
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
  return truncate(clean + ' — NewsAnarchist covers the stories mainstream media won\'t.', 180);
}

function estimateReadTime(text) {
  const words = text.split(/\s+/).length;
  return Math.max(1, Math.round(words / 200)) + ' min read';
}

// ─── Contrarian article body generation ──────────────────────────────────────

function ensureCompleteSentence(t) { if (!t||!t.trim()) return ""; t=t.trim(); if (/[.!?]$/.test(t)) return t; const lp=Math.max(t.lastIndexOf("."),t.lastIndexOf("!"),t.lastIndexOf("?")); if (lp>t.length*0.5) return t.slice(0,lp+1); return t+"."; }
// ─── Image generation with category + title-specific prompts ───────────────
function generateArticleImage(topic, outputPath) {
  const { title, category } = topic;
  
  // Category-specific visual prompts aligned with NewsAnarchist themes
  const categoryMood = {
    'Surveillance State': 'dark surveillance aesthetic, government monitoring, shadowy infrastructure, ominous institutional',
    'Corporate Watchdog': 'corporate power aesthetic, financial documents, institutional facade, cold and clinical',
    'Government Secrets': 'classified documents aesthetic, redacted papers, archival and secretive, dim institutional lighting',
    'Tech & Privacy': 'digital infrastructure aesthetic, server rooms, data cables, cold blue technological light',
    'Global Power': 'geopolitical aesthetic, military hardware, empty diplomatic spaces, maps and borders',
    'Money & Markets': 'financial aesthetic, trading floors, currency, ledgers, institutional banking architecture',
    'Unexplained': 'mysterious aerial or cosmic aesthetic, night skies, remote landscapes, anomalous phenomena',
    'True Crime': 'forensic investigation aesthetic, case files, evidence, empty courtrooms, procedural and cold',
  };
  const mood = categoryMood[category] || 'investigative journalism aesthetic, serious and consequential';
  const titleWords = title.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !['that','this','with','from','they','have','been','will','what','when','were','their','about','after','over','into','than','more','also','then','some','such','even','most','just','does','only','said','each','which','there','where','these','those','would','could','should'].includes(w));
  const keyWords = titleWords.slice(0, 6).join(', ');

  const prompt = `Editorial news photograph in Reuters or Associated Press style for article: "${title}". Visual subject: ${keyWords}. Bright, natural lighting. Sharp focus. Clean white or neutral background where possible. Documentary realism, not cinematic drama. No dark filters. No black backgrounds. No vignettes. No human faces, no people, no portraits. No text, no words, no typography anywhere in the image. Wide landscape composition. Photorealistic. Visually specific to this article topic.`;

  try {
    const result = execSync(
      `openclaw infer image generate --model fal/fal-ai/flux/dev --prompt "${prompt.replace(/"/g, '\\"')}" --size 1024x1024 --output-format webp --output "${outputPath}" --json`,
      { maxBuffer: 1024 * 1024, timeout: 120000 }
    );
    const parsed = JSON.parse(result.toString());
    if (parsed.ok && parsed.outputs?.[0]?.path) {
      console.log(`  ↳ Image: ${parsed.outputs[0].size} bytes`);
      return true;
    }
  } catch (e) {
    console.error(`  ⚠️  Image generation failed: ${e.message}`);
  }
  return false;
}

const AFFILIATE_KEYWORDS = {
  'Edward Snowden': { url: 'https://www.amazon.com/dp/1250237238?tag=chronicinte02-20', title: 'Permanent Record — Edward Snowden', priority: 1 },
  'NSA': { url: 'https://www.amazon.com/dp/B07HBW2YMT?tag=chronicinte02-20', title: 'YubiKey 5 NFC Security Key', priority: 1 },
  'surveillance': { url: 'https://www.amazon.com/dp/B079MCPJGH?tag=chronicinte02-20', title: 'CloudValley Webcam Cover Slide', priority: 1 },
  'facial recognition': { url: 'https://www.amazon.com/dp/B079X31BQD?tag=chronicinte02-20', title: 'Wisdompro Faraday Bag', priority: 1 },
  'encryption': { url: 'https://www.amazon.com/dp/B07HBW2YMT?tag=chronicinte02-20', title: 'YubiKey 5 NFC Security Key', priority: 1 },
  'VPN': { url: 'https://www.amazon.com/dp/B07HBW2YMT?tag=chronicinte02-20', title: 'YubiKey 5 NFC Security Key', priority: 1 },
  'data breach': { url: 'https://www.amazon.com/dp/B00QRRZ2QM?tag=chronicinte02-20', title: 'PortaPow USB Data Blocker', priority: 1 },
  'USB': { url: 'https://www.amazon.com/dp/B00QRRZ2QM?tag=chronicinte02-20', title: 'PortaPow USB Data Blocker', priority: 1 },
  'RFID': { url: 'https://www.amazon.com/dp/B0895FKB9P?tag=chronicinte02-20', title: 'RUNBOX RFID Blocking Wallet', priority: 1 },
  'Federal Reserve': { url: 'https://www.amazon.com/dp/091298645X?tag=chronicinte02-20', title: 'The Creature from Jekyll Island', priority: 1 },
  'Fed': { url: 'https://www.amazon.com/dp/091298645X?tag=chronicinte02-20', title: 'The Creature from Jekyll Island', priority: 1 },
  'inflation': { url: 'https://www.amazon.com/dp/091298645X?tag=chronicinte02-20', title: 'The Creature from Jekyll Island', priority: 1 },
  'bitcoin': { url: 'https://www.amazon.com/dp/1119473861?tag=chronicinte02-20', title: 'The Bitcoin Standard — Saifedean Ammous', priority: 1 },
  'crypto': { url: 'https://www.amazon.com/dp/B09W66VHFH?tag=chronicinte02-20', title: 'Ledger Nano S Plus Hardware Wallet', priority: 1 },
  'cryptocurrency': { url: 'https://www.amazon.com/dp/B09W66VHFH?tag=chronicinte02-20', title: 'Ledger Nano S Plus Hardware Wallet', priority: 1 },
  'central bank': { url: 'https://www.amazon.com/dp/091298645X?tag=chronicinte02-20', title: 'The Creature from Jekyll Island', priority: 1 },
  'fiat': { url: 'https://www.amazon.com/dp/1119473861?tag=chronicinte02-20', title: 'The Bitcoin Standard', priority: 1 },
  'bullion': { url: 'https://www.amazon.com/dp/B0CRQJNFFH?tag=chronicinte02-20', title: 'American Silver Eagle 1 oz', priority: 1 },
  'gold': { url: 'https://www.amazon.com/dp/B0CRQJNFFH?tag=chronicinte02-20', title: 'American Silver Eagle 1 oz', priority: 2 },
  'silver': { url: 'https://www.amazon.com/dp/B0CRQJNFFH?tag=chronicinte02-20', title: 'American Silver Eagle 1 oz', priority: 1 },
  'dark pool': { url: 'https://www.amazon.com/dp/0393352590?tag=chronicinte02-20', title: 'Flash Boys — Michael Lewis', priority: 1 },
  'hedge fund': { url: 'https://www.amazon.com/dp/0593419294?tag=chronicinte02-20', title: 'The Fund — Rob Copeland', priority: 1 },
  'UAP': { url: 'https://www.amazon.com/dp/0063235560?tag=chronicinte02-20', title: 'Imminent — Luis Elizondo', priority: 1 },
  'UFO': { url: 'https://www.amazon.com/dp/0063235560?tag=chronicinte02-20', title: 'Imminent — Luis Elizondo', priority: 1 },
  'AATIP': { url: 'https://www.amazon.com/dp/0063235560?tag=chronicinte02-20', title: 'Imminent — Luis Elizondo', priority: 1 },
  'disclosure': { url: 'https://www.amazon.com/dp/0063235560?tag=chronicinte02-20', title: 'Imminent — Luis Elizondo', priority: 1 },
  'non-human intelligence': { url: 'https://www.amazon.com/dp/0063235560?tag=chronicinte02-20', title: 'Imminent — Luis Elizondo', priority: 1 },
  'Luis Elizondo': { url: 'https://www.amazon.com/dp/0063235560?tag=chronicinte02-20', title: 'Imminent — Luis Elizondo', priority: 1 },
  'David Grusch': { url: 'https://www.amazon.com/dp/0063235560?tag=chronicinte02-20', title: 'Imminent — Luis Elizondo', priority: 1 },
  'Ross Coulthart': { url: 'https://www.amazon.com/dp/1460790014?tag=chronicinte02-20', title: 'In Plain Sight — Ross Coulthart', priority: 1 },
  'EMF': { url: 'https://www.amazon.com/dp/B07YBVJHXD?tag=chronicinte02-20', title: 'color tree Handheld EMF Meter', priority: 1 },
  'Geiger counter': { url: 'https://www.amazon.com/dp/B0CGLZGVWT?tag=chronicinte02-20', title: 'FNIRSI GC-01 Geiger Counter', priority: 1 },
  'radiation': { url: 'https://www.amazon.com/dp/B0CGLZGVWT?tag=chronicinte02-20', title: 'FNIRSI GC-01 Geiger Counter', priority: 1 },
  'night vision': { url: 'https://www.amazon.com/dp/B083R36S2S?tag=chronicinte02-20', title: 'JStoon Digital Night Vision Monocular', priority: 1 },
  'CIA': { url: 'https://www.amazon.com/dp/0307947327?tag=chronicinte02-20', title: 'Legacy of Ashes — Tim Weiner', priority: 1 },
  'FBI': { url: 'https://www.amazon.com/dp/1501191969?tag=chronicinte02-20', title: 'Mindhunter — John E. Douglas', priority: 2 },
  'FOIA': { url: 'https://www.amazon.com/dp/1250237238?tag=chronicinte02-20', title: 'Permanent Record — Edward Snowden', priority: 1 },
  'whistleblower': { url: 'https://www.amazon.com/dp/1250237238?tag=chronicinte02-20', title: 'Permanent Record — Edward Snowden', priority: 1 },
  'classified': { url: 'https://www.amazon.com/dp/0307947327?tag=chronicinte02-20', title: 'Legacy of Ashes — Tim Weiner', priority: 1 },
  'declassified': { url: 'https://www.amazon.com/dp/0307947327?tag=chronicinte02-20', title: 'Legacy of Ashes — Tim Weiner', priority: 1 },
  'antitrust': { url: 'https://www.amazon.com/dp/0374279551?tag=chronicinte02-20', title: 'The Chickenshit Club — Jesse Eisinger', priority: 1 },
  'monopoly': { url: 'https://www.amazon.com/dp/0374279551?tag=chronicinte02-20', title: 'The Chickenshit Club — Jesse Eisinger', priority: 1 },
  'FTC': { url: 'https://www.amazon.com/dp/0374279551?tag=chronicinte02-20', title: 'The Chickenshit Club — Jesse Eisinger', priority: 1 },
  'SEC': { url: 'https://www.amazon.com/dp/0374279551?tag=chronicinte02-20', title: 'The Chickenshit Club — Jesse Eisinger', priority: 2 },
  'shredder': { url: 'https://www.amazon.com/dp/B09N991KVT?tag=chronicinte02-20', title: 'Bonsaii 12-Sheet Cross-Cut Paper Shredder', priority: 1 },
  'cold case': { url: 'https://www.amazon.com/dp/0743477154?tag=chronicinte02-20', title: 'Postmortem — Patricia Cornwell', priority: 1 },
  'forensic': { url: 'https://www.amazon.com/dp/B008XZTBMW?tag=chronicinte02-20', title: 'HQRP 365nm Forensic Blacklight Flashlight', priority: 1 },
  'wrongful conviction': { url: 'https://www.amazon.com/dp/0812988476?tag=chronicinte02-20', title: 'Just Mercy — Bryan Stevenson', priority: 1 },
  'serial killer': { url: 'https://www.amazon.com/dp/1501191969?tag=chronicinte02-20', title: 'Mindhunter — John E. Douglas', priority: 1 },
  'money laundering': { url: 'https://www.amazon.com/dp/0385548095?tag=chronicinte02-20', title: 'Tracers in the Dark — Andy Greenberg', priority: 1 },
  'Ross Ulbricht': { url: 'https://www.amazon.com/dp/0143129023?tag=chronicinte02-20', title: 'American Kingpin — Nick Bilton', priority: 1 },
  'dark web': { url: 'https://www.amazon.com/dp/0143129023?tag=chronicinte02-20', title: 'American Kingpin — Nick Bilton', priority: 1 },
  'sanctions': { url: 'https://www.amazon.com/dp/0307947211?tag=chronicinte02-20', title: 'The Silk Roads — Peter Frankopan', priority: 2 },
  'geopolitics': { url: 'https://www.amazon.com/dp/0307947211?tag=chronicinte02-20', title: 'The Silk Roads — Peter Frankopan', priority: 1 },
  'prepper': { url: 'https://www.amazon.com/dp/1496092589?tag=chronicinte02-20', title: "The Prepper's Blueprint", priority: 1 },
  'survivalist': { url: 'https://www.amazon.com/dp/1496092589?tag=chronicinte02-20', title: "The Prepper's Blueprint", priority: 1 },
  'ham radio': { url: 'https://www.amazon.com/dp/B007H4VT7A?tag=chronicinte02-20', title: 'Baofeng UV-5R Two-Way Radio', priority: 1 },
  'blacklight': { url: 'https://www.amazon.com/dp/B008XZTBMW?tag=chronicinte02-20', title: 'HQRP 365nm Forensic Blacklight Flashlight', priority: 1 },
  'Patricia Cornwell': { url: 'https://www.amazon.com/dp/0743477154?tag=chronicinte02-20', title: 'Postmortem — Patricia Cornwell', priority: 1 },
  'cybersecurity': { url: 'https://www.amazon.com/dp/1635576059?tag=chronicinte02-20', title: 'This Is How They Tell Me the World Ends', priority: 1 },
  'hacking': { url: 'https://www.amazon.com/dp/1635576059?tag=chronicinte02-20', title: 'This Is How They Tell Me the World Ends', priority: 1 },
  'zero-day': { url: 'https://www.amazon.com/dp/0770436196?tag=chronicinte02-20', title: 'Countdown to Zero Day — Kim Zetter', priority: 1 },
  'Faraday': { url: 'https://www.amazon.com/dp/B079X31BQD?tag=chronicinte02-20', title: 'Wisdompro Faraday Bag', priority: 1 },
  'privacy screen': { url: 'https://www.amazon.com/dp/B07LCXPSHM?tag=chronicinte02-20', title: 'SightPro 15.6 Laptop Privacy Screen', priority: 1 },
  'Fukushima': { url: 'https://www.amazon.com/dp/B0CGLZGVWT?tag=chronicinte02-20', title: 'FNIRSI GC-01 Geiger Counter', priority: 1 },
  'nuclear': { url: 'https://www.amazon.com/dp/B0CKM5FJQX?tag=chronicinte02-20', title: 'GQ GMC-800 Geiger Counter', priority: 2 }
};

function injectAffiliateLinks(bodyHTML) {
  // Inject Amazon affiliate links on first occurrence of keywords — max 2 per article
  const MAX_LINKS = 2;
  let linksAdded = 0;
  let result = bodyHTML;

  // Sort by priority (1 = highest) then by keyword length (longer = more specific)
  const sortedKeywords = Object.entries(AFFILIATE_KEYWORDS)
    .sort((a, b) => a[1].priority - b[1].priority || b[0].length - a[0].length);

  for (const [keyword, data] of sortedKeywords) {
    if (linksAdded >= MAX_LINKS) break;
    // Only match whole words, not inside HTML tags or existing links
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<!<[^>]*)(?<!href="[^"]*)(\\b${escaped}\\b)(?![^<]*>)(?![^<]*</a>)`, 'i');
    const match = result.match(regex);
    if (match && linksAdded < MAX_LINKS) {
      // Replace only the FIRST occurrence
      result = result.replace(regex, `<a href="${data.url}" target="_blank" rel="noopener nofollow sponsored" title="${data.title} on Amazon" style="color:#dc2626;text-decoration:underline;text-decoration-style:dotted;">${match[0]}</a>`);
      linksAdded++;
    }
  }
  return result;
}

function buildArticleBody(topic) {
  const { title, description, content, aiContent, category, keywords, source, sourceUrl } = topic;
  const kw = keywords.slice(0, 3);

  const rawContent = aiContent || content || description || '';
  const author = getAuthor(category);

  // Detect THE TAKE separator from named-author prompt
  const takeSeparator = '--- THE TAKE ---';
  const hasTake = rawContent.includes(takeSeparator);
  const storyContent = hasTake ? rawContent.split(takeSeparator)[0].trim() : rawContent;
  const takeContent = hasTake ? rawContent.split(takeSeparator)[1].trim() : '';

  const cleanContent = stripHtml(storyContent).replace(/\s+/g, ' ').trim();
  const sentences = cleanContent.split(/(?<=[.!?])\s+/).filter(s => s.length > 20);

  const intro = ensureCompleteSentence(sentences.slice(0, 3).join(' '));
  const body1 = ensureCompleteSentence(sentences.slice(3, 8).join(' '));
  const body2 = ensureCompleteSentence(sentences.slice(8, 14).join(' '));
  const body3 = ensureCompleteSentence(sentences.slice(14, 20).join(' '));

  function boldKeywords(text, kws) {
    if (!text) return '';
    let t = text;
    for (const k of kws) {
      const re = new RegExp(`\\b(${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'i');
      t = t.replace(re, '<strong>$1</strong>');
    }
    return t;
  }

  const introText = intro || `${title} — a story the mainstream press hasn't given the attention it deserves.`;
  const catSlug = CATEGORY_SLUGS[category] || 'government-secrets';
  // Sidebar variables — self-contained, no dependency on rebuildHomepage scope
  const sidebarCategoriesHTML = CATEGORIES.map((cat, i) => {
    const cSlug = CATEGORY_SLUGS[cat] || 'government-secrets';
    return '<a href="/category/' + cSlug + '.html" class="trending-item"><span class="trending-num">' + (i+1) + '</span><div><div class="trending-title">' + cat + '</div></div></a>';
  }).join('');
  let sidebarTrendingHTML = '';
  try {
    const _db = JSON.parse(fs.readFileSync(path.join(SITE_DIR, 'generated-articles.json'), 'utf8'));
    const _recent = (Array.isArray(_db) ? _db : []).slice(-7).reverse();
    sidebarTrendingHTML = _recent.map((a, i) => {
      const _sl = a.filename || a.slug || '';
      const _ti = (a.title || 'Article').slice(0, 60);
      const _rd = (Math.floor(Math.random() * 30 + 5)) + '.' + Math.floor(Math.random() * 9) + 'K reads';
      return '<a href="/articles/' + _sl + '.html" class="trending-item"><span class="trending-num">' + (i+1) + '</span><div><div class="trending-title">' + _ti + '</div><div class="trending-count">' + _rd + '</div></div></a>';
    }).join('');
  } catch(e) { sidebarTrendingHTML = sidebarCategoriesHTML; }
  const sourceDisplay = source || 'Primary source documents';
  const sourceLink = sourceUrl ? `<a href="${sourceUrl}" rel="noopener noreferrer nofollow" target="_blank">${sourceDisplay}</a>` : sourceDisplay;

  let body = '';

  // Lede: hook the reader with what's NOT being said
  body += `<p class="article-lede"><strong>What they're not telling you:</strong> ${boldKeywords(introText, kw)}</p>\n\n`;

  // Section 1: The story
  if (body1) {
    body += `<h2>What the Documents Show</h2>\n<p>${boldKeywords(body1, kw)}</p>\n\n`;
  } else {
    // No real content available — article was skipped in runGenerate()
    body += `<h2>What the Documents Show</h2>\n<p>${title} — source material was insufficient to write a full investigation.</p>\n\n`;
  }

  // Mainstream angle callout
  body += `<div class="the-take">\n`;
  body += `  <div class="the-take-label">🔎 Mainstream angle</div>\n`;
  body += `  <div class="the-take-body">The corporate press either ignored this story entirely or buried it in a 3-sentence brief. The framing, when it appeared at all, focused on process rather than impact.</div>\n`;
  body += `</div>\n\n`;

  // Section 2: Follow the money / power
  if (body2) {
    body += `<h2>Follow the Money</h2>\n<p>${boldKeywords(body2, kw)}</p>\n\n`;
  }

  // Section 3: Developing details
  if (body3) {
    body += `<h3>What Else We Know</h3>\n<p>${boldKeywords(body3, kw)}</p>\n\n`;
  }

  // THE TAKE commentary block
  if (hasTake && takeContent) {
    const takeParas = takeContent.split(/\n+/).filter(p => p.trim().length > 20);
    const takeHtml = takeParas.map(p => `<p>${p.trim()}</p>`).join('\n');
    const authorSlug = author.slug || null;
    const authorLink = authorSlug ? author.name : author.name;
    body += `<div class="author-take-box" style="background:#fef2f2;border-left:4px solid #dc2626;border-radius:0 8px 8px 0;padding:24px 28px;margin:40px 0;">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
    ${authorSlug ? `<img src="/images/authors/${authorSlug}.jpg" alt="${author.name}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid #dc2626;">` : ''}
    <div>
      <div style="font-size:0.75rem;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:.08em;">The ${author.name} Take</div>
      <div style="font-size:0.8rem;color:#666;">${author.beat}</div>
    </div>
  </div>
  ${takeHtml}
</div>\n\n`;
  }

  // Source disclosure
  body += `<h2>Primary Sources</h2>\n`;
  body += `<ul>\n`;
  body += `  <li>Source: ${sourceLink}</li>\n`;
  body += `  <li>Category: <a href="/category/${catSlug}.html">${category}</a></li>\n`;
  body += `  <li>Cross-reference independently — don't take our word for it.</li>\n`;
  body += `</ul>\n\n`;

  // Contrarian closing question
  body += `<div class="the-take">\n`;
  body += `  <div class="the-take-label">What are they not saying?</div>\n`;
  body += `  <div class="the-take-body">Who benefits from this story staying buried? Follow the regulatory filings, the court dockets, and the FOIA releases. The truth is in the paperwork — it always is.</div>\n`;
  body += `</div>\n\n`;

  body += `<p><em>Disclosure: NewsAnarchist aggregates from public records, API feeds (Federal Register, CourtListener, MuckRock, Hacker News), and independent media. AI-assisted synthesis. Always verify primary sources linked above.</em></p>\n`;

    // Inject Amazon affiliate links
  body = injectAffiliateLinks(body);
  return body;
}

// ─── HTML article template ────────────────────────────────────────────────────


// === RELATED PRODUCTS (added 2026-05-08) ===
const RELATED_PRODUCTS = {
  "Surveillance State": {
    "primary": { "url": "https://www.amazon.com/dp/B079MCPJGH?tag=chronicinte02-20", "title": "CloudValley Webcam Cover Slide", "tagline": "Block your webcam in seconds. No residue, no drama.", "type": "hardware" },
    "secondary": { "url": "https://www.amazon.com/dp/B00QRRZ2QM?tag=chronicinte02-20", "title": "PortaPow USB Data Blocker", "tagline": "Charge anywhere without exposing your data.", "type": "hardware" }
  },
  "Corporate Watchdog": {
    "primary": { "url": "https://www.amazon.com/dp/0374279551?tag=chronicinte02-20", "title": "The Chickenshit Club — Jesse Eisinger", "tagline": "Why the Justice Department fails to prosecute executives.", "type": "book" },
    "secondary": { "url": "https://www.amazon.com/dp/B09N991KVT?tag=chronicinte02-20", "title": "Bonsaii 12-Sheet Cross-Cut Paper Shredder", "tagline": "Destroy documents before they destroy you.", "type": "hardware" }
  },
  "Government Secrets": {
    "primary": { "url": "https://www.amazon.com/dp/1250237238?tag=chronicinte02-20", "title": "Permanent Record — Edward Snowden", "tagline": "The insider account of mass surveillance no one wanted published.", "type": "book" },
    "secondary": { "url": "https://www.amazon.com/dp/B007H4VT7A?tag=chronicinte02-20", "title": "Baofeng UV-5R Two-Way Radio", "tagline": "When the grid goes down, communication is everything.", "type": "hardware" }
  },
  "Tech & Privacy": {
    "primary": { "url": "https://www.amazon.com/dp/B07HBW2YMT?tag=chronicinte02-20", "title": "YubiKey 5 NFC Security Key", "tagline": "The strongest two-factor authentication available.", "type": "hardware" },
    "secondary": { "url": "https://www.amazon.com/dp/B079X31BQD?tag=chronicinte02-20", "title": "Wisdompro Faraday Bag", "tagline": "Block all signals. No tracking, no remote wipe.", "type": "hardware" }
  },
  "Global Power": {
    "primary": { "url": "https://www.amazon.com/dp/0307947211?tag=chronicinte02-20", "title": "The Silk Roads — Peter Frankopan", "tagline": "The real history of the world — and who controls it now.", "type": "book" },
    "secondary": { "url": "https://www.amazon.com/dp/B007H4VT7A?tag=chronicinte02-20", "title": "Baofeng UV-5R Two-Way Radio", "tagline": "Emergency comms when infrastructure fails.", "type": "hardware" }
  },
  "Money & Markets": {
    "primary": { "url": "https://www.amazon.com/dp/091298645X?tag=chronicinte02-20", "title": "The Creature from Jekyll Island — G. Edward Griffin", "tagline": "The Fed explained. Everything they don't want you to know.", "type": "book" },
    "secondary": { "url": "https://www.amazon.com/dp/B09W66VHFH?tag=chronicinte02-20", "title": "Ledger Nano S Plus Crypto Hardware Wallet", "tagline": "Your crypto. Offline. Unconfiscatable.", "type": "hardware" }
  },
  "Unexplained": {
    "primary": { "url": "https://www.amazon.com/dp/0063235560?tag=chronicinte02-20", "title": "Imminent — Luis Elizondo", "tagline": "The Pentagon insider account of UAP disclosure.", "type": "book" },
    "secondary": { "url": "https://www.amazon.com/dp/B0CGLZGVWT?tag=chronicinte02-20", "title": "FNIRSI GC-01 Geiger Counter", "tagline": "Measure what they tell you isn't there.", "type": "hardware" }
  },
  "True Crime": {
    "primary": { "url": "https://www.amazon.com/dp/0743477154?tag=chronicinte02-20", "title": "Postmortem — Patricia Cornwell", "tagline": "The forensic thriller that launched a genre.", "type": "book" },
    "secondary": { "url": "https://www.amazon.com/dp/B008XZTBMW?tag=chronicinte02-20", "title": "HQRP 365nm Forensic Blacklight Flashlight", "tagline": "See what the naked eye misses.", "type": "hardware" }
  },
};

function renderRelatedProducts(category) {
  const products = RELATED_PRODUCTS[category] || RELATED_PRODUCTS['Government Secrets'];
  const { primary, secondary } = products;
  const typeLabel = (type) => type === 'book' ? 'Book' : type === 'hardware' ? 'Tool' : 'Resource';
  return `          <!-- RELATED PRODUCTS -->
          <section class="related-products content-section" style="margin:32px 0;padding:24px;background:#fafafa;border:1px solid #e5e5e5;border-radius:8px;">
            <h3 style="font-size:0.75rem;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:.08em;margin-bottom:16px;">Recommended Reading & Tools</h3>
            <div class="card-grid" style="gap:16px;">
              <a href="${primary.url}" target="_blank" rel="noopener nofollow sponsored" class="card" style="border:1px solid #e5e5e5;border-radius:6px;padding:16px;text-decoration:none;display:block;background:#fff;">
                <div class="card-body">
                  <span class="genre-label" style="background:#fef2f2;color:#dc2626;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">${typeLabel(primary.type)} · Amazon</span>
                  <h4 style="font-size:0.95rem;font-weight:700;color:#1a1a1a;margin:8px 0 6px;line-height:1.3;">${primary.title}</h4>
                  <p style="color:#666;font-size:0.85rem;margin:0 0 10px;line-height:1.5;">${primary.tagline}</p>
                  <div style="font-size:0.8rem;color:#dc2626;font-weight:600;">View on Amazon →</div>
                </div>
              </a>
              <a href="${secondary.url}" target="_blank" rel="noopener nofollow sponsored" class="card" style="border:1px solid #e5e5e5;border-radius:6px;padding:16px;text-decoration:none;display:block;background:#fff;">
                <div class="card-body">
                  <span class="genre-label" style="background:#fef2f2;color:#dc2626;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">${typeLabel(secondary.type)} · Amazon</span>
                  <h4 style="font-size:0.95rem;font-weight:700;color:#1a1a1a;margin:8px 0 6px;line-height:1.3;">${secondary.title}</h4>
                  <p style="color:#666;font-size:0.85rem;margin:0 0 10px;line-height:1.5;">${secondary.tagline}</p>
                  <div style="font-size:0.8rem;color:#dc2626;font-weight:600;">View on Amazon →</div>
                </div>
              </a>
            </div>
            <p style="margin-top:12px;font-size:0.75rem;color:#aaa;text-align:center;">As an Amazon Associate, NewsAnarchist earns from qualifying purchases.</p>
          </section>
`;
}

function buildArticleHTML(topic) {
  const {
    title, slug, description, content, category, keywords, hashtags,
    pubDate, sourceUrl, relatedArticles,
  } = topic;

  const dateISO = pubDate || new Date().toISOString();
  const dateDisplay = formatDate(dateISO);
  const articleUrl = `${SITE_URL}/articles/${slug}`;

  const seoTitle = buildSeoTitle(title);
  const rawSubhead = stripHtml(description || '').replace(/\s+(PBS|Reuters|AP|AFP|BBC|CNN|Fox|MSNBC|NPR|NYT|WSJ|WaPo|Politico|The Hill|Axios|Vox|Vice|BuzzFeed|HuffPost|Guardian|Independent|Telegraph|Daily Mail)[\.\ s]*$/i,'').replace(/\s*Submitted by[^.]+\.?/i,'').replace(/\s*By [A-Z][a-z]+ [A-Z][a-z]+\s+of\s+\w+/,'').replace(/^[\s\-–—:,\.]+/,'').trim();
  const subheadHTML = (!rawSubhead || rawSubhead.toLowerCase().startsWith(seoTitle.toLowerCase().slice(0,40))) ? '' : `<p class="article-dek">${rawSubhead}</p>`;
  const articleBody = buildArticleBody(topic);
  const readTime = estimateReadTime(articleBody + ' '.repeat(100));
  const metaDesc = buildMetaDescription(title, description);
  const kw = keywords || [];
  const catSlug = CATEGORY_SLUGS[category] || 'government-secrets';
  const author = getAuthor(category);
  const hasImage = fs.existsSync(path.join(SITE_DIR, 'images/articles', slug + '.webp'));
  const ogImage = hasImage ? `${SITE_URL}/images/articles/${slug}.webp` : `${SITE_URL}/images/og-default.webp`;
  const heroImageStyle = hasImage
    ? `background-image:url(/images/articles/${slug}.webp);background-size:cover;background-position:center;`
    : 'background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);';

  const sidebarCategoriesHTML = CATEGORIES.map((cat, i) => {
    const cSlug = CATEGORY_SLUGS[cat] || 'government-secrets';
    return `<a href="/category/${cSlug}.html" class="trending-item"><span class="trending-num">${i+1}</span><div><div class="trending-title">${cat}</div></div></a>`;
  }).join('');
  let sidebarTrendingHTML = '';
  try {
    const _db = JSON.parse(fs.readFileSync(path.join(SITE_DIR, 'generated-articles.json'), 'utf8'));
    const _recent = (Array.isArray(_db) ? _db : []).slice(-7).reverse();
    sidebarTrendingHTML = _recent.map((a, i) => {
      const _sl = a.filename || a.slug || '';
      const _ti = (a.title || 'Article').slice(0, 60);
      const _rd = (Math.floor(Math.random() * 30 + 5)) + '.' + Math.floor(Math.random() * 9) + 'K reads';
      return `<a href="/articles/${_sl}" class="trending-item"><span class="trending-num">${i+1}</span><div><div class="trending-title">${_ti}</div><div class="trending-count">${_rd}</div></div></a>`;
    }).join('');
  } catch(e) { sidebarTrendingHTML = sidebarCategoriesHTML; }
  const keywordsStr = kw.join(', ');

  let relatedHTML = '';
  const related = (relatedArticles || []).slice(0, 2);
  for (const rel of related) {
    const relSlug = rel.slug || slugify(rel.title || 'article');
    const relCat = rel.category || 'Government Secrets';
    relatedHTML += `<a href="/articles/${relSlug}.html" class="card">
              <div class="card-image" style="background-image:url(/images/articles/${relSlug}.webp);background-size:cover;background-position:center;"></div>
              <div class="card-body">
                <div class="card-meta">
                  <span class="genre-label">${relCat}</span>
                  <span class="dot-sep">·</span>
                  <span class="card-date">${dateDisplay}</span>
                </div>
                <div class="card-title">${rel.title || 'Related Story'}</div>
              </div>
            </a>`;
  }

  const navLinks = CATEGORIES.map(cat => {
    const cs = CATEGORY_SLUGS[cat];
    const active = cat === category ? ' class="active"' : '';
    return `<li><a href="/category/${cs}.html"${active}>${cat}</a></li>`;
  }).join('\n        ');

  const footerCatLinks = CATEGORIES.map(cat => {
    const cs = CATEGORY_SLUGS[cat];
    return `<a href="/category/${cs}.html">${cat}</a>`;
  }).join('\n        ');

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
  <meta property="article:modified_time" content="${new Date().toISOString()}">
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
    "dateModified": "${new Date().toISOString()}",
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
        <div class="byline-meta">${dateDisplay} · ${readTime} min read</div>
      </div>
      <div class="article-hero-image" style="${heroImageStyle}"></div>
      <div class="article-body">
        ${articleBody}
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
        <div class="email-widget-text">The stories buried, spiked, or spun. Every morning — free.</div>
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
    <div class="footer-legal">&copy; ${new Date().getFullYear()} NewsAnarchist. All rights reserved. AI-assisted editorial content disclosed in bylines. As an Amazon Associate, we earn from qualifying purchases.</div>
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
</html>`;}

// ─── SOURCE FETCHERS ──────────────────────────────────────────────────────────

async function fetchHackerNews() {
  const results = [];
  const FILTER_KEYWORDS = [
    'privacy', 'surveillance', 'censorship', 'government', 'overreach', 'whistleblower',
    'leak', 'fbi', 'cia', 'nsa', 'court', 'ruling', 'lawsuit', 'regulation', 'ban',
    'data', 'tracking', 'breach', 'backdoor', 'encryption', 'monopoly', 'antitrust',
    'corporate', 'misconduct', 'fine', 'penalty', 'fraud', 'secret', 'classified',
    'freedom', 'speech', 'press', 'journalist', 'subpoena', 'warrant',
  ];

  try {
    console.log('  Fetching Hacker News top stories...');
    const [topRes, newRes] = await Promise.all([
      fetchWithTimeout('https://hacker-news.firebaseio.com/v0/topstories.json'),
      fetchWithTimeout('https://hacker-news.firebaseio.com/v0/newstories.json'),
    ]);

    const topIds = (await topRes.json()).slice(0, 60);
    const newIds = (await newRes.json()).slice(0, 30);
    const allIds = [...new Set([...topIds, ...newIds])];

    // Fetch stories in batches to avoid hammering the API
    const batchSize = 10;
    for (let i = 0; i < Math.min(allIds.length, 80) && results.length < 20; i += batchSize) {
      const batch = allIds.slice(i, i + batchSize);
      const stories = await Promise.all(
        batch.map(id =>
          fetchWithTimeout(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
            .then(r => r.json())
            .catch(() => null)
        )
      );

      for (const story of stories) {
        if (!story || !story.title || story.dead || story.deleted) continue;
        const titleLower = story.title.toLowerCase();
        const hasRelevantKw = FILTER_KEYWORDS.some(kw => titleLower.includes(kw));
        if (!hasRelevantKw) continue;
        if (isMainstreamGarbage(story.title, '')) continue;

        results.push({
          title: story.title,
          url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
          description: story.text ? stripHtml(story.text).slice(0, 400) : '',
          pubDate: story.time ? new Date(story.time * 1000).toISOString() : new Date().toISOString(),
          source: 'Hacker News',
          hnScore: story.score || 0,
          hnComments: story.descendants || 0,
        });
      }
      await sleep(300);
    }

    console.log(`  ✅ HN: ${results.length} relevant stories`);
  } catch (e) {
    console.warn(`  ⚠ HN: ${e.message}`);
  }
  return results;
}

async function fetchZeroHedge() {
  const results = [];
  try {
    console.log('  Fetching ZeroHedge RSS...');
    const res = await fetchWithTimeout('https://feeds.feedburner.com/zerohedge/feed', {}, 15000);
    if (!res.ok) {
      console.warn(`  ⚠ ZeroHedge: HTTP ${res.status}`);
      return results;
    }
    const text = await res.text();
    const items = parseXML(text);
    for (const item of items.slice(0, 25)) {
      if (!item.title) continue;
      if (isMainstreamGarbage(item.title, item.description)) continue;
      results.push({
        title: item.title,
        url: item.link,
        description: item.description || '',
        pubDate: item.pubDate,
        source: 'ZeroHedge',
      });
    }
    console.log(`  ✅ ZeroHedge: ${results.length} stories`);
  } catch (e) {
    console.warn(`  ⚠ ZeroHedge: ${e.message}`);
  }
  return results;
}

async function fetchRedditRSSFallback(subreddit) {
  // Reddit RSS doesn't 403 as aggressively as JSON API
  const results = [];
  try {
    const url = `https://www.reddit.com/r/${subreddit}/.rss?limit=25`;
    const res = await fetchWithTimeout(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RSS Reader; +https://newsanarchist.com)' }
    }, 12000);
    if (!res.ok) {
      console.warn(`  ⚠ r/${subreddit} RSS: HTTP ${res.status}`);
      return results;
    }
    const text = await res.text();
    // Reddit RSS uses Atom format
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
    let match;
    while ((match = entryRegex.exec(text)) !== null) {
      const block = match[1];
      const getTag = (tag) => {
        const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(block);
        return m ? stripHtml(m[1]).trim() : '';
      };
      const titleMatch = /<title[^>]*type="html"[^>]*>([\s\S]*?)<\/title>/i.exec(block) ||
                         /<title[^>]*>([\s\S]*?)<\/title>/i.exec(block);
      const title = titleMatch ? stripHtml(titleMatch[1]).trim() : '';
      const linkMatch = /<link[^>]*href="([^"]+)"[^>]*>/i.exec(block);
      const link = linkMatch ? linkMatch[1] : '';
      const updated = getTag('updated');
      const content = getTag('content');

      if (!title || title.length < 5) continue;
      if (isMainstreamGarbage(title, content)) continue;

      results.push({
        title,
        url: link || `https://reddit.com/r/${subreddit}`,
        description: content.slice(0, 400),
        pubDate: updated ? new Date(updated).toISOString() : new Date().toISOString(),
        source: `r/${subreddit}`,
        redditScore: 0,
      });
    }
    if (results.length > 0) {
      console.log(`  ✅ r/${subreddit} RSS fallback: ${results.length} stories`);
    }
  } catch (e) {
    console.warn(`  ⚠ r/${subreddit} RSS fallback: ${e.message}`);
  }
  return results;
}

async function fetchRedditContrarian(subreddit, sortMode = 'hot') {
  const results = [];
  const SOURCED_INDICATORS = [
    'http', 'pdf', 'gov', 'court', 'ruling', 'foia', 'report', 'study',
    'document', 'filing', 'case', 'judge', 'legislation', 'bill', 'act',
  ];

  // Rotate user agents to avoid Reddit 403
  const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64; rv:122.0) Gecko/20100101 Firefox/122.0',
  ];
  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

  try {
    console.log(`  Fetching r/${subreddit} (${sortMode})...`);
    const url = `https://www.reddit.com/r/${subreddit}/${sortMode}.json?limit=50${sortMode === 'controversial' ? '&t=week' : ''}`;
    const res = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': ua,
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    }, 15000);

    if (!res.ok) {
      // Fallback: try RSS feed
      console.warn(`  ⚠ r/${subreddit}: JSON API ${res.status}, trying RSS fallback...`);
      return await fetchRedditRSSFallback(subreddit);
    }

    const data = await res.json();
    const posts = data?.data?.children || [];

    for (const p of posts) {
      const post = p.data;
      if (post.stickied) continue;
      if (post.score < 50) continue; // minimum engagement

      const titleLower = post.title.toLowerCase();
      const textLower = (post.selftext || '').toLowerCase();

      // For conspiracy sub: require sourced indicators to filter memes/speculation
      if (subreddit === 'conspiracy') {
        const hasSources = SOURCED_INDICATORS.some(ind => titleLower.includes(ind) || textLower.includes(ind));
        if (!hasSources) continue;
        // Also require a URL (not self-post speculation)
        if (!post.url || post.is_self) continue;
      }

      // Filter mainstream garbage
      if (isMainstreamGarbage(post.title, post.selftext)) continue;

      results.push({
        title: post.title,
        url: post.url || `https://reddit.com${post.permalink}`,
        description: post.selftext ? post.selftext.slice(0, 400) : '',
        pubDate: new Date(post.created_utc * 1000).toISOString(),
        source: `r/${subreddit}`,
        redditScore: post.score,
        redditComments: post.num_comments,
      });
    }

    console.log(`  ✅ r/${subreddit}: ${results.length} stories`);
  } catch (e) {
    console.warn(`  ⚠ r/${subreddit}: ${e.message}`);
  }
  return results;
}

async function fetchFederalRegister() {
  const results = [];
  try {
    console.log('  Fetching Federal Register (newest rules)...');
    const url = 'https://www.federalregister.gov/api/v1/documents.json?per_page=20&order=newest&fields[]=title&fields[]=document_number&fields[]=publication_date&fields[]=html_url&fields[]=abstract&fields[]=type&fields[]=agencies';
    const res = await fetchWithTimeout(url, {}, 15000);
    if (!res.ok) {
      console.warn(`  ⚠ Federal Register: HTTP ${res.status}`);
      return results;
    }
    const data = await res.json();
    const docs = data.results || [];

    // Filter out purely administrative boilerplate
    const SKIP_FR_PATTERNS = [
      /sunshine act meeting/i,
      /board of directors meeting/i,
      /filing of plats/i,
      /information collection.*omg/i,
      /notice of intent to request.*collection/i,
      /^agency information collection.*comment request/i,
      /application for final commitment.*\$\d+ million/i,
    ];

    for (const doc of docs) {
      if (!doc.title) continue;
      if (SKIP_FR_PATTERNS.some(p => p.test(doc.title))) continue;
      // Prioritize rules, proposed rules, executive orders, presidential documents
      const isSubstantive = ['RULE', 'PRORULE', 'PRESDOCU', 'EXECORD'].includes(doc.type);
      const hasInterestingContent = doc.title && (
        doc.title.toLowerCase().includes('privacy') ||
        doc.title.toLowerCase().includes('surveillance') ||
        doc.title.toLowerCase().includes('data') ||
        doc.title.toLowerCase().includes('national security') ||
        doc.title.toLowerCase().includes('regulation') ||
        doc.title.toLowerCase().includes('ban') ||
        doc.title.toLowerCase().includes('prohibition') ||
        doc.title.toLowerCase().includes('enforcement') ||
        doc.title.toLowerCase().includes('investigation') ||
        doc.title.toLowerCase().includes('trade') ||
        isSubstantive
      );
      if (!hasInterestingContent) continue;

      const abstract = doc.abstract || '';
      const agencies = (doc.agencies || []).map(a => a.name).join(', ');
      const description = `${abstract} [Agencies: ${agencies}]`.slice(0, 500);

      results.push({
        title: `[Federal Register] ${doc.title}`,
        url: doc.html_url || 'https://federalregister.gov',
        description,
        pubDate: doc.publication_date ? new Date(doc.publication_date).toISOString() : new Date().toISOString(),
        source: 'Federal Register',
      });
    }

    console.log(`  ✅ Federal Register: ${results.length} documents`);
  } catch (e) {
    console.warn(`  ⚠ Federal Register: ${e.message}`);
  }
  return results;
}

async function fetchCourtListener() {
  const results = [];
  try {
    console.log('  Fetching CourtListener (recent opinions)...');
    // Use the search endpoint which doesn't require auth and returns richer data
    const url = 'https://www.courtlistener.com/api/rest/v4/opinions/?order_by=-date_created&format=json&page_size=20';
    const res = await fetchWithTimeout(url, {
      headers: { 'Accept': 'application/json' }
    }, 15000);
    if (!res.ok) {
      console.warn(`  ⚠ CourtListener: HTTP ${res.status} — skipping`);
      return results;
    }
    const data = await res.json();
    const opinions = data.results || [];

    for (const op of opinions) {
      const caseText = stripHtml(op.plain_text || op.html_with_citations || op.html || '').slice(0, 500);
      if (!caseText || caseText.length < 30) continue;

      const caseName = `Court Opinion: ${caseText.slice(0, 80).replace(/\s+/g, ' ')}...`;

      results.push({
        title: caseName,
        url: `https://www.courtlistener.com${op.absolute_url || '/opinion/' + op.id + '/'}`,
        description: caseText.slice(0, 400),
        pubDate: op.date_created || new Date().toISOString(),
        source: 'CourtListener',
      });
    }

    console.log(`  ✅ CourtListener: ${results.length} opinions`);
  } catch (e) {
    console.warn(`  ⚠ CourtListener: ${e.message}`);
  }
  return results;
}

async function fetchMuckRockFOIA() {
  const results = [];
  try {
    console.log('  Fetching MuckRock FOIA requests...');
    const url = 'https://www.muckrock.com/api_v1/foia/?format=json&order_by=-date_submitted&page_size=20';
    const res = await fetchWithTimeout(url, {}, 15000);
    if (!res.ok) {
      console.warn(`  ⚠ MuckRock: HTTP ${res.status}`);
      return results;
    }
    const data = await res.json();
    const foias = data.results || [];

    // Skip cryptic/numeric-coded FOIA titles with no context
    const SKIP_FOIA_PATTERNS = [
      /^#?\d{2}[-.\/]\d{2}/,                  // date-coded: 02/29/16, 07-24, 02.10.18
      /^[0-9]{3,}-[0-9]+/,                    // case numbers: 100-18762, 04-5812
      /^#\d{2,}/,                              // ticket numbers: #04-5812
      /^\d{4}\s+[a-z]/i,                      // "0215 Memphis"
      /^(public records request|RTK\s)/i,     // generic RTK titles
    ];

    for (const foia of foias) {
      if (!foia.title) continue;
      if (SKIP_FOIA_PATTERNS.some(p => p.test(foia.title))) continue;
      if (foia.title.length < 15) continue; // too short to be informative

      const description = `FOIA request to ${foia.agency || 'federal agency'}: ${foia.title}. Status: ${foia.status || 'pending'}.`;
      results.push({
        title: `[FOIA] ${foia.title}`,
        url: foia.absolute_url ? (foia.absolute_url.startsWith('http') ? foia.absolute_url : `https://www.muckrock.com${foia.absolute_url}`) : 'https://www.muckrock.com',
        description: description.slice(0, 400),
        pubDate: foia.date_submitted ? new Date(foia.date_submitted).toISOString() : new Date().toISOString(),
        source: 'MuckRock FOIA',
      });
    }

    console.log(`  ✅ MuckRock: ${results.length} FOIA requests`);
  } catch (e) {
    console.warn(`  ⚠ MuckRock: ${e.message}`);
  }
  return results;
}


async function fetchTheIntercept() {
  const results = [];
  try {
    console.log('  Fetching The Intercept RSS...');
    const res = await fetchWithTimeout('https://theintercept.com/feed/?lang=en', {}, 15000);
    if (!res.ok) { console.warn('  ⚠ The Intercept: HTTP ' + res.status); return results; }
    const text = await res.text();
    const items = parseXML(text);
    for (const item of items.slice(0, 15)) {
      if (!item.title) continue;
      results.push({
        title: item.title,
        url: item.link,
        description: item.description || '',
        pubDate: item.pubDate,
        source: 'The Intercept',
      });
    }
    console.log('  ✅ The Intercept: ' + results.length + ' stories');
  } catch (e) { console.warn('  ⚠ The Intercept: ' + e.message); }
  return results;
}

async function fetchEFF() {
  const results = [];
  try {
    console.log('  Fetching EFF Deeplinks...');
    const res = await fetchWithTimeout('https://www.eff.org/rss/updates.xml', {}, 15000);
    if (!res.ok) { console.warn('  ⚠ EFF: HTTP ' + res.status); return results; }
    const text = await res.text();
    const items = parseXML(text);
    for (const item of items.slice(0, 15)) {
      if (!item.title) continue;
      results.push({
        title: item.title,
        url: item.link,
        description: item.description || '',
        pubDate: item.pubDate,
        source: 'EFF',
      });
    }
    console.log('  ✅ EFF: ' + results.length + ' stories');
  } catch (e) { console.warn('  ⚠ EFF: ' + e.message); }
  return results;
}

async function fetchProPublica() {
  const results = [];
  try {
    console.log('  Fetching ProPublica RSS...');
    const res = await fetchWithTimeout('https://feeds.propublica.org/propublica/main', {}, 15000);
    if (!res.ok) { console.warn('  ⚠ ProPublica: HTTP ' + res.status); return results; }
    const text = await res.text();
    const items = parseXML(text);
    for (const item of items.slice(0, 15)) {
      if (!item.title) continue;
      results.push({
        title: item.title,
        url: item.link,
        description: item.description || '',
        pubDate: item.pubDate,
        source: 'ProPublica',
      });
    }
    console.log('  ✅ ProPublica: ' + results.length + ' stories');
  } catch (e) { console.warn('  ⚠ ProPublica: ' + e.message); }
  return results;
}

async function fetchArsTechnica() {
  const results = [];
  try {
    console.log('  Fetching Ars Technica RSS...');
    const res = await fetchWithTimeout('https://feeds.arstechnica.com/arstechnica/index', {}, 15000);
    if (!res.ok) { console.warn('  ⚠ Ars Technica: HTTP ' + res.status); return results; }
    const text = await res.text();
    const items = parseXML(text);
    for (const item of items.slice(0, 15)) {
      if (!item.title) continue;
      if (isMainstreamGarbage(item.title, item.description)) continue;
      results.push({
        title: item.title,
        url: item.link,
        description: item.description || '',
        pubDate: item.pubDate,
        source: 'Ars Technica',
      });
    }
    console.log('  ✅ Ars Technica: ' + results.length + ' stories');
  } catch (e) { console.warn('  ⚠ Ars Technica: ' + e.message); }
  return results;
}

async function fetchTheMarkup() {
  const results = [];
  try {
    console.log('  Fetching The Markup RSS...');
    const res = await fetchWithTimeout('https://themarkup.org/feeds/rss.xml', {}, 15000);
    if (!res.ok) { console.warn('  ⚠ The Markup: HTTP ' + res.status); return results; }
    const text = await res.text();
    const items = parseXML(text);
    for (const item of items.slice(0, 15)) {
      if (!item.title) continue;
      results.push({
        title: item.title,
        url: item.link,
        description: item.description || '',
        pubDate: item.pubDate,
        source: 'The Markup',
      });
    }
    console.log('  ✅ The Markup: ' + results.length + ' stories');
  } catch (e) { console.warn('  ⚠ The Markup: ' + e.message); }
  return results;
}

async function fetchPodcastSignals() {
  const results = [];
  const feeds = [
    { name: 'Joe Rogan Experience', url: 'https://feeds.megaphone.fm/GLT1412515089' },
    { name: 'All-In Podcast', url: 'https://feeds.megaphone.fm/all-in-with-chamath-jason-sacks-and-friedberg' },
  ];
  for (const feed of feeds) {
    try {
      console.log(`  Fetching ${feed.name}...`);
      const res = await fetchWithTimeout(feed.url, {}, 10000);
      if (!res.ok) { console.warn(`  ⚠ ${feed.name}: HTTP ${res.status}`); continue; }
      const xml = await res.text();
      const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
      for (const item of items.slice(0, 5)) {
        const titleMatch = item.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const descMatch = item.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
        const linkMatch = item.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
        const pubMatch = item.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
        if (!titleMatch) continue;
        const title = stripHtml(titleMatch[1]).trim();
        const desc = descMatch ? stripHtml(descMatch[1]).trim() : '';
        const link = linkMatch ? stripHtml(linkMatch[1]).trim() : '';
        const pubDate = pubMatch ? new Date(stripHtml(pubMatch[1]).trim()).toISOString() : new Date().toISOString();
        results.push({
          title: `[${feed.name}] ${title}`,
          url: link,
          description: desc.slice(0, 400),
          pubDate,
          source: feed.name,
        });
      }
      console.log(`  ✅ ${feed.name}: ${Math.min(items.length, 5)} episodes`);
    } catch (e) {
      console.warn(`  ⚠ ${feed.name}: ${e.message}`);
    }
  }
  return results;
}


async function fetchPressReleaseFeeds() {
  const results = [];
  // Press release feeds — official announcements for contrarian analysis — official press releases for contrarian analysis
  const feeds = [
    { name: 'PR Newswire Finance', url: 'https://www.prnewswire.com/rss/financial-news.rss', category: 'Money & Markets' },
    { name: 'PR Newswire Tech', url: 'https://www.prnewswire.com/rss/technology-news.rss', category: 'Tech & Privacy' },
    { name: 'GlobeNewswire Finance', url: 'https://www.globenewswire.com/RssFeed/subjectCode/15', category: 'Money & Markets' },
    { name: 'GlobeNewswire Tech', url: 'https://www.globenewswire.com/RssFeed/subjectCode/13', category: 'Tech & Privacy' },
    { name: 'GlobeNewswire Law', url: 'https://www.globenewswire.com/RssFeed/subjectCode/10', category: 'Corporate Watchdog' },
  ];
  for (const feed of feeds) {
    try {
      console.log(`  Fetching ${feed.name}...`);
      const res = await fetchWithTimeout(feed.url, {}, 12000);
      if (!res.ok) { console.warn(`  ⚠ ${feed.name}: HTTP ${res.status}`); continue; }
      const xml = await res.text();
      const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
      for (const item of items.slice(0, 5)) {
        const t = item.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const d = item.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
        const l = item.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
        const p = item.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
        if (!t) continue;
        const title = t[1].replace(/<[^>]+>/g, '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
        const desc = d ? d[1].replace(/<[^>]+>/g, '').replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
        const link = l ? l[1].replace(/<[^>]+>/g, '').trim() : '';
        const pubDate = p ? new Date(p[1].replace(/<[^>]+>/g, '').trim()).toISOString() : new Date().toISOString();
        if (!title || title.length < 10) continue;
        results.push({
          title,
          url: link,
          description: desc.slice(0, 400),
          pubDate,
          source: feed.name,
          category: feed.category,
        });
      }
      console.log(`  ✅ ${feed.name}: ${Math.min(items.length, 5)} releases`);
    } catch (e) {
      console.warn(`  ⚠ ${feed.name}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 300));
  }
  return results;
}

async function fetchUnexplainedFeeds(){
  const results=[];const feeds=[{name:'The Debrief',url:'https://thedebrief.org/feed/',cat:'Unexplained'},{name:'The Black Vault',url:'https://www.theblackvault.com/documentarchive/feed/',cat:'Unexplained'},{name:'MUFON News',url:'https://mufon.com/feed/',cat:'Unexplained'},{name:'Dark Reading',url:'https://www.darkreading.com/rss.xml',cat:'Tech & Privacy'}];
  for(const feed of feeds){try{console.log('  Fetching '+feed.name+'...');const res=await fetchWithTimeout(feed.url,{},12000);if(!res.ok){console.warn('  Warning '+feed.name+': HTTP '+res.status);continue;}const xml=await res.text();const items=xml.match(/<item>[\s\S]*?<\/item>/gi)||[];for(const item of items.slice(0,8)){const t=item.match(/<title[^>]*>([\s\S]*?)<\/title>/i);const d=item.match(/<description[^>]*>([\s\S]*?)<\/description>/i);const l=item.match(/<link[^>]*>([\s\S]*?)<\/link>/i);const p=item.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);if(!t)continue;const title=t[1].replace(/<[^>]+>/g,'').replace(/<!\[CDATA\[|\]\]>/g,'').trim();const desc=d?d[1].replace(/<[^>]+>/g,'').replace(/<!\[CDATA\[|\]\]>/g,'').trim():'';const link=l?l[1].replace(/<[^>]+>/g,'').trim():'';const pubDate=p?new Date(p[1].replace(/<[^>]+>/g,'').trim()).toISOString():new Date().toISOString();results.push({title,url:link,description:desc.slice(0,400),pubDate,source:feed.name,category:feed.cat});}console.log('  OK '+feed.name+': '+Math.min(items.length,8)+' stories');}catch(e){console.warn('  Warn '+feed.name+': '+e.message);}await new Promise(r=>setTimeout(r,300));}return results;}

async function fetchArticleContent(url) {
  try {
    if (!url || url.includes('reddit.com') || url.includes('hacker-news.firebase') || url.includes('news.ycombinator.com')) return '';
    const res = await fetchWithTimeout(url, {}, 10000);
    if (!res.ok) return '';
    const html = await res.text();
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (!bodyMatch) return '';
    let text = bodyMatch[1];
    text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<nav[\s\S]*?<\/nav>/gi, '');
    text = text.replace(/<footer[\s\S]*?<\/footer>/gi, '');
    text = text.replace(/<header[\s\S]*?<\/header>/gi, '');
    const paragraphs = [];
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let m;
    while ((m = pRegex.exec(text)) !== null) {
      const clean = stripHtml(m[1]).trim();
      if (clean.length > 40) paragraphs.push(clean);
    }
    return paragraphs.slice(0, 20).join(' ');
  } catch (e) {
    return '';
  }
}

function deduplicateAndRank(allTopics) {
  const seen = new Map();

  for (const topic of allTopics) {
    const titleLower = topic.title.toLowerCase().replace(/[^a-z0-9 ]/g, '');
    const words = new Set(titleLower.split(/\s+/).filter(w => w.length > 4));

    let matched = null;
    for (const [key, existing] of seen.entries()) {
      const existWords = new Set(key.split(' '));
      const overlap = [...words].filter(w => existWords.has(w)).length;
      const minLen = Math.min(words.size, existWords.size);
      if (minLen > 0 && overlap / minLen > 0.5) {
        matched = key;
        break;
      }
    }

    if (matched) {
      const ex = seen.get(matched);
      ex.score = (ex.score || 0) + (topic.score || 0) + 1;
      ex.sources = [...new Set([...(ex.sources || [ex.source]), topic.source])];
    } else {
      const key = titleLower.split(/\s+/).filter(w => w.length > 4).join(' ');
      const obscurityScore = scoreObscurity(topic.title, topic.description, topic.source);
      seen.set(key, { ...topic, score: (topic.score || 0) + obscurityScore, sources: [topic.source] });
    }
  }

  // Filter out negative-scored stories (mainstream garbage)
  const valid = Array.from(seen.values()).filter(t => t.score > 0);

  // Cap per-source to prevent any single source from dominating
  const SOURCE_CAPS = {
    'Federal Register': 1,    // max 1 FR doc per cycle — dry bureaucratic content
    'CourtListener': 2,
    'MuckRock FOIA': 2,
  };
  const sourceCounts = {};
  const capped = valid
    .sort((a, b) => b.score - a.score)
    .filter(t => {
      const src = t.source || 'unknown';
      const cap = SOURCE_CAPS[src];
      if (cap !== undefined) {
        sourceCounts[src] = (sourceCounts[src] || 0) + 1;
        if (sourceCounts[src] > cap) return false;
      }
      return true;
    });

  // Ensure category diversity — at least 2 per category if available
  const CATEGORY_MIN = 2;
  const result = [];
  const catCounts = {};
  const catPools = {};
  for (const t of capped) {
    const cat = t.category || 'Government Secrets';
    if (!catPools[cat]) catPools[cat] = [];
    catPools[cat].push(t);
  }
  // First pass: guarantee minimum per category
  for (const [cat, pool] of Object.entries(catPools)) {
    for (let i = 0; i < Math.min(CATEGORY_MIN, pool.length); i++) {
      result.push(pool[i]);
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    }
  }
  // Second pass: fill remaining slots with highest-scored
  for (const t of capped) {
    if (result.length >= 40) break;
    if (!result.includes(t)) result.push(t);
  }
  return result.slice(0, 40);
}

// ─── GOOGLE NEWS RSS ──────────────────────────────────────────────────────────

async function fetchGoogleNewsRSS() {
  const results = [];
  const BASE = 'https://news.google.com/rss/search?hl=en-US&gl=US&ceid=US:en&q=';
  const feeds = [
    { q: 'NSA surveillance government tracking warrantless',      label: 'Surveillance State' },
    { q: 'corporate fraud antitrust FTC SEC lawsuit settlement',  label: 'Corporate Watchdog' },
    { q: 'FOIA classified whistleblower leaked declassified',     label: 'Government Secrets' },
    { q: 'data privacy big tech cybersecurity encryption',        label: 'Tech & Privacy' },
    { q: 'geopolitics sanctions NATO intelligence regime change', label: 'Global Power' },
    { q: 'Federal Reserve inflation financial crisis debt',        label: 'Money & Markets' },
    { q: 'UFO UAP Pentagon unexplained phenomena disclosure',     label: 'Unexplained' },
    { q: 'crime investigation FBI cold case forensic evidence',   label: 'True Crime' },
  ];
  for (const feed of feeds) {
    try {
      const url = BASE + encodeURIComponent(feed.q);
      console.log(`  Fetching Google News (${feed.label})...`);
      const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)' } }, 12000);
      if (!res.ok) { console.warn(`  ⚠ ${feed.label}: HTTP ${res.status}`); continue; }
      const items = parseXML(await res.text());
      for (const item of items.slice(0, 10)) {
        if (!item.title) continue;
        results.push({
          title:       item.title.replace(/ - [^-]+$/, ''),
          url:         item.link || item.url || '',
          description: stripHtml(item.description || '').slice(0, 500),
          pubDate:     item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
          source:      `Google News (${feed.label})`,
        });
      }
      console.log(`  ✅ ${feed.label}: ${items.length} stories`);
      await sleep(400);
    } catch (e) { console.warn(`  ⚠ ${feed.label}: ${e.message}`); }
  }
  return results;
}
// ─── SCRAPE MODE ──────────────────────────────────────────────────────────────

async function runScrape() {
  console.log('\n🔍 NewsAnarchist Anarchist Scraper — Hunting buried stories...\n');

  const allTopics = [];

  // 0. Google News RSS (high-quality mainstream headlines for context + contrarian takes)
  allTopics.push(...await fetchGoogleNewsRSS());
  await sleep(500);

  // 1. Hacker News (privacy/surveillance/censorship filtered)
  allTopics.push(...await fetchHackerNews());
  await sleep(500);

  // 2. ZeroHedge RSS
  allTopics.push(...await fetchZeroHedge());
  await sleep(800);

  // 3. Reddit contrarian subs (skip low-quality personal subs)
  allTopics.push(...await fetchRedditContrarian('worldnews', 'hot'));
  await sleep(800);
  allTopics.push(...await fetchRedditContrarian('technology', 'hot'));
  await sleep(800);
  allTopics.push(...await fetchRedditContrarian('privacy', 'hot'));
  await sleep(800);
  allTopics.push(...await fetchRedditContrarian('conspiracy', 'hot'));
  await sleep(500);
  allTopics.push(...await fetchRedditContrarian('cryptocurrency', 'hot'));
  await sleep(800);
  allTopics.push(...await fetchRedditContrarian('wallstreetbets', 'hot'));
  await sleep(800);
  allTopics.push(...await fetchRedditContrarian('stocks', 'hot'));
  await sleep(500);

  // 4. Federal Register (capped to 1 per cycle in deduplicateAndRank)
  allTopics.push(...await fetchFederalRegister());
  await sleep(500);

  // 5. CourtListener (recent court opinions)
  allTopics.push(...await fetchCourtListener());
  await sleep(500);

  // 6. MuckRock FOIA
  allTopics.push(...await fetchMuckRockFOIA());
  await sleep(500);

  // 7. Podcast signals (Rogan, All-In — topic ideas the mainstream ignores)
  allTopics.push(...await fetchTheIntercept());
  allTopics.push(...await fetchEFF());
  allTopics.push(...await fetchProPublica());
  allTopics.push(...await fetchArsTechnica());
  allTopics.push(...await fetchTheMarkup());
  allTopics.push(...await fetchPodcastSignals());
  allTopics.push(...await fetchPressReleaseFeeds());
  allTopics.push(...await fetchUnexplainedFeeds());
  await sleep(500);

  console.log(`\n📊 Raw stories collected: ${allTopics.length}`);

  // Categorize all topics
  for (const topic of allTopics) {
    topic.category = detectCategory(topic.title, topic.description);
  }

  // Deduplicate and rank by obscurity score
  const ranked = deduplicateAndRank(allTopics);
  console.log(`✅ After filtering + ranking: ${ranked.length} stories selected`);
  console.log(`   (${allTopics.length - ranked.length} mainstream/duplicate stories dropped)\n`);

  // Fetch source content for top topics
  const recentSlugBases = loadRecentSlugBases(24);
  console.log(`[dedup] ${recentSlugBases.size} seen in last 24h`);
  const enriched = [];
  for (let i = 0; i < Math.min(ranked.length, 40); i++) {
    const topic = ranked[i];
    console.log(`  [${i + 1}/${ranked.length}] Fetching content: ${topic.title.slice(0, 70)}...`);
    const content = await fetchArticleContent(topic.url);
    const keywords = extractKeywords(topic.title, topic.description + ' ' + content, topic.category);
    const hashtags = keywords.map(k => '#' + k.replace(/\s+/g, ''));
    const slug = todayISO() + '-' + slugify(topic.title);
    const htmlPath = path.join(SITE_DIR, 'articles', slug + '.html');
    if (fs.existsSync(htmlPath)) { console.log(`  [skip] exists: ${slug}`); continue; }
    if (recentSlugBases.has(slugBase(slug))) { console.log(`  [skip] duplicate: ${slug}`); continue; }

    enriched.push({
      ...topic,
      content: content || topic.description || '',
      keywords,
      hashtags,
      slug,
      sourceUrl: topic.url,
      generatedAt: new Date().toISOString(),
    });

    await sleep(1000 + Math.random() * 1000);
  }

  // Link related articles (same category)
  for (let i = 0; i < enriched.length; i++) {
    const topic = enriched[i];
    topic.relatedArticles = enriched
      .filter((t, j) => j !== i && t.category === topic.category)
      .slice(0, 2)
      .map(t => ({ title: t.title, slug: t.slug, category: t.category }));
  }

  // Save to JSON
  const output = {
    scrapedAt: new Date().toISOString(),
    topicsCount: enriched.length,
    topics: enriched,
  };

  fs.writeFileSync(TRENDING_JSON, JSON.stringify(output, null, 2));
  console.log(`\n✅ Saved ${enriched.length} topics to ${TRENDING_JSON}`);

  return enriched;
}

// ─── DRY RUN MODE ─────────────────────────────────────────────────────────────

async function runDryRun() {
  console.log('\n🧪 NewsAnarchist DRY RUN — Story selection preview (no articles generated)\n');

  const allTopics = [];
  const sourceStats = {};

  function track(source, items) {
    sourceStats[source] = items.length;
    allTopics.push(...items);
  }

  console.log('--- Fetching sources ---\n');
  track('Hacker News', await fetchHackerNews());
  await sleep(500);
  track('ZeroHedge', await fetchZeroHedge());
  await sleep(800);
  track('r/privacy', await fetchRedditContrarian('privacy', 'hot'));
  await sleep(600);
  track('r/undelete', await fetchRedditContrarian('undelete', 'hot'));
  await sleep(600);
  track('r/conspiracy (sourced)', await fetchRedditContrarian('conspiracy', 'hot'));
  await sleep(600);
  track('r/worldnews (controversial)', await fetchRedditContrarian('worldnews', 'controversial'));
  await sleep(600);
  track('r/technology', await fetchRedditContrarian('technology', 'hot'));
  await sleep(500);
  track('Federal Register', await fetchFederalRegister());
  await sleep(500);
  track('CourtListener', await fetchCourtListener());
  await sleep(500);
  track('MuckRock FOIA', await fetchMuckRockFOIA());
  track('The Intercept', await fetchTheIntercept());
  track('EFF', await fetchEFF());
  track('ProPublica', await fetchProPublica());
  track('Ars Technica', await fetchArsTechnica());
  track('The Markup', await fetchTheMarkup());

  console.log('\n--- Source Summary ---');
  let totalRaw = 0;
  for (const [src, count] of Object.entries(sourceStats)) {
    console.log(`  ${src}: ${count} stories`);
    totalRaw += count;
  }
  console.log(`  TOTAL RAW: ${totalRaw}`);

  // Categorize
  for (const topic of allTopics) {
    topic.category = detectCategory(topic.title, topic.description);
  }

  // Rank and filter
  const ranked = deduplicateAndRank(allTopics);

  console.log('\n--- SELECTED STORIES (ranked by obscurity score) ---\n');
  for (let i = 0; i < ranked.length; i++) {
    const t = ranked[i];
    const score = t.score || 0;
    const cat = t.category;
    const src = t.sources ? t.sources.join(', ') : t.source;
    console.log(`[${i + 1}] Score: ${score} | ${cat}`);
    console.log(`    Title: ${t.title}`);
    console.log(`    Source: ${src}`);
    console.log(`    URL: ${(t.url || '').slice(0, 100)}`);
    console.log('');
  }

  console.log(`\n✅ ${ranked.length} stories selected from ${totalRaw} raw.`);
  console.log(`   ${totalRaw - ranked.length} dropped (mainstream/duplicate/low-score)\n`);
  console.log('Run `node newsanarchist-content.mjs scrape` to proceed with full pipeline.');
}

// ─── GENERATE MODE ────────────────────────────────────────────────────────────


// ─── AI article writer ────────────────────────────────────────────────────────

async function generateAIArticle(topic) {
  const { title, description, content, category, source } = topic;
  const material = [description, content].filter(Boolean).join('\n\n').slice(0, 2500);

  const author = getAuthor(category);
  const authorVoices = {
    'Marcus Webb': 'Write in a dry, technical, document-heavy voice. Lead with the most damning specific fact. Name the agency, the program, the official. Favor surveillance infrastructure details over political framing. Never speculate — only cite what documents show.',
    'Elena Vasquez': 'Write with sharp geopolitical framing. Situate the story in the longer arc of power — who benefits, which alliance is shifting, what the official narrative obscures. Reference historical precedent. Name countries and institutions, not abstractions.',
    'Jordan Calloway': 'Write in an adversarial, receipts-first voice. Lead with the most damning document or quote. State the official position, then dismantle it with evidence. Name the individuals responsible — not just agencies. End with what oversight has failed to do.',
    'Diana Reeves': 'Write in a data-driven, Stoller-esque voice. Follow the money. Name the beneficiaries, the lobbyists, the regulators who looked away. Use specific dollar figures and market structure details. Frame every story as a question of who profits and who pays.',
    'Sam Okafor': 'Write in a narrative-driven, case-file voice. Establish the facts as a timeline. Name the prosecutors, judges, and institutions involved. Identify the contradiction between the official account and the evidence. End with what justice would actually require.',
    'Casey North': 'Write in a skeptical but open science-journalist voice. State what the documents or data actually show — not what officials claim they show. Reference congressional testimony and primary sources. Avoid ridicule of any public official or political figure — report facts, let the evidence speak. Never editorialize against the president or any elected leader by name. NewsAnarchist is center/independent, not partisan.',
    'NewsAnarchist Desk': 'Write in a direct, evidence-based contrarian voice. Lead with what the mainstream framing misses. Name specific actors. Close with the implication for ordinary people.',
  };
  const voiceInstruction = authorVoices[author.name] || authorVoices['NewsAnarchist Desk'];

  const prompt = `You are ${author.name}, ${author.credential}, writing for NewsAnarchist.com.
${voiceInstruction}

HEADLINE: ${title}
CATEGORY: ${category}
SOURCE: ${source || 'Public records'}
SOURCE MATERIAL:
${material}

Write a 700-900 word investigative article in two clearly separated sections.

SECTION 1 - THE STORY (400-500 words):
- Opening lede: one punchy declarative sentence stating the most important fact
- 4-5 paragraphs advancing the story using only the source material provided
- Weave in what the mainstream framing misses or underplays
- Name specific individuals, agencies, or corporations — never abstractions
- No invented facts, no speculation beyond what sources support
- No headers, no bullet points, no filler phrases

SECTION 2 - THE TAKE (200-400 words):
Start this section with exactly this line: --- THE TAKE ---
Then write original contrarian commentary in first person voice:
- State your thesis bluntly in the first sentence
- Explain what this story reveals about a larger pattern of power or institutional failure
- Name who benefits from the official narrative and why
- End with one concrete thing readers should watch, demand, or understand
- Use first person: I, what I find striking, the pattern here is
- NEVER mock, ridicule, or use partisan snark toward any elected official, president, or political leader by name. Critique policy and institutional failure with evidence — never personal mockery.`;

  try {
    const INFER = process.env.HOME + '/.openclaw/scripts/openclaw-infer.sh';
    const tmpFile = '/tmp/na-ai-' + Date.now() + '.txt';
    fs.writeFileSync(tmpFile, prompt);
    const { execSync } = await import('child_process');
    const out = execSync(`bash "${INFER}" "${tmpFile}"`, { maxBuffer: 2*1024*1024, timeout: 90000 }).toString().trim();
    try { fs.unlinkSync(tmpFile); } catch {}
    const parsed = JSON.parse(out);
    const text = parsed.ok ? (parsed.outputs?.[0]?.text || '').trim() : '';
    return text.length > 100 ? text : null;
  } catch (e) {
    console.error(`  ⚠️  AI failed: ${e.message}`);
    return null;
  }
}

async function runGenerate() {
  if (!fs.existsSync(TRENDING_JSON)) {
    console.error('❌ trending-topics.json not found. Run scrape mode first.');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(TRENDING_JSON, 'utf-8'));
  const topics = data.topics || [];

  if (!topics.length) {
    console.error('❌ No topics in trending-topics.json.');
    process.exit(1);
  }

  console.log(`\n✍️  Generating ${topics.length} contrarian articles...\n`);

  if (!fs.existsSync(ARTICLES_DIR)) {
    fs.mkdirSync(ARTICLES_DIR, { recursive: true });
  }

  const generated = [];

  for (const topic of topics) {
    try {

      // Generate article image (category + title specific)
      const imgDir = path.join(SITE_DIR, 'images', 'articles');
      if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });
      const imgPath = path.join(imgDir, topic.slug + '.webp');
      const imgPathPng = path.join(imgDir, topic.slug + '.png');
      if (!fs.existsSync(imgPath)) {
        generateArticleImage(topic, imgPath);
        // fal.ai ignores --output-format webp and saves PNG — convert after
        if (!fs.existsSync(imgPath) && fs.existsSync(imgPathPng)) {
          try {
            const { execSync: ex } = await import('child_process');
            ex(`python3 -c "from PIL import Image; img=Image.open('${imgPathPng}'); img.save('${imgPath}','webp',quality=82)"`, { timeout: 30000 });
            fs.unlinkSync(imgPathPng);
            console.log('  ↳ Converted PNG→WebP');
          } catch(ce) {
            // If conversion fails, rename PNG to webp path
            try { fs.renameSync(imgPathPng, imgPath); } catch {}
          }
        }
      }

      console.log(`  ✍️  Writing article: ${topic.title.slice(0, 65)}...`);
      const aiBody = await generateAIArticle(topic);
      if (!aiBody) {
        console.warn(`  ⏭  Skipped (AI generation failed): ${topic.title.slice(0, 60)}`);
        continue;
      }
      topic.aiContent = aiBody;

      const html = buildArticleHTML(topic);
      const filename = `${topic.slug}.html`;
      const filepath = path.join(ARTICLES_DIR, filename);
      fs.writeFileSync(filepath, html);
      console.log(`  ✅ Generated: articles/${filename} [${topic.category}]`);
      generated.push({ ...topic, filename });
    } catch (e) {
      console.error(`  ❌ Failed: ${topic.title.slice(0, 50)} — ${e.message}`);
    }
  }

  const logPath = path.join(SITE_DIR, 'generated-articles.json');
  let existing = [];
  if (fs.existsSync(logPath)) {
    try { existing = JSON.parse(fs.readFileSync(logPath, 'utf-8')); } catch {}
  }
  // Merge new articles — deduplicate by filename, keep latest
  const existingMap = new Map(existing.map(a => [a.filename, a]));
  for (const a of generated) {
    existingMap.set(a.filename, {
      title: a.title,
      slug: a.slug,
      category: a.category,
      filename: a.filename,
      pubDate: a.pubDate || new Date().toISOString(),
      generatedAt: new Date().toISOString(),
      source: a.source,
      description: a.description,
    });
  }
  const allGenerated = [...existingMap.values()];
  fs.writeFileSync(logPath, JSON.stringify(allGenerated, null, 2));

  console.log(`\n✅ Generated ${generated.length} articles.`);
  return generated;
}

// ─── PUBLISH MODE ─────────────────────────────────────────────────────────────

function buildArticleCard(article) {
  const author = getAuthor(article.category);
  const dateDisplay = formatDate(article.pubDate);
  const excerpt = cleanExcerpt(truncate(stripHtml(article.description || article.title), 120), article.title);
  const imgSlug = (article.filename || article.slug || '').replace('.html', '');
  const typeClass = (article.articleType || 'news').toLowerCase();
  const typeLabel = article.articleType ? article.articleType.toUpperCase() : article.category;
  return `<a href="/articles/${article.filename}" class="card">
  <div class="card-image" style="background-image:url(/images/articles/${imgSlug}.webp);background-size:cover;background-position:center;"></div>
  <div class="card-body">
    <div class="card-meta">
      <span class="genre-label ${typeClass}">${typeLabel}</span>
      <span class="dot-sep">·</span>
      <span class="card-author">${author.name}</span>
      <span class="dot-sep">·</span>
      <span class="card-date">${dateDisplay}</span>
    </div>
    <div class="card-title">${article.title}</div>
    <div class="card-excerpt">${excerpt}</div>
  </div>
</a>`;
}

function buildHeroCard(article, isMain = false) {
  const author = getAuthor(article.category);
  const imgSlug = (article.filename || article.slug || '').replace('.html', '');
  const avatarStyle = author.slug ? `background-image:url(/images/authors/${author.slug}.webp)` : '';
  const authorLink = author.slug
    ? `<a href="/authors/${author.slug}.html" style="color:rgba(255,255,255,0.75);text-decoration:none;">${author.name}</a>`
    : author.name;
  return `<a href="/articles/${article.filename}" class="hero-card ${isMain ? 'hero-main' : 'hero-secondary'}">
  <div class="hero-card-image" style="background-image:url(/images/articles/${imgSlug}.webp);"></div>
  <div class="hero-card-overlay"></div>
  <div class="hero-card-body">
    <div class="hero-card-meta">
      <span class="genre-label" style="background:rgba(255,255,255,0.1);border-color:rgba(255,255,255,0.5);color:#fff;">${article.category}</span>
    </div>
    <div class="hero-card-title">${isMain ? article.title : truncate(article.title, 80)}</div>
    <div class="hero-card-author">
      <div class="hero-author-avatar" style="${avatarStyle}"></div>
      ${authorLink} · ${article.category}
    </div>
  </div>
</a>`;
}

// Keyword-based category remapping for articles with generic raw categories
function remapArticleCategory(article) {
  const rawCat = article.category || '';
  const text = (article.title + ' ' + (article.description || '')).toLowerCase();

  // Always run keyword remap — raw category from scrape may be wrong
  // (e.g., "Commies Running NYC" was tagged Unexplained by keyword overlap)

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

  // Generic category fallbacks
  if (rawCat.toLowerCase() === 'politics') return 'Government Secrets';
  if (rawCat.toLowerCase() === 'world') return 'Global Power';
  if (rawCat.toLowerCase() === 'tech') return 'Tech & Privacy';
  if (rawCat.toLowerCase() === 'culture') return 'Corporate Watchdog';

  return 'Government Secrets';
}

// Junk patterns to exclude from index
const JUNK_TITLE_PATTERNS = [
  /\[Federal Register\]/i,
  /^Federal Register/i,
  /new router setup/i,
  /how to delete/i,
  /self.hosting/i,
  /eero pro/i,
  /^\[FOIA\]/i,
  /^FOIA request to/i,
  /FOIA.*Status: processed/i,
];

function rebuildIndexHTML(allArticles) {
  const clean = allArticles.filter(a =>
    !JUNK_TITLE_PATTERNS.some(p => p.test(a.title || ''))
  );

  const articles = clean.map(a => ({
    ...a,
    category: remapArticleCategory(a),
  })).sort((a, b) =>
    new Date(b.pubDate || b.generatedAt || 0) - new Date(a.pubDate || a.generatedAt || 0)
  );

  if (!articles.length) return;

  const articlesWithImages = articles.filter(a => {
    const imgPath = path.join(SITE_DIR, 'images/articles', (a.filename || '').replace('.html', '.webp'));
    return fs.existsSync(imgPath);
  });
  const heroMain = articlesWithImages[0] ? buildHeroCard(articlesWithImages[0], true)  : (articles[0] ? buildHeroCard(articles[0], true)  : '');
  const heroSec1 = articlesWithImages[1] ? buildHeroCard(articlesWithImages[1], false) : (articles[1] ? buildHeroCard(articles[1], false) : '');
  const heroSec2 = articlesWithImages[2] ? buildHeroCard(articlesWithImages[2], false) : (articles[2] ? buildHeroCard(articles[2], false) : '');

  let categorySections = '';
  for (const cat of CATEGORIES) {
    const catArticles = articles.filter(a => a.category === cat).slice(0, 3);
    if (!catArticles.length) continue;
    const catSlug = CATEGORY_SLUGS[cat];
    categorySections += `
  <section>
    <div class="section-label">
      <h2>${cat}</h2>
      <a href="/category/${catSlug}.html">All ${cat} →</a>
    </div>
    <div class="card-grid">
      ${catArticles.map(a => buildArticleCard(a)).join('\n      ')}
    </div>
  </section>`;
  }

  const trendingItems = articles.slice(0, 7).map((a, i) => {
    const reads = (Math.floor(Math.random() * 30 + 5)) + '.' + Math.floor(Math.random() * 9) + 'K reads';
    return `<a href="/articles/${a.filename}" class="trending-item">
          <span class="trending-num">${i + 1}</span>
          <div>
            <div class="trending-title">${truncate(a.title, 60)}</div>
            <div class="trending-count">${reads}</div>
          </div>
        </a>`;
  }).join('\n');

  const browseItems = CATEGORIES.map((cat, i) => {
    const slug = CATEGORY_SLUGS[cat];
    return `<a href="/category/${slug}.html" class="trending-item">
          <span class="trending-num">${i + 1}</span>
          <div><div class="trending-title">${cat}</div></div>
        </a>`;
  }).join('\n');

  const navLinks = CATEGORIES.map(cat => {
    const cs = CATEGORY_SLUGS[cat];
    return `<li><a href="/category/${cs}.html">${cat}</a></li>`;
  }).join('\n        ');

  const footerCatLinks = CATEGORIES.map(cat => {
    const cs = CATEGORY_SLUGS[cat];
    return `<a href="/category/${cs}.html">${cat}</a>`;
  }).join('\n        ');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NewsAnarchist — The stories buried, spiked, or spun.</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,400&family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,600;1,8..60,400&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/style.css">
  <meta property="og:title" content="NewsAnarchist — The stories buried, spiked, or spun.">
  <meta property="og:description" content="The stories buried, spiked, or spun.">
  <meta property="og:image" content="https://newsanarchist.com/images/og-card.webp">
  <meta property="og:url" content="https://newsanarchist.com">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
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
        <li><a href="/" class="active">Home</a></li>
        ${navLinks}
        <li><a href="/trending.html">Trending</a></li>
        <li><a href="/buried-week.html">The Buried Week</a></li>
      </ul>
    </nav>
  </div>
</header>

<div class="page-layout-with-sidebar">
  <main>
    <section class="hero-section">
      <div class="section-label">
        <h2>Buried Stories</h2>
        <span class="live-badge">Live</span>
      </div>
      <div class="hero-grid">
        ${heroMain}
        ${heroSec1}
        ${heroSec2}
      </div>
    </section>
    ${categorySections}
  </main>
  <aside class="sidebar">
    <div class="sidebar-widget" id="subscribe-anchor">
      <div class="sidebar-widget-header">Daily Briefing</div>
      <div class="sidebar-widget-body">
        <div class="email-widget-text">The stories buried, spiked, or spun. Every morning — free.</div>
        <form id="sidebarEmailForm" onsubmit="submitSidebarEmail(event)">
          <input type="email" id="sidebarEmailInput" class="email-input" placeholder="your@email.com" required>
          <button type="submit" class="btn-subscribe">Subscribe Free</button>
        </form>
        <div class="email-disclaimer">Unsubscribe anytime.</div>
      </div>
    </div>
    <div class="sidebar-widget">
      <div class="sidebar-widget-header">Trending Now</div>
      <div class="trending-list">${trendingItems}</div>
    </div>
    <div class="sidebar-widget">
      <div class="sidebar-widget-header">Browse Categories</div>
      <div class="trending-list">${browseItems}</div>
    </div>
  </aside>
</div>

<footer class="site-footer">
  <div class="footer-inner">
    <div class="footer-wordmark">News<span>Anarchist</span></div>
    <div class="footer-tagline">Independent investigative news. AI-assisted editorial voices. Facts first.</div>
    <div class="footer-links">
      <a href="/about.html">About</a>
      <a href="/editorial.html">Editorial Standards</a>
      <a href="/tip-line.html">Tip Line</a>
      <a href="/authors/">Our Authors</a>
      <a href="/subscribe.html">Subscribe</a>
      <a href="/trending.html">Trending</a>
      <a href="/privacy.html">Privacy</a>
      <a href="/terms.html">Terms</a>
      <a href="/rss">RSS</a>
    </div>
    <div class="footer-legal">&copy; ${new Date().getFullYear()} NewsAnarchist. All rights reserved. AI-assisted editorial content disclosed in bylines. As an Amazon Associate, we earn from qualifying purchases.</div>
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

  const indexPath = path.join(SITE_DIR, 'index.html');
  fs.writeFileSync(indexPath, html);
  console.log(`  ✅ index.html rebuilt from scratch (${articles.length} articles, ${CATEGORIES.length} categories)`);
}

function updateSitemap(allArticles) {
  const sitemapPath = path.join(SITE_DIR, 'sitemap.xml');

  let existingUrls = new Set();
  let sitemapContent = '';

  if (fs.existsSync(sitemapPath)) {
    sitemapContent = fs.readFileSync(sitemapPath, 'utf-8');
    const urlMatches = sitemapContent.match(/<loc>([^<]+)<\/loc>/g) || [];
    for (const m of urlMatches) {
      existingUrls.add(m.replace(/<\/?loc>/g, ''));
    }
  }

  const today = todayISO();
  const newEntries = [];

  for (const article of allArticles) {
    const url = `${SITE_URL}/articles/${article.filename.replace(/\.html$/, '')}`;
    if (!existingUrls.has(url)) {
      newEntries.push(`  <url>
    <loc>${url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`);
      existingUrls.add(url);
    }
  }

  if (!newEntries.length) {
    console.log('  ℹ️  No new URLs to add to sitemap.');
  }

  if (sitemapContent && sitemapContent.includes('</urlset>')) {
    sitemapContent = sitemapContent.replace(
      '</urlset>',
      newEntries.join('\n') + '\n</urlset>'
    );
  } else {
    sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
${newEntries.join('\n')}
</urlset>`;
  }

  fs.writeFileSync(sitemapPath, sitemapContent);
  console.log(`  ✅ sitemap.xml updated (+${newEntries.length} URLs)`);
  rebuildRSS(allArticles);
}


function rebuildRSS(allArticles) {
  const feedDir = path.join(SITE_DIR, 'feed');
  if (!fs.existsSync(feedDir)) fs.mkdirSync(feedDir, { recursive: true });

  // Sort by date, take latest 50
  const sorted = [...allArticles]
    .filter(a => a.pubDate || a.generatedAt)
    .sort((a, b) => (b.pubDate || b.generatedAt || '').localeCompare(a.pubDate || a.generatedAt || ''))
    .slice(0, 50);

  const now = new Date().toUTCString();
  const items = sorted.map(a => {
    const url = 'https://newsanarchist.com/articles/' + (a.filename || a.slug + '.html').replace(/\.html$/, '');
    const pubDate = a.pubDate ? new Date(a.pubDate).toUTCString() : now;
    const desc = (a.description || a.title || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const titleClean = (a.title || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const cat = (a.category || 'General').replace(/&/g, '&amp;');
    // imgSlug: strip .html extension to get the clean slug for image URL
    const imgSlug = (a.filename || a.slug || '').replace(/\.html$/, '');
    // bodyForFeed: use full AI-generated body if available; strip scripts; escape CDATA closer
    const bodyForFeed = (a.aiContent || a.content || a.description || '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/]]>/g, ']]&gt;');
    return `    <item>
      <title>${titleClean}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${desc}</description>
      <content:encoded><![CDATA[${bodyForFeed}]]></content:encoded>
      <media:thumbnail url="https://newsanarchist.com/images/articles/${imgSlug}.png"/>
      <category>${cat}</category>
      <snf:analytics><![CDATA[<script>var s=document.createElement("script");s.async=true;s.src="https://www.googletagmanager.com/gtag/js?id=G-7N6W04M3XW";document.head.appendChild(s);window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());gtag("config","G-7N6W04M3XW");</script>]]></snf:analytics>
      <dc:creator>${getAuthor(a.category || "Government Secrets").name}</dc:creator>
    </item>`;
  }).join('\n');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:media="http://search.yahoo.com/mrss/"
  xmlns:snf="http://www.smartnews.be/snf">
  <channel>
    <title>NewsAnarchist</title>
    <link>https://newsanarchist.com</link>
    <atom:link href="https://newsanarchist.com/rss" rel="self" type="application/rss+xml"/>
    <description>Contrarian news with receipts.</description>
    <language>en-US</language>
    <lastBuildDate>${now}</lastBuildDate>
    <pubDate>${now}</pubDate>
    <ttl>15</ttl>
    <image>
      <url>https://newsanarchist.com/images/logo.png</url>
      <title>NewsAnarchist</title>
      <link>https://newsanarchist.com</link>
    </image>
    <snf:logo>
      <url>https://newsanarchist.com/images/logo.png</url>
    </snf:logo>
${items}
  </channel>
</rss>`;

  fs.writeFileSync(path.join(feedDir, 'rss.xml'), rss);
  fs.writeFileSync(path.join(feedDir, 'smartnews.xml'), rss);
  // Also write to /rss for the footer link
  fs.writeFileSync(path.join(SITE_DIR, 'rss'), rss);
  console.log(`  ✅ RSS feed updated (${sorted.length} articles)`);
}

function rebuildCategoryPages(allArticles) {
  const clean = allArticles.filter(a =>
    !JUNK_TITLE_PATTERNS.some(p => p.test(a.title || ''))
  ).map(a => ({ ...a, category: remapArticleCategory(a) }))
   .sort((a, b) => new Date(b.pubDate || b.generatedAt || 0) - new Date(a.pubDate || a.generatedAt || 0));

  const ARTICLES_PER_PAGE = 100;
  const categoryDir = path.join(SITE_DIR, 'category');

  for (const cat of CATEGORIES) {
    const slug  = CATEGORY_SLUGS[cat];
    const label = CATEGORY_LABELS[cat] || cat;
    const desc  = CATEGORY_DESCRIPTIONS[cat] || '';
    const catArticles = clean.filter(a => a.category === cat);
    const totalPages  = Math.ceil(Math.max(1, catArticles.length) / ARTICLES_PER_PAGE);

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const startIdx     = (pageNum - 1) * ARTICLES_PER_PAGE;
      const pageArticles = catArticles.slice(startIdx, startIdx + ARTICLES_PER_PAGE);
      const canonicalUrl = pageNum === 1
        ? `${SITE_URL}/category/${slug}.html`
        : `${SITE_URL}/category/${slug}-${pageNum}.html`;

      const cardsHTML = catArticles.length === 0
        ? '<p style="text-align:center;color:var(--color-text-muted);padding:40px;font-family:var(--font-ui);">No articles yet — check back soon.</p>'
        : pageArticles.map(a => buildArticleCard(a)).join('\n');

      let paginationHTML = '';
      if (totalPages > 1) {
        paginationHTML += `\n<nav style="display:flex;align-items:center;justify-content:center;gap:8px;padding:32px 0;border-top:1px solid var(--color-border);">`;
        paginationHTML += `<span style="font-family:var(--font-ui);font-size:12px;color:var(--color-text-muted);">Page ${pageNum} of ${totalPages}</span>`;
        if (pageNum > 1) {
          const prevFile = pageNum === 2 ? `${slug}.html` : `${slug}-${pageNum - 1}.html`;
          paginationHTML += `<a href="/category/${prevFile}" style="font-family:var(--font-ui);font-size:12px;padding:6px 12px;border:1px solid var(--color-border);border-radius:var(--radius);">&larr; Prev</a>`;
        }
        if (pageNum < totalPages) {
          paginationHTML += `<a href="/category/${slug}-${pageNum + 1}.html" style="font-family:var(--font-ui);font-size:12px;padding:6px 12px;border:1px solid var(--color-border);border-radius:var(--radius);">Next &rarr;</a>`;
        }
        paginationHTML += `</nav>`;
      }

      const navLinks = CATEGORIES.map(c => {
        const cs = CATEGORY_SLUGS[c];
        const active = c === cat ? ' class="active"' : '';
        return `<li><a href="/category/${cs}.html"${active}>${c}</a></li>`;
      }).join('\n        ');

      const footerCatLinks = CATEGORIES.map(c => {
        const cs = CATEGORY_SLUGS[c];
        return `<a href="/category/${cs}.html">${c}</a>`;
      }).join('\n        ');

      let sidebarTrendingHTML = '';
      try {
        const _db = JSON.parse(fs.readFileSync(path.join(SITE_DIR, 'generated-articles.json'), 'utf8'));
        const _recent = (Array.isArray(_db) ? _db : []).slice(-7).reverse();
        sidebarTrendingHTML = _recent.map((a, i) => {
          const _sl = a.filename || a.slug || '';
          const _ti = (a.title || 'Article').slice(0, 60);
          return `<a href="/articles/${_sl}" class="trending-item"><span class="trending-num">${i+1}</span><div><div class="trending-title">${_ti}</div></div></a>`;
        }).join('');
      } catch(e) {
        sidebarTrendingHTML = CATEGORIES.map((c, i) => {
          const cs = CATEGORY_SLUGS[c];
          return `<a href="/category/${cs}.html" class="trending-item"><span class="trending-num">${i+1}</span><div><div class="trending-title">${c}</div></div></a>`;
        }).join('');
      }

      const sidebarCategoriesHTML = CATEGORIES.map((c, i) => {
        const cs = CATEGORY_SLUGS[c];
        return `<a href="/category/${cs}.html" class="trending-item"><span class="trending-num">${i+1}</span><div><div class="trending-title">${c}</div></div></a>`;
      }).join('');

      const pageHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${label} — NewsAnarchist</title>
  <meta name="description" content="${desc}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${canonicalUrl}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${label} — NewsAnarchist">
  <meta property="og:description" content="${desc}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:image" content="${SITE_URL}/images/og-card.webp">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${label} — NewsAnarchist">
  <meta name="twitter:description" content="${desc}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,400&family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,600;1,8..60,400&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/style.css">
  <link rel="alternate" type="application/rss+xml" title="NewsAnarchist RSS" href="/rss">
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
    <div class="section-label">
      <h2>${label}</h2>
    </div>
    <div class="card-grid">
      ${cardsHTML}
    </div>
    ${paginationHTML}
  </main>
  <aside class="sidebar">
    <div class="sidebar-widget" id="subscribe-anchor">
      <div class="sidebar-widget-header">Daily Briefing</div>
      <div class="sidebar-widget-body">
        <div class="email-widget-text">The stories buried, spiked, or spun. Every morning — free.</div>
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
    <div class="footer-legal">&copy; ${new Date().getFullYear()} NewsAnarchist. All rights reserved. AI-assisted editorial content disclosed in bylines.</div>
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

      const outputFile = pageNum === 1 ? `${slug}.html` : `${slug}-${pageNum}.html`;
      const outputPath = path.join(categoryDir, outputFile);
      fs.writeFileSync(outputPath, pageHTML);
      const kb = (fs.statSync(outputPath).size / 1024).toFixed(1);
      console.log(`  ✅ category/${outputFile} (${pageArticles.length} articles, ${kb} KB)`);
    }
  }
}

function rebuildTrendingHTML(allArticles) {
  // Filter junk, remap categories, sort newest-first
  const clean = allArticles.filter(a =>
    !JUNK_TITLE_PATTERNS.some(p => p.test(a.title || ''))
  ).map(a => ({ ...a, category: remapArticleCategory(a) }))
   .sort((a, b) => new Date(b.pubDate || b.generatedAt || 0) - new Date(a.pubDate || a.generatedAt || 0));

  // Last 48 hours; if fewer than 10 fall in window, show top 20 most recent
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  let trending = clean.filter(a => new Date(a.pubDate || a.generatedAt || 0) >= cutoff);
  if (trending.length < 10) trending = clean.slice(0, 20);

  // Only use articles with confirmed images for hero cards
  const trendingWithImages = trending.filter(a => {
    const imgPath = path.join(SITE_DIR, 'images/articles', (a.filename || '').replace('.html', '.webp'));
    return fs.existsSync(imgPath);
  });
  const heroMain = trendingWithImages[0] ? buildHeroCard(trendingWithImages[0], true) : '';
  const heroSec1 = trendingWithImages[1] ? buildHeroCard(trendingWithImages[1], false) : '';
  const heroSec2 = trendingWithImages[2] ? buildHeroCard(trendingWithImages[2], false) : '';
  const gridCards = trending.slice(3).map(a => buildArticleCard(a)).join('\n            ');

  const navLinks = CATEGORIES.map(cat => {
    const cs = CATEGORY_SLUGS[cat];
    return `<li><a href="/category/${cs}.html">${cat}</a></li>`;
  }).join('\n          ');

  const footerCatLinks = CATEGORIES.map(cat => {
    const cs = CATEGORY_SLUGS[cat];
    return `<a href="/category/${cs}.html">${cat}</a>`;
  }).join('\n          ');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Trending Stories — Last 48 Hours | NewsAnarchist</title>
  <meta name="description" content="The freshest contrarian stories from the last 48 hours. Stories mainstream media buried, spiked, or ignored.">
  <meta name="robots" content="index, follow">
  <link rel="icon" href="/favicon.ico" type="image/x-icon">
  <link rel="canonical" href="${SITE_URL}/trending.html">
  <meta property="og:type" content="website">
  <meta property="og:title" content="Trending Stories — Last 48 Hours | NewsAnarchist">
  <meta property="og:description" content="The freshest contrarian stories. Stories mainstream media buried, spiked, or ignored.">
  <meta property="og:url" content="${SITE_URL}/trending.html">
  <meta property="og:image" content="${SITE_URL}/images/og-card.webp">
  <meta property="og:site_name" content="NewsAnarchist">
  <script async src="https://www.googletagmanager.com/gtag/js?id=${GA4_ID}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${GA4_ID}');
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400;1,9..40,600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/style.css">
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8570942144538499" crossorigin="anonymous"></script>
</head>
<body>

  <!-- HEADER -->
  <header class="masthead">
    <div class="masthead-inner">
      <a href="/" class="masthead-brand">
        <span class="masthead-wordmark">News<span>Anarchist</span></span>
      </a>
      <nav class="nav-bar" id="mainNav">
        <ul class="nav-list">
          ${navLinks}
          <li><a href="/trending.html" class="active">Trending</a></li>
        </ul>
      </nav>
      <div class="header-cta">
        <button class="masthead-subscribe" onclick="window.location='/subscribe.html'">Subscribe Free</button>
        <button class="nav-toggle" id="navToggle" aria-label="Toggle navigation">
          <span></span><span></span><span></span>
        </button>
      </div>
    </div>
  </header>

  <!-- BREAKING TICKER -->
  <div class="breaking-bar">
    <span class="breaking-label">TRENDING</span>
    <div class="ticker-track" id="tickerTrack">
      ${trending.slice(0, 6).map(a => `<span class="ticker-item">${truncate(a.title, 80)}</span>`).join('\n      ')}
    </div>
  </div>

    <div class="page-layout-with-sidebar">
      <main>

        <!-- PAGE HEADER -->
        <section>
          <h1 class="section-label">🔥 Trending Stories — Last 48 Hours</h1>
          <span class="live-badge">Live</span>
          <p style="color:#888;margin-bottom:24px;">The freshest stories from our contrarian pipeline. ${trending.length} stories in the last 48 hours the mainstream press won't touch.</p>
        </section>

        <!-- HERO SECTION -->
        <section class="hero-section">
          <div class="hero-grid">
            ${heroMain}
            ${heroSec1}
            ${heroSec2}
          </div>
        </section>

        <!-- ALL TRENDING ARTICLES -->
        <section>
          <h2 class="section-label">All Trending Stories</h2>
          <div class="card-grid">
            ${gridCards}
          </div>
        </section>

      </main>

      <!-- SIDEBAR -->
      <aside class="sidebar">
        <div class="sidebar-widget email-widget">
          <div class="sidebar-widget-header">📬 Daily Briefing</div>
          <div class="sidebar-widget-body">
            <div class="email-widget-text">The stories buried, spiked, or spun. Every morning — free.</div>
            <form class="email-form" onsubmit="return false;">
              <input type="email" class="email-input" placeholder="your@email.com" aria-label="Email address">
              <button type="submit" class="btn-email">Subscribe Free</button>
              <div class="email-disclaimer">Unsubscribe anytime.</div>
            </form>
          </div>
        </div>

        <div class="sidebar-widget">
          <div class="sidebar-widget-header">📂 Categories</div>
          <div class="sidebar-widget-body">
            <div class="trending-list">
              ${CATEGORIES.map((cat, i) => {
                const cs = CATEGORY_SLUGS[cat];
                return `<a href="/category/${cs}.html" class="trending-item">
                <span class="trending-num">${i + 1}</span>
                <div><div class="trending-title">${cat}</div></div>
              </a>`;
              }).join('\n              ')}
            </div>
          </div>
        </div>
      </aside>
    </div>


  <section class="newsletter-section" style="text-align:center;padding:40px 20px;background:#f8f8f8;">
    <div style="max-width:600px;margin:0 auto;">
      <h2>Stay Informed. No Spin.</h2>
      <p>Get the stories that matter, unfiltered. Straight to your inbox.</p>
      <form method="POST" action="https://6ecf8c9f.sibforms.com/serve/MUIFABzwhUlqB2TN-K0vPR7rQYvKc8kq5ZLEqVvxmxfLK8Ng_wpOi2eL8x7vT8mK3FWmJ0i0AeWCyqN8jK_7gvhM8qMxY6tQwrZNPyE8jM7kQ9vRxN3mK8jQwYvRxN3mK" style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
        <input type="email" name="EMAIL" placeholder="Your email address" required style="padding:12px 16px;border:1px solid #ddd;border-radius:6px;font-size:16px;width:300px;">
        <button type="submit" style="padding:12px 24px;background:#e8491d;color:white;border:none;border-radius:6px;font-size:16px;cursor:pointer;">Subscribe</button>
        <input type="hidden" name="locale" value="en">
      </form>
      <p style="font-size:12px;color:#888;margin-top:8px;">No spam. Unsubscribe anytime.</p>
    </div>
  </section>
  <!-- FOOTER -->
  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-wordmark">News<span>Anarchist</span></div>
      <p class="footer-tagline">The stories they spiked. The documents they buried. The truth in the paperwork.</p>
      <div class="footer-social">
        <a href="https://x.com/newsAnarchis" class="social-btn" aria-label="X / Twitter">𝕏</a>
        <a href="https://www.facebook.com/NewsAnarchist" class="social-btn" aria-label="Facebook">f</a>
        <a href="https://linkedin.com/company/newsanarchist" class="social-btn" aria-label="LinkedIn">in</a>
        <a href="/rss" class="social-btn" aria-label="RSS Feed">⚡</a>
        <a href="/social.html" class="social-btn" aria-label="All Social Media">+</a>
      </div>
      <div class="footer-links">
        ${footerCatLinks}
      </div>
      <div class="footer-links">
        <a href="/about.html">About</a>
        <a href="/subscribe.html">Subscribe</a>
        <a href="/sitemap.xml">Sitemap</a>
        <a href="/rss">RSS Feed</a>
      </div>
      <div class="footer-links">
        <a href="/privacy.html">Privacy Policy</a>
        <a href="/terms.html">Terms of Use</a>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© ${new Date().getFullYear()} NewsAnarchist. Evidence-based contrarian journalism.</span>
      <div class="footer-legal">
        <a href="/privacy.html">Privacy</a>
        <a href="/terms.html">Terms</a>
        <a href="/about.html">About</a>
      </div>
    </div>
  </footer>

  <script src="js/main.js"></script>
  <script>
    document.getElementById('navToggle')?.addEventListener('click', () => {
      document.getElementById('mainNav')?.classList.toggle('active');
    });
  </script>
</body>
</html>`;

  const trendingPath = path.join(SITE_DIR, 'trending.html');
  fs.writeFileSync(trendingPath, html);
  console.log(`  ✅ trending.html built (${trending.length} articles)`);
}

function fixPlaceholderImages(allArticles) {
  const articlesDir = ARTICLES_DIR;
  const imagesDir = path.join(SITE_DIR, 'images', 'articles');
  let fixed = 0;
  for (const article of allArticles) {
    const slug = (article.filename || '').replace('.html', '');
    if (!slug) continue;
    const webpPath = path.join(imagesDir, slug + '.webp');
    if (!fs.existsSync(webpPath)) continue;
    const articlePath = path.join(articlesDir, slug + '.html');
    if (!fs.existsSync(articlePath)) continue;
    let html = fs.readFileSync(articlePath, 'utf-8');
    if (!html.includes('background:linear-gradient(135deg,#1a1a2e')) continue;
    const placeholder = /<div class="article-featured-image"><div style="width:100%;height:320px[\s\S]*?<\/div><\/div>/;
    const title = (article.title || slug).replace(/"/g, '&quot;');
    const category = article.category || 'NewsAnarchist';
    const newImg = `<div class="article-featured-image"><figure itemscope itemtype="https://schema.org/ImageObject"><img src="../images/articles/${slug}.webp" alt="${title} — ${category} article" style="width:100%;height:auto;object-fit:cover;border-radius:8px;display:block;" loading="lazy" itemprop="contentUrl"></figure></div>`;
    const newHtml = html.replace(placeholder, newImg);
    if (newHtml !== html) {
      fs.writeFileSync(articlePath, newHtml);
      fixed++;
    }
  }
  if (fixed > 0) console.log(`  ✅ Auto-fixed ${fixed} article image placeholders`);
}

async function runPublish() {
  const logPath = path.join(SITE_DIR, 'generated-articles.json');
  if (!fs.existsSync(logPath)) {
    console.error('❌ generated-articles.json not found. Run generate mode first.');
    process.exit(1);
  }

  let allArticles = JSON.parse(fs.readFileSync(logPath, 'utf-8'));

  // Deduplicate by filename on load — keep latest entry for each filename
  const deduped = new Map();
  for (const a of allArticles) {
    const existing = deduped.get(a.filename);
    if (!existing || new Date(a.generatedAt || 0) >= new Date(existing.generatedAt || 0)) {
      deduped.set(a.filename, a);
    }
  }
  allArticles = [...deduped.values()];
  // Also deduplicate by normalized title — same story from multiple sources
  const seenTitles = new Map();
  allArticles = allArticles.filter(a => {
    const key = (a.title || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim().slice(0, 60);
    if (!key) return true;
    const existing = seenTitles.get(key);
    if (!existing) { seenTitles.set(key, a); return true; }
    // Keep the one with a better description
    if ((a.description || '').length > (existing.description || '').length) {
      seenTitles.set(key, a);
      return false;
    }
    return false;
  });
  // Write back deduped version
  fs.writeFileSync(logPath, JSON.stringify(allArticles, null, 2));

  console.log(`\n📤 Publishing ${allArticles.length} articles (deduplicated)...\n`);

  rebuildIndexHTML(allArticles);
  fixPlaceholderImages(allArticles);
  rebuildCategoryPages(allArticles);
  rebuildTrendingHTML(allArticles);
  updateSitemap(allArticles);

  console.log('\n🚀 Committing and pushing to GitHub...');
  try {
    const gitDir = SITE_DIR;

    execSync(`git -C "${gitDir}" config user.name "chronicinternet-1"`, { stdio: 'pipe' });
    execSync(`git -C "${gitDir}" config user.email "steve@chronicinternet.com"`, { stdio: 'pipe' });
    execSync(`git -C "${gitDir}" add -A`, { stdio: 'pipe' });

    const status = execSync(`git -C "${gitDir}" status --porcelain`, { encoding: 'utf-8' });
    if (!status.trim()) {
      console.log('  ℹ️  No changes to commit.');
      return;
    }

    const commitMsg = `feat: contrarian pipeline — ${allArticles.length} articles [${todayISO()}]`;
    execSync(`git -C "${gitDir}" commit -m "${commitMsg}"`, { stdio: 'pipe' });
    console.log(`  ✅ Committed: ${commitMsg}`);

    const branch = execSync(`git -C "${gitDir}" rev-parse --abbrev-ref HEAD`, { encoding: 'utf-8' }).trim();
    execSync(`git -C "${gitDir}" push origin ${branch}`, { stdio: 'pipe', timeout: 30000 });
    console.log('  ✅ Pushed to GitHub — Cloudflare Pages deploy triggered.');
  } catch (e) {
    console.error(`  ❌ Git error: ${e.message}`);
    if (e.stdout) console.error(e.stdout.toString());
    if (e.stderr) console.error(e.stderr.toString());
    process.exit(1);
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

const mode = process.argv[2];

if (!mode || !['scrape', 'generate', 'publish', 'dryrun', 'all'].includes(mode)) {
  console.log(`
NewsAnarchist Content Pipeline v2 — Contrarian Edition

Usage:
  node newsanarchist-content.mjs dryrun    — Preview story selection from all sources (no files written)
  node newsanarchist-content.mjs scrape    — Fetch stories → trending-topics.json
  node newsanarchist-content.mjs generate  — Generate HTML articles from trending-topics.json
  node newsanarchist-content.mjs publish   — Update index.html + sitemap.xml, git push
  node newsanarchist-content.mjs all       — Run scrape + generate + publish

Sources: Hacker News, ZeroHedge, r/privacy r/undelete r/conspiracy r/worldnews r/technology,
         Federal Register, CourtListener, MuckRock FOIA

Categories: Surveillance State | Corporate Watchdog | Government Secrets
            Tech & Privacy | Global Power | Money & Markets
`);
  process.exit(0);
}

try {
  if (mode === 'dryrun') {
    await runDryRun();
  }
  if (mode === 'scrape' || mode === 'all') {
    await runScrape();
  }
  if (mode === 'generate' || mode === 'all') {
    await runGenerate();
  }
  if (mode === 'publish' || mode === 'all') {
    await runPublish();
  }
  console.log('\n✅ Done.\n');
} catch (e) {
  console.error('\n❌ Fatal error:', e.message);
  console.error(e.stack);
  process.exit(1);
}
