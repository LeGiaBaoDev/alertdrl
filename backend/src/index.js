import cron from 'node-cron';
import { config, assertConfig } from './config.js';
import { fetchEvents } from './scraper.js';
import {
  loadPreviousEvents,
  saveEvents,
  loadSavedCookie,
  saveCookie,
} from './store.js';
import { diffEvents } from './diff.js';
import { notify } from './notifier.js';
import { startServer } from './server.js';

let latestEvents = [];

async function checkOnce() {
  const stamp = new Date().toLocaleString('vi-VN');
  try {
    // Ưu tiên cookie đã gia hạn ở lần quét trước; chưa có thì dùng cookie gốc từ env
    const cookie = (await loadSavedCookie()) || config.cookie;
    const { events: curr, cookie: nextCookie } = await fetchEvents(cookie);
    latestEvents = curr;

    // Lưu lại cookie mới nhất để lần sau dùng (giữ session sống lâu hơn)
    if (nextCookie && nextCookie !== cookie) {
      await saveCookie(nextCookie);
    }
    const prev = await loadPreviousEvents();
    const changes = diffEvents(prev, curr);

    console.log(
      `[${stamp}] Quét xong: ${curr.length} sự kiện` +
        (prev === null ? ' (lần đầu — lưu baseline, không báo)' : `, ${changes.length} thay đổi`)
    );

    for (const c of changes) {
      console.log(`   • ${c.title}: ${c.body}`);
      await notify({ title: c.title, body: c.body });
    }

    await saveEvents(curr);
  } catch (err) {
    console.error(`[${stamp}] ✗ Lỗi khi quét:`, err.message);
  }
}

async function main() {
  const once = process.argv.includes('--once');
  console.log('🔔 AlertDRL backend khởi động');
  assertConfig();

  if (once) {
    await checkOnce();
    return;
  }

  startServer(() => latestEvents);
  await checkOnce(); // chạy ngay 1 lần
  cron.schedule(config.cronSchedule, checkOnce);
  console.log(`⏰ Đã lên lịch quét: "${config.cronSchedule}"`);
}

main();
