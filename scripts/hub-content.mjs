// Hub-page content for the Hub & Spoke rollout — Money & Markets and Financial Fraud were the
// pilot; Surveillance State, Corporate Watchdog, Government Secrets, Tech & Privacy, Global Power,
// Unexplained, True Crime, Conflict & Wars, and Web3 & Blockchain were added in the full rollout
// (2026-07-18), same shape/tone, no redesign. Real synthesis grounded in each category's actual
// recent coverage (sampled from generated-articles.json via the site's own remapArticleCategory()
// keyword logic — the same function the category-page builder uses — not raw stored category
// labels, which can be stale). Slugs referenced below were verified present as real files under
// articles/ at write time. If a slug is ever retired/merged, the link degrades to a normal 404 —
// it does not break the page.

const METHODOLOGY_BLOCK = (categoryLabel, sourceClause, practiceParagraph) => {
  const src = sourceClause || "a regulator's own filing or press release (SEC, CFTC, FCA, DOJ, HHS-OIG, Treasury/OFAC), a court record, or wire reporting from outlets we cite by name";
  const practice = practiceParagraph || "we report what a regulator, prosecutor, or court document says happened, attributed to that source — we do not offer investment advice, predict where a case or a market goes next, or verify disputed facts beyond what the primary source states. If you're making a financial decision based on something you read here, read the underlying filing yourself; we link to it when it exists precisely so you can.";
  return `
<div class="na-hub-method">
  <div class="na-hub-method-h">How We Report ${categoryLabel}</div>
  <p>NewsAnarchist's ${categoryLabel} coverage is produced by an AI reporting system, not a human staff reporter — we say this plainly rather than let a byline imply otherwise. Each piece starts from a primary source: ${src}. The system cross-references the source document against the claim before publishing and links to the underlying filing or release wherever one exists.</p>
  <p>What this means in practice: ${practice}</p>
  <p>Corrections: if you find an error, tell us — <a href="/tip-line">tip line</a>. We fix the article and note the correction inline, not silently.</p>
</div>`;
};

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

const SS_HUB = `
<div class="na-hub">
  <h1 class="na-hub-title">🎥 Surveillance State</h1>
  <p class="na-hub-dek">The two live fights in this category right now: Flock Safety's license-plate camera network facing a real Fourth Amendment challenge in federal court, and warrantless-spying authorities that lawmakers keep threatening to rein in and then don't. Facial recognition keeps spreading into places — grocery stores, sportsbooks — that have nothing to do with law enforcement's original justification for it. Updated continuously as new reporting lands; this page is a living summary, not a one-time post.</p>

  <div class="na-hub-section">
    <h2>Flock Cameras and the Fourth Amendment Fight</h2>
    <p>The deployment of Flock Safety's automated license-plate readers across hundreds of municipalities has moved from a local-news story to a live constitutional fight — the ACLU, EFF, and Cato Institute have jointly appealed <a href="/articles/2026-07-16-flock-cameras-spark-surveillance-debate">Schmidt v. City of Norfolk (4th Cir., No. 26-1227)</a>, arguing that a searchable, multi-week archive built from a network of hundreds of cameras is constitutionally different from a single officer's plate check. The same week, <a href="/articles/2026-07-16-flock-cameras-spark-warrantless-surveillance-debate">lawmakers in West Virginia and elsewhere pushed for camera removal</a> in their own towns. Texas has spent <a href="/articles/2026-07-17-lawmakers-push-back-on-warrantless-spying">$4.5 million on surveillance-equipped SUVs</a>, reportedly bypassing standard procurement review.</p>
  </div>

  <div class="na-hub-section">
    <h2>Warrantless Spying Authorities That Almost Expire, Then Don't</h2>
    <p>This beat has a recurring shape: an authority is set to lapse, civil-liberties groups and a genuinely bipartisan bloc of lawmakers push to let it, and it survives anyway. <a href="/articles/2026-07-16-lawmakers-reexamine-warrantless-spying">Lawmakers have been reexamining warrantless spying practices</a> including drone pilot schemes — Minneapolis's city council voted down one over "mission creep" concerns — while <a href="/articles/2026-07-16-warrantless-surveillance-program-expires">one such program did lapse</a> this month. A federal gun prosecution in Maine <a href="/articles/2026-07-18-feds-drop-maine-gun-case-over-secret-surveillance">was dropped entirely after a judge started asking real questions</a> about the years of secret surveillance behind it — the government chose to drop the case rather than let a court rule on the surveillance's legality. Separately, <a href="/articles/2026-07-17-nsa-reports-omit-china-election-interference">NSA reporting reportedly omitted findings on Chinese election interference</a>, raising its own transparency question.</p>
  </div>

  <div class="na-hub-section">
    <h2>Facial Recognition's Expanding Footprint</h2>
    <p>Facial recognition keeps moving into contexts well outside its original law-enforcement justification. A California grocery chain is <a href="/articles/2026-07-16-facial-recognition-expands-to-grocery-stores">using it to flag suspected shoplifters</a>, and a bipartisan bill from Rep. Josh Gottheimer would <a href="/articles/2026-07-17-us-bill-requires-facial-recognition-for-online-betting">mandate facial-recognition age verification for online sportsbooks and prediction markets</a>. We've also covered this expansion through a lighter lens — <a href="/articles/2026-07-18-watch-dogs-series-mirrors-real-world-surveillance-concerns">the Watch Dogs game franchise's fictional surveillance dystopia</a> tracking uncomfortably close to the real thing.</p>
  </div>

  ${METHODOLOGY_BLOCK('Surveillance State',
    "a FOIA release, an agency's own procurement or policy document, court filings from surveillance-related litigation, or reporting from outlets we cite by name",
    "we report what the document, filing, or named outlet states about a program or a tool, attributed to that source — we do not allege intent behind a surveillance program beyond what the record shows, and we do not claim a technology is deployed somewhere the source doesn't say it is. Read the underlying document or court filing yourself wherever we link to one.")}
</div>`;

