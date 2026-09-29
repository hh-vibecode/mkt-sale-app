// CHẠY 1 CÂU SQL qua Supabase Management API (dùng cho phiên Claude trên máy lẫn trên cloud, 29/9/2026).
//   node scripts/sql.js "select count(*) from datahub_orders"
//   SQLFILE=supabase-schema-x.sql node scripts/sql.js
// Token: biến môi trường SUPABASE_MGMT_TOKEN (cloud) hoặc dòng sbp_… trong supabase-keys.local.txt (máy anh Hải).
// KHÔNG in token ra màn hình.
const fs = require('fs'), path = require('path');
const REF = 'bcrpxfvvjsjpvbksqzls';
const token = process.env.SUPABASE_MGMT_TOKEN || (() => {
  try { return (fs.readFileSync(path.join(__dirname, '..', 'supabase-keys.local.txt'), 'utf8').match(/sbp_[A-Za-z0-9]+/) || [])[0]; }
  catch (e) { return ''; }
})();
if (!token) { console.error('Thiếu SUPABASE_MGMT_TOKEN'); process.exit(1); }
const sql = process.env.SQLFILE ? fs.readFileSync(process.env.SQLFILE, 'utf8') : process.argv.slice(2).join(' ');
if (!sql.trim()) { console.error('Chưa có câu SQL'); process.exit(1); }
(async () => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) });
  const t = await r.text();
  console.log(r.status, t.length > 20000 ? t.slice(0, 20000) + ' …(cắt)' : t);
  if (!r.ok) process.exit(1);
})();
