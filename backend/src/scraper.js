import * as cheerio from 'cheerio';
import { config } from './config.js';

/**
 * Tải HTML trang doanvien và parse danh sách sự kiện đăng ký.
 *
 * Bảng mục tiêu: <table class="tblDoanvien"> nằm trong tab "Đăng ký tham gia",
 * có các cột: TT | Tên hoạt động | Học kỳ | Điểm tích luỹ | Kết thúc đăng ký | Trạng thái
 *
 * @returns {Promise<Array<{id,name,semester,point,deadline,status,current,max,isOpen}>>}
 */
export async function fetchEvents() {
  const res = await fetch(config.targetUrl, {
    headers: {
      Cookie: config.cookie,
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept-Language': 'vi,en;q=0.9',
    },
    redirect: 'follow',
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} khi tải trang`);
  }

  const html = await res.text();
  return parseEvents(html);
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
