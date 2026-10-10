import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const EVENTS_FILE = join(DATA_DIR, 'events.json');
const TOKENS_FILE = join(DATA_DIR, 'tokens.json');
const COOKIE_FILE = join(DATA_DIR, 'cookie.txt');

async function ensureDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readJson(file, fallback) {
  try {
    const raw = await readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(file, data) {
  await ensureDir();
  await writeFile(file, JSON.stringify(data, null, 2), 'utf8');
}

// ----- Trạng thái sự kiện lần quét trước -----
export async function loadPreviousEvents() {
  return readJson(EVENTS_FILE, null); // null = chưa quét lần nào
}

export async function saveEvents(events) {
  await writeJson(EVENTS_FILE, events);
}

// ----- Cookie mới nhất (được gia hạn/xoay sau mỗi lần quét) -----
export async function loadSavedCookie() {
  try {
    const raw = await readFile(COOKIE_FILE, 'utf8');
    return raw.trim() || null;
  } catch {
    return null; // chưa lưu lần nào
  }
}

export async function saveCookie(cookie) {
  await ensureDir();
  await writeFile(COOKIE_FILE, cookie, 'utf8');
}

// ----- Expo push tokens (từ app native) -----
export async function loadTokens() {
  return readJson(TOKENS_FILE, []);
}

export async function addToken(token) {
  const tokens = await loadTokens();
  if (!tokens.includes(token)) {
    tokens.push(token);
    await writeJson(TOKENS_FILE, tokens);
  }
  return tokens;
}
