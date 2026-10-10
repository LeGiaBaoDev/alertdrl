import * as cheerio from 'cheerio';
import { config } from './config.js';

/**
 * Gộp cookie cũ với các cặp Set-Cookie mới từ phản hồi.
 * Server (ASP.NET) có thể gia hạn/xoay cookie mỗi request; ta giữ lại
 * giá trị mới nhất để lần quét sau dùng, tránh cookie "chết" sớm.
 *
 * @param {string} oldCookie - chuỗi "k1=v1; k2=v2" đang dùng
 * @param {string[]} setCookies - mảng header Set-Cookie thô
 * @returns {string} chuỗi cookie đã gộp
 */
export function mergeCookies(oldCookie, setCookies) {
  const jar = new Map();
  for (const part of (oldCookie || '').split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) jar.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim());
  }
  for (const sc of setCookies || []) {
    // Set-Cookie: "name=value; Path=/; HttpOnly" -> chỉ lấy cặp name=value đầu tiên
    const first = sc.split(';')[0];
    const eq = first.indexOf('=');
    if (eq <= 0) continue;
    const name = first.slice(0, eq).trim();
    const value = first.slice(eq + 1).trim();
    // Giá trị rỗng / "deleted" = server yêu cầu xoá cookie -> bỏ khỏi jar
    if (!value || value.toLowerCase() === 'deleted') jar.delete(name);
    else jar.set(name, value);
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

/**
 * Tải HTML trang doanvien và parse danh sách sự kiện đăng ký.
 *
 * Bảng mục tiêu: <table class="tblDoanvien"> nằm trong tab "Đăng ký tham gia",
 * có các cột: TT | Tên hoạt động | Học kỳ | Điểm tích luỹ | Kết thúc đăng ký | Trạng thái
 *
 * @param {string} [cookie] - cookie dùng cho request (mặc định config.cookie)
 * @returns {Promise<{events: Array, cookie: string}>} sự kiện + cookie đã gộp
 */
export async function fetchEvents(cookie = config.cookie) {
  const res = await fetch(config.targetUrl, {
    headers: {
      Cookie: cookie,
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept-Language': 'vi,en;q=0.9',
    },
    redirect: 'follow',
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} khi tải trang`);
  }

  // Node 18.14+: getSetCookie() trả về mảng các header Set-Cookie
  const setCookies =
    typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  const nextCookie = mergeCookies(cookie, setCookies);

  const html = await res.text();
  return { events: parseEvents(html), cookie: nextCookie };
}

export function parseEvents(html) {
  const $ = cheerio.load(html);

  // Tìm bảng đăng ký: bảng có header chứa "Kết thúc đăng ký"
  let $table = null;
  $('table.tblDoanvien, table').each((_, el) => {
    const text = $(el).text();
    if (text.includes('Kết thúc đăng ký') && !$table) {
      $table = $(el);
    }
  });

  if (!$table) {
    // Có thể cookie hết hạn -> trang trả về form đăng nhập
    if (html.includes('Đăng nhập') || html.toLowerCase().includes('login')) {
      throw new Error(
        'Không tìm thấy bảng sự kiện — có thể COOKIE đã hết hạn (trang trả về đăng nhập). Hãy lấy cookie mới.'
      );
    }
    throw new Error('Không tìm thấy bảng sự kiện trong HTML.');
  }

  const events = [];
  $table.find('tr').each((_, tr) => {
    const tds = $(tr).find('td');
    if (tds.length < 6) return; // bỏ header / dòng không hợp lệ

    // Cột TT phải là số — loại bỏ dòng tiêu đề (TT, Hoạt động, ...)
    if (!/^\d+$/.test($(tds[0]).text().trim())) return;

    const rawName = $(tds[1]).text().replace(/\s+/g, ' ').trim();
    if (!rawName) return;

    const semester = $(tds[2]).text().replace(/\s+/g, ' ').trim();
    const point = $(tds[3]).text().trim();
    const deadline = $(tds[4]).text().trim();
    const status = $(tds[5]).text().replace(/\s+/g, ' ').trim();

    // Số lượng "(330/450)" trong tên
    const m = rawName.match(/\((\d+)\s*\/\s*(\d+)\)\s*$/);
    const current = m ? Number(m[1]) : null;
    const max = m ? Number(m[2]) : null;
    const name = m ? rawName.replace(/\s*\(\d+\s*\/\s*\d+\)\s*$/, '').trim() : rawName;

    // Còn mở đăng ký khi trạng thái không phải "Đã đủ số lượng"
    const isOpen = !/đã đủ số lượng/i.test(status);

    events.push({
      id: name, // dùng tên (đã bỏ số lượng) làm khoá ổn định
      name,
      semester,
      point,
      deadline,
      status,
      current,
      max,
      isOpen,
    });
  });

  return events;
}
