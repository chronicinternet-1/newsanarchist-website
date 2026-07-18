#!/usr/bin/env node
/**
 * backfill-category-breadcrumb.mjs
 *
 * 2026-07-18: the na-authors content-category convergence sweep (commit 81f189d2d) corrected
 * article:section / JSON-LD articleSection / generated-articles.json category fields on 3835 of
 * 8361 checked articles, but explicitly did NOT touch the visible on-page breadcrumb
 * (`<div class="art-cat">...</div>`) — readers were still seeing the stale category even on
 * articles whose meta tags were already fixed. This script closes that gap: it re-runs the same
 * remapArticleCategory() keyword ladder (copied verbatim below from newsanarchist-content.mjs —
 * see that function for the canonical source) against every article file on disk and rewrites
 * BOTH the visible breadcrumb and any straggler meta tags (articles published between the prior
 * sweep and the na-authors v18 deploy were never covered by either) wherever they disagree with
 * the resolved category. Only ever touches the single art-cat div's text and the two meta/JSON-LD
 * category fields — never regenerates or restyles anything else in the file.
 *
 * Skips the non-canonical side of any resolved duplicate pair (via the exact same
 * isNonCanonicalArticleFile() check newsanarchist-content.mjs's listing/sitemap code uses) —
 * no reason to rewrite content that's already excluded from every listing.
 *
 * Usage:
 *   node scripts/backfill-category-breadcrumb.mjs --dry-run          # report only, no writes
 *   node scripts/backfill-category-breadcrumb.mjs --dry-run --files=a.html,b.html
 *   node scripts/backfill-category-breadcrumb.mjs                    # write for real
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_DIR = path.resolve(__dirname, '..');
const ARTICLES_DIR = path.join(SITE_DIR, 'articles');
const MANIFEST_PATH = path.join(SITE_DIR, 'generated-articles.json');
const CANONICAL_STATUS_CACHE_PATH = path.join(SITE_DIR, '.canonical-status-cache.json');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const filesArg = args.find(a => a.startsWith('--files='));
const ONLY_FILES = filesArg ? filesArg.slice('--files='.length).split(',').map(s => s.trim()) : null;

// ─── Verbatim copy of newsanarchist-content.mjs's category-resolution machinery ───────────────
// (CATEGORIES, authorSlugOf, newsLang, remapArticleCategory) — kept textually identical to that
// file, which is the site's real source of truth for hub/category-page placement. If that file's
// keyword ladder ever changes, this must be updated to match (same manual-invariant note as
// resolveArticleCategory() in na-authors/src/index.js).

const CATEGORIES = [
  'Surveillance State',
  'Corporate Watchdog',
  'Government Secrets',
  'Tech & Privacy',
  'Global Power',
  'Money & Markets',
  'Unexplained',
  'True Crime',
  'Financial Fraud',
  'Conflict & Wars',
  'Web3 & Blockchain',
];

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

function remapArticleCategory(article) {
  const rawCat = article.category || '';
  if (article.categoryLocked && rawCat) return rawCat;
  if (['ja', 'pt'].includes(newsLang(article.author)) && CATEGORIES.includes(rawCat)) return rawCat;
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

// ─── Canonical-duplicate skip (same check newsanarchist-content.mjs's listing/sitemap code uses) ─

let _canonStatusCache = null;
function loadCanonicalStatusCache() {
  if (_canonStatusCache) return _canonStatusCache;
  try { _canonStatusCache = JSON.parse(fs.readFileSync(CANONICAL_STATUS_CACHE_PATH, 'utf-8')); }
  catch { _canonStatusCache = {}; }
  return _canonStatusCache;
}

function isNonCanonicalArticleFile(filename, html) {
  const slug = filename.replace(/\.html$/, '');
  const m = html.match(/<link rel="canonical" href="https:\/\/newsanarchist\.com\/articles\/([^"]+)">/);
  return !!(m && m[1] !== slug);
}

// ─── HTML field extraction (read-only) ─────────────────────────────────────────────────────────

function unescapeHtml(s) {
  return String(s || '')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function extractFields(html) {
  const artCatMatch = html.match(/<div class="art-cat">([^<]*)<\/div>/);
  const titleMatch = html.match(/<title>([^<]*)\s*—\s*NewsAnarchist<\/title>/);
  const descMatch = html.match(/<meta name="description" content="([^"]*)">/);
  const sectionMatch = html.match(/<meta property="article:section" content="([^"]*)">/);
  const ldMatch = html.match(/"articleSection":"((?:[^"\\]|\\.)*)"/);
  const authorImgMatch = html.match(/<img src="\/images\/authors\/([^"]+)\.webp"/);
  const authorLdMatch = html.match(/\/authors\/([a-z0-9-]+)"/);

  return {
    artCat: artCatMatch ? artCatMatch[1] : null,
    title: titleMatch ? unescapeHtml(titleMatch[1]) : null,
    description: descMatch ? unescapeHtml(descMatch[1]) : '',
    articleSection: sectionMatch ? unescapeHtml(sectionMatch[1]) : null,
    ldArticleSection: ldMatch ? ldMatch[1] : null,
    authorSlug: authorImgMatch ? authorImgMatch[1] : (authorLdMatch ? authorLdMatch[1] : ''),
  };
}

// ─── Manifest (for categoryLocked / author fallback) ───────────────────────────────────────────

function loadManifestByFilename() {
  const map = new Map();
  try {
    const rows = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    for (const r of rows) if (r.filename) map.set(r.filename, r);
  } catch (e) { console.warn('WARN: could not read manifest:', e.message); }
  return map;
}

// ─── Main ───────────────────────────────────────────────────────────────────────────────────────

function main() {
  const manifestByFilename = loadManifestByFilename();
  const files = ONLY_FILES
    ? ONLY_FILES
    : fs.readdirSync(ARTICLES_DIR).filter(f => f.endsWith('.html'));

  console.log(`Scanning ${files.length} article file(s)${DRY_RUN ? ' [DRY RUN]' : ''}...`);

  let skippedNonCanonical = 0;
  let skippedNoData = 0;
  let alreadyCorrect = 0;
  let breadcrumbFixed = 0;
  let metaFixed = 0;
  let bothFixed = 0;
  const sampleChanges = [];
  const sampleFailures = [];

  for (const filename of files) {
    const filePath = path.join(ARTICLES_DIR, filename);
    let html;
    try { html = fs.readFileSync(filePath, 'utf8'); }
    catch (e) { skippedNoData++; continue; }

    if (isNonCanonicalArticleFile(filename, html)) { skippedNonCanonical++; continue; }

    const f = extractFields(html);
    if (!f.artCat || !f.title) { skippedNoData++; sampleFailures.push(filename); continue; }

    const manifestEntry = manifestByFilename.get(filename);
    const rawCategoryInput = f.articleSection || f.artCat;
    const resolved = remapArticleCategory({
      title: f.title,
      description: f.description,
      author: manifestEntry ? manifestEntry.author : f.authorSlug,
      category: rawCategoryInput,
      categoryLocked: manifestEntry ? !!manifestEntry.categoryLocked : false,
    });

    const needsBreadcrumb = f.artCat !== resolved;
    const needsMetaSection = f.articleSection !== null && f.articleSection !== resolved;
    const needsMetaLd = f.ldArticleSection !== null && f.ldArticleSection !== resolved;
    const needsMeta = needsMetaSection || needsMetaLd;

    if (!needsBreadcrumb && !needsMeta) { alreadyCorrect++; continue; }

    let newHtml = html;
    if (needsBreadcrumb) {
      newHtml = newHtml.replace(
        `<div class="art-cat">${f.artCat}</div>`,
        `<div class="art-cat">${resolved}</div>`
      );
    }
    if (needsMetaSection) {
      newHtml = newHtml.replace(
        `<meta property="article:section" content="${f.articleSection}">`,
        `<meta property="article:section" content="${resolved}">`
      );
    }
    if (needsMetaLd) {
      newHtml = newHtml.replace(
        `"articleSection":"${f.ldArticleSection}"`,
        `"articleSection":"${resolved}"`
      );
    }

    if (needsBreadcrumb && needsMeta) bothFixed++;
    else if (needsBreadcrumb) breadcrumbFixed++;
    else if (needsMeta) metaFixed++;

    if (sampleChanges.length < 15) {
      sampleChanges.push(`${filename}: art-cat "${f.artCat}" -> "${resolved}"${needsMeta ? ' (+ meta)' : ''}`);
    }

    if (!DRY_RUN && newHtml !== html) {
      fs.writeFileSync(filePath, newHtml, 'utf8');
    }
  }

  console.log(`\n${DRY_RUN ? '[DRY RUN] Would fix' : 'Fixed'}:`);
  console.log(`  Breadcrumb only:     ${breadcrumbFixed}`);
  console.log(`  Meta tags only:      ${metaFixed}`);
  console.log(`  Both:                ${bothFixed}`);
  console.log(`  Already correct:     ${alreadyCorrect}`);
  console.log(`  Skipped (non-canon): ${skippedNonCanonical}`);
  console.log(`  Skipped (no data):   ${skippedNoData}`);
  console.log(`  Total scanned:       ${files.length}`);
  if (sampleChanges.length) {
    console.log(`\nSample changes:`);
    sampleChanges.forEach(s => console.log(`  ${s}`));
  }
  if (sampleFailures.length) {
    console.log(`\nSample extraction failures (first ${Math.min(10, sampleFailures.length)}):`);
    sampleFailures.slice(0, 10).forEach(s => console.log(`  ${s}`));
  }
}

main();
