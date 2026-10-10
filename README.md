# AlertDRL — Thông báo sự kiện Đoàn IUH

App theo dõi trang hoạt động Đoàn (`doantn.iuh.edu.vn`) và **đẩy thông báo lên iPhone** mỗi khi:
- 🆕 có **sự kiện mới** xuất hiện, hoặc
- ✅ một sự kiện đang đầy **mở lại slot** đăng ký.

Giao diện app giống mockup "NOW EVENT NOTIFICATION".

```
AlertDRL/
├── backend/   # Node.js: scrape trang + phát hiện thay đổi + gửi push
└── app/       # Expo (React Native): giao diện iOS + nhận push
```

---

## ⚠️ Điều quan trọng về trang trường

Trang này **cần đăng nhập** (hiển thị thông tin cá nhân của bạn). Vì vậy backend phải
dùng **cookie phiên** của bạn để tải được danh sách. Cookie sẽ hết hạn sau một thời gian
→ khi backend báo lỗi "COOKIE đã hết hạn", bạn chỉ cần lấy cookie mới và dán lại.

---

## 1) Backend (chạy trên máy bạn)

### Cài đặt
```bash
cd backend
npm install
cp .env.example .env
```

### Lấy cookie đăng nhập

**Cách dễ — trợ lý đăng nhập (khuyên dùng):**
```bash
npm run login
```
Nó hiện ảnh captcha, bạn gõ MSSV + mật khẩu + captcha → tự lấy & ghi `COOKIE` vào `.env`.
(Chạy trên máy có màn hình để xem được captcha.)

**Cách thủ công — qua Chrome DevTools:**
1. Mở Chrome, đăng nhập trang Đoàn.
2. **F12** → **Application** → **Cookies** → `https://doantn.iuh.edu.vn`.
3. Copy `PHPSESSID` (name=value), dán vào `COOKIE=` trong `.env`.

> ⚠️ Trang có **captcha** nên không thể tự đăng nhập 100%. Nhưng vì backend quét
> mỗi 5 phút nên phiên được giữ sống → cookie thường rất lâu mới hết hạn.

### Chọn cách nhận thông báo trên iPhone
Mở `.env` và cấu hình. Có 2 cách:

**Cách A — ntfy (MIỄN PHÍ, dùng được ngay, khuyên dùng để test):**
- Cài app **ntfy** trên App Store (iPhone).
- Trong `.env` đặt `NTFY_ENABLED=true` và `NTFY_TOPIC=` một chuỗi khó đoán
  (ví dụ `alertdrl-giabao-9f3k2x` — coi như mật khẩu, ai biết cũng nhận được thông báo).
- Mở app ntfy → **Subscribe to topic** → nhập đúng topic đó.
- Xong! Thông báo sẽ hiện trên iPhone kể cả khi app đóng.

**Cách B — App Expo native (giao diện giống mockup):**
- Đặt `EXPO_ENABLED=true`.
- Xem phần "2) App iOS" bên dưới.
- ❗ Để nhận **push thật khi app đóng trên iPhone**, iOS bắt buộc phải có
  **tài khoản Apple Developer ($99/năm)** để cấu hình APNs qua EAS. Không có
  khoản này thì chỉ test được trên máy ảo / thông báo khi app đang mở. Cách A (ntfy)
  không cần khoản phí này.

Có thể bật **cả hai** cùng lúc.

### Chạy
```bash
npm start          # chạy liên tục, quét mỗi 5 phút (đổi ở CRON_SCHEDULE)
npm run once       # quét đúng 1 lần rồi thoát (để test)
```

Lần quét **đầu tiên** chỉ lưu "ảnh chụp" hiện trạng, **không** bắn thông báo
(tránh spam). Từ lần sau mới báo khi có thay đổi.

> 🚀 Chạy 24/7 trên VPS / Raspberry Pi: xem [DEPLOY.md](DEPLOY.md).

---

## 2) App iOS (Expo) — tùy chọn

```bash
cd app
npm install
npx expo start
```

- Test nhanh: cài **Expo Go** trên iPhone rồi quét QR (thông báo chỉ hiện khi app mở).
- Push thật khi app đóng: cần tạo **development build** bằng EAS + tài khoản Apple Developer:
  ```bash
  npm install -g eas-cli
  eas build --profile development --platform ios
  ```
- Trong app, tab **Cài đặt** → đổi "Địa chỉ backend" thành IP máy chạy backend
  (vd `http://192.168.1.10:3000`, phải cùng Wi-Fi) → bấm **Bật thông báo đẩy**.

> App lấy danh sách sự kiện từ backend qua `GET /events`, nên **backend phải đang chạy**.

---

## Cách hoạt động (tóm tắt)

1. Backend tải HTML trang (kèm cookie) → parse bảng `Đăng ký tham gia`.
2. So sánh với lần quét trước (`backend/data/events.json`).
3. Nếu có sự kiện mới / mở lại slot → gửi thông báo qua ntfy và/hoặc Expo.
4. App iOS hiển thị danh sách và nhận push.

## Khắc phục sự cố
- **"COOKIE đã hết hạn"** → lấy cookie mới (phần 1), dán lại vào `.env`, chạy lại.
- **App không thấy sự kiện** → kiểm tra backend đang chạy và đúng IP ở tab Cài đặt.
- **ntfy không có thông báo** → kiểm tra đã subscribe đúng topic; thử `npm run once` xem log.

4. Khi cookie hết hạn (backend run sẽ chuyển sang đỏ với lỗi "COOKIE đã hết hạn"):
- Chạy cd backend && npm run login ở máy → lấy cookie mới
- Vào repo → Settings → Secrets → COOKIE → Update → dán cookie mới. Xong.