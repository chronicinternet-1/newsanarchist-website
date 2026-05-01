#!/usr/bin/env node
/**
 * daily-pnl-report.mjs — Monas Trading System daily P&L summary.
 *
 * Data sources:
 *   Schwab    — schwab-client.mjs getAccounts()
 *   Kalshi    — kalshi-live-state-v2.json  (balance_cents / 100)
 *   CDC Exch  — cdc-portfolio-state.json   (snapshots[last].value)
 *
 * Usage:
 *   node daily-pnl-report.mjs             # console + /tmp/daily-pnl.html
 *   node daily-pnl-report.mjs --telegram  # also send to Telegram
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir  = dirname(fileURLToPath(import.meta.url));
const HOME   = homedir();
const SECRETS_DIR   = join(HOME, '.openclaw', 'secrets');
const BOT_DIR       = join(HOME, '.openclaw', 'workspace', 'robinhood-api', 'bot');
const SCHWAB_CLIENT = join(BOT_DIR, 'schwab-client.mjs');

const SEND_TELEGRAM = process.argv.includes('--telegram');
const REPORT_FILE   = '/tmp/daily-pnl.html';

// ─── Credentials ──────────────────────────────────────────────────────────────

function loadCreds() {
  const credFile = join(SECRETS_DIR, 'credentials.env');
  if (!existsSync(credFile)) return {};
  const result = {};
  for (const line of readFileSync(credFile, 'utf8').split('\n')) {
    // Handle both  export KEY="VALUE"  and  KEY=VALUE  formats
    const m = line.match(/^(?:export\s+)?([A-Z0-9_]+)=["']?([^"'\n]*)["']?/);
    if (m) result[m[1]] = m[2];
  }
  return result;
}

const CREDS = loadCreds();
const TELEGRAM_TOKEN   = process.env.TELEGRAM_BOT_TOKEN || CREDS.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID   || CREDS.TELEGRAM_CHAT_ID   || '5124303328';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

function fmt(n) {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function now() {
  return new Date().toLocaleString('en-US', { timeZone: 'Pacific/Honolulu', hour12: true });
}

// ─── Data sources ─────────────────────────────────────────────────────────────

async function getSchwabBalance() {
  try {
    if (!existsSync(SCHWAB_CLIENT)) return { error: 'schwab-client.mjs not found', value: 0 };
    const { default: client } = await import(SCHWAB_CLIENT);
    const accounts = await client.getAccounts();
    if (!accounts || !accounts.length) return { error: 'no accounts returned', value: 0 };

    let totalValue  = 0;
    let totalBuying = 0;
    const lines     = [];

    for (const acct of accounts) {
      const bal  = acct.securitiesAccount?.currentBalances
                ?? acct.securitiesAccount?.initialBalances ?? {};
      const val  = Number(bal.liquidationValue ?? bal.totalValue ?? bal.accountValue ?? 0);
      const cash = Number(bal.buyingPower      ?? bal.cashBalance ?? 0);
      const num  = acct.securitiesAccount?.accountNumber ?? '????';
      totalValue  += val;
      totalBuying += cash;
      lines.push(`  ${num.slice(-4)}: ${fmt(val)} (BP: ${fmt(cash)})`);
    }
    return { value: totalValue, buyingPower: totalBuying, lines };
  } catch (err) {
    return { error: err.message, value: 0 };
  }
}

function getKalshiBalance() {
  // v2 file is current; balance_cents needs /100
  const file = join(BOT_DIR, 'kalshi-live-state-v2.json');
  const data = readJson(file);
  if (!data) return { balance: 0, error: 'kalshi-live-state-v2.json not found' };
  const cents = data.balance_cents ?? data.balance ?? null;
  if (cents === null) return { balance: 0, error: 'no balance field in kalshi-live-state-v2.json' };
  // balance_cents: 38103 → $381.03
  const balance = cents > 1000 ? cents / 100 : cents;
  return { balance };
}

function getCDCExchangeBalance() {
  // cdc-portfolio-state.json → snapshots array, use the latest entry's value (USD)
  const file = join(BOT_DIR, 'cdc-portfolio-state.json');
  const data = readJson(file);
  if (!data) return { totalUsd: 0, error: 'cdc-portfolio-state.json not found' };

  const snapshots = data.snapshots;
  if (snapshots && snapshots.length) {
    const latest = snapshots[snapshots.length - 1];
    return { totalUsd: Number(latest.value ?? latest.usd ?? 0) };
  }
  // Fallback: top-level fields
  const v = data.totalUsd ?? data.total_usd ?? data.usdValue ?? data.value ?? null;
  if (v !== null) return { totalUsd: Number(v) };
  return { totalUsd: 0, error: 'no value field in cdc-portfolio-state.json' };
}

// ─── Telegram ─────────────────────────────────────────────────────────────────

async function sendTelegram(text) {
  if (!TELEGRAM_TOKEN) {
    console.error('[telegram] No TELEGRAM_BOT_TOKEN found in credentials.env or environment');
    return;
  }
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' }),
  });
  if (!res.ok) {
    console.error('[telegram] Send failed:', await res.text());
  } else {
    console.log('[telegram] Sent successfully.');
  }
}

// ─── Report builders ──────────────────────────────────────────────────────────

function buildTelegramMessage(schwab, kalshi, cdc, total) {
  const date = new Date().toLocaleDateString('en-US', {
    timeZone: 'Pacific/Honolulu', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const lines = [
    `<b>📊 Monas Trading System — Daily P&amp;L</b>`,
    `<i>${date} (HST)</i>`,
    ``,
    `<b>Schwab</b>`,
  ];

  if (schwab.error && !schwab.value) {
    lines.push(`  ⚠️ ${schwab.error}`);
  } else {
    lines.push(`  Portfolio: <b>${fmt(schwab.value)}</b>`);
    lines.push(`  Buying Power: ${fmt(schwab.buyingPower)}`);
  }

  lines.push(``, `<b>Kalshi</b>`);
  if (kalshi.error && !kalshi.balance) {
    lines.push(`  ⚠️ ${kalshi.error}`);
  } else {
    lines.push(`  Balance: <b>${fmt(kalshi.balance)}</b>`);
  }

  lines.push(``, `<b>CDC Exchange</b>`);
  if (cdc.error && !cdc.totalUsd) {
    lines.push(`  ⚠️ ${cdc.error}`);
  } else {
    lines.push(`  Portfolio: <b>${fmt(cdc.totalUsd)}</b>`);
  }

  lines.push(
    ``, `━━━━━━━━━━━━━━━━━━`,
    `<b>Total: ${fmt(total)}</b>`,
    ``, `<i>Zeno | Monas Trading System</i>`,
  );
  return lines.join('\n');
}

function buildHtmlReport(schwab, kalshi, cdc, total) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Monas P&L — ${new Date().toISOString().slice(0, 10)}</title>
  <style>
    body { font-family: monospace; max-width: 600px; margin: 40px auto; background: #111; color: #eee; }
    h1 { color: #f90; }
    table { border-collapse: collapse; width: 100%; }
    td, th { padding: 8px 16px; text-align: left; border-bottom: 1px solid #333; }
    .val { text-align: right; font-weight: bold; }
    .total { color: #0f0; font-size: 1.2em; }
    .warn { color: #fa0; }
  </style>
</head>
<body>
  <h1>📊 Monas Trading System</h1>
  <p>Generated: ${now()} HST</p>
  <table>
    <tr><th>Account</th><th class="val">Value</th><th>Notes</th></tr>
    <tr>
      <td>Schwab</td>
      <td class="val">${fmt(schwab.value)}</td>
      <td>${schwab.error ? `<span class="warn">${schwab.error}</span>` : `BP: ${fmt(schwab.buyingPower)}`}</td>
    </tr>
    <tr>
      <td>Kalshi</td>
      <td class="val">${fmt(kalshi.balance)}</td>
      <td>${kalshi.error ? `<span class="warn">${kalshi.error}</span>` : ''}</td>
    </tr>
    <tr>
      <td>CDC Exchange</td>
      <td class="val">${fmt(cdc.totalUsd)}</td>
      <td>${cdc.error ? `<span class="warn">${cdc.error}</span>` : ''}</td>
    </tr>
    <tr class="total">
      <td><strong>TOTAL</strong></td>
      <td class="val"><strong>${fmt(total)}</strong></td>
      <td></td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[pnl] ${now()} HST`);

  const [schwab, kalshi, cdc] = await Promise.all([
    getSchwabBalance(),
    Promise.resolve(getKalshiBalance()),
    Promise.resolve(getCDCExchangeBalance()),
  ]);

  const total = (schwab.value || 0) + (kalshi.balance || 0) + (cdc.totalUsd || 0);

  console.log(`\n── Portfolio Summary ─────────────────────────────`);
  console.log(`  Schwab:       ${fmt(schwab.value)}${schwab.error ? `  ⚠ ${schwab.error}` : `  (BP: ${fmt(schwab.buyingPower)})`}`);
  if (schwab.lines?.length > 1) schwab.lines.forEach(l => console.log(l));
  console.log(`  Kalshi:       ${fmt(kalshi.balance)}${kalshi.error ? `  ⚠ ${kalshi.error}` : ''}`);
  console.log(`  CDC Exchange: ${fmt(cdc.totalUsd)}${cdc.error ? `  ⚠ ${cdc.error}` : ''}`);
  console.log(`  ─────────────────────────────────────────────────`);
  console.log(`  TOTAL:        ${fmt(total)}`);
  console.log(`──────────────────────────────────────────────────\n`);

  writeFileSync(REPORT_FILE, buildHtmlReport(schwab, kalshi, cdc, total));
  console.log(`[pnl] Report written to ${REPORT_FILE}`);

  if (SEND_TELEGRAM) await sendTelegram(buildTelegramMessage(schwab, kalshi, cdc, total));
}

main().catch(err => { console.error('[pnl] Fatal:', err); process.exit(1); });