const CW_HUB = `
<div class="na-hub">
  <h1 class="na-hub-title">🐕‍🦺 Corporate Watchdog</h1>
  <p class="na-hub-dek">Antitrust enforcement against the largest names in tech and media, and — because a large share of what actually gets prosecuted as "corporate" misconduct in our sourcing runs through hospitals, insurers, and pharmacy middlemen — a steady thread of federal healthcare-fraud enforcement that overlaps with our Financial Fraud coverage but is charged against companies and executives rather than individual scheme operators. Updated continuously as new reporting lands; this page is a living summary, not a one-time post.</p>

  <div class="na-hub-section">
    <h2>Big Tech's Antitrust Reckoning</h2>
    <p>Apple and the Department of Justice are reportedly in <a href="/articles/2026-07-18-apple-in-settlement-talks-with-doj">early settlement talks over the DOJ's 2024 iPhone-ecosystem antitrust lawsuit</a> — no agreement has been reached, but both sides appear to be exploring alternatives to a full trial. The proposed <a href="/articles/2026-07-16-paramount-warner-bros-merger-faces-new-antitrust-challenges">$111 billion Paramount-Warner Bros. merger</a> is facing a lawsuit from a 12-state coalition (including California) over competition and job-loss concerns, on top of a separate Writers Guild of America suit and a shareholder lawsuit accusing the companies' leadership of corruption. The FTC, meanwhile, <a href="/articles/2026-07-16-ftc-reaches-settlement-with-caremark-in-antitrust-case">secured a settlement with pharmacy middleman Caremark</a> over allegedly inflating insulin list prices through anticompetitive rebating practices.</p>
  </div>

  <div class="na-hub-section">
    <h2>Healthcare Fraud, Charged Against Institutions</h2>
    <p>Where our Financial Fraud hub tracks individual Medicaid/Medicare scheme operators, this beat tends to pick up the institutional and executive-level cases: HHS's Office of Inspector General has <a href="/articles/2026-07-15-hhs-oig-flags-medicare-skin-substitute-spending">flagged "major concerns" over a spike in Medicare spending on skin-substitute products</a>, part of a crackdown that has recovered $5.56 billion and barred over 1,200 people from federal programs — including the indictment of individuals accused of <a href="/articles/2026-07-15-hhs-oig-flags-medicare-skin-substitute-spending">targeting elderly Medicare patients directly</a>. Separately, <a href="/articles/2026-07-14-six-charged-in-207m-nj-healthcare-fraud">six people were charged in a $20.7 million New Jersey healthcare fraud and kickback scheme</a> that ran 37 months, and HHS has <a href="/articles/2026-07-15-hhs-targets-medicaid-medicare-advantage-fraud">separately targeted Medicaid and Medicare Advantage fraud</a> more broadly, with federal anti-fraud efforts <a href="/articles/2026-07-11-medicare-anti-fraud-saves-42b">credited with $42 billion in savings</a> in one recent accounting.</p>
  </div>

  ${METHODOLOGY_BLOCK('Corporate Watchdog',
    "a regulator's enforcement action (SEC, FTC, DOJ, HHS-OIG), a company's own SEC filing, a court record, or trade-press/wire reporting we cite by name",
    "we report what the regulator, court record, or named outlet states a company did, attributed to that source — this is not a recommendation about any company's stock, products, or services, and we do not verify a company's disputed denial beyond what the record shows. If you're deciding whether to do business with a company named here, read the underlying filing or complaint yourself; we link to it when it exists.")}
</div>`;

