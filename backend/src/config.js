import 'dotenv/config';

function bool(v, def = false) {
  if (v === undefined) return def;
  return String(v).toLowerCase() === 'true';
}

export const config = {
  targetUrl:
    process.env.TARGET_URL ||
    'https://doantn.iuh.edu.vn/doanvien.html@211@Tra-cuu',
  cookie: process.env.COOKIE || '',
  cronSchedule: process.env.CRON_SCHEDULE || '*/5 * * * *',
  port: Number(process.env.PORT || 3000),

  ntfy: {
    enabled: bool(process.env.NTFY_ENABLED, true),
    server: process.env.NTFY_SERVER || 'https://ntfy.sh',
    topic: process.env.NTFY_TOPIC || '',
  },

  expo: {
    enabled: bool(process.env.EXPO_ENABLED, false),
  },
};

export function assertConfig() {
  const problems = [];
  if (!config.cookie) {
    problems.push(
      'Thiếu COOKIE trong .env — trang cần đăng nhập nên không có cookie sẽ không scrape được.'
    );
  }
  if (config.ntfy.enabled && !config.ntfy.topic) {
    problems.push('NTFY_ENABLED=true nhưng thiếu NTFY_TOPIC.');
  }
  if (problems.length) {
    console.warn('\n⚠️  Cảnh báo cấu hình:');
    for (const p of problems) console.warn('   - ' + p);
    console.warn('');
  }
  return problems;
}
