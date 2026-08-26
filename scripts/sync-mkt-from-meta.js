// Kéo báo cáo chi tiêu quảng cáo Meta (Facebook Ads) hàng ngày và upsert vào Supabase mkt_spend.
// Chạy tự động qua GitHub Actions (xem .github/workflows/sync-mkt.yml), 7h sáng giờ VN mỗi ngày.
//
// Cần 3 secret (đặt trong GitHub repo Settings -> Secrets and variables -> Actions):
//   META_ACCESS_TOKEN   -- System User token, quyền ads_read, xem project_deploy.md/reference cho cách tạo
//   META_AD_ACCOUNT_ID  -- dạng "act_1234567890", hỗ trợ nhiều account cách nhau bởi dấu phẩy
//     (VD: "act_1165848552382524,act_2424101351383388" -- tài khoản chính + tài khoản phụ 1)
//   SUPABASE_SERVICE_ROLE_KEY -- lấy trong Supabase dashboard > Settings > API (KHÔNG phải anon key -- key
//     này bỏ qua RLS nên phải giữ bí mật tuyệt đối, không bao giờ được nhúng vào code client-side)
//
// Field trong bảng mkt_spend (xem supabase-schema.sql): ad_id, ad_date, campaign_name, adset_name, ad_name,
// brand, product, reach, impressions, spend, messages, ctr, cpc, comments.

const META_API_VERSION = 'v21.0';
const SUPABASE_URL = 'https://bcrpxfvvjsjpvbksqzls.supabase.co';

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const AD_ACCOUNT_ID_RAW = process.env.META_AD_ACCOUNT_ID;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Mặc định kéo báo cáo của HÔM QUA (Meta thường chưa chốt số liệu xong trong ngày hiện tại) -- override
// bằng biến môi trường SYNC_DATE (định dạng YYYY-MM-DD) nếu cần chạy bù cho 1 ngày cụ thể.
const TARGET_DATE = process.env.SYNC_DATE || (() => {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
})();

function detectBrand(name) {
  const n = (name || '').trim();
  if (/tự tại viên|tu tai vien|nến bơ|nen bo/i.test(n)) return 'TTV';
  if (/^HT[\s\-–]|^HT$|hiền thu[ỷy]|hiến thu[ỷy]|hien thuy/i.test(n)) return 'HT';
  if (/shidai/i.test(n)) return 'Shidai';
  if (/chánh tâm|chanh tam|^CT[\s\-–]/i.test(n)) return 'CT';
  return 'CT';
}
function detectProduct(name) {
  const n = (name || '').toLowerCase();
  if (/thần tài|ban thần tài|tài địa|di lặc|quan lộc/.test(n)) return 'Thần Tài';
  if (/tượng phật/.test(n)) return 'Tượng Phật';
  if (/đèn thờ|đèn/.test(n)) return 'Đèn Thờ';
  if (/ban thờ|bàn thờ|đồ thờ/.test(n)) return 'Ban Thờ';
  if (/dịch vụ/.test(n)) return 'Dịch Vụ';
  const cleaned = (name || '').trim().replace(/^(HT|Shidai)\s*[-–]\s*/i, '').replace(/\s*[-–]\s*(fix bài cũ|mess tiềm năng|mess mua hàng).*$/i, '').replace(/\s*[-–]\s*\d{2}\/\d{2}.*/, '').trim();
  return cleaned || 'Khác';
}
function actionValue(actions, types) {
  if (!Array.isArray(actions)) return 0;
  let total = 0;
  actions.forEach(a => { if (types.some(t => a.action_type === t)) total += Number(a.value) || 0; });
  return total;
}

async function fetchInsights(adAccountId) {
  const fields = ['campaign_name', 'adset_name', 'ad_name', 'ad_id', 'reach', 'impressions', 'spend', 'ctr', 'cpc', 'actions'].join(',');
  const url = `https://graph.facebook.com/${META_API_VERSION}/${adAccountId}/insights` +
    `?level=ad&fields=${fields}&time_range=${encodeURIComponent(JSON.stringify({ since: TARGET_DATE, until: TARGET_DATE }))}` +
    `&limit=500&access_token=${ACCESS_TOKEN}`;
  let allRows = [];
  let nextUrl = url;
  while (nextUrl) {
    const res = await fetch(nextUrl);
    const json = await res.json();
    if (json.error) throw new Error(`Meta API lỗi: ${json.error.message} (code ${json.error.code})`);
    allRows = allRows.concat(json.data || []);
    nextUrl = json.paging && json.paging.next ? json.paging.next : null;
  }
  return allRows;
}