const GS_HUB = `
<div class="na-hub">
  <h1 class="na-hub-title">🗂️ Government Secrets</h1>
  <p class="na-hub-dek">Declassification as an ongoing story, not a one-time event — a rolling release of 2020-election intelligence files running in parallel with a separate, years-long Pentagon effort to declassify decades of UAP material. Alongside it, the whistleblower disclosures and press-freedom fights that determine whether anyone outside government ever gets to see what these records actually say. Updated continuously as new reporting lands; this page is a living summary, not a one-time post.</p>

  <div class="na-hub-section">
    <h2>The 2020 Election Files Declassification</h2>
    <p>President Trump has <a href="/articles/2026-07-18-trump-declassifies-election-documents">declassified hundreds of intelligence files related to the 2020 election</a>, tied to allegations of Chinese election interference — reporters are still working through what the documents do and don't actually establish. The declassification effort is being run out of the same department currently releasing <a href="/articles/2026-07-18-pentagon-ufo-files-reveal-mysterious-object-near-texas-nuclear-plant">decades of UAP-related material</a> (see our <a href="/category/unexplained">Unexplained</a> hub for that side of the story) — two declassification efforts running on parallel tracks worth reading against each other for what each does and doesn't disclose.</p>
  </div>

  <div class="na-hub-section">
    <h2>Whistleblowers Naming Names</h2>
    <p>A DEA whistleblower has alleged the agency <a href="/articles/2026-07-17-whistleblower-alleges-dea-allowed-fentanyl-trafficking">allowed millions of illegal fentanyl doses into the country</a>, with a significant share reportedly landing in West Virginia — a claim now attached to a formal legal complaint, not just an anonymous allegation. Separately, Illinois governor J.B. Pritzker <a href="/articles/2026-07-17-pritzker-signs-bill-for-wrongful-imprisonment-restitution">signed legislation restoring restitution for the wrongfully imprisoned</a>, a policy response to exactly the kind of prosecutorial failure this beat tracks.</p>
  </div>

  <div class="na-hub-section">
    <h2>Press Freedom, Tested in Court</h2>
    <p>The Supreme Court <a href="/articles/2026-07-17-supreme-court-upholds-fine-for-reporter-refusing-to-divulge-sources">declined to halt an $800-a-day contempt fine against former Fox News reporter Catherine Herridge</a>, who is refusing to name her sources — a case media advocates warn could make future sources think twice before talking to any reporter. And the Epstein Truth Commission has <a href="/articles/2026-07-11-epstein-commission-subpoenas-ignored">reported the federal government simply not responding to its subpoenas</a>, its own kind of disclosure failure.</p>
  </div>

  ${METHODOLOGY_BLOCK('Government Secrets',
    "a declassified document, a FOIA release, an inspector general or congressional report, or a named whistleblower's disclosure as reported by outlets we cite",
    "we report what the declassified record, IG report, or named source states, attributed to it — we do not speculate about what remains classified beyond what the document itself says, and a disclosure being reported does not mean every allegation inside it has been independently confirmed elsewhere. Read the underlying document yourself wherever we link to one.")}
</div>`;

