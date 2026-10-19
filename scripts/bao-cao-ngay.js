// ════════ DAILY REPORT — tự chạy 4–5h sáng giờ VN (anh Hải 19/10/2026) ════════
// Tính báo cáo của NGÀY HÔM QUA (giờ VN) bằng ĐÚNG hàm bcnTinh trong index.html (nạp app vào máy ảo, xem lib/app-vm.js)
// rồi ghi 1 dòng vào mkt_bao_cao_ngay. Trang "Daily report" (chỉ Supreme) đọc bảng này.
// Đã có báo cáo của ngày đó thì bỏ qua (workflow hẹn 2 lần cho chắc, lần sau tự thoát). CHAY_LAI=1 để tính lại; NGAY=YYYY-MM-DD để chọn ngày.
const vm = require('vm');
const { SUPABASE_URL, H, tai, napApp } = require('./lib/app-vm');

const homNayVN = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const cong = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

(async () => {
  if (!H.apikey) { console.error('Thiếu SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
  const D = process.env.NGAY || cong(homNayVN(), -1);
  const co = await tai('mkt_bao_cao_ngay', `select=ngay&ngay=eq.${D}`);
  if (co.length && process.env.CHAY_LAI !== '1') { console.log(`Đã có báo cáo ngày ${D} — bỏ qua.`); return; }
  const tu = new Date(D + 'T00:00:00+07:00').toISOString(), den = new Date(cong(D, 1) + 'T00:00:00+07:00').toISOString();
  const truoc = new Date(new Date(tu).getTime() - 86400000).toISOString();
  const [log, sync, ds] = await Promise.all([
    tai('activity_log', `select=at,who,act,tbl,ref,label,fld,old_v,new_v&at=gte.${tu}&at=lt.${den}&order=at`),
    tai('sync_log', `select=source,status,started_at,error_message&started_at=gte.${truoc}&started_at=lt.${den}`),
    tai('sync_log', `select=status,records_updated,error_message,started_at,finished_at&source=eq.${encodeURIComponent('Đối soát Kiot (tuần)')}&order=started_at.desc`),
  ]);
  const ctx = await napApp();
  ctx.__D = D; ctx.__phu = { log, sync, doiSoat: ds[0] || null };
  // "hôm nay" của app = ngày sau ngày báo cáo (việc quá hạn, todayISO...)
  const kq = JSON.parse(vm.runInContext(`(()=>{todayISO=()=>${JSON.stringify(cong(D, 1))};return JSON.stringify(bcnTinh(__D,__phu));})()`, ctx));
  const r = await fetch(`${SUPABASE_URL}/rest/v1/mkt_bao_cao_ngay?on_conflict=ngay`, { method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ ...kq, tao_luc: new Date().toISOString(), tao_boi: 'Job tự chạy sáng (GitHub)' }) });
  if (!r.ok) { console.error('Ghi báo cáo lỗi', r.status, (await r.text()).slice(0, 300)); process.exit(1); }
  console.log(`XONG báo cáo ngày ${D}: ${kq.canh_bao.length} cảnh báo.`);
  kq.tom_tat.forEach(t => console.log('  • ' + t));
  kq.canh_bao.forEach(c => console.log(`  [${c.muc}] ${c.nhom}: ${c.nd}`));
})().catch(e => { console.error(e); process.exit(1); });
