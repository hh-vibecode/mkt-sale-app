// EDGE FUNCTION "pancake-note": Sale điền Mã KH trong app -> ghi thẳng vào GHI CHÚ NỘI BỘ của đơn Pancake.
// Pancake vẫn là nguồn sự thật (app không tạo nguồn thứ hai), app chỉ là chỗ nhập cho tiện.
// Token Pancake nằm ở secret của Supabase, KHÔNG nhúng vào index.html (repo public).
// Đã đo 21/9/2026: ghi được bằng PUT https://pos.pages.fm/api/v1/shops/{shop_id}/orders/{order_id} body {note}.
const PC = Deno.env.get('PANCAKE_SESSION_TOKEN') ?? '';
const SB_URL = Deno.env.get('SB_URL') ?? '';
const SB_KEY = Deno.env.get('SB_SERVICE_KEY') ?? '';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Chỉ nhận POST' }, 405);
  if (!PC) return json({ error: 'Chưa cấu hình PANCAKE_SESSION_TOKEN' }, 500);

  const { shop_id, order_id, code, who } = await req.json().catch(() => ({}));
  if (!shop_id || !order_id) return json({ error: 'Thiếu shop_id / order_id' }, 400);

  // Chuẩn hoá Mã KH: "kh7620", "KH 007620", "7620" -> "KH007620"
  const m = /^\s*(?:kh)?\s*0*(\d{3,7})\s*$/i.exec(String(code ?? ''));
  if (!m) return json({ error: 'Mã KH không hợp lệ (đúng dạng: KH007620)' }, 400);
  const ma = 'KH' + m[1].padStart(6, '0');

  const base = `https://pos.pages.fm/api/v1/shops/${shop_id}/orders/${order_id}`;
  const cur = await fetch(`${base}?access_token=${PC}`).then((r) => r.json()).catch(() => null);
  const don = cur?.data ?? cur;
  if (!don?.id) return json({ error: 'Không đọc được đơn bên Pancake' }, 404);

  const cu = String(don.note ?? '');
  if (cu.replace(/\s+/g, '').toUpperCase().includes(ma)) {
    return json({ ok: true, note: cu, ma, skipped: 'Mã đã có sẵn trong ghi chú' });
  }
  // NỐI THÊM, không ghi đè ghi chú cũ của Sale.
  const moi = cu.trim() ? cu.trim() + ' ' + ma : ma;

  const put = await fetch(`${base}?access_token=${PC}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note: moi }),
  });
  if (!put.ok) return json({ error: 'Pancake trả lỗi ' + put.status + ': ' + (await put.text()).slice(0, 200) }, 502);

  // Đọc lại để chắc chắn đã vào, rồi cập nhật luôn bản sao trong Supabase cho app hiện ngay,
  // khỏi phải chờ lượt đồng bộ sau.
  const lai = await fetch(`${base}?access_token=${PC}`).then((r) => r.json()).catch(() => null);
  const note2 = String((lai?.data ?? lai)?.note ?? '');
  if (!note2.toUpperCase().includes(ma)) return json({ error: 'Ghi xong nhưng đọc lại không thấy mã' }, 502);

  if (SB_URL && SB_KEY) {
    await fetch(`${SB_URL}/rest/v1/datahub_orders?shop_id=eq.${shop_id}&order_id=eq.${order_id}`, {
      method: 'PATCH',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ internal_note: note2 }),
    }).catch(() => {});
  }
  return json({ ok: true, ma, note: note2, who: who ?? null });
});