const TP_HUB = `
<div class="na-hub">
  <h1 class="na-hub-title">🔐 Tech &amp; Privacy</h1>
  <p class="na-hub-dek">AI oversight is the story now, not a side note — the FTC opening enforcement on AI-marketing claims and AI-enabled scams at the same time it's fielding user complaints about xAI's Grok, while facial-recognition privacy litigation from an earlier era of this beat (Clearview AI) is still working its way through appeals courts. Updated continuously as new reporting lands; this page is a living summary, not a one-time post.</p>

  <div class="na-hub-section">
    <h2>The FTC Turns Its Attention to AI</h2>
    <p>The FTC has been unusually active on AI specifically: it's <a href="/articles/2026-07-16-ftc-warns-of-ai-scams-ramps-up-enforcement">warned of AI-enabled scams and announced new enforcement plans</a>, and separately is <a href="/articles/2026-07-11-ftc-probes-xai-over-uncensored-content">probing xAI over uncensored Grok content and difficult cancellation processes</a> — users allege they were charged after attempting to cancel, potentially violating the FTC's own Click-to-Cancel rule. On the infrastructure side, New York <a href="/articles/2026-07-14-ny-pauses-ai-data-center-construction">paused AI data-center construction</a>, and the EU has moved to <a href="/articles/2026-07-11-eu-enforces-cybersecurity">enforce a new cybersecurity framework</a> that touches AI systems directly.</p>
  </div>

  <div class="na-hub-section">
    <h2>Facial Recognition's Legal Comeuppance, Delayed</h2>
    <p>A US appeals court has <a href="/articles/2026-07-14-clearview-ai-settlement-vacated">vacated Clearview AI's privacy-case settlement</a> over a procedural defect in how it was structured — not a ruling on the underlying facial-recognition practice itself, which remains legally unresolved even as the technology keeps spreading into new commercial and law-enforcement contexts (see our <a href="/category/surveillance-state">Surveillance State</a> hub for that expansion).</p>
  </div>

  <div class="na-hub-section">
    <h2>State Privacy Law and AI's Institutional Friction</h2>
    <p>Privacy regulation keeps moving at the state level in the absence of a federal standard — <a href="/articles/2026-07-14-us-data-privacy-laws-evolve">Indiana, Kentucky, and Rhode Island all passed new privacy statutes</a> reflecting a nationwide shift toward stronger data-governance rules. DHS has <a href="/articles/2026-07-14-dhs-updates-ai-classification-in-immigration-enforcement">updated how it classifies AI tools used in immigration enforcement</a>, and a lawsuit alleges <a href="/articles/2026-07-10-mayo-clinic-ai-issues">Mayo Clinic retaliated against an employee who flagged internal AI-compliance issues</a> — a reminder that AI oversight fights aren't limited to the tech companies building the models.</p>
  </div>

  ${METHODOLOGY_BLOCK('Tech & Privacy',
    "a company's own disclosure, a security researcher's published findings, a regulator's filing (FTC, EU data-protection authorities), or a data-breach notification",
    "we report what the company, researcher, or regulator states, attributed to that source — this is not security advice tailored to your own devices or accounts, and we do not verify a vendor's disputed claim beyond what the primary source says. Check the underlying disclosure or filing yourself wherever we link to one.")}
</div>`;

const GP_HUB = `
<div class="na-hub">
  <h1 class="na-hub-title">🌍 Global Power</h1>
  <p class="na-hub-dek">The US-Iran conflict escalating in real time alongside a NATO alliance that just publicly declined to escalate against Russia — two theaters showing opposite instincts in the same week. Underneath both, a slower story: polling now shows China ahead of the US in global favorability, and the EU is building financial infrastructure (a digital euro, tightened investment screening) that reads as hedging against both. Updated continuously as new reporting lands; this page is a living summary, not a one-time post.</p>

  <div class="na-hub-section">
    <h2>The US-Iran Conflict Escalates</h2>
    <p>US forces have carried out <a href="/articles/2026-07-18-us-strikes-iran-bridges">a seventh consecutive night of strikes on bridges near a key Iranian port</a> in the ongoing battle over the Strait of Hormuz, even as the US separately <a href="/articles/2026-07-18-eu-sanctions-russian-executive-companies-over-drones">works with the EU to sanction a Russian executive and five drone-manufacturing companies</a> as part of the broader effort to squeeze Russia's war economy — complicated by Greece's request for a Russian-LNG exemption, which some diplomats have called "shameless."</p>
  </div>

  <div class="na-hub-section">
    <h2>NATO Declines to Escalate on Russia</h2>
    <p>In the same window, <a href="/articles/2026-07-17-nato-summit-rejects-new-russia-sanctions">NATO leaders rejected a push for new Russia sanctions</a> despite ongoing tensions over Ukraine — a genuine split in posture from the Iran theater above, worth reading together rather than as a single "the West is getting tougher" narrative. Planning for Ukraine's eventual post-conflict reconstruction, including using sanctioned Russian assets to help fund it, is reportedly already underway.</p>
  </div>

  <div class="na-hub-section">
    <h2>The Slow Realignment: China, the EU, and a Digital Euro</h2>
    <p>Independent polling now shows <a href="/articles/2026-07-17-china-surpasses-us-in-global-favorability">China ahead of the US in global favorability</a> — a genuine shift worth tracking rather than dismissing. The EU, meanwhile, <a href="/articles/2026-07-16-eu-unveils-digital-euro-regulations">unveiled final digital-euro regulations</a> — privacy tiers, a €3,000 holding limit, offline payments, a 2028 rollout target — as part of a broader push to tighten market access amid foreign-interference concerns and strengthen its foreign-investment screening framework.</p>
  </div>

  ${METHODOLOGY_BLOCK('Global Power',
    "an official government or diplomatic statement, wire-service reporting (Reuters, AP, AFP) we cite by name, or a named think-tank or NGO report",
    "we report what that government, wire service, or organization states happened, attributed to it — we do not predict how a conflict, negotiation, or election will resolve, and competing governments' accounts of the same event are often genuinely contested, which we try to flag rather than flatten into a single version. Read the underlying statement or report yourself wherever we link to one.")}
</div>`;

