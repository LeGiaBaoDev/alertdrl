# Deploy AlertDRL chạy 24/7 (VPS hoặc Raspberry Pi)

Mục tiêu: backend quét mỗi 5 phút, chạy mãi, tự khởi động lại khi reboot.
Hướng dẫn dùng chung cho **VPS** và **Raspberry Pi** (chỉ khác ở bước thuê máy).

---

## 0. Chọn máy

| | VPS | Raspberry Pi |
|---|---|---|
| Ổn định | Cao (uptime ~100%) | Phụ thuộc điện/mạng nhà |
| Chi phí | ~1–2$/tháng, hoặc **Oracle Cloud Free** (miễn phí vĩnh viễn) | Đã có sẵn |
| Phù hợp | Chạy lâu dài | Thử nghiệm / cá nhân |

> **Oracle Cloud Free tier**: tạo 1 VM "Always Free" (Ampere ARM hoặc AMD micro),
> chọn Ubuntu. Sau khi tạo xong bạn có IP + user `ubuntu` để SSH vào.

---

## 1. SSH vào máy

```bash
ssh ubuntu@<IP_VPS>        # VPS (Oracle: user thường là "ubuntu")
# hoặc
ssh legiabao@raspberry-2.local   # Raspberry Pi
```

## 2. Cài Node.js 20 (nếu chưa có)

```bash
node -v   # nếu >= v18 thì bỏ qua bước này
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## 3. Đưa code lên máy

**Cách A — rsync từ máy Mac** (chạy trên Terminal Mac, KHÔNG phải trong SSH):
```bash
rsync -av --exclude node_modules --exclude data --exclude .env \
  "/Users/legiabao/Documents/HỌC CODE/MyProject/inProgress/AlertDRL/backend/" \
  ubuntu@<IP_VPS>:~/alertdrl-backend/
```

**Cách B — git** (nếu bạn đẩy project lên GitHub):
```bash
git clone <repo-url> alertdrl && cd alertdrl/backend
```

## 4. Cài dependencies + cấu hình

Trên VPS/Pi:
```bash
cd ~/alertdrl-backend
npm install
cp .env.example .env
nano .env      # điền COOKIE, NTFY_TOPIC (xem README)
```

Test 1 lần:
```bash
npm run once
```
Thấy "Quét xong: N sự kiện" là OK.

## 5. Chạy nền 24/7 với pm2

```bash
sudo npm install -g pm2
pm2 start src/index.js --name alertdrl
pm2 save
pm2 startup      # copy & chạy dòng lệnh (có sudo) nó in ra -> tự chạy khi reboot
```

Lệnh quản lý:
```bash
pm2 logs alertdrl      # xem log realtime
pm2 restart alertdrl   # khởi động lại (sau khi đổi .env)
pm2 stop alertdrl      # tạm dừng
pm2 status             # trạng thái
```

---

## 6. Đổi cookie khi hết hạn (trên máy chạy nền headless)

Trang có **captcha** nên không thể tự đăng nhập hoàn toàn. Khi backend báo
"COOKIE đã hết hạn", làm 1 trong 2 cách:

**Cách nhanh (khuyên dùng):** chạy trợ lý đăng nhập trên **laptop có màn hình**:
```bash
cd backend && npm run login       # xem captcha, gõ MSSV + mật khẩu + captcha
```
Nó in ra / ghi dòng `COOKIE=...` mới. Copy dòng đó, SSH vào VPS, sửa `.env`:
```bash
nano ~/alertdrl-backend/.env      # dán COOKIE mới
pm2 restart alertdrl
```

**Cách thủ công:** lấy cookie qua Chrome DevTools (xem README) rồi dán vào `.env`.

---

## 7. Lưu ý Oracle Cloud Free

- Backend chỉ gọi ra ngoài (doantn.iuh.edu.vn + ntfy.sh), **không cần mở port**
  nếu bạn chỉ dùng ntfy. Nếu dùng app Expo native (cần port 3000) thì mở
  Ingress Rule cho port 3000 trong Security List + `sudo ufw allow 3000`.
- VM Always Free không bị tính tiền, hợp để chạy tool cá nhân như thế này.
