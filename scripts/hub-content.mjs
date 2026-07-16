// Hub-page content for the Hub & Spoke pilot — Money & Markets and Financial Fraud only.
// Real synthesis grounded in this session's actual sample of the last ~80 canonical articles
// per category (see mm-articles.json / ff-articles.json). Slugs referenced below were verified
// present in generated-articles.json and canonical (not filtered by isNonCanonicalArticleFile)
// at write time. If a slug is ever retired/merged, the link degrades to a normal 404 — it does
// not break the page.

const METHODOLOGY_BLOCK = (categoryLabel) => `
<div class="na-hub-method">
  <div class="na-hub-method-h">How We Report ${categoryLabel}</div>
  <p>NewsAnarchist's ${categoryLabel} coverage is produced by an AI reporting system, not a human staff reporter — we say this plainly rather than let a byline imply otherwise. Each piece starts from a primary source: a regulator's own filing or press release (SEC, CFTC, FCA, DOJ, HHS-OIG, Treasury/OFAC), a court record, or wire reporting from outlets we cite by name. The system cross-references the source document against the claim before publishing and links to the underlying filing or release wherever one exists.</p>
  <p>What this means in practice: we report what a regulator, prosecutor, or court document says happened, attributed to that source — we do not offer investment advice, predict where a case or a market goes next, or verify disputed facts beyond what the primary source states. If you're making a financial decision based on something you read here, read the underlying filing yourself; we link to it when it exists precisely so you can.</p>
  <p>Corrections: if you find an error, tell us — <a href="/tip-line">tip line</a>. We fix the article and note the correction inline, not silently.</p>
</div>`;

const MM_HUB = `
<div class="na-hub">
  <h1 class="na-hub-title">💰 Money &amp; Markets</h1>
  <p class="na-hub-dek">Where the real money is actually moving right now — crypto's collision with federal regulators, the state actors and hackers draining exchanges, what central banks are actually doing to rates, and the energy and commodity flows underneath it all. Updated continuously as new reporting lands; this page is a living summary, not a one-time post.</p>

  <div class="na-hub-section">
    <h2>The Crypto Regulatory Reckoning</h2>
    <p>The single largest story in this category right now is the fight over the <strong>CLARITY Act</strong>, the federal market-structure bill that would split digital-asset oversight between the SEC and CFTC. Coverage has tracked it through repeated Senate deadline extensions and stalls — see <a href="/articles/2026-07-14-us-crypto-regulation-heats-up-with-clarity-act-deadline">the Senate deadline pressure</a> and the earlier <a href="/articles/2026-07-14-clarity-act-deadline-looms-as-crypto-legislation-hangs-in-balance">four-week countdown</a> reporting. In parallel, the SEC itself has been moving on two tracks — a formal <a href="/articles/2026-07-15-sec-develops-new-crypto-rules">DeFi safe-harbor and tokenized-securities framework</a>, and Chair Paul Atkins' <a href="/articles/2026-07-02-secs-project-crypto">Project Crypto initiative</a> to bring traditional finance on-chain. Outside the US, the pattern repeats: the UK's FCA has swung between <a href="/articles/2026-06-28-fca-eyes-cryptoasset-crackdown">tightening cryptoasset rules</a> and later <a href="/articles/2026-07-04-uk-regulator-eases-crypto-rules">easing them</a>, while the EU works through a <a href="/articles/2026-07-02-eu-refines-crypto-regulation">formal MiCA review consultation</a>. Compliance cost is a real, measured downstream effect — one estimate put pre-CLARITY-Act delay at <a href="/articles/2026-07-13-us-crypto-regulatory-shifts">$4.2 billion in stalled investment</a>, and <a href="/articles/2026-07-06-crypto-compliance-costs-soar">startups are now facing $2M+ in annual compliance costs</a>.</p>
  </div>

  <div class="na-hub-section">
    <h2>Crypto Crime Doesn't Wait for Regulators</h2>
    <p>While the rulemaking drags, the theft keeps happening at scale. North Korea-linked hacking groups were tied to <a href="/articles/2026-07-09-nk-hackers-steal-crypto">two-thirds of all crypto stolen in 2026</a> per one tracking report, and separately to a <a href="/articles/2026-06-16-crypto-hack">$36 million token theft</a>. A single Solana-based perpetual-futures platform lost <a href="/articles/2026-07-08-crypto-hacks-surge">$295 million in one hack</a>. The attack surface has moved into AI tooling itself — <a href="/articles/2026-07-13-ai-gateways-hijacked-to-steal-crypto">AI gateways connected to Amazon Bedrock</a> and even <a href="/articles/2026-06-27-ai-hijacks-crypto-chats">private crypto messaging apps hijacked with a single crafted sentence</a>. On the enforcement side, a <a href="/articles/2026-06-16-crypto-laundering-service-shut">$389M laundering service was shut down</a>, and <a href="/articles/2026-07-13-doj-charges-inmate-with-laundering-seized-crypto-funds">DOJ has pursued laundering charges tied to previously-seized funds</a> — read alongside our <a href="/category/financial-fraud">Financial Fraud</a> coverage of the prosecutions themselves.</p>
  </div>

  <div class="na-hub-section">
    <h2>Central Banks, Rates, and Inflation</h2>
    <p>The ECB has been weighing a rate move as <a href="/articles/2026-07-13-ecb-weighs-rate-hike-amid-euro-area-inflation">euro-area inflation accelerated to 3.2%</a>, above its 2% target. Outside the developed economies, the divergence is stark — Iran's sanctions-driven <a href="/articles/2026-06-30-iran-inflation-soars">annual inflation rate hit 58%</a> in the same window.</p>
  </div>

  <div class="na-hub-section">
    <h2>Energy and Commodity Flows</h2>
    <p>Renewables investment is shifting from project-building to institution-building — <a href="/articles/2026-07-13-africa-shifts-focus-to-building-institutions-for-renewable-energy">Africa is prioritizing regulatory capacity over new projects</a>, while <a href="/articles/2026-07-04-central-asia-invests-in-renewables">Uzbekistan's solar and battery buildout is drawing outside investors</a> and <a href="/articles/2026-07-07-europe-boosts-renewables">Portugal and Spain added 1,000 MW of cross-border grid capacity</a> — set against <a href="/articles/2026-07-07-europe-power-grids-tested">grids being pushed to their limit by heat waves</a> the same week. Global renewable capacity <a href="/articles/2026-07-02-renewables-boom">hit a record high in 2025</a>, and China's newest five-year plan signals a <a href="/articles/2026-06-29-nuclear-energy-revival">major nuclear-energy pivot</a>. On the fossil side, oil moved on real diplomacy, not just sentiment — prices <a href="/articles/2026-06-18-oil-prices-plummet">fell over $2/barrel after a US-Iran interim agreement</a>, while the DOJ and FTC opened a <a href="/articles/2026-07-03-us-probes-oil-price-fixing">formal look at potential oil-market price-fixing</a>.</p>
  </div>

  ${METHODOLOGY_BLOCK('Money & Markets')}
</div>`;