const UX_HUB = `
<div class="na-hub">
  <h1 class="na-hub-title">👽 Unexplained</h1>
  <p class="na-hub-dek">The Pentagon's rolling UAP declassification is the dominant, ongoing story here — new batches of files nearly every week, not one big reveal — running alongside a smaller, genuinely separate thread of peer-reviewed and preprint consciousness/near-death-experience research. We keep these two apart deliberately: one is a government transparency story, the other is basic science, and treating them as the same kind of claim would misrepresent both.</p>

  <div class="na-hub-section">
    <h2>The Pentagon's Rolling UAP Declassification</h2>
    <p>The Department of War's declassification effort keeps producing new material on a near-weekly cadence — the newest batch <a href="/articles/2026-07-18-pentagon-ufo-files-reveal-mysterious-object-near-texas-nuclear-plant">shows a mysterious object spotted near a Texas nuclear-weapons plant</a>, drawn from Pantex facility records, military aircraft encounters, and NASA Apollo-era debriefings. An earlier batch of <a href="/articles/2026-07-14-pentagon-releases-40-new-uap-files">40 newly declassified UAP files</a> covers similar ground. The All-domain Anomaly Resolution Office (AARO) — the Pentagon's own investigative body for this material — is <a href="/articles/2026-07-15-aaro-leads-investigation-into-ufo-sightings">formally leading the government's review of these sightings</a>, a notable shift from decades of the government dismissing the topic outright. None of this coverage claims the objects described are proven extraterrestrial craft; it reports what the declassified record itself says, which is often considerably more mundane and more genuinely unresolved than the headline suggests.</p>
  </div>

  <div class="na-hub-section">
    <h2>Consciousness and Near-Death-Experience Research — a Separate Thread</h2>
    <p>Distinct from the UAP material above, a real strand of academic research keeps surfacing here: a recent preprint, <a href="/articles/2026-07-15-near-death-experience-research">"Architecture of Near-Death Experience Spaces,"</a> from researchers France Lerner and Guillaume Tahar, examines the structure of near-death and out-of-body experience reports and was posted to bioRxiv — a real preprint server, not a fringe outlet, though preprints are by definition not yet peer-reviewed. We flag that distinction here rather than let a scientific-sounding citation imply more certainty than the paper itself claims.</p>
  </div>

  ${METHODOLOGY_BLOCK('Unexplained',
    "a government record (including FOIA-released or Pentagon/AARO-published UAP material), an agency statement, or named witness testimony as reported by outlets we cite",
    "we report what the record, agency, or named witness states, attributed to that source — we do not claim any event described is proven, extraterrestrial, paranormal, or otherwise extraordinary, only that the stated source said what we report it said. The evidentiary bar on this beat is often lower than the rest of the site — an official record calling something 'unexplained' or 'anomalous' is not the same as confirmed, and we try not to blur the two.")}
</div>`;

