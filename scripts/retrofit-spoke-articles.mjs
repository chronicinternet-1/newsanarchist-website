#!/usr/bin/env node
// Retrofits published articles in the 9 non-pilot categories (Surveillance State, Corporate
// Watchdog, Government Secrets, Tech & Privacy, Global Power, Unexplained, True Crime,
// Conflict & Wars, Web3 & Blockchain) with the same na-spoke-callout + na-article-method block
// the Money & Markets/Financial Fraud pilot hand-added to 18 articles. Written as a script
// (not hand-edits) because the real volume here is in the hundreds/thousands, not 18.
//
// Category assignment uses remapArticleCategory() — copied verbatim from
// newsanarchist-content.mjs (same function, same priority order) — NOT the stored
// generated-articles.json `category` field, because that field can be stale relative to what
// the category-page builder actually files the article under (rebuildCategoryPages() in
// newsanarchist-content.mjs recomputes category via this same function at build time, every
// time). Retrofitting against the recomputed category means a spoke always points at the hub
// it's actually indexed under, not wherever its original generation-time label said.
//
// Usage: node scripts/retrofit-spoke-articles.mjs [--dry-run] [--limit=N]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HUB_CSS, articleMethodologyBlock } from './hub-content.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_DIR = path.resolve(__dirname, '..');
const ARTICLES_DIR = path.join(SITE_DIR, 'articles');

const DRY_RUN = process.argv.includes('--dry-run');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;

const TARGET_CATEGORIES = [
  'Surveillance State', 'Corporate Watchdog', 'Government Secrets', 'Tech & Privacy',
  'Global Power', 'Unexplained', 'True Crime', 'Conflict & Wars', 'Web3 & Blockchain',
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
  'Financial Fraud': 'financial-fraud',
  'Conflict & Wars': 'conflict-wars',
  'Web3 & Blockchain': 'web3-blockchain',
};

// Short, category-appropriate phrase for the callout's "including our ongoing coverage of X"
// clause — mirrors the specificity of the pilot's "public benefits fraud" phrase rather than a
// generic "more stories" line.
const CATEGORY_COVERAGE_PHRASE = {
  'Surveillance State': 'camera networks, warrantless spying, and facial recognition',
  'Corporate Watchdog': 'antitrust enforcement and corporate accountability',
  'Government Secrets': 'declassification, whistleblowers, and government transparency',
  'Tech & Privacy': 'AI oversight and data privacy',
  'Global Power': 'sanctions, alliances, and geopolitical realignment',
  'Unexplained': 'UAP declassification and consciousness research',
  'True Crime': 'cold cases and criminal prosecutions',
  'Conflict & Wars': 'active conflicts and military escalation',
  'Web3 & Blockchain': 'DeFi exploits and crypto regulation',
};

