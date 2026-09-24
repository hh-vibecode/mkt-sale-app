// EDGE FUNCTION "pancake-note": Sale điền Mã KH trong app -> ghi thẳng vào GHI CHÚ NỘI BỘ của đơn Pancake,
// và (tuỳ chọn) đẩy luôn TRẠNG THÁI ĐƠN lên mức tương ứng — khách đã chốt thì "Đã gửi hàng" (2).
// Pancake vẫn là nguồn sự thật (app không tạo nguồn thứ hai), app chỉ là chỗ nhập cho tiện.
// Token Pancake nằm ở secret của Supabase, KHÔNG nhúng vào index.html (repo public).
// Đo 21/9/2026: PUT https://pos.pages.fm/api/v1/shops/{shop_id}/orders/{order_id}
//   body {note}   -> ghi ghi chú nội bộ
//   body {status} -> đổi trạng thái; Pancake CHỈ CHO TIẾN, lùi lại trả 422.
const PC = Deno.env.get('PANCAKE_SESSION_TOKEN') ?? '';
const SB_URL = Deno.env.get('SB_URL') ?? '';
const SB_KEY = Deno.env.get('SB_SERVICE_KEY') ?? '';
// ── Chỉ người ĐÃ ĐĂNG NHẬP APP mới gọi được (24/9/2026). Bật bằng secret BAT_BUOC_PHIEN=1 lúc khoá CSDL;
// chưa bật thì chạy như cũ để không gãy người đang dùng khoá công khai.
const URL_SB = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_SB = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const BAT_BUOC = Deno.env.get('BAT_BUOC_PHIEN') === '1';
async function daDangNhap(req: Request): Promise<boolean> {
  const t = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!t || !URL_SB) return false;
  const r = await fetch(URL_SB + '/auth/v1/user', { headers: { apikey: ANON_SB, Authorization: 'Bearer ' + t } }).catch(() => null);
  return !!r && r.ok;   // khoá công khai không có người dùng -> /auth/v1/user từ chối
}
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
  if (BAT_BUOC && !(await daDangNhap(req))) return json({ error: 'Cần đăng nhập app' }, 401);

  const { shop_id, order_id, code, status, chot, the, who } = await req.json().catch(() => ({}));
  if (!shop_id || !order_id) return json({ error: 'Thiếu shop_id / order_id' }, 400);

  const base = `https://pos.pages.fm/api/v1/shops/${shop_id}/orders/${order_id}`;
  const doc = async () => {
    const j = await fetch(`${base}?access_token=${PC}`).then((r) => r.json()).catch(() => null);
    return j?.data ?? j;
  };
  const put = (body: unknown) =>
    fetch(`${base}?access_token=${PC}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  const don = await doc();
  if (!don?.id) return json({ error: 'Không đọc được đơn bên Pancake' }, 404);

  const ket: Record<string, unknown> = { ok: true, who: who ?? null };

  // 1) GHI MÃ KH vào ghi chú nội bộ (nếu có gửi mã)
  if (code !== undefined && code !== null && String(code).trim() !== '') {
    const m = /^\s*(?:kh)?\s*0*(\d{3,7})\s*$/i.exec(String(code));
    if (!m) return json({ error: 'Mã KH không hợp lệ (đúng dạng: KH007620)' }, 400);
    const ma = 'KH' + m[1].padStart(6, '0');
    ket.ma = ma;
    const cu = String(don.note ?? '');
    if (cu.replace(/\s+/g, '').toUpperCase().includes(ma)) {
      ket.note = cu; ket.skipped = 'Mã đã có sẵn trong ghi chú';
    } else {
      const moi = cu.trim() ? cu.trim() + ' ' + ma : ma;   // NỐI THÊM, không ghi đè ghi chú cũ
      const r = await put({ note: moi });
      if (!r.ok) return json({ error: 'Pancake trả lỗi ' + r.status + ': ' + (await r.text()).slice(0, 200) }, 502);
      const lai = await doc();
      const note2 = String(lai?.note ?? '');
      if (!note2.toUpperCase().includes(ma)) return json({ error: 'Ghi xong nhưng đọc lại không thấy mã' }, 502);
      ket.note = note2;
    }
  }

  // 2) ĐẨY TRẠNG THÁI ĐƠN (nếu có gửi status). Chỉ đẩy TỚI, bỏ qua đơn đã huỷ/hoàn.
  let stMoi: number | null = null;
  if (status !== undefined && status !== null) {
    const dich = Number(status);
    const ht = Number((await doc())?.status ?? -1);
    if (![0, 1].includes(ht)) {
      ket.status_skipped = `Đơn đang ở trạng thái ${ht}, không tự đổi`;
    } else if (ht >= dich) {
      ket.status_skipped = 'Trạng thái hiện tại đã bằng hoặc cao hơn';
    } else {
      const r = await put({ status: dich });
      if (r.ok) { stMoi = dich; ket.status = dich; }
      else ket.status_error = 'Pancake trả lỗi ' + r.status;
    }
  }

  // 3) GẮN THẺ KHÁCH trên Pancake. Thẻ nằm ở KHÁCH chứ không ở đơn:
  //    PUT /shops/{shop}/customers/{customer_id} body {customer:{tags:[...]}}
  //    - chot=true            -> bỏ TIỀM NĂNG, gắn CHỐT ĐƠN (giữ nguyên hành vi cũ)
  //    - the='TIỀM NĂNG'      -> gắn thêm TIỀM NĂNG (23/9/2026: Sale Sỉ phân loại khách trong app thì
  //                              app gắn thẻ ngược lên Pancake, khỏi phải làm tay 2 nơi)
  //    - the='CHỐT ĐƠN'       -> như chot=true
  let tagMoi: string[] | null = null;
  const theMuon = chot === true ? 'CHỐT ĐƠN' : (typeof the === 'string' && the.trim() ? the.trim().toUpperCase() : '');
  if (theMuon === 'CHỐT ĐƠN' || theMuon === 'TIỀM NĂNG') {
    const d2 = await doc();
    const cid = d2?.customer?.id;
    const cu: string[] = d2?.customer?.shop_customer?.tags ?? [];
    const daCo = (t: string) => cu.some((x) => x.toUpperCase().includes(t));
    if (!cid) {
      ket.tag_skipped = 'Không đọc được khách của đơn';
    } else if (daCo(theMuon) || (theMuon === 'TIỀM NĂNG' && daCo('CHỐT ĐƠN'))) {
      // đã có đúng thẻ đó, hoặc xin gắn TIỀM NĂNG cho khách đã CHỐT ĐƠN (bậc cao hơn) -> bỏ qua
      ket.tag_skipped = 'Khách đã có thẻ ' + (daCo(theMuon) ? theMuon : 'CHỐT ĐƠN');
    } else {
      const moi = theMuon === 'CHỐT ĐƠN'
        ? [...cu.filter((t) => !/TIỀM NĂNG/i.test(t)), 'CHỐT ĐƠN']
        : [...cu, 'TIỀM NĂNG'];
      const r = await fetch(`https://pos.pages.fm/api/v1/shops/${shop_id}/customers/${cid}?access_token=${PC}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer: { tags: moi } }),
      });
      if (r.ok) { tagMoi = moi; ket.tags = moi; ket.tags_cu = cu; }
      else ket.tag_error = 'Pancake trả lỗi ' + r.status;
    }
  }

  // 4) Cập nhật bản sao trong Supabase để app hiện ngay, khỏi chờ lượt đồng bộ sau
  if (SB_URL && SB_KEY && (ket.note || stMoi !== null || tagMoi)) {
    const patch: Record<string, unknown> = {};
    if (ket.note) patch.internal_note = ket.note;
    if (stMoi !== null) patch.order_status = String(stMoi);
    if (tagMoi) patch.customer_tags = tagMoi.join(', ');
    await fetch(`${SB_URL}/rest/v1/datahub_orders?shop_id=eq.${shop_id}&order_id=eq.${order_id}`, {
      method: 'PATCH',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).catch(() => {});
  }
  return json(ket);
});
