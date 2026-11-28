// Nhận brand từ TÊN CHIẾN DỊCH Meta -- dùng chung cho sync-mkt-from-meta.js (mkt_spend) và sync-mkt-vung.js (mkt_spend_vung)
// để 2 bảng chia brand giống hệt nhau. App (index.html) có hàm detectBrand cùng luật.
function detectBrand(name) {
  const n = (name || '').trim();
  if (/tự tại viên|tu tai vien|nến bơ|nen bo/i.test(n)) return 'TTV';
  if (/^HT[\s\-–]|^HT$|hiền thu[ỷy]|hiến thu[ỷy]|hien thuy/i.test(n)) return 'HT';
  if (/shidai/i.test(n)) return 'Shidai';
  if (/chánh tâm|chanh tam|^CT[\s\-–]/i.test(n)) return 'CT';
  return 'CT';
}
// Chiến dịch tuyển dụng không phải chi phí bán hàng (chốt 22/9/2026) -- cùng luật rptMktBoQua trong app.
const laTuyenDung = ten => /tuyển\s*dụng|tuyen\s*dung|tuyển\s*nhân|recruit/i.test(String(ten || ''));
module.exports = { detectBrand, laTuyenDung };
