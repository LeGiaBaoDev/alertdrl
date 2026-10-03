/**
 * Trợ lý đăng nhập — lấy PHPSESSID mới mà không cần mò DevTools.
 *
 * Luồng:
 *  1. GET trang chủ -> nhận PHPSESSID + captcha gắn với phiên.
 *  2. Tải ảnh captcha, mở lên cho bạn xem.
 *  3. Bạn gõ MSSV + mật khẩu + captcha.
 *  4. POST /login.html -> xác thực phiên.
 *  5. Kiểm tra đăng nhập thành công rồi ghi COOKIE mới vào .env.
 *
 * Chạy: npm run login
 * Nên chạy trên máy CÓ màn hình (để xem captcha). Trên VPS headless:
 * chạy trên laptop rồi copy dòng COOKIE sang .env của VPS.
 */
import { writeFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import readline from 'node:readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASE = 'https://doantn.iuh.edu.vn';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

function ask(question, { hidden = false } = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    if (hidden) {
      // ẩn ký tự khi gõ mật khẩu
      const onData = () => (rl.output.write('\x1B[2K\x1B[200D' + question));
      process.stdin.on('data', onData);
      rl.question(question, (ans) => {
        process.stdin.removeListener('data', onData);
        rl.output.write('\n');
        rl.close();
        resolve(ans.trim());
      });
    } else {
      rl.question(question, (ans) => {
        rl.close();
        resolve(ans.trim());
      });
    }
  });
}

function openFile(path) {
  const cmd =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  try {
    spawn(cmd, [path], { stdio: 'ignore', detached: true }).unref();
  } catch {
    /* headless: bỏ qua */
  }
}

async function updateEnvCookie(cookie) {
  const envPath = join(ROOT, '.env');
  let text = '';
  try {
    text = await readFile(envPath, 'utf8');
  } catch {
    text = '';
  }
  if (/^COOKIE=.*$/m.test(text)) {
    text = text.replace(/^COOKIE=.*$/m, `COOKIE=${cookie}`);
  } else {
    text += `\nCOOKIE=${cookie}\n`;
  }
  await writeFile(envPath, text, 'utf8');
}

async function main() {
  console.log('🔐 Trợ lý đăng nhập AlertDRL\n');

  // 1. Lấy phiên + captcha
  const home = await fetch(`${BASE}/`, { headers: { 'User-Agent': UA } });
  const setCookie = home.headers.get('set-cookie') || '';
  const m = setCookie.match(/PHPSESSID=([^;]+)/);
  if (!m) throw new Error('Không lấy được PHPSESSID từ trang chủ.');
  const phpsessid = `PHPSESSID=${m[1]}`;
  console.log('→ Đã tạo phiên mới.');

  // 2. Tải captcha
  const cap = await fetch(`${BASE}/components/com_contact/captcha.php`, {
    headers: { 'User-Agent': UA, Cookie: phpsessid },
  });
  const buf = Buffer.from(await cap.arrayBuffer());
  const capPath = join(ROOT, 'captcha.jpg');
  await writeFile(capPath, buf);
  console.log(`→ Ảnh captcha đã lưu: ${capPath}`);
  openFile(capPath);
  console.log('   (Nếu không tự mở, hãy mở file captcha.jpg để xem)\n');

  // 3. Nhập thông tin
  const mssv = await ask('MSSV: ');
  const password = await ask('Mật khẩu: ', { hidden: true });
  const security_code = await ask('Mã captcha trong ảnh: ');

  // 4. POST đăng nhập
  const body = new URLSearchParams({
    mssv,
    password,
    security_code,
    btLogin: 'Đăng nhập',
  });
  const login = await fetch(`${BASE}/login.html`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'User-Agent': UA,
      Cookie: phpsessid,
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: `${BASE}/`,
    },
    body,
  });
  // phiên có thể được cấp lại cookie mới
  const loginSet = login.headers.get('set-cookie') || '';
  const m2 = loginSet.match(/PHPSESSID=([^;]+)/);
  const finalCookie = m2 ? `PHPSESSID=${m2[1]}` : phpsessid;

  // 5. Kiểm tra
  const check = await fetch(`${BASE}/doanvien.html@211@Tra-cuu`, {
    headers: { 'User-Agent': UA, Cookie: finalCookie },
  });
  const checkHtml = await check.text();
  if (checkHtml.includes('KẾT QUẢ TRA CỨU') || checkHtml.includes('Kết thúc đăng ký')) {
    await updateEnvCookie(finalCookie);
    console.log('\n✅ Đăng nhập thành công! Đã cập nhật COOKIE vào .env.');
    console.log('   Khởi động lại backend (hoặc pm2 restart alertdrl) để dùng cookie mới.');
  } else {
    console.error('\n❌ Đăng nhập thất bại — sai MSSV / mật khẩu / captcha. Chạy lại: npm run login');
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('Lỗi:', e.message);
  process.exitCode = 1;
});
