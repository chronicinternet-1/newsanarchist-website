# NewsAnarchist — Social Media Setup Guide
**Generated: 2026-05-04 | Deploy when creating accounts**

---

## Platform Handles (claim these NOW — squatters are real)

| Platform   | Handle / URL                                       | Status      |
|------------|----------------------------------------------------|-------------|
| Twitter/X  | @newsAnarchis                                     | Claim first |
| Facebook   | facebook.com/NewsAnarchist                         | Claim first |
| Instagram  | @newsanarchist                                     | Claim first |
| Threads    | @newsanarchist                                     | Auto from IG |
| LinkedIn   | linkedin.com/company/newsanarchist                 | Claim first |
| YouTube    | @newsAnarchis                                     | Claim first |
| TikTok     | @newsanarchist                                     | Optional    |
| Telegram   | t.me/NewsAnarchist                                 | Optional    |

---

## TWITTER / X — Full Setup

**Handle:** @newsAnarchis (or @newsAnarchis_)

**Display Name:** NewsAnarchist 🔴

**Bio (160 chars max):**
```
The stories they spiked. The documents they buried.
Contrarian journalism with receipts. 4× daily. No paywall.
newsanarchist.com
```

**Alt Bio (edgier):**
```
Buried stories. Uncensored. 651+ articles mainstream media wouldn't touch.
No paywall. No spin. Just receipts. 🔴 newsanarchist.com
```

**Location:** Everywhere they don't want us

**Website:** https://newsanarchist.com

**Pinned Tweet Template:**
```
🔴 WHAT IS NEWSANARCHIST?

We publish the stories mainstream media spikes.

• 4× daily updates
• 8 categories: surveillance, corporate fraud, gov secrets & more
• 651+ articles — no paywall
• AI-assisted. Human-edited. No advertiser pressure.

Follow for the feed they don't want you reading 👇
newsanarchist.com
```

**Hashtags to use regularly:**
`#NewsAnarchist` `#MediaCriticism` `#UnreportedNews` `#SurveillanceState` `#CorporateWatchdog` `#FollowTheMoney` `#BuriedStories`

---

## FACEBOOK PAGE — Full Setup

**Page Name:** NewsAnarchist

**Username:** @newsAnarchis

**Category:** News & Media Website

**Short Description (255 chars):**
```
The stories they spiked. The documents they buried.
Contrarian journalism with receipts — no paywalls, no spin, no advertiser pressure.
4× daily updates across 8 categories. newsanarchist.com
```

**Long Description (About section):**
```
NewsAnarchist is an independent news aggregator and commentary platform covering the stories mainstream media buries, spikes, or refuses to cover.

We publish 40 articles per run, 4 times daily — covering Surveillance State, Corporate Watchdog, Government Secrets, Tech & Privacy, Global Power, Money & Markets, Unexplained, and True Crime.

651+ articles live. No paywalls. No advertisers. No spin.

The stories they don't want you reading — with receipts.
```

**Website:** https://newsanarchist.com

**Cover Photo idea:** Black background, red "N" logo large center, tagline "The Stories They Spiked" in white serif font. 820×312px.

**CTA Button:** "See More" → https://newsanarchist.com

---

## INSTAGRAM — Full Setup

**Handle:** @newsanarchist

**Name (Display):** NewsAnarchist 🔴

**Bio (150 chars max):**
```
The stories they spiked 🔴
Contrarian journalism with receipts
4× daily | No paywall
🔗 newsanarchist.com
```

**Link in Bio:** Use a direct link to newsanarchist.com/social.html (the hub page) or newsanarchist.com

**Content Types:**
- Quote cards (black bg, red accent, serif headline) — pull best lines from articles
- Infographic carousels — "5 things mainstream media didn't tell you about [X]"
- Reels — 30-second story summary with text overlay
- Story polls — "Did you know about this story?" Yes/No

**Profile Photo:** "N" logo on red background, 200×200px minimum

---

## LINKEDIN — Full Setup

**Company Name:** NewsAnarchist

**Tagline:** Contrarian journalism with receipts.

