import cron from 'node-cron';
import { config, assertConfig } from './config.js';
import { fetchEvents } from './scraper.js';
import {
  loadPreviousEvents,
  saveEvents,
  loadSavedCookie,
  saveCookie,
  loadLastCookieAlert,
  saveLastCookieAlert,
} from './store.js';

// Chỉ cảnh báo "cookie hết hạn" tối đa 1 lần mỗi 3 tiếng (chống spam vì quét 1 phút/lần)
const COOKIE_ALERT_INTERVAL_MS = 3 * 60 * 60 * 1000;
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

    // Quét OK -> reset mốc cảnh báo để lần hết hạn sau được báo ngay
    if ((await loadLastCookieAlert()) !== 0) await saveLastCookieAlert(0);
  } catch (err) {
    console.error(`[${stamp}] ✗ Lỗi khi quét:`, err.message);

    // Cookie hết hạn -> báo ntfy để user biết mà cập nhật (giới hạn 1 lần / 3 tiếng)
    if (err.cookieExpired) {
      const last = await loadLastCookieAlert();
      if (Date.now() - last >= COOKIE_ALERT_INTERVAL_MS) {
        await notify({
          title: '⚠️ AlertDRL: COOKIE hết hạn',
          body: 'Không quét được sự kiện vì cookie đã hết hạn. Hãy lấy PHPSESSID mới và cập nhật secret COOKIE trên GitHub.',
        });
        await saveLastCookieAlert();
        console.log('   → đã gửi cảnh báo cookie hết hạn qua ntfy');
      }
    }
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
