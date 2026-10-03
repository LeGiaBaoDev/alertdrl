/**
 * So sánh danh sách sự kiện cũ và mới, trả về các thay đổi đáng thông báo.
 *
 * @param {Array|null} prev - sự kiện lần quét trước (null nếu lần đầu)
 * @param {Array} curr - sự kiện hiện tại
 * @returns {Array<{type,event,title,body}>}
 */
export function diffEvents(prev, curr) {
  const changes = [];

  // Lần đầu chạy: không bắn thông báo hàng loạt, chỉ lưu baseline.
  if (prev === null) return changes;

  const prevById = new Map(prev.map((e) => [e.id, e]));

  for (const e of curr) {
    const before = prevById.get(e.id);

    if (!before) {
      // Sự kiện hoàn toàn mới
      changes.push({
        type: 'new',
        event: e,
        title: '🆕 Sự kiện mới',
        body: `${e.name}${e.max ? ` (${e.current}/${e.max})` : ''}${
          e.deadline ? ` · hết hạn ${e.deadline}` : ''
        }`,
      });
      continue;
    }

    // Slot mở lại: trước đó đầy, giờ còn chỗ
    if (!before.isOpen && e.isOpen) {
      changes.push({
        type: 'reopen',
        event: e,
        title: '✅ Mở lại đăng ký',
        body: `${e.name}${e.max ? ` (${e.current}/${e.max})` : ''} — nhanh tay đăng ký!`,
      });
      continue;
    }
  }

  return changes;
}