const TC_HUB = `
<div class="na-hub">
  <h1 class="na-hub-title">⚖️ True Crime</h1>
  <p class="na-hub-dek">Cold cases are the real backbone of this category, and they're being solved at a genuinely unusual clip right now thanks to forensic genetic genealogy labs like Othram — decades-old, sometimes centuries-old, mysteries closing almost weekly. Alongside that, the institutional accountability side of the beat: prosecutorial-misconduct claims, wrongful-conviction restitution, and the individual white-collar indictments that overlap with our Financial Fraud coverage.</p>

  <div class="na-hub-section">
    <h2>Cold Cases, Closing at an Unusual Pace</h2>
    <p>Forensic genetic genealogy has turned into the single most productive tool on this beat. A <a href="/articles/2026-07-18-250-year-old-cold-case-solved">250-year-old Revolutionary War-era John Doe case — America's oldest</a> — was solved through DNA testing, identifying a Maryland teenager who died in one of the war's last major battles. More recently, <a href="/articles/2026-07-17-cold-case-solved-thelma-gaston-identified">an 80-year-old multimillionaire who vanished in 1981 was identified after 44 years</a>, her remains matched via forensic lab Othram's Forensic-Grade Genome Sequencing and dental records. These aren't one-offs — they're a pattern worth tracking as its own story, not a string of unrelated local-news items.</p>
  </div>

  <div class="na-hub-section">
    <h2>Institutional Accountability and Wrongful Convictions</h2>
    <p>The Epstein Truth Commission has <a href="/articles/2026-07-11-epstein-commission-subpoenas-ignored">reported the federal government isn't responding to its subpoenas</a>, echoing the same institutional-stonewalling pattern our <a href="/category/government-secrets">Government Secrets</a> coverage tracks. On the transit-safety side, <a href="/articles/2026-07-13-mbta-workers-indicted-for-faking-safety-inspections">MBTA workers were indicted for allegedly faking safety inspections</a>.</p>
  </div>

  <div class="na-hub-section">
    <h2>Individual Fraud Indictments</h2>
    <p>Outside the two clusters above, this beat also tracks fraud cases charged against individuals rather than institutions — an <a href="/articles/2026-07-14-arlington-pastor-indicted-for-32m-fraud-scheme">Arlington pastor indicted for an alleged $3.2 million fraud scheme</a> is a recent example, distinct from the corporate/regulatory cases we track under <a href="/category/financial-fraud">Financial Fraud</a>.</p>
  </div>

  ${METHODOLOGY_BLOCK('True Crime',
    "a court record, a police or prosecutor's statement, or verified wire-service/local-news reporting we cite by name",
    "we report the state of a case as charged, reported, or ruled on, attributed to that source — this is not a verdict on guilt, and anyone named in connection with a crime is presumed innocent unless a court record states otherwise. Read the underlying charging document or court record yourself wherever we link to one.")}
</div>`;

const CWR_HUB = `
<div class="na-hub">
  <h1 class="na-hub-title">⚔️ Conflict &amp; Wars</h1>
  <p class="na-hub-dek">Sudan's civil war has reached the point where the UN's own human rights chief describes what he heard directly from survivors as shocking — gang rape, torture, mass killing, three years in. Myanmar's civil war produces its own humanitarian catastrophes (500 feared dead in a single refugee-boat sinking), while China's military modernization and Taiwan Strait tensions run as a slower, structural story underneath the acute crises. Updated continuously as new reporting lands; this page is a living summary, not a one-time post.</p>

  <div class="na-hub-section">
    <h2>Sudan: Three Years In, Still Escalating</h2>
    <p>UN High Commissioner for Human Rights Volker Türk has <a href="/articles/2026-07-18-sudan-war-un-commissioner-shocked-by-atrocity-crimes">described being shocked by direct survivor accounts of killings, gang rape, and torture</a> during a recent visit — a notably blunt characterization from a senior UN official, not secondhand reporting. The conflict, now three years old, has prompted what's being described as a global-powers push to avert another mass-casualty event in the city of El-Obeid specifically.</p>
  </div>

  <div class="na-hub-section">
    <h2>Myanmar's Civil War and Its Refugee Toll</h2>
    <p>Two boats carrying people fleeing Myanmar's civil war <a href="/articles/2026-07-17-myanmar-refugee-boats-feared-lost">disappeared off the country's coast, with over 500 people feared dead</a> — UN migration bodies have been tracking the situation since late June, against a backdrop of foreign parties reportedly still supplying arms and dual-use items to the military junta.</p>
  </div>

  <div class="na-hub-section">
    <h2>The Sahel's Widening Terrorist Threat</h2>
    <p>The UN has <a href="/articles/2026-07-16-sahel-terrorist-threat-expands">warned of a widening terrorist threat across West Africa and the Sahel</a>, even as the US works to rebuild ties with the Alliance of Sahelian States. Separately, structural military tension keeps building elsewhere: <a href="/articles/2026-07-17-taiwan-strait-tensions-rise">Taiwan Strait tensions have risen</a> alongside <a href="/articles/2026-07-18-xi-promotes-officers-amid-china-military-modernization">a wave of officer promotions tied to China's ongoing military modernization</a>.</p>
  </div>

  ${METHODOLOGY_BLOCK('Conflict & Wars',
    "wire-service reporting (Reuters, AP, AFP), an official government or military statement, or a named NGO/UN report",
    "we report what that wire service, government, or organization states, attributed to it — casualty counts and battlefield claims in active conflicts are frequently disputed by the parties involved, and we attribute contested figures to whoever is making them rather than presenting one side's number as settled fact. Read the underlying report yourself wherever we link to one.")}
</div>`;

