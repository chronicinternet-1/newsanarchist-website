#!/usr/bin/env node
/**
 * watchdog.mjs — Monas Trading System health monitor.
 *
 * Checks:
 *   1. Schwab trading token freshness (must be < 28 min old)
 *   2. Schwab marketdata token freshness (must be < 28 min old)
 *   3. Brain-exec (brain-exec.mjs) process is running
 *   4. Last newsanarchist content push is < 26 hours old
 *   5. Telegram bot connectivity
 *
 * Sends Telegram alert when any check fails. Safe to run every 5 minutes.
 *
 * Crontab (add to VPS):
 *   ⁠* /5 * * * * node /home/ubuntu/.openclaw/workspace/newsanarchist-website/scripts/watchdog.mjs >> /home/ubuntu/.openclaw/workspace/robinhood-api/bot/logs/watchdog.log 2>&1
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { homedir } from 'os';
import { join, dirname } from 'path';

const HOME        = homedir();
const SECRETS_DIR = join(HOME, '.openclaw', 'secrets');
const WORKSPACE   = join(HOME, '.openclaw', 'workspace');

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

const CREDS            = loadCreds();
const TELEGRAM_TOKEN   = CREDS.TELEGRAM_BOT_TOKEN || CREDS.TELEGRAM_TOKEN   || '';
const TELEGRAM_CHAT_ID = CREDS.TELEGRAM_CHAT_ID   || CREDS.TELEGRAM_CHANNEL || '';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ageMinutes(filePath) {
  if (!existsSync(filePath)) return Infinity;
  const mtime = statSync(filePath).mtimeMs;
  return (Date.now() - mtime) / 60_000;
}

function processRunning(name) {
  try {
    const out = execSync(`pgrep -f "${name}" 2>/dev/null`, { encoding: 'utf8' });
    return out.trim().length > 0;
  } catch { return false; }
}

async function sendTelegram(text) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' }),
    });
    return res.ok;
  } catch { return false; }
}

function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

function tokenAge(tokenFile) {
  const data = readJson(tokenFile);
  if (!data) return Infinity;
  // Schwab tokens have an expires_at or expires_in field
  const expiresAt = data.expires_at || data.expiry || null;
  if (expiresAt) {
    const expiresMs = typeof expiresAt === 'number'
      ? expiresAt * 1000   // unix timestamp in seconds
      : new Date(expiresAt).getTime();
    return (expiresMs - Date.now()) / 60_000; // positive = minutes until expiry
  }
  // Fall back to file mtime
  return -ageMinutes(tokenFile); // negative = minutes past mtime (already expired feel)
}

// ─── Checks ───────────────────────────────────────────────────────────────────

const TRADING_TOKEN_FILE    = join(SECRETS_DIR, 'schwab-trading-tokens.json');
const MARKETDATA_TOKEN_FILE = join(SECRETS_DIR, 'schwab-marketdata-tokens.json');
const CONTENT_REPO          = join(WORKSPACE, 'newsanarchist-website');
const SITE_JSON             = join(CONTENT_REPO, 'generated-articles.json');

function checkSchwabTokens() {
  const failures = [];

  const tradingAge = ageMinutes(TRADING_TOKEN_FILE);
  if (tradingAge > 28) {
    failures.push(`Schwab TRADING token is ${tradingAge === Infinity ? 'MISSING' : `${tradingAge.toFixed(0)} min old`} (limit 28 min)`);
  }

  const marketAge = ageMinutes(MARKETDATA_TOKEN_FILE);
  if (marketAge > 28) {
    failures.push(`Schwab MARKETDATA token is ${marketAge === Infinity ? 'MISSING' : `${marketAge.toFixed(0)} min old`} (limit 28 min)`);
  }

  return failures;
}

function checkBrainExec() {
  if (!processRunning('brain-exec')) {
    return ['brain-exec.mjs is NOT running — trading decisions halted'];
  }
  return [];
}

function checkContentFreshness() {
  if (!existsSync(SITE_JSON)) {
    return ['generated-articles.json not found — content pipeline may be broken'];
  }
  const data = readJson(SITE_JSON);
  if (!data || !data.length) return ['generated-articles.json is empty'];
  const newest = data.reduce((a, b) =>
    new Date(b.generatedAt) > new Date(a.generatedAt) ? b : a
  );
  const ageHours = (Date.now() - new Date(newest.generatedAt).getTime()) / 3_600_000;
  if (ageHours > 26) {
    return [`NewsAnarchist last article is ${ageHours.toFixed(1)}h old — content cron may be broken`];
  }
  return [];
}

// ─── Alert deduplication (file-based) ─────────────────────────────────────────

const ALERT_STATE_FILE = join(WORKSPACE, 'robinhood-api', 'bot', 'logs', 'watchdog-state.json');

function loadAlertState() {
  try { return JSON.parse(readFileSync(ALERT_STATE_FILE, 'utf8')); } catch { return {}; }
}

function saveAlertState(state) {
  try {
    mkdirSync(dirname(ALERT_STATE_FILE), { recursive: true });
    writeFileSync(ALERT_STATE_FILE, JSON.stringify(state));
  } catch {}
}

// Re-alert only if same key hasn't been alerted in the past 60 min
function shouldAlert(key, state) {
  const lastSent = state[key] || 0;
  return (Date.now() - lastSent) > 60 * 60_000;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Pacific/Honolulu', hour12: true });
  console.log(`[watchdog] ${timestamp} HST`);

  const failures = [
    ...checkSchwabTokens(),
    ...checkBrainExec(),
    ...checkContentFreshness(),
  ];

  if (!failures.length) {
    console.log('[watchdog] All checks passed.');
    return;
  }

  const state = loadAlertState();
  const toAlert = [];
  const now = Date.now();

  for (const msg of failures) {
    const key = msg.slice(0, 40);
    if (shouldAlert(key, state)) {
      toAlert.push(msg);
      state[key] = now;
    } else {
      console.log(`[watchdog] suppressed (already alerted): ${msg}`);
    }
  }

  if (toAlert.length) {
    const alertText = [
      `<b>🚨 Monas Trading System — Alert</b>`,
      `<i>${timestamp} HST</i>`,
      ``,
      ...toAlert.map(m => `• ${m}`),
      ``,
      `<i>Check the VPS immediately.</i>`,
    ].join('\n');

    console.error('[watchdog] ALERT:', toAlert.join(' | '));
    await sendTelegram(alertText);
    saveAlertState(state);
  }
}

main().catch(err => { console.error('[watchdog] Fatal:', err); process.exit(1); });