const FF_HUB = `
<div class="na-hub">
  <h1 class="na-hub-title">🕵️ Financial Fraud</h1>
  <p class="na-hub-dek">By dollar volume and case count, the majority of what actually lands in this category is public-benefits fraud — Medicaid, Medicare, and SNAP schemes charged one prosecution at a time, week after week, by the same handful of federal and state units. We've grouped that pattern here explicitly, rather than let it read as dozens of interchangeable headlines, alongside the market-manipulation and individual white-collar cases that make up the rest of the beat.</p>

  <div class="na-hub-section">
    <h2>Public Benefits Fraud, at Scale</h2>
    <p>This is genuinely the dominant story in the category, not just the most-covered one. The 2026 <strong>National Health Care Fraud Takedown</strong> alone charged <a href="/articles/2026-07-09-medicare-fraud-takedown">455 people over more than $6.5 billion in alleged false claims</a> — separately reported as <a href="/articles/2026-07-07-medicare-fraud-hits-65b">a $6.5B action</a> and, regionally, as <a href="/articles/2026-07-04-medicaid-fraud-takedown">nearly $11 million recovered in the Medicaid slice of the same sweep</a>. HHS's Inspector General has separately logged <a href="/articles/2026-07-14-hhs-recovers-556b-in-fraud-crackdown">$5.56 billion in total recoveries</a> and barred over 1,200 people from federal programs. Medicare's own claims data shows the anomaly clearly: claims for skin-substitute products <a href="/articles/2026-07-09-medicare-fraud-spikes">surged 7,100% — from $200 million to $14.4 billion between 2019 and 2025</a>. Enforcement has real, sometimes contested side effects — a hospice-focused crackdown <a href="/articles/2026-07-13-medicare-fraud-scheme-raises-concerns">halted funding to some legitimate hospice providers</a> alongside the fraudulent ones. On SNAP specifically, USDA reported <a href="/articles/2026-07-15-10b-snap-fraud-uncovered">nearly $10 billion in fraud and 1,000 arrests</a>, against a backdrop of <a href="/articles/2026-07-11-snap-error-rate">over 10% of federal SNAP payments made in error</a> — two related but distinct numbers (fraud vs. error) our coverage has sometimes blurred together, which is exactly the kind of thing a hub page should call out rather than repeat. Despite all this enforcement activity, a GAO-style review found <a href="/articles/2026-07-15-medicaid-fraud-control-units-ineffective">Medicaid Fraud Control Unit indictments and convictions are actually down</a> even as their funding rose.</p>
  </div>

  <div class="na-hub-section">
    <h2>Market Manipulation and Insider Trading</h2>
    <p>The SEC has been active on classic market-integrity cases — a <a href="/articles/2026-07-15-sec-cracks-down-on-market-manipulation">series of new manipulation investigations</a>, concerns about <a href="/articles/2026-07-12-market-manipulation-risks-in-prediction-markets">spoofing and insider trading spreading into prediction markets</a>, and a federal judge's approval of the <a href="/articles/2026-07-10-elon-musk-settlement">SEC's settlement with Elon Musk over Twitter share disclosure</a>. Campaign-finance-adjacent trading also surfaced: <a href="/articles/2026-07-10-insider-trading-probe">staffers were caught betting on the elections they worked on</a>. Two cases worth reading together for how differently they were handled: <a href="/articles/2026-07-13-jordan-belfort-scam-allegations-and-market-manipulation">Jordan Belfort's renewed fraud/manipulation allegations</a>, and federal prosecutors' decision to <a href="/articles/2026-07-12-doj-drops-charges-in-722m-crypto-ponzi-scheme">drop charges in a $722 million crypto Ponzi case</a> outright.</p>
  </div>

  <div class="na-hub-section">
    <h2>Individual Wire Fraud &amp; White-Collar Cases</h2>
    <p>Outside the two clusters above, the beat also tracks one-off prosecutions as they're charged: a <a href="/articles/2026-07-04-deli-fraudster-sentence">$100 million New Jersey deli stock-manipulation sentencing recommendation</a>, a <a href="/articles/2026-07-13-telehealth-founder-sentenced-for-90m-adderall-scheme">telehealth founder sentenced for a 37-million-pill Adderall distribution scheme</a>, and a <a href="/articles/2026-06-30-guo-wengui-gets-30-years">30-year sentence for exiled financier Guo Wengui</a>.</p>
  </div>

  ${METHODOLOGY_BLOCK('Financial Fraud')}
</div>`;

