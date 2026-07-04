/**
 * Fetch pending Telegram messages from authorized user.
 * Prints a JSON array of pending messages to stdout.
 * Updates state.json with the new offset so messages aren't reprocessed.
 * Usage: node check.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, 'config.json');
const statePath  = path.join(__dirname, 'state.json');

const config = JSON.parse(readFileSync(configPath, 'utf8'));
const state  = JSON.parse(readFileSync(statePath,  'utf8'));

if (!config.BOT_TOKEN || config.BOT_TOKEN === 'PASTE_YOUR_BOT_TOKEN_HERE') {
  console.log(JSON.stringify({ configured: false, messages: [] }));
  process.exit(0);
}

const url = `https://api.telegram.org/bot${config.BOT_TOKEN}/getUpdates?offset=${state.lastOffset + 1}&timeout=5`;
let data;
try {
  const res = await fetch(url);
  data = await res.json();
} catch (e) {
  console.log(JSON.stringify({ configured: true, error: e.message, messages: [] }));
  process.exit(0);
}

if (!data.ok) {
  console.log(JSON.stringify({ configured: true, error: data.description, messages: [] }));
  process.exit(0);
}

const updates = data.result ?? [];

// Only accept messages from the authorized chat
const messages = updates
  .filter(u => u.message && String(u.message.chat.id) === String(config.AUTHORIZED_CHAT_ID))
  .map(u => ({
    updateId: u.update_id,
    messageId: u.message.message_id,
    text: u.message.text ?? '',
    date: new Date(u.message.date * 1000).toISOString(),
  }));

// Advance offset past all received updates (including ignored ones)
if (updates.length > 0) {
  const maxOffset = Math.max(...updates.map(u => u.update_id));
  state.lastOffset = maxOffset;
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

console.log(JSON.stringify({ configured: true, messages }));
