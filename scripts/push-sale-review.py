"""Đẩy các lượt hỏi-đáp đã tách được lên bảng `sale_response_review`.

Job 7h sáng chỉ tự chốt được những kết luận KHÔNG cần đọc hiểu:
  - khong_tra_loi   : không ai trả lời, kể cả bot
  - chi_bot         : chỉ bot rep, không có người vào
  - tra_loi_inbox   : bình luận được điều hướng sang tin nhắn và sale đã tư vấn ở đó
Còn việc chấm ĐÚNG / THIẾU Ý / SAI KIẾN THỨC thì cần đối chiếu với 263 câu trong `product_faq`,
model rẻ làm không nổi (đã 2 lần chấm oan) → để verdict `chua_cham`, chờ chấm tay bằng Claude.

Chống trùng: khoá (conv_id, conv_date, 160 ký tự đầu của câu hỏi). Chạy lại cùng ngày không nhân bản.
Đã có verdict thật rồi thì KHÔNG ghi đè — tránh xoá mất kết quả đã chấm.
"""
import json, os, sys, urllib.request, urllib.error

# Hardcode giống scripts/sync-mkt-from-meta.js để khỏi phải thêm secret trùng lặp
URL = (os.environ.get('SUPABASE_URL') or 'https://bcrpxfvvjsjpvbksqzls.supabase.co').rstrip('/')
KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']
PAIRS = os.environ.get('OUT_PAIRS', 'pairs.json')

H = {'apikey': KEY, 'Authorization': 'Bearer ' + KEY,
     'Content-Type': 'application/json', 'Prefer': 'return=representation'}


def req(method, path, body=None):
    r = urllib.request.Request(URL + '/rest/v1/' + path, method=method,
                               data=json.dumps(body).encode() if body is not None else None,
                               headers=H)
    try:
        with urllib.request.urlopen(r) as f:
            t = f.read().decode()
            return json.loads(t) if t.strip() else []
    except urllib.error.HTTPError as e:
        print('HTTP', e.code, e.read().decode()[:400], file=sys.stderr)
        raise


pairs = json.load(open(PAIRS, encoding='utf-8'))
if not pairs:
    print('Không có lượt nào trong khoảng ngày — bỏ qua.')
    raise SystemExit(0)

dates = sorted({p['date'] for p in pairs})
existing = req('GET', 'sale_response_review?select=id,conv_id,conv_date,customer_ask,full_thread'
                      f'&conv_date=in.({",".join(dates)})&limit=5000')
seen = {(r['conv_id'], r['conv_date'], (r['customer_ask'] or '')[:160]) for r in existing}
# Dòng cũ đã có (chấm rồi hay chưa cũng vậy) nhưng thiếu full_thread (dữ liệu thêm vào sau, 4/9/2026) —
# vá thêm conv_at/full_thread cho các dòng đó, KHÔNG đụng verdict/issue/suggestion đã chấm.
id_by_key = {(r['conv_id'], r['conv_date'], (r['customer_ask'] or '')[:160]): r['id']
             for r in existing if not r.get('full_thread')}

AUTO = {
    'khong_tra_loi': dict(
        severity='Nghiêm trọng',
        issue='Khách có nhu cầu thật nhưng không ai trả lời (kể cả bot).',
        suggestion='Phân công người trực bình luận + inbox theo ca, đặt cảnh báo tin chưa đọc.'),
    'chi_bot': dict(
        severity='Nghiêm trọng',
        issue='Chỉ có bot trả lời tự động, không có sale nào vào tư vấn.',
        suggestion='Kiểm tra luồng bàn giao từ bot sang người — bot rep xong phải có người tiếp nhận.'),
    'tra_loi_inbox': dict(
        severity=None,
        issue='Bình luận được bot điều hướng sang tin nhắn, sale đã tư vấn trong inbox — không tính lỗi.',
        suggestion=None),
}

rows = []
backfills = []
for p in pairs:
    key = (p['conv_id'], p['date'], (p['ask'] or '')[:160])
    if key in seen:
        if key in id_by_key:
            backfills.append((id_by_key[key], {'conv_at': p.get('at'), 'full_thread': p.get('thread')}))
        continue
    seen.add(key)
    if p.get('answered_in_inbox'):
        v = 'tra_loi_inbox'
    elif p.get('bot_only'):
        v = 'chi_bot'
    elif not p.get('reply'):
        v = 'khong_tra_loi'
    else:
        v = 'chua_cham'
    meta = AUTO.get(v, dict(severity=None, issue=None, suggestion=None))
    rows.append({
        'conv_date': p['date'], 'conv_at': p.get('at'), 'page_name': p['page'], 'conv_id': p['conv_id'],
        'customer_name': p['customer'], 'phone': p.get('phone'),
        'sale_name': p.get('sale'), 'customer_ask': p['ask'],
        'sale_reply': p.get('reply'), 'verdict': v, 'source_faq': None, 'full_thread': p.get('thread'), **meta,
    })

if not rows and not backfills:
    print(f'{len(pairs)} lượt — đã có đủ trong bảng, không thêm/vá dòng nào.')
    raise SystemExit(0)

if os.environ.get('DRY_RUN'):
    print(f'[DRY_RUN] sẽ thêm {len(rows)} dòng mới, vá full_thread cho {len(backfills)} dòng cũ — không ghi gì.')
else:
    for i in range(0, len(rows), 100):
        req('POST', 'sale_response_review', rows[i:i + 100])
    for rid, body in backfills:
        req('PATCH', f'sale_response_review?id=eq.{rid}', body)

from collections import Counter
c = Counter(r['verdict'] for r in rows)
print(f'Đã thêm {len(rows)} lượt mới ({dates[0]}..{dates[-1]}):')
for k, n in c.most_common():
    print(f'   {k}: {n}')
if backfills:
    print(f'Đã vá full_thread/conv_at cho {len(backfills)} dòng cũ (không đụng verdict đã chấm).')
print(f'→ {c.get("chua_cham", 0)} lượt CHỜ CHẤM (mở Claude Code bảo chấm khi rảnh).')
