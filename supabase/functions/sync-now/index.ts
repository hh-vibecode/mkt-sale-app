// EDGE FUNCTION "sync-now": bấm nút Đồng bộ ngay trong app -> gọi GitHub chạy workflow đồng bộ.
// VÌ SAO PHẢI QUA ĐÂY: token GitHub không được nhúng vào index.html (repo public, ai xem nguồn cũng thấy).
// Token nằm trong secret của Supabase, chỉ hàm này đọc được.
// Chống bấm dồn: hỏi GitHub xem workflow đó có lượt nào đang xếp hàng/đang chạy không -- biến trong bộ nhớ
// KHÔNG dùng được vì mỗi lượt gọi có thể rơi vào một tiến trình khác (đã đo: chặn hụt).
const GH_TOKEN = Deno.env.get('GH_DISPATCH_TOKEN') ?? '';
const REPO = 'hh-vibecode/mkt-sale-app';
const ALLOWED: Record<string, string> = {
  datahub: 'sync-datahub.yml',   // Pancake POS
  kiot: 'sync-kiot.yml',         // KiotViet: đơn đặt hàng + hoá đơn
  mkt: 'sync-mkt.yml',           // Meta Ads
};
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Chỉ nhận POST' }, 405);
  if (!GH_TOKEN) return json({ error: 'Chưa cấu hình GH_DISPATCH_TOKEN' }, 500);

  const { job = 'datahub', backfill = false } = await req.json().catch(() => ({}));
  const wf = ALLOWED[job];
  if (!wf) return json({ error: 'Job không hợp lệ: ' + job }, 400);

  const gh = (p: string, init?: RequestInit) => fetch('https://api.github.com/repos/' + REPO + p, {
    ...init,
    headers: { Authorization: 'Bearer ' + GH_TOKEN, Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json', 'User-Agent': 'mkt-sale-app' },
  });
  const running = await gh('/actions/workflows/' + wf + '/runs?per_page=5')
    .then((r) => r.json()).then((d) => (d.workflow_runs || []).filter((x: any) => x.status !== 'completed'))
    .catch(() => []);
  if (running.length) return json({ error: 'Job đang chạy rồi, đợi nó xong đã', running: running.length }, 429);

  const res = await gh('/actions/workflows/' + wf + '/dispatches', {
    method: 'POST',
    body: JSON.stringify({ ref: 'main', inputs: backfill ? { backfill: 'true' } : {} }),
  });
  if (!res.ok) return json({ error: 'GitHub trả lỗi ' + res.status + ': ' + (await res.text()).slice(0, 200) }, 502);
  return json({ ok: true, job, workflow: wf, backfill });
});