function authorSlugOf(author) {
  return String(author || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}
function newsLang(author) {
  const s = authorSlugOf(author);
  if (s === 'kenji-mori') return 'ja';
  if (s === 'lucia-ferreira' || s === 'lcia-ferreira') return 'pt';
  if (s === 'james-whitfield') return 'en-GB';
  return 'en';
}
const ALL_CATEGORIES = Object.keys(CATEGORY_SLUGS);

// Copied verbatim from newsanarchist-content.mjs (2026-07-18) — see that file for the canonical
// version. Kept in sync manually; do not let this drift if the source regex chain changes.
function remapArticleCategory(article) {
  const rawCat = article.category || '';
  if (article.categoryLocked && rawCat) return rawCat;
  if (['ja', 'pt'].includes(newsLang(article.author)) && ALL_CATEGORIES.includes(rawCat)) return rawCat;
  const text = (article.title + ' ' + (article.description || '')).toLowerCase();

  if (/ufo|uap|unidentified aerial|non.human intelligence|recovered craft|paranormal|skinwalker|anomalous phenomenon|uap sighting|extraterrestrial|abduction|roswell|area 51|consciousness research|nde |near.death experience/.test(text))
    return 'Unexplained';
  if (/murder|serial killer|drug cartel|sex trafficking|human trafficking|convicted felon|death penalty|cold case|missing person|kidnap/.test(text))
    return 'True Crime';
  if (/medicaid fraud|medicare fraud|snap fraud|food stamp fraud|hospice fraud|daycare fraud|childcare fraud|benefits fraud|wire fraud|securities fraud|ponzi scheme|rico|shell company|offshore accounts|embezzlement|forfeiture|financial crime|white collar crime|fraud ring|money laundering/.test(text))
    return 'Financial Fraud';
  if (/defi|dao|nft|stablecoin|cbdc|on-chain|smart contract|bridge hack|rug pull|blockchain forensics|chainalysis|crypto fraud|sec crypto|cftc crypto|doj crypto|tornado cash|crypto money laundering|ransomware payment|north korea crypto|web3|blockchain/.test(text))
    return 'Web3 & Blockchain';
  if (/proxy war|arms deal|war crimes|conflict financing|drone warfare|unreported war|forgotten war|siege warfare|blockade|china military|pla|taiwan strait|south china sea|sahel|mali|niger|burkina faso|somalia|ethiopia|tigray|myanmar|sudan/.test(text))
    return 'Conflict & Wars';
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
  if (/nato|china|russia|iran|middle east|ukraine|israel|gaza|taiwan|north korea|global|geopolit|troops|sanctions|diplomacy|refinery|oil supply|energy crisis|pipeline|opec|petrodollar|greenland|arctic|foreign minister|prime minister|chancellor|eu |european union|un security council|g7|g20|imf|world bank/.test(text))
    return 'Global Power';
  if (/ice |border patrol|dhs|homeland security|tsa|airport security|immigration|deportation|migrant|asylum|customs|cbp|visa|green card|undocumented/.test(text))
    return 'Surveillance State';
  if (/congress|senate|house of representatives|legislation|bill passed|vote|election|midterm|democrat|republican|gop|white house|president|administration|cabinet|attorney general|doj |fbi director|cia director|supreme court|federal judge|appellate/.test(text))
    return 'Government Secrets';
  if (/mayor|governor|city council|city hall|municipal|borough|alderman|state legislature|state senate|state house|local government|county|zoning|ordinance/.test(text))
    return 'Corporate Watchdog';
  if (/hospital|healthcare|medicaid|medicare|fda|cdc|nih|drug approval|clinical trial|opioid|pharmaceutical|insurance claim|rural health|public health/.test(text))
    return 'Corporate Watchdog';
  if (/arrest|indicted|charged|convicted|guilty plea|sentencing|trial|criminal complaint|grand jury|warrant|search warrant|subpoena|scandal/.test(text))
    return 'True Crime';
  if (/drone|uav|autonomous weapon|anti-drone|counter-drone|directed energy|hypersonic|missile|radar|stealth|air force|navy seal|special forces|military base|barksdale|pentagon budget|defense contract|lockheed|raytheon|northrop|boeing defense|general dynamics/.test(text))
    return 'Conflict & Wars';
  if (/solar|renewable|wind energy|energy transition|power grid|electricity|oil price|gas price|fuel|opec cut|lng|natural gas|commodities|gold price|silver|federal budget|deficit|debt ceiling|jobs report|unemployment|gdp growth|cpi|ppi|interest rate|rate hike|rate cut/.test(text))
    return 'Money & Markets';
  if (/palantir|irs|tax audit|tax evasion|tax haven|offshore|finra|sec fine|sec charges|sec investigation|insider trading|market manipulation|short seller|hedge fund fraud|private equity|venture capital|spac/.test(text))
    return 'Financial Fraud';
  if (/reddit|privacy setting|privacy policy|terms of service|data collection|user data|ad targeting|behavioral data|browser fingerprint|cookie|gdpr|ccpa|digital privacy|michigan privacy|state privacy law/.test(text))
    return 'Tech & Privacy';
  if (/volvo|tesla|ford|gm |general motors|toyota|honda|class action|product recall|product liability|consumer fraud|false advertising|price gouging|wage theft|worker rights|union|nlrb/.test(text))
    return 'Corporate Watchdog';
  if (/commie|communist|marxist|socialist|woke|rino|maga|trump|biden|harris|desantis|democrats|republicans|midterm|primary|swing state|electoral|polling|campaign/.test(text))
    return 'Government Secrets';
  if (/job openings|unemployment rate|jobs report|labor market|hiring|layoffs|wage|payroll|gdp|economic growth|recession|consumer spending|retail sales|housing market|mortgage|federal budget|treasury|central bank|oil refiner|commodity|trade deficit|export|import/.test(text))
    return 'Money & Markets';
  if (/vaccine|covid|pandemic|fauci|cdc director|nih director|public health emergency|outbreak|pathogen|bioweapon|gain of function|lab leak|wuhan|retaliation email|health policy/.test(text))
    return 'Government Secrets';
  if (/copyright|court rules|appellate court|first amendment|free speech|freedom of press|shield law|journalist|subpoena reporter|prior restraint|defamation|libel/.test(text))
    return 'Corporate Watchdog';
  if (/digital age|age verification|online safety|children online|section 230|platform liability|content moderation|draft bill|privacy bill|state privacy|digital rights/.test(text))
    return 'Tech & Privacy';
  if (/citizenship proof|banking|treasury order|treasury secretary|treasury department|financial regulation|bank account|payment system|wire transfer|swift|correspondent bank/.test(text))
    return 'Financial Fraud';
  if (/android app|ios app|app log|app data|privacy polic|data retention|isp retention|digital id|passport data|biometric id|eurail|breach|data leak|fine print|exchange privacy|secret management|http proxy|proxy server/.test(text))
    return 'Tech & Privacy';
  if (/fomc|fed keeps rate|powell|jerome powell|rate unchanged|dissent|basis points|fed meeting|federal open market|quantitative|balance sheet|treasury yield|bond market|debt spiral|sovereign debt|fiscal deficit|austerity|imf loan|debt gdp/.test(text))
    return 'Money & Markets';
  if (/kpmg|audit|auditor|accounting fraud|big four|deloitte|pwc|ernst young|restatement|sec enforcement|corporate fine|government contract|army contract|gsa|procurement fraud/.test(text))
    return 'Financial Fraud';
  if (/malaria|endemic|disease|epidemic|who |world health|cholera|tuberculosis|hiv|aids|polio|global health|health crisis|humanitarian|famine|refugee|displaced/.test(text))
    return 'Global Power';
  if (/detention center|immigration detention|ice facility|alcatraz|gitmo|guantanamo|prison|incarceration|solitary|death row|appeals court|injunction|stay of execution/.test(text))
    return 'Government Secrets';
  if (/jetblue|spirit airlines|delta|united airlines|american airlines|southwest|airline|aviation|faa|airport|flight|passenger|fare|boeing 737|airbus/.test(text))
    return 'Corporate Watchdog';
  if (/cigna|aetna|humana|anthem|bcbs|blue cross|obamacare|aca|health insurance|insurer|premium|deductible|coverage|medicaid expansion|medicare advantage/.test(text))
    return 'Corporate Watchdog';
  if (/jetblue|spirit|paypal|dell|amd|nvidia|intel|qualcomm|broadcom|arm holdings|semiconductor|chip|data center|humanoid robot|figure ai|boston dynamics|redomicil/.test(text))
    return 'Corporate Watchdog';
  if (/treasury.*borrowing|quarterly refunding|auction size|bessent|treasury.*estimate|treasury.*note|treasury.*bond|10.year yield|2.year yield|30.year|borrow estimate|debt issuance|quarterly.*debt/.test(text))
    return 'Money & Markets';
  if (/elon musk|sec.*settlement|sec.*fine|sec.*twitter|twitter stake|burry|gamestop|michael burry|short.*position|meme stock|wallstreetbets/.test(text))
    return 'Financial Fraud';
  if (/nuclear.*reactor|nuclear.*plant|nuclear energy|small modular|brookfield|nuclear co|uranium|fusion|fission|energy.*reactor/.test(text))
    return 'Money & Markets';
  if (/mini data center|data center.*home|tech bros.*data|robot.*home|\$600.*month.*robot|humanoid.*home|figure.*robot|paypal.*job cuts|paypal.*ceo|turnaround/.test(text))
    return 'Corporate Watchdog';
  if (/welfare|snap benefit|food stamp|work requirement|federal work|benefit enrollment|medicaid work|tanf|wic program/.test(text))
    return 'Financial Fraud';
  if (/home sales|new home|existing home|housing starts|building permit|real estate|property market|home price|mortgage rate|30.year mortgage/.test(text))
    return 'Money & Markets';
  if (/beef price|supply.chain|supply chain|pork|chicken price|food price|grocery|commodity price|farm|agriculture|crop|drought|harvest/.test(text))
    return 'Money & Markets';
  if (/california.*republic|islamic republic.*california|golden state.*fallen|state.*fallen|virtue.*mad|shoplifter|retail.*theft|organized retail|smash.*grab/.test(text))
    return 'Government Secrets';
  if (/durham.*energy|energy efficiency.*fine|epa fine|epa penalty|environmental fine|clean energy fraud|green energy fraud|solar fraud/.test(text))
    return 'Financial Fraud';
  if (/pirates|arabian sea|somali pirate|maritime|shipping lane|cargo ship|tanker.*attack|sea.*hijack/.test(text))
    return 'Conflict & Wars';
  if (/notepad|is.*private|vpn.*review|browser.*review|app.*review|tool.*review|software.*review/.test(text))
    return 'Tech & Privacy';

  if (rawCat.toLowerCase() === 'politics') return 'Government Secrets';
  if (rawCat.toLowerCase() === 'world') return 'Global Power';
  if (rawCat.toLowerCase() === 'tech') return 'Tech & Privacy';
  if (rawCat.toLowerCase() === 'culture') return 'Corporate Watchdog';
  if (rawCat.toLowerCase() === 'conflict & wars') return 'Conflict & Wars';
  if (rawCat.toLowerCase() === 'financial fraud') return 'Financial Fraud';
  if (rawCat.toLowerCase() === 'web3 & blockchain') return 'Web3 & Blockchain';

  return 'Government Secrets';
}

function isNonCanonicalArticleFile(filename) {
  if (!filename) return false;
  const slug = filename.replace(/\.html$/, '');
  const fp = path.join(ARTICLES_DIR, filename);
  let html;
  try { html = fs.readFileSync(fp, 'utf-8'); } catch { return false; }
  const m = html.match(/<link rel="canonical" href="https:\/\/newsanarchist\.com\/articles\/([^"]+)">/);
  return !!(m && m[1] !== slug);
}