async function upsertMktSpend(rows) {
  if (!rows.length) { console.log('Không có dòng nào để ghi.'); return; }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/mkt_spend?on_conflict=ad_id,ad_date`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: 'Bearer ' + SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Supabase upsert lỗi ${res.status}: ${t.slice(0, 500)}`);
  }
  console.log(`Đã upsert ${rows.length} dòng vào mkt_spend cho ngày ${TARGET_DATE}.`);
}

// Ghi lịch sử vào sync_log để Data Hub (Admin) thấy được job này thực sự chạy khi nào, lấy/tạo/lỗi bao nhiêu --
// không có bảng này thì "Sync History" trên Data Hub chỉ là khung rỗng mãi mãi dù MKT vẫn tự chạy thật mỗi ngày.
async function logSyncStart() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/sync_log`, {
    method: 'POST',
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: 'Bearer ' + SERVICE_ROLE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ source: 'MKT - Meta Ads', status: 'running' }),
  });
  const data = await res.json().catch(() => null);
  return data && data[0] ? data[0].id : null;
}
async function logSyncEnd(id, { status, recordsCreated, errorMessage }) {
  if (!id) return;
  await fetch(`${SUPABASE_URL}/rest/v1/sync_log?id=eq.${id}`, {
    method: 'PATCH',
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: 'Bearer ' + SERVICE_ROLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ finished_at: new Date().toISOString(), status, records_created: recordsCreated || 0, records_updated: 0, error_message: errorMessage || null }),
  }).catch(e => console.warn('Ghi sync_log lỗi (bỏ qua, không chặn job chính):', e.message));
}

(async () => {
  if (!ACCESS_TOKEN || !AD_ACCOUNT_ID_RAW || !SERVICE_ROLE_KEY) {
    console.error('Thiếu secret: cần đủ META_ACCESS_TOKEN, META_AD_ACCOUNT_ID, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  const logId = await logSyncStart().catch(() => null);
  try {
    const adAccountIds = AD_ACCOUNT_ID_RAW.split(',').map(s => s.trim()).filter(Boolean)
      .map(id => id.startsWith('act_') ? id : `act_${id}`);
    console.log(`Đang kéo báo cáo Meta Ads cho ngày ${TARGET_DATE}, ${adAccountIds.length} account: ${adAccountIds.join(', ')}...`);

    let raw = [];
    for (const adAccountId of adAccountIds) {
      const rowsForAccount = await fetchInsights(adAccountId);
      console.log(`  ${adAccountId}: ${rowsForAccount.length} dòng (cấp Ad).`);
      raw = raw.concat(rowsForAccount);
    }
    if (raw[0]) console.log('Mẫu 1 dòng thô (để đối chiếu field actions nếu cần chỉnh):', JSON.stringify(raw[0], null, 2));

    const rows = raw.filter(r => r.ad_id).map(r => {
      const campaign = r.campaign_name || '';
      return {
        ad_id: r.ad_id,
        ad_date: TARGET_DATE,
        campaign_name: campaign,
        adset_name: r.adset_name || null,
        ad_name: r.ad_name || null,
        brand: detectBrand(campaign),
        product: detectProduct(campaign),
        reach: Math.round(Number(r.reach) || 0),
        impressions: Math.round(Number(r.impressions) || 0),
        spend: Number(r.spend) || 0,
        messages: Math.round(actionValue(r.actions, ['onsite_conversion.messaging_conversation_started_7d', 'messaging_conversation_started_7d'])),
        ctr: Number(r.ctr) || 0,
        cpc: Number(r.cpc) || 0,
        comments: Math.round(actionValue(r.actions, ['comment', 'post_comment'])),
      };
    });

    await upsertMktSpend(rows);
    await logSyncEnd(logId, { status: 'success', recordsCreated: rows.length });
  } catch (e) {
    await logSyncEnd(logId, { status: 'failed', errorMessage: e.message });
    throw e;
  }
})().catch(e => { console.error('SYNC_ERROR:', e.message); process.exit(1); });