export const HUB_CSS = `
.na-hub{background:#fff;border:1px solid #E5E3DE;padding:20px 22px;margin-bottom:16px}
.na-hub-title{font-family:'Syne',sans-serif;font-size:26px;font-weight:800;letter-spacing:-.5px;margin-bottom:8px}
.na-hub-dek{font-family:'Source Serif 4',serif;font-size:15px;color:#444;line-height:1.6;margin-bottom:18px;padding-bottom:16px;border-bottom:1px solid #E5E3DE}
.na-hub-section{margin-bottom:18px}
.na-hub-section h2{font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:#111;margin-bottom:8px;padding-left:10px;border-left:3px solid #E11D48}
.na-hub-section p{font-size:14px;line-height:1.7;color:#222}
.na-hub-section p a{color:#B91C1C;text-decoration:underline;text-decoration-color:#E5E3DE;font-weight:600}
.na-hub-section p a:hover{text-decoration-color:#B91C1C}
.na-hub-method{margin-top:20px;padding:14px 16px;background:#F9F8F5;border:1px solid #E5E3DE;border-left:3px solid #111}
.na-hub-method-h{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#666;margin-bottom:8px}
.na-hub-method p{font-size:12.5px;line-height:1.6;color:#555;margin-bottom:8px}
.na-hub-method p:last-child{margin-bottom:0}
.na-hub-method a{color:#B91C1C}
.na-spoke-callout{margin:22px 0;padding:14px 16px;background:#F9F8F5;border-left:3px solid #E11D48;font-size:13px}
.na-spoke-callout-h{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#E11D48;margin-bottom:6px}
.na-spoke-callout a{color:#111;font-weight:600;text-decoration:underline;text-decoration-color:#E5E3DE}
.na-spoke-callout a:hover{text-decoration-color:#E11D48}
.na-spoke-callout ul{margin:4px 0 0 18px;padding:0}
.na-spoke-callout li{margin-bottom:3px}
.na-article-method{margin:24px 0;padding:14px 16px;background:#F9F8F5;border:1px solid #E5E3DE;border-left:3px solid #111;font-size:12.5px;line-height:1.6;color:#555}
.na-article-method-h{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#666;margin-bottom:6px}
.na-article-method a{color:#B91C1C}
`;

export const HUB_CONTENT = {
  'Money & Markets': MM_HUB,
  'Financial Fraud': FF_HUB,
};

export function articleMethodologyBlock(categoryLabel) {
  return `<div class="na-article-method"><div class="na-article-method-h">How We Report ${categoryLabel}</div><p>This article is produced by NewsAnarchist's AI reporting system, not a human staff reporter. It's built from the primary source cited above (a regulator filing, court record, or the wire reporting linked in the body) and reports what that source states, attributed to it — it is not investment advice and does not verify disputed facts beyond what the source says. Part of our <a href="/category/${categoryLabel === 'Money & Markets' ? 'money-markets' : 'financial-fraud'}">${categoryLabel} hub</a>. Found an error? <a href="/tip-line">Tell us</a>.</p></div>`;
}