// Junk-title guard (subset of JUNK_TITLE_PATTERNS in newsanarchist-content.mjs) so sibling
// links in the callout don't point at obvious scrape noise.
const JUNK_RE = /\[Federal Register\]|^Federal Register|^\[FOIA\]|^FOIA request to|^to what extent|^what (is|are|do|does|did|should|would|can|could) |^how (do|does|did|can|should|would) |^why (is|are|do|does) |^is (it|this|there|a|the) |^am i |^does anyone/i;

function main() {
  const logPath = path.join(SITE_DIR, 'generated-articles.json');
  const raw = JSON.parse(fs.readFileSync(logPath, 'utf-8'));

  // Dedupe by filename, keep latest — same rule runPublish() uses.
  const deduped = new Map();
  for (const a of raw) {
    const existing = deduped.get(a.filename);
    if (!existing || new Date(a.generatedAt || 0) >= new Date(existing.generatedAt || 0)) {
      deduped.set(a.filename, a);
    }
  }
  const all = [...deduped.values()];

  // Resolve true category for every article once, then group.
  const byCategory = {};
  for (const cat of TARGET_CATEGORIES) byCategory[cat] = [];
  for (const a of all) {
    if (!a.filename || !a.title) continue;
    const cat = remapArticleCategory(a);
    if (!TARGET_CATEGORIES.includes(cat)) continue;
    byCategory[cat].push(a);
  }
  for (const cat of TARGET_CATEGORIES) {
    byCategory[cat].sort((x, y) => new Date(y.generatedAt || y.pubDate || 0) - new Date(x.generatedAt || x.pubDate || 0));
  }

  const stats = {};
  for (const cat of TARGET_CATEGORIES) stats[cat] = { retrofitted: 0, skippedAlready: 0, skippedMissingFile: 0, skippedNonCanonical: 0, skippedNoSiblings: 0, skippedJunkTitle: 0 };

  let totalWritten = 0;

  for (const cat of TARGET_CATEGORIES) {
    const slug = CATEGORY_SLUGS[cat];
    const list = byCategory[cat];
    const coveragePhrase = CATEGORY_COVERAGE_PHRASE[cat];

    // Pre-filter: real file exists, canonical, not junk-titled — this becomes the sibling pool too.
    const eligible = list.filter(a => {
      const fp = path.join(ARTICLES_DIR, a.filename);
      if (!fs.existsSync(fp)) { stats[cat].skippedMissingFile++; return false; }
      if (JUNK_RE.test(a.title)) { stats[cat].skippedJunkTitle++; return false; }
      if (isNonCanonicalArticleFile(a.filename)) { stats[cat].skippedNonCanonical++; return false; }
      return true;
    });

    for (let i = 0; i < eligible.length && totalWritten < LIMIT; i++) {
      const a = eligible[i];
      const fp = path.join(ARTICLES_DIR, a.filename);
      let html = fs.readFileSync(fp, 'utf-8');

      if (html.includes('class="na-spoke-callout"')) {
        stats[cat].skippedAlready++;
        continue;
      }

      // A subset of articles were generated before na-authors' 2026-07-18 disclosure-gate
      // generalization and already carry a stale "How We Report <wrong category>" block from
      // the old MONEY_FRAUD_TOPIC_RE-only gate (e.g. a Web3 & Blockchain article whose title
      // matched "crypto regulat" got a Money & Markets disclosure baked in at generation time,
      // even though remapArticleCategory() files it under Web3 & Blockchain). Strip that stale
      // block before inserting the correctly-labeled one below, so the article never ends up
      // with two contradictory "How We Report" blocks.
      const staleMethodRe = /<div class="na-article-method"><div class="na-article-method-h">How We Report[^<]*<\/div><p>.*?<\/p><\/div>/;
      const staleMatch = html.match(staleMethodRe);
      if (staleMatch) {
        html = html.slice(0, staleMatch.index) + html.slice(staleMatch.index + staleMatch[0].length);
      }

      // Pick 2 sibling links: nearest other eligible articles in the same category (by recency
      // position), skipping itself and titles that are near-duplicates of this one.
      const siblings = [];
      const selfTitleKey = a.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 40);
      for (let off = 1; off < eligible.length && siblings.length < 2; off++) {
        for (const idx of [i - off, i + off]) {
          if (idx < 0 || idx >= eligible.length || siblings.length >= 2) continue;
          const cand = eligible[idx];
          const candKey = cand.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 40);
          if (candKey === selfTitleKey) continue;
          if (siblings.some(s => s.filename === cand.filename)) continue;
          siblings.push(cand);
        }
      }
      if (siblings.length < 1) {
        stats[cat].skippedNoSiblings++;
        continue;
      }

      const siblingLis = siblings.map(s => {
        const sSlug = s.filename.replace(/\.html$/, '');
        const esc = String(s.title).replace(/"/g, '&quot;');
        return `<li><a href="/articles/${sSlug}">${esc}</a></li>`;
      }).join('');

      const calloutHTML = `<div class="na-spoke-callout"><div class="na-spoke-callout-h">Part of our ${cat} coverage</div>See the full picture on <a href="/category/${slug}">our ${cat} hub</a> — including our ongoing coverage of ${coveragePhrase}.<ul>${siblingLis}</ul></div>${articleMethodologyBlock(cat)}`;

      let newHtml = html;

      // CSS: only add if this file doesn't already carry the rules (many already do from an
      // earlier broad template pass; harmless duplicate CSS is still avoided).
      if (!newHtml.includes('.na-spoke-callout{')) {
        const cssBlock = `<style>\n.na-article-method{margin:24px 0;padding:14px 16px;background:#F9F8F5;border:1px solid #E5E3DE;border-left:3px solid #111;font-size:12.5px;line-height:1.6;color:#555}\n.na-article-method-h{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#666;margin-bottom:6px}\n.na-article-method a{color:#B91C1C}\n.na-spoke-callout{margin:22px 0;padding:14px 16px;background:#F9F8F5;border-left:3px solid #E11D48;font-size:13px}\n.na-spoke-callout-h{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#E11D48;margin-bottom:6px}\n.na-spoke-callout a{color:#111;font-weight:600;text-decoration:underline;text-decoration-color:#E5E3DE}\n.na-spoke-callout a:hover{text-decoration-color:#E11D48}\n.na-spoke-callout ul{margin:4px 0 0 18px;padding:0}\n.na-spoke-callout li{margin-bottom:3px}\n</style>\n</head>`;
        if (newHtml.includes('</head>')) {
          newHtml = newHtml.replace('</head>', cssBlock);
        }
      }

      // Body insertion point: prefer right before the subscribe-inline widget (matches pilot
      // placement exactly), else right before </main>, else right before </body>.
      if (newHtml.includes('class="na-subscribe-inline"')) {
        const idx = newHtml.indexOf('<div class="na-subscribe-inline"');
        newHtml = newHtml.slice(0, idx) + calloutHTML + newHtml.slice(idx);
      } else if (newHtml.includes('</main>')) {
        const idx = newHtml.indexOf('</main>');
        newHtml = newHtml.slice(0, idx) + calloutHTML + newHtml.slice(idx);
      } else {
        const idx = newHtml.indexOf('</body>');
        newHtml = newHtml.slice(0, idx) + calloutHTML + newHtml.slice(idx);
      }

      if (!DRY_RUN) fs.writeFileSync(fp, newHtml);
      stats[cat].retrofitted++;
      totalWritten++;
    }
  }

  console.log(DRY_RUN ? '--- DRY RUN (no files written) ---' : '--- RETROFIT COMPLETE ---');
  let grandTotal = 0;
  for (const cat of TARGET_CATEGORIES) {
    const s = stats[cat];
    grandTotal += s.retrofitted;
    console.log(`${cat}: retrofitted=${s.retrofitted} alreadyDone=${s.skippedAlready} missingFile=${s.skippedMissingFile} nonCanonical=${s.skippedNonCanonical} junkTitle=${s.skippedJunkTitle} noSiblings=${s.skippedNoSiblings} (pool=${byCategory[cat].length})`);
  }
  console.log(`TOTAL retrofitted: ${grandTotal}`);
}

main();