**About (2,000 chars):**
```
NewsAnarchist is an independent digital news platform committed to covering stories mainstream media consistently buries, downplays, or refuses to report.

Founded on the principle that citizens deserve full information — not curated narratives shaped by advertiser pressure or political access — NewsAnarchist publishes across eight categories:

• Surveillance State — government and corporate surveillance programs
• Corporate Watchdog — accountability journalism on business misconduct
• Government Secrets — declassified docs, FOIA findings, policy failures
• Tech & Privacy — digital rights, data harvesting, platform power
• Global Power — geopolitics, international conflicts, power structures
• Money & Markets — financial stories affecting everyday people
• Unexplained — science anomalies, fringe research worth examining
• True Crime — systemic failures behind high-profile cases

Publishing cadence: 40 articles per run, 4× daily. 651+ articles live.

AI-assisted research and summarization. Human editorial standards.
No paywall. No advertisers. No spin.

Website: https://newsanarchist.com
```

**Specialties:** Investigative Journalism, Media Criticism, Government Accountability, Corporate Watchdog, Surveillance, Privacy Rights

---

## THREADS — Full Setup

**Handle:** @newsanarchist (synced from Instagram)

**Bio:** Same as Instagram bio — auto-populated

**Content style:** Casual, reactive, hot takes on the day's buried stories. Short. Punchy. Link to article.

---

## YOUTUBE (Future) — Setup Template

**Channel Name:** NewsAnarchist

**Handle:** @newsAnarchis

**Description:**
```
The video channel for NewsAnarchist.com — the stories mainstream media buries.

We break down the buried documents, spiked stories, and unreported news the corporate press won't touch — with receipts.

Subscribe for video breakdowns, deep-dives, and the weekly buried stories roundup.

Website: https://newsanarchist.com
```

**Video ideas to start:**
1. "5 Stories This Week Mainstream Media Ignored"
2. Weekly 3-minute rundown of top buried stories
3. Category deep-dives: "The Surveillance State Explained"
4. "How We Find the Stories They Spike" (origin story / SEO magnet)

---

## TELEGRAM CHANNEL — Setup

**Channel Name:** NewsAnarchist Breaking
**Username:** @newsAnarchis

**Description:**
```
Instant alerts when NewsAnarchist drops a major story.
No noise. No spam. Just the buried stories — direct to you.
Full site: newsanarchist.com
```

**Auto-post:** Hook into the newsanarchist-content.mjs pipeline to post each new article slug + title to Telegram automatically (add TELEGRAM_NA_CHANNEL_ID to credentials.env).

---

## BRAND ASSETS — Quick Reference

**Primary Color:** #e8000d (Red)
**Background:** #0a0a0a (Near Black)
**Text:** #e8e6e3 (Off White)
**Font — Headlines:** Georgia / Times New Roman (serif)
**Font — Body:** System UI / -apple-system

**Logo Mark:** "N" in white on #e8000d red square/badge
**Tagline 1:** "The stories they spiked."
**Tagline 2:** "News without the noise."
**Tagline 3:** "Contrarian journalism with receipts."
**Tagline 4:** "The documents they buried."

---

## SOCIAL MEDIA PAGE DEPLOYMENT

**File:** `newsanarchist-social.html`

**Deploy steps:**
```bash
# Copy to newsanarchist-website repo
cp newsanarchist-social.html ~/.openclaw/workspace/newsanarchist-website/social.html

# Commit and push
cd ~/.openclaw/workspace/newsanarchist-website
git checkout master
git add social.html
git commit -m "feat: add social media hub page"
git push origin master
# Cloudflare Pages auto-deploys → https://newsanarchist.com/social.html
```

**Link to add in site footer:**
```html
<a href="/social.html">Follow Us</a>
```

---

## CROSS-POST AUTOMATION (already configured in social-crosspost.mjs)

The `~/.openclaw/workspace/scripts/social-crosspost.mjs` already handles:
- Facebook (FB_ACCESS_TOKEN)
- Instagram (IG_ACCESS_TOKEN)
- Threads (IG_ACCESS_TOKEN — same)
- Twitter (TWITTER_* keys)
- LinkedIn (LINKEDIN_ACCESS_TOKEN)

**⚠️ Still needed:** Verify each token is active in credentials.env before posting.
Run: `grep -E "FB_|IG_|TWITTER_|LINKEDIN_" ~/.openclaw/secrets/credentials.env`

---

*End of Social Media Setup Guide*
