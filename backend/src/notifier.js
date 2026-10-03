import { config } from './config.js';
import { loadTokens } from './store.js';

/**
 * Gửi 1 thông báo qua tất cả kênh đang bật.
 * @param {{title:string, body:string}} msg
 */
export async function notify(msg) {
  const jobs = [];
  if (config.ntfy.enabled && config.ntfy.topic) jobs.push(sendNtfy(msg));
  if (config.expo.enabled) jobs.push(sendExpo(msg));
  const results = await Promise.allSettled(jobs);
  for (const r of results) {
    if (r.status === 'rejected') console.error('   ✗ Lỗi gửi thông báo:', r.reason?.message || r.reason);
  }
}

async function sendNtfy({ title, body }) {
  const url = `${config.ntfy.server.replace(/\/$/, '')}/${config.ntfy.topic}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Title: encodeHeader(title),
      Priority: 'high',
      Tags: 'bell',
    },
    body,
  });
  if (!res.ok) throw new Error(`ntfy HTTP ${res.status}`);
  console.log('   → ntfy ok');
}

// ntfy header phải là latin-1; mã hoá tiêu đề tiếng Việt an toàn.
function encodeHeader(s) {
  // ntfy hỗ trợ RFC 2047 encoded-word cho ký tự ngoài ASCII
  return `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`;
}

async function sendExpo({ title, body }) {
  const tokens = await loadTokens();
  if (!tokens.length) {
    console.log('   → expo: chưa có token nào đăng ký, bỏ qua');
    return;
  }
  const messages = tokens.map((to) => ({
    to,
    title,
    body,
    sound: 'default',
    priority: 'high',
  }));
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  });
  if (!res.ok) throw new Error(`expo HTTP ${res.status}`);
  console.log(`   → expo ok (${tokens.length} thiết bị)`);
}
