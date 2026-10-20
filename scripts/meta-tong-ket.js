// TỔNG KẾT QUẢNG CÁO THEO KỲ — lấy THẲNG từ Ads Manager (Meta Marketing API), cấp chiến dịch + cả tài khoản.
// Dùng cho báo cáo tháng (anh Hải 20/10/2026: "số liệu ưu tiên lấy từ Ads Manager cho chuẩn, kết hợp báo cáo MKT lấy doanh số").
// Khác mkt_spend (cộng theo ngày): ở đây Meta tự tính cho CẢ KỲ -> tiếp cận / tần suất là người duy nhất, có click liên kết, kết quả mess.
// Chạy: KY="2026-10-01:2026-10-20,2026-09-01:2026-09-30" OUT=file.json node scripts/meta-tong-ket.js
// Khoá: biến môi trường META_ACCESS_TOKEN / META_AD_ACCOUNT_ID (cloud) hoặc supabase-keys.local.txt (máy anh). KHÔNG in khoá.
const fs = require('fs');
const path = require('path');
const V = 'v21.0';
const tep = (() => { try { return fs.readFileSync(path.join(__dirname, '..', 'supabase-keys.local.txt'), 'utf8'); } catch (e) { return ''; } })();
const TOKEN = process.env.META_ACCESS_TOKEN || (tep.match(/META_ACCESS_TOKEN(?:_NEW)?\s*[:=]\s*(EA[A-Za-z0-9]+)/) || tep.match(/(EAA[A-Za-z0-9]{60,})/) || [])[1];
const KY = (process.env.KY || '').split(',').filter(Boolean).map(x => x.split(':'));
const goi = async url => { const j = await (await fetch(url)).json(); if (j.error) throw new Error('Meta API: ' + j.error.message); return j; };
const tatCa = async url => { let ra = [], u = url; while (u) { const j = await goi(u); ra = ra.concat(j.data || []); u = j.paging && j.paging.next; } return ra; };
const hd = (a, t) => (a || []).filter(x => t.includes(x.action_type)).reduce((s, x) => s + Number(x.value || 0), 0);
const F = 'campaign_id,campaign_name,objective,spend,reach,impressions,frequency,cpm,ctr,clicks,inline_link_clicks,inline_link_click_ctr,cost_per_inline_link_click,actions';
const gon = r => ({
  ten: r.campaign_name || 'TOÀN TÀI KHOẢN', muc_tieu: r.objective || '', chi: +r.spend || 0, tiep_can: +r.reach || 0, hien_thi: +r.impressions || 0,
  tan_suat: +r.frequency || 0, cpm: +r.cpm || 0, ctr_tat_ca: +r.ctr || 0, click_tat_ca: +r.clicks || 0,
  click_lien_ket: +r.inline_link_clicks || 0, ctr_lien_ket: +r.inline_link_click_ctr || 0, cp_click_lien_ket: +r.cost_per_inline_link_click || 0,
  mess_bat_dau: hd(r.actions, ['onsite_conversion.messaging_conversation_started_7d']),
  nguoi_lien_he_mess: hd(r.actions, ['onsite_conversion.total_messaging_connection']),
  binh_luan: hd(r.actions, ['comment', 'post_comment']), tuong_tac_bai: hd(r.actions, ['post_engagement']),
});
(async () => {
  if (!TOKEN) { console.error('Không thấy META token (biến môi trường hoặc supabase-keys.local.txt)'); process.exit(1); }
  if (!KY.length) { console.error('Thiếu KY'); process.exit(1); }
  const tk = process.env.META_AD_ACCOUNT_ID ? process.env.META_AD_ACCOUNT_ID.split(',').map(x => ({ id: x.trim(), name: x.trim() }))
    : (await tatCa(`https://graph.facebook.com/${V}/me/adaccounts?fields=id,name,account_status,currency&limit=100&access_token=${TOKEN}`)).filter(a => a.account_status === 1);
  const kq = { tai_khoan: tk.map(a => ({ id: a.id, ten: a.name, tien_te: a.currency })), ky: {} };
  for (const [tu, den] of KY) {
    const tr = encodeURIComponent(JSON.stringify({ since: tu, until: den }));
    const k = kq.ky[tu + '..' + den] = { toan_bo: [], chien_dich: [] };
    for (const a of tk) {
      const acc = await tatCa(`https://graph.facebook.com/${V}/${a.id}/insights?level=account&fields=${F.replace(/campaign_id,campaign_name,objective,/, '')}&time_range=${tr}&access_token=${TOKEN}`);
      acc.forEach(r => k.toan_bo.push({ tai_khoan: a.name, ...gon(r) }));
      const cd = await tatCa(`https://graph.facebook.com/${V}/${a.id}/insights?level=campaign&fields=${F}&time_range=${tr}&limit=200&access_token=${TOKEN}`);
      cd.forEach(r => k.chien_dich.push({ tai_khoan: a.name, ...gon(r) }));
    }
  }
  fs.writeFileSync(process.env.OUT || 'meta-tong-ket.json', JSON.stringify(kq, null, 1));
  Object.entries(kq.ky).forEach(([ky, k]) => console.log(ky, '·', k.toan_bo.length, 'tài khoản ·', k.chien_dich.length, 'chiến dịch · chi', Math.round(k.toan_bo.reduce((s, x) => s + x.chi, 0)).toLocaleString('vi')));
})().catch(e => { console.error('LỖI', e.message); process.exit(1); });