const W3_HUB = `
<div class="na-hub">
  <h1 class="na-hub-title">⛓️ Web3 &amp; Blockchain</h1>
  <p class="na-hub-dek">DeFi exploits keep happening on a near-weekly cadence — smaller-dollar hacks than the headline nine-figure thefts we track under Money & Markets, but constant — even as the SEC continues loosening its crypto rulebook. Two trends worth holding side by side: security has not caught up with DeFi's growth, and regulators are moving toward accommodation faster than the exploits are slowing down.</p>

  <div class="na-hub-section">
    <h2>DeFi's Constant, Smaller-Scale Exploit Problem</h2>
    <p>Solana lending platform DeFiTuna <a href="/articles/2026-07-18-defituna-hack-580k-lost">lost $580,000 when attackers exploited its USDC lending pool</a>, with a full forensic report still pending. On the Hedera network, <a href="/articles/2026-07-12-hedera-defi-lender-hacked-for-9m">Bonzo Lend — the network's largest lending protocol — was exploited for $9 million</a>, with $5.25 million bridged to Ethereum within hours. A separate report found <a href="/articles/2026-07-09-bonkdao-loses-20m">BonkDAO lost $20 million</a> in its own incident. These are the routine end of the scale — see our <a href="/category/money-markets">Money & Markets</a> hub for the nine-figure exchange hacks tied to state actors.</p>
  </div>

  <div class="na-hub-section">
    <h2>The SEC Keeps Loosening Its Crypto Rulebook</h2>
    <p>2026 has brought a steady stream of SEC crypto-rule changes, including a <a href="/articles/2026-07-18-sec-crypto-regulation-updates-2026">proposed $75 million fundraising exemption</a> deliberately mirroring Regulation A+ Tier 2's ceiling, and a joint SEC/CFTC release stating <a href="/articles/2026-07-18-sec-crypto-regulation-updates-2026">XRP is now treated as a commodity</a> — Chairman Paul Atkins has framed the broader effort as providing regulatory "clarity," the same word anchoring the CLARITY Act fight we track on our <a href="/category/money-markets">Money & Markets</a> hub. Institutional adoption is following the same accommodating direction: <a href="/articles/2026-06-28-invesco-launches-tokenized-stablecoin-fund">Invesco launched a tokenized stablecoin fund</a>, a traditional asset manager building directly on-chain infrastructure.</p>
  </div>

  ${METHODOLOGY_BLOCK('Web3 & Blockchain',
    "on-chain data verifiable on a public block explorer, a project's own disclosure, a regulator's filing (SEC, CFTC), or a security firm's incident report",
    "we report what the on-chain record, project, or regulator states, attributed to that source — this is not investment advice, and we do not verify a project's own claims about a hack's cause or scope beyond what the source or the chain itself shows. Check the transaction or filing yourself wherever we link to one.")}
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
  'Surveillance State': SS_HUB,
  'Corporate Watchdog': CW_HUB,
  'Government Secrets': GS_HUB,
  'Tech & Privacy': TP_HUB,
  'Global Power': GP_HUB,
  'Unexplained': UX_HUB,
  'True Crime': TC_HUB,
  'Conflict & Wars': CWR_HUB,
  'Web3 & Blockchain': W3_HUB,
};

// Per-category "How We Report" copy for the single-paragraph disclosure block spliced into
// retrofitted spoke articles (and mirrored — same wording — in na-authors/src/index.js for
// freshly-generated articles, since that Worker is a separate repo and can't import this file
// directly). Money & Markets/Financial Fraud keep their original pilot wording unchanged; the
// other 9 are new as of the 2026-07-18 rollout, each reflecting that category's real sourcing
// and evidentiary caveats rather than a copy-pasted generic line.
const CATEGORY_METHOD_META = {
  'Money & Markets': {
    slug: 'money-markets',
    sourceDesc: "a regulator filing, court record, or the wire reporting linked in the body",
    caveat: "it is not investment advice and does not verify disputed facts beyond what the source says",
  },
  'Financial Fraud': {
    slug: 'financial-fraud',
    sourceDesc: "a regulator filing, court record, or the wire reporting linked in the body",
    caveat: "it is not investment advice and does not verify disputed facts beyond what the source says",
  },
  'Surveillance State': {
    slug: 'surveillance-state',
    sourceDesc: "a FOIA release, an agency's own policy or procurement document, court filings from surveillance litigation, or the wire reporting linked in the body",
    caveat: "it does not allege intent behind a surveillance program beyond what the record shows",
  },
  'Corporate Watchdog': {
    slug: 'corporate-watchdog',
    sourceDesc: "a regulator's enforcement action (SEC, FTC, DOJ), a company's own SEC filing, a court record, or the wire/trade-press reporting linked in the body",
    caveat: "it is not a recommendation about any company's stock or products, and does not verify a company's disputed denial beyond what the record shows",
  },
  'Government Secrets': {
    slug: 'government-secrets',
    sourceDesc: "a declassified document, a FOIA release, an inspector general or congressional report, or a named whistleblower disclosure reported by outlets we cite",
    caveat: "it reports what the document or disclosure states and does not speculate about what remains classified beyond that",
  },
  'Tech & Privacy': {
    slug: 'tech-privacy',
    sourceDesc: "a company's own disclosure, a security researcher's published findings, a regulator's filing (FTC, EU data-protection authorities), or a data-breach notification",
    caveat: "it is not security advice specific to your own devices or accounts, and does not verify a vendor's disputed claim beyond what the source states",
  },
  'Global Power': {
    slug: 'global-power',
    sourceDesc: "an official government or diplomatic statement, wire-service reporting (Reuters, AP, AFP) we cite by name, or a named think-tank/NGO report",
    caveat: "it reports what that source states and does not predict how a conflict or negotiation resolves",
  },
  'Unexplained': {
    slug: 'unexplained',
    sourceDesc: "a government record (including FOIA-released or Pentagon/AARO UAP material), an agency statement, or named witness testimony as reported by outlets we cite",
    caveat: "it makes no claim that any event described is proven, extraterrestrial, or otherwise extraordinary — only that the source said what we report it said",
  },
  'True Crime': {
    slug: 'true-crime',
    sourceDesc: "a court record, a police or prosecutor's statement, or verified wire-service/local-news reporting we cite by name",
    caveat: "it reports the state of a case as charged or reported, not a verdict on guilt, and anyone named is presumed innocent unless a court record states otherwise",
  },
  'Conflict & Wars': {
    slug: 'conflict-wars',
    sourceDesc: "wire-service reporting (Reuters, AP, AFP), an official government or military statement, or a named NGO/UN report",
    caveat: "casualty and battlefield claims in active conflicts are frequently contested by the parties involved, and we attribute them to whichever source made them rather than presenting them as settled fact",
  },
  'Web3 & Blockchain': {
    slug: 'web3-blockchain',
    sourceDesc: "on-chain data verifiable on a public block explorer, a project's own disclosure, a regulator's filing (SEC, CFTC), or a security firm's incident report",
    caveat: "it is not investment advice, and does not verify a project's own claims beyond what the source or on-chain record shows",
  },
};

export function articleMethodologyBlock(categoryLabel) {
  const meta = CATEGORY_METHOD_META[categoryLabel] || CATEGORY_METHOD_META['Financial Fraud'];
  return `<div class="na-article-method"><div class="na-article-method-h">How We Report ${categoryLabel}</div><p>This article is produced by NewsAnarchist's AI reporting system, not a human staff reporter. It's built from the primary source cited above (${meta.sourceDesc}) and reports what that source states, attributed to it — ${meta.caveat}. Part of our <a href="/category/${meta.slug}">${categoryLabel} hub</a>. Found an error? <a href="/tip-line">Tell us</a>.</p></div>`;
}
