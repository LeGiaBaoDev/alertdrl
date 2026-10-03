import express from 'express';
import { config } from './config.js';
import { addToken } from './store.js';

/**
 * HTTP server để:
 *  - App Expo đăng ký push token:   POST /register-token { token }
 *  - App lấy danh sách sự kiện mới nhất:  GET /events
 *  - Kiểm tra sống:                 GET /health
 *
 * getLatestEvents: hàm trả về snapshot sự kiện gần nhất (từ index.js).
 */
export function startServer(getLatestEvents) {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

  app.get('/events', (_req, res) => {
    res.json({ events: getLatestEvents() });
  });

  app.post('/register-token', async (req, res) => {
    const token = req.body?.token;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Thiếu token' });
    }
    await addToken(token);
    console.log('📱 Đã đăng ký push token mới');
    res.json({ ok: true });
  });

  app.listen(config.port, () => {
    console.log(`🌐 HTTP server: http://localhost:${config.port}`);
  });
}
