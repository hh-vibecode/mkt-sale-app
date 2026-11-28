// CHI TIÊU META THEO TỈNH + THEO TUỔI / GIỚI TÍNH -> bảng mkt_spend_vung (28/11/2026, anh Hải: tab "Khách Online",
// "biết chính xác ngân sách chi tiêu theo tỉ lệ các tỉnh", "nhân khẩu học khách online"). Soạn bởi Monsieur Claude.
//
// Meta insights cấp CHIẾN DỊCH, time_increment=1, 2 lượt breakdowns: region (tỉnh) và age,gender. Gộp theo ngày x brand
// (brand theo tên chiến dịch, scripts/lib/meta-brand.js -- cùng luật mkt_spend), bỏ chiến dịch tuyển dụng. Upsert, return=minimal.
// Mặc định: hôm qua + hôm nay (giờ VN). Chạy bù: TU=2026-06-01 DEN=2026-11-28 (tự chia khúc 15 ngày).
// Cần: META_ACCESS_TOKEN, META_AD_ACCOUNT_ID, SUPABASE_SERVICE_ROLE_KEY (cùng secret với sync-mkt-from-meta.js).
const { fetchLai } = require('./lib/fetch-lai.js');
const { detectBrand, laTuyenDung } = require('./lib/meta-brand.js');
const fetch = (u, o) => fetchLai(u, o, { ten: 'sync-mkt-vung.js' });

const API = 'https://graph.facebook.com/v21.0';
const SUPABASE_URL = 'https://bcrpxfvvjsjpvbksqzls.supabase.co';
const TOKEN = process.env.META_ACCESS_TOKEN, KHOA = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TK = String(process.env.META_AD_ACCOUNT_ID || '').split(',').map(s => s.trim()).filter(Boolean).map(id => id.startsWith('act_') ? id : 'act_' + id);

const ngayVN = lui => { const d = new Date(Date.now() + 7 * 3600e3); d.setUTCDate(d.getUTCDate() - (lui || 0)); return d.toISOString().slice(0, 10); };
const TU = process.env.TU || ngayVN(1), DEN = process.env.DEN || ngayVN(0);
const congNgay = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const tinNhan = a => (Array.isArray(a) ? a : []).filter(x => x.action_type === 'onsite_conversion.messaging_conversation_started_7d').reduce((s, x) => s + (Number(x.value) || 0), 0);

async function keo(act, tu, den, breakdowns) {
  let url = `${API}/${act}/insights?level=campaign&fields=campaign_name,spend,impressions,actions&breakdowns=${breakdowns}`
    + `&time_increment=1&time_range=${encodeURIComponent(JSON.stringify({ since: tu, until: den }))}&limit=1000&access_token=${TOKEN}`;
  let ra = [], trang = 0;
  while (url && trang < 500) {
    const j = await (await fetch(url)).json();
    if (j.error) throw new Error(`Meta ${breakdowns}: ${(j.error.message || '').slice(0, 200)} (code ${j.error.code})`);
    ra = ra.concat(j.data || []); url = (j.paging || {}).next || null; trang++;
  }
  return ra;
}

async function ghi(rows) {
  for (let i = 0; i < rows.length; i += 1000) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/mkt_spend_vung?on_conflict=ngay,brand,loai,khoa`, {
      method: 'POST',
      headers: { apikey: KHOA, Authorization: 'Bearer ' + KHOA, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows.slice(i, i + 1000)),
    });
    if (!res.ok) throw new Error('Ghi mkt_spend_vung lỗi ' + res.status + ': ' + (await res.text()).slice(0, 200));
  }
}

(async () => {
  if (!TOKEN || !TK.length || !KHOA) { console.error('Thiếu secret: META_ACCESS_TOKEN, META_AD_ACCOUNT_ID, SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
  console.log(`Chi tiêu Meta theo tỉnh / tuổi-giới tính: ${TU} -> ${DEN}, ${TK.length} tài khoản`);
  let tong = 0;
  for (let tu = TU; tu <= DEN; tu = congNgay(tu, 15)) {
    const den = congNgay(tu, 14) < DEN ? congNgay(tu, 14) : DEN;
    const g = {};
    for (const [loai, bd] of [['tinh', 'region'], ['tuoi_gioi', 'age,gender']]) {
      for (const act of TK) {
        for (const r of await keo(act, tu, den, bd)) {
          if (laTuyenDung(r.campaign_name)) continue;
          const khoa = loai === 'tinh' ? (r.region || 'Unknown') : (r.age || '?') + '|' + (r.gender || '?');
          const k = r.date_start + '|' + detectBrand(r.campaign_name) + '|' + loai + '|' + khoa;
          const x = g[k] = g[k] || { ngay: r.date_start, brand: detectBrand(r.campaign_name), loai, khoa, spend: 0, impressions: 0, messages: 0 };
          x.spend += Number(r.spend) || 0; x.impressions += Math.round(Number(r.impressions) || 0); x.messages += Math.round(tinNhan(r.actions));
        }
      }
    }
    const rows = Object.values(g).map(x => Object.assign(x, { spend: Math.round(x.spend), cap_nhat: new Date().toISOString() }));
    await ghi(rows); tong += rows.length;
    const chi = rows.filter(x => x.loai === 'tinh').reduce((s, x) => s + x.spend, 0);
    console.log(`  ${tu} -> ${den}: ${rows.length} dòng, chi tiêu (theo tỉnh) ${chi.toLocaleString('vi')} đ`);
  }
  console.log(`Xong: ${tong} dòng.`);
})().catch(e => { console.error('SYNC_ERROR:', e.message); process.exit(1); });
