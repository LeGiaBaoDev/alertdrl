// Đẩy cookie mới lên GitHub Actions Secret (đã mã hoá), để workflow dùng ngay.
// Dùng sealed-box (libsodium) theo đúng yêu cầu của GitHub API.
import nacl from 'tweetnacl';
import sealedbox from 'tweetnacl-sealedbox-js';
import { decodeBase64, encodeBase64, decodeUTF8 } from 'tweetnacl-util';
import * as Crypto from 'expo-crypto';

// tweetnacl cần nguồn ngẫu nhiên — cấp bằng expo-crypto (chạy được trong Expo Go).
nacl.setPRNG((x, n) => {
  const bytes = Crypto.getRandomBytes(n);
  for (let i = 0; i < n; i++) x[i] = bytes[i];
});

const API = 'https://api.github.com';

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/**
 * Cập nhật một secret của repo (vd COOKIE).
 * @returns {Promise<void>} throw nếu lỗi (kèm message dễ hiểu)
 */
export async function updateRepoSecret({ token, owner, repo, name, value }) {
  // 1. Lấy public key của repo để mã hoá
  const pkRes = await fetch(`${API}/repos/${owner}/${repo}/actions/secrets/public-key`, {
    headers: headers(token),
  });
  if (!pkRes.ok) {
    throw new Error(await explain(pkRes, 'Không lấy được public key (kiểm tra token & quyền Secrets)'));
  }
  const { key, key_id } = await pkRes.json();

  // 2. Mã hoá giá trị bằng sealed-box
  const encrypted = sealedbox.seal(decodeUTF8(value), decodeBase64(key));
  const encrypted_value = encodeBase64(encrypted);

  // 3. PUT secret
  const putRes = await fetch(`${API}/repos/${owner}/${repo}/actions/secrets/${name}`, {
    method: 'PUT',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ encrypted_value, key_id }),
  });
  if (!(putRes.status === 201 || putRes.status === 204)) {
    throw new Error(await explain(putRes, 'Cập nhật secret thất bại'));
  }
}

async function explain(res, prefix) {
  let detail = '';
  try {
    const j = await res.json();
    detail = j.message || '';
  } catch {}
  if (res.status === 401) detail = 'Token sai hoặc hết hạn.';
  if (res.status === 403) detail = 'Token thiếu quyền "Secrets: write" cho repo này.';
  if (res.status === 404) detail = 'Không thấy repo (sai owner/repo hoặc token không có quyền truy cập).';
  return `${prefix} [HTTP ${res.status}]${detail ? ' — ' + detail : ''}`;
}
