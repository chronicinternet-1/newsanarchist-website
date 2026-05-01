#!/usr/bin/env node
/**
 * daily-pnl-report.mjs — Monas Trading System daily P&L summary.
 *
 * Pulls live balances from:
 *   • Schwab (via schwab-client.mjs getAccounts())
 *   • Kalshi (kalshi-live-state.json)
 *   • CDC Exchange (cdc-exchange-state.json)
 *
 * Usage:
 *   node daily-pnl-report.mjs             # write /tmp/daily-pnl.html + print
 *   node daily-pnl-report.mjs --telegram  # also send summary to Telegram
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createRequire } from 'module';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir  = dirname(fileURLToPath(import.meta.url));
const HOME   = homedir();
const SECRETS_DIR  = join(HOME, '.openclaw', 'secrets');
const WORKSPACE    = join(HOME, '.openclaw', 'workspace');
const SCHWAB_CLIENT = join(WORKSPACE, 'robinhood-api', 'bot', 'schwab-client.mjs');

const SEND_TELEGRAM = process.argv.includes('--telegram');
const REPORT_FILE   = '/tmp/daily-pnl.html';

// ─── Credentials ──────────────────────────────────────────────────────────────

function loadCreds() {
  const credFile = join(SECRETS_DIR, 'credentials.env');
  if (!existsSync(credFile)) return {};
  const result = {};
  for (const line of readFileSync(credFile, 'utf8').split('\n')) {
    const m = line.match(/^export\s+([A-Z0-9_]+)="?([^"]*)"?/);
    if (m) result[m[1]] = m[2];
  }
  return result;
}

const CREDS = loadCreds();
const TELEGRAM_TOKEN   = CREDS.TELEGRAM_BOT_TOKEN   || CREDS.TELEGRAM_TOKEN   || '';
const TELEGRAM_CHAT_ID = CREDS.TELEGRAM_CHAT_ID     || CREDS.TELEGRAM_CHANNEL || '';

// ─── Data sources ─────────────────────────────────────────────────────────────

function readJson(path, fallback = null) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; }
}

async function getSchwabBalance() {
  try {
    if (!existsSync(SCHWAB_CLIENT)) return { error: 'schwab-client.mjs not found', value: 0 };
    const { default: client } = await import(SCHWAB_CLIENT);
    const accounts = await client.getAccounts();
    if (!accounts || !accounts.length) return { error: 'no accounts returned', value: 0 };

    let totalValue     = 0;
    let totalBuying    = 0;
    const accountLines = [];

    for (const acct of accounts) {
      const agg  = acct.securitiesAccount?.currentBalances
                ?? acct.securitiesAccount?.initialBalances
                ?? {};
      const val  = agg.liquidationValue ?? agg.totalValue ?? agg.accountValue ?? 0;
      const cash = agg.buyingPower      ?? agg.cashBalance ?? 0;
      const num  = acct.securitiesAccount?.accountNumber ?? '????';
      totalValue  += Number(val);
      totalBuying += Number(cash);
      accountLines.push(`  ${num.slice(-4)}: $${Number(val).toFixed(2)} (BP: $${Number(cash).toFixed(2)})`);
    }
    return { value: totalValue, buyingPower: totalBuying, lines: accountLines };
  } catch (err) {
    return { error: err.message, value: 0 };
  }
}

function getKalshiBalance() {
  // Try multiple possible state-file locations
  const candidates = [
    join(WORKSPACE, 'robinhood-api', 'bot', 'kalshi-live-state.json'),
    join(WORKSPACE, 'scripts', 'kalshi-live-state.json'),
    join(HOME, 'kalshi-live-state.json'),
  ];
  for (const p of candidates) {
    const data = readJson(p);
    if (!data) continue;
    // Support multiple shapes written by different kalshi integrations
    const balance = data.balance
      ?? data.portfolio_value
      ?? data.account?.balance
      ?? data.totalValue
      ?? data.total_value
      ?? null;
    if (balance !== null) return { balance: Number(balance), file: p };
  }
  return { balance: 0, error: 'kalshi-live-state.json not found or has no balance field' };
}

function getCDCExchangeBalance() {
  // CDC Exchange (crypto.com exchange, not CDC app / CDC swing)
  const candidates = [
    join(WORKSPACE, 'robinhood-api', 'bot', 'cdc-exchange-state.json'),
    join(WORKSPACE, 'scripts', 'cdc-exchange-state.json'),
    join(HOME, 'cdc-exchange-state.json'),
  ];
  for (const p of candidates) {
    const data = readJson(p);
    if (!data) continue;
    const totalUsd = data.totalUsd
      ?? data.total_usd
      ?? data.usd_value
      ?? data.portfolioValue
      ?? null;
    if (totalUsd !== null) return { totalUsd: Number(totalUsd), file: p };
  }
  return { totalUsd: 0, error: 'cdc-exchange-state.json not found' };
}

// ─── Telegram ─────────────────────────────────────────────────────────────────

async function sendTelegram(text) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('[telegram] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in credentials.env');
    return;
  }
  const url  = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  const body = JSON.stringify({
    chat_id:    TELEGRAM_CHAT_ID,
    text,
    parse_mode: 'HTML',
  });
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('[telegram] Send failed:', err);
  } else {
    console.log('[telegram] Sent successfully.');
  }
}

// ─── Report builder ───────────────────────────────────────────────────────────

function fmt(n)   { return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function now()    { return new Date().toLocaleString('en-US', { timeZone: 'Pacific/Honolulu', hour12: true }); }

function buildTelegramMessage(schwab, kalshi, cdc, total) {
  const date  = new Date().toLocaleDateString('en-US', { timeZone: 'Pacific/Honolulu', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const lines = [
    `<b>📊 Monas Trading System — Daily P&amp;L</b>`,
    `<i>${date} (HST)</i>`,
    ``,
    `<b>Schwab</b>`,
  ];

  if (schwab.error) {
    lines.push(`  ⚠️ ${schwab.error}`);
  } else {
    lines.push(`  Portfolio: <b>${fmt(schwab.value)}</b>`);
    lines.push(`  Buying Power: ${fmt(schwab.buyingPower)}`);
    if (schwab.lines?.length > 1) {
      for (const l of schwab.lines) lines.push(`  ${l.trim()}`);
    }
  }

  lines.push(``);
  lines.push(`<b>Kalshi</b>`);
  if (kalshi.error && !kalshi.balance) {
    lines.push(`  ⚠️ ${kalshi.error}`);
  } else {
    lines.push(`  Balance: <b>${fmt(kalshi.balance)}</b>`);
  }

  lines.push(``);
  lines.push(`<b>CDC Exchange</b>`);
  if (cdc.error && !cdc.totalUsd) {
    lines.push(`  ⚠️ ${cdc.error}`);
  } else {
    lines.push(`  Portfolio: <b>${fmt(cdc.totalUsd)}</b>`);
  }

  lines.push(``);
  lines.push(`<b>─────────────────</b>`);
  lines.push(`<b>Total: ${fmt(total)}</b>`);
  lines.push(``);
  lines.push(`<i>Zeno | Monas Trading System</i>`);

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
  console.log(`[pnl] Running at ${now()} HST`);

  const [schwab, kalshi, cdc] = await Promise.all([
    getSchwabBalance(),
    Promise.resolve(getKalshiBalance()),
    Promise.resolve(getCDCExchangeBalance()),
  ]);

  const total = (schwab.value || 0) + (kalshi.balance || 0) + (cdc.totalUsd || 0);

  // Console summary
  console.log(`\n── Portfolio Summary ──────────────────────────────`);
  console.log(`  Schwab:       ${fmt(schwab.value)}${schwab.error ? ` ⚠ ${schwab.error}` : ` (BP: ${fmt(schwab.buyingPower)})`}`);
  if (schwab.lines?.length > 1) schwab.lines.forEach(l => console.log(l));
  console.log(`  Kalshi:       ${fmt(kalshi.balance)}${kalshi.error ? ` ⚠ ${kalshi.error}` : ''}`);
  console.log(`  CDC Exchange: ${fmt(cdc.totalUsd)}${cdc.error ? ` ⚠ ${cdc.error}` : ''}`);
  console.log(`  ─────────────────────────────────────────────────`);
  console.log(`  TOTAL:        ${fmt(total)}`);
  console.log(`──────────────────────────────────────────────────\n`);

  // HTML report
  const html = buildHtmlReport(schwab, kalshi, cdc, total);
  writeFileSync(REPORT_FILE, html);
  console.log(`[pnl] Report written to ${REPORT_FILE}`);

  // Telegram
  if (SEND_TELEGRAM) {
    const msg = buildTelegramMessage(schwab, kalshi, cdc, total);
    await sendTelegram(msg);
  }
}

main().catch(err => { console.error('[pnl] Fatal:', err); process.exit(1); });
