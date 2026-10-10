// Đăng nhập trang Đoàn IUH để lấy PHPSESSID mới, ngay trong app.
// Dùng expo/fetch (SDK 52+) vì nó đọc được header Set-Cookie và không tự
// quản lý cookie như fetch mặc định của React Native.
import { fetch as expoFetch } from 'expo/fetch';
import { encodeBase64 } from 'tweetnacl-util';

const BASE = 'https://doantn.iuh.edu.vn';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

function phpsessidFrom(setCookie) {
  if (!setCookie) return null;
  const m = setCookie.match(/PHPSESSID=([^;]+)/);
  return m ? m[1] : null;
}

/**
 * Tạo phiên mới + tải captcha.
 * @returns {Promise<{phpsessid:string, captchaDataUri:string}>}
 */
export async function startLogin() {
  // 1. Phiên mới
  const home = await expoFetch(`${BASE}/`, { headers: { 'User-Agent': UA } });
  const sid = phpsessidFrom(home.headers.get('set-cookie'));
  if (!sid) throw new Error('Không tạo được phiên (PHPSESSID). Thử lại.');

  // 2. Captcha của đúng phiên đó
  const cap = await expoFetch(`${BASE}/components/com_contact/captcha.php`, {
    headers: { 'User-Agent': UA, Cookie: `PHPSESSID=${sid}` },
  });
  if (!cap.ok) throw new Error(`Không tải được captcha [HTTP ${cap.status}]`);
  const buf = await cap.arrayBuffer();
  const b64 = encodeBase64(new Uint8Array(buf));
  return { phpsessid: sid, captchaDataUri: `data:image/jpeg;base64,${b64}` };
}

/**
 * Gửi thông tin đăng nhập, trả về cookie hợp lệ nếu thành công.
 * @returns {Promise<string>} chuỗi cookie "PHPSESSID=..."
 */
export async function submitLogin({ phpsessid, mssv, password, code }) {
  const body = `mssv=${encodeURIComponent(mssv)}&password=${encodeURIComponent(
    password
  )}&security_code=${encodeURIComponent(code)}&btLogin=${encodeURIComponent('Đăng nhập')}`;

  const login = await expoFetch(`${BASE}/login.html`, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      Cookie: `PHPSESSID=${phpsessid}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: `${BASE}/`,
    },
    body,
  });
  // phiên có thể được cấp lại
  const sid2 = phpsessidFrom(login.headers.get('set-cookie')) || phpsessid;
  const cookie = `PHPSESSID=${sid2}`;

  // Kiểm tra đã vào được trang tra cứu chưa
  const check = await expoFetch(`${BASE}/doanvien.html@211@Tra-cuu`, {
    headers: { 'User-Agent': UA, Cookie: cookie },
  });
  const html = await check.text();
  if (html.includes('KẾT QUẢ TRA CỨU') || html.includes('Kết thúc đăng ký')) {
    return cookie;
  }
  throw new Error('Sai MSSV / mật khẩu / captcha. Thử lại.');
}
