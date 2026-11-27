// KIỂM KHOÁ PANCAKE ĐẦU MỖI LƯỢT SYNC — CHỈ BÁO LỖI 1 LẦN (anh Hải 27/11/2026: "toàn báo lỗi sync về mail t", "có cách nào hạn chế k").
// Khoá PANCAKE_SESSION_TOKEN hỏng (Pancake trả "access_token is invalid" / 401) thì lượt nào cũng đỏ -> 10 phút 1 mail.
// Nay: hỏng LẦN ĐẦU -> ghi dấu job_moc 'pancake-token-hong' + để bước này ĐỎ (1 mail duy nhất); các lượt sau thấy dấu đã có -> bỏ qua mọi bước
// Pancake, lượt chạy XANH (không mail). Khoá chạy lại -> xoá dấu, các bước chạy bình thường. Lỗi mạng / Pancake 5xx KHÔNG tính là hỏng khoá
// (để các bước tự xử như cũ). Ra: GITHUB_OUTPUT ok=true|false.
const fs = require('fs'), path = require('path');
const KEYS = (() => { try { return fs.readFileSync(path.join(__dirname, '..', 'supabase-keys.local.txt'), 'utf8'); } catch (e) { return ''; } })();
const TOKEN = process.env.PANCAKE_SESSION_TOKEN || (KEYS.match(/PANCAKE_SESSION_TOKEN[^\n]*\n\s*(eyJ[A-Za-z0-9._-]+)/) || [])[1];
const KHOA = process.env.SUPABASE_SERVICE_ROLE_KEY || (KEYS.match(/SERVICE_ROLE_KEY:\s*(eyJ[A-Za-z0-9._-]+)/) || [])[1];
const SB = 'https://bcrpxfvvjsjpvbksqzls.supabase.co';
const H = { apikey: KHOA, Authorization: 'Bearer ' + KHOA, 'Content-Type': 'application/json' };
const TEN = 'pancake-token-hong';
const ra = ok => { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'ok=' + ok + '\n'); };

async function khoaHong() {   // true = hỏng chắc chắn, false = dùng được, null = không biết (mạng / 5xx)
  if (!TOKEN) return true;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`https://pos.pages.fm/api/v1/shops/1943052948/orders?page=1&page_size=1&access_token=${TOKEN}`);
      const j = await r.json().catch(() => ({}));
      if (r.status === 401 || /access_token is invalid|invalid.*token|token.*expired/i.test(String(j.message || ''))) return true;
      if (r.ok && j.success !== false) return false;
    } catch (e) { /* thử lại */ }
    await new Promise(s => setTimeout(s, 2000 * (i + 1)));
  }
  return null;
}

(async () => {
  const hong = await khoaHong();
  const r = await fetch(`${SB}/rest/v1/job_moc?ten=eq.${TEN}&select=ten,luc,ghi_chu&limit=1`, { headers: H });
  const dau = r.ok ? (await r.json())[0] : null;
  const daBao = !!(dau && dau.ghi_chu === 'hỏng');
  if (hong === true) {
    ra(false);
    if (daBao) { console.log(`Khoá Pancake vẫn hỏng (đã báo lúc ${dau.luc}) — bỏ qua các bước Pancake, không báo lại.`); return; }
    await fetch(`${SB}/rest/v1/job_moc?on_conflict=ten`, { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ ten: TEN, luc: new Date().toISOString(), ghi_chu: 'hỏng' }]) });
    console.error('KHOÁ PANCAKE HỎNG (access_token is invalid): cần lấy khoá mới, thay secret PANCAKE_SESSION_TOKEN ở GitHub (mkt-sale-app + qc-cskh).'
      + ' Chỉ báo 1 lần này; các lượt sau tự bỏ qua bước Pancake cho tới khi khoá chạy lại.');
    process.exit(1);
  }
  ra(true);
  if (hong === false && daBao) {
    await fetch(`${SB}/rest/v1/job_moc?ten=eq.${TEN}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify({ luc: new Date().toISOString(), ghi_chu: 'đã chạy lại' }) });
    console.log('Khoá Pancake đã chạy lại — xoá dấu hỏng, các bước chạy bình thường.');
  } else console.log(hong === false ? 'Khoá Pancake OK.' : 'Không kiểm được khoá Pancake (mạng / Pancake lỗi) — cho các bước chạy như thường.');
})().catch(e => { console.error('kiem-token-pancake:', String(e && e.message || e).slice(0, 200)); ra(true); });
