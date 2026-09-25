import json, re, html, os, sys
# Chạy trong job hàng ngày: nhận file crawl + khoảng ngày qua biến môi trường.
IN   = os.environ.get('IN',  'pancake_raw.json')
OUT  = os.environ.get('OUT_PAIRS', 'pairs.json')
def _d(n):
    from datetime import datetime, timedelta
    return (datetime.utcnow() + timedelta(hours=7) - timedelta(days=n)).strftime('%Y-%m-%d')
FROM = os.environ.get('FROM') or _d(1)
TO   = os.environ.get('TO')   or _d(1)
d = json.load(open(IN, encoding='utf-8'))

def clean(t):
    if not t: return ''
    t = re.sub(r"<Copy[^>]*text='([^']*)'[^>]*>.*?</Copy>", r'\1', t, flags=re.S)
    t = re.sub(r'<br[^>]*/?>', ' ', t)
    t = re.sub(r"<a href='([^']*)'[^>]*>.*?</a>", r'\1', t, flags=re.S)
    t = re.sub(r'<[^>]+>', '', t)
    return re.sub(r'\s+',' ', html.unescape(t)).strip()

BOT_NAMES={'Botcake'}
# tin hệ thống / trả lời tự động — KHÔNG tính là sale phản hồi
SYS = re.compile(r'đã trả lời (một|về một) (quảng cáo|bài viết)|bạn đang phản hồi bình luận|vui lòng nhắn tin cho bên em|vui lòng đợi (giây lát|một chút)|kết nối (với )?nhân viên|kính chào anh/chị|trân trọng xin chào|hân hạnh được kết nối|xin phép kết nối lại', re.I)
INTENT = re.compile(r'giá|bao nhiêu|bn |bnhiêu|size|kích thước|còn hàng|có bán|mua|ship|đặt|order|tư vấn|mẫu|hình|ảnh|inbox|ib\b|sỉ|đại lý|nhập|combo|khuyến mãi|km\b|bảo hành|đổi trả|chất liệu|gỗ|đồng|cách|hướng dẫn|lắp|giao hàng|phí|freeship|thanh toán|cọc|báo giá|xin|cho e|cho c|cho a|còn ko|còn không|có ko|có không|lấy cho|\?', re.I)

def kind(m):
    """cust | sale | auto  (auto = bot hoặc tin hệ thống, không tính là sale trả lời)"""
    if not m['from_page']: return 'cust'
    if (m['admin'] or '') in BOT_NAMES: return 'auto'
    if SYS.search(clean(m['text'])): return 'auto'
    return 'sale'

# ── NỐI BÌNH LUẬN → TIN NHẮN ───────────────────────────────────
# Luồng thật của page: khách bình luận dưới bài quảng cáo → Botcake rep "vui lòng kiểm tra tin nhắn"
# → sale trả lời tử tế trong INBOX. Nếu chỉ soi trong 1 hội thoại thì bình luận đó luôn bị chấm
# "không trả lời / chỉ bot" dù khách ĐÃ được tư vấn đầy đủ. => Chỉ báo lỗi bình luận khi khách
# KHÔNG được ai trả lời trong tin nhắn.
# Khoá nối: conv INBOX có id = "{page_id}_{fb_id}", conv COMMENT mang fb_id ở customers[0].
# Bản crawl cũ chưa lưu fb_id → fallback khớp theo (page_id, tên khách).
from datetime import datetime, timedelta
def _plus_hours(iso, h):
    try: return (datetime.fromisoformat(iso[:26]) + timedelta(hours=h)).isoformat()
    except Exception: return iso[:10] + 'T99'

def _sale_reply_times(c):
    # Mốc thời gian các lượt sale THẬT (không bot/hệ thống) trả lời trong 1 hội thoại
    out=[]
    for m in c['messages']:
        if not m['from_page']: continue
        if (m['admin'] or '') in BOT_NAMES: continue
        if SYS.search(clean(m['text'])): continue
        if not clean(m['text']): continue   # ảnh trần không tính là đã tư vấn
        out.append(m['at'])
    return out

inbox_by_fb, inbox_by_name, inbox_any_page = {}, {}, {}
inbox_conv_by_fb, inbox_conv_by_name, inbox_conv_any = {}, {}, {}
for c in d:
    if c.get('type')!='INBOX': continue
    ts=_sale_reply_times(c)
    if not ts: continue
    pid=str(c.get('page_id') or '')
    fb=str(c.get('fb_id') or '') or (c['conv_id'].split('_',1)[1] if '_' in c['conv_id'] else '')
    if fb:
        inbox_by_fb.setdefault((pid,fb),[]).extend(ts)
        inbox_conv_by_fb.setdefault((pid,fb),c)
    nm=(c.get('customer') or '').strip().lower()
    if nm:
        inbox_by_name.setdefault((pid,nm),[]).extend(ts)
        inbox_any_page.setdefault(nm,[]).extend(ts)
        inbox_conv_by_name.setdefault((pid,nm),c)
        inbox_conv_any.setdefault(nm,c)

def answered_in_inbox(c, after_at):
    # Khách của hội thoại `c` có được sale trả lời trong INBOX kể từ mốc `after_at` không.
    # Trả về conv INBOX thật đã khớp (để ghép full_thread), hoặc None nếu không tìm thấy.
    pid=str(c.get('page_id') or '')
    fb=str(c.get('fb_id') or '')
    nm=(c.get('customer') or '').strip().lower()
    for ts,conv in [(inbox_by_fb.get((pid,fb)),inbox_conv_by_fb.get((pid,fb))),
                    (inbox_by_name.get((pid,nm)),inbox_conv_by_name.get((pid,nm)))]:
        if ts and any(t>=after_at for t in ts): return conv
    # Cùng thương hiệu nhưng KHÁC page: 1 brand có nhiều fanpage (VD "Đồ Thờ Nhập Khẩu Chánh Tâm"
    # và "Chánh Tâm - Không Gian Tâm Linh"), khách bình luận page này lại được rep inbox page kia.
    # Chỉ khớp theo tên + trong vòng 6 GIỜ để không vơ nhầm người trùng tên ở thời điểm khác.
    ts = inbox_any_page.get(nm)
    if ts:
        lim = _plus_hours(after_at, 6)
        if any(after_at <= t <= lim for t in ts): return inbox_conv_any.get(nm)
    return None


WHO_LABEL = {'cust': 'Khách', 'auto': 'Bot', 'sale': None}  # sale dùng luôn tên nhân sự nếu có
def _fmt_line(m):
    ts = (m['at'] or '')[:16].replace('T', ' ')
    who = WHO_LABEL.get(m['_k'])
    if who is None:
        who = f"Sale ({m['admin']})" if m.get('admin') else 'Sale'
    txt = clean(m['text']) or ('(gửi ảnh/tệp)' if m.get('has_attach') else '')
    return f"[{ts}] {who}: {txt}"

def build_thread(*convs):
    """Ghép nguyên đoạn hội thoại từ 1 hoặc nhiều conv (VD bình luận + tin nhắn), sắp theo thời gian thật."""
    lines = []
    for c in convs:
        if not c: continue
        msgs = [m for m in c['messages'] if clean(m['text']) or m.get('has_attach')]
        for m in msgs:
            m['_k'] = kind(m)
        lines.extend(msgs)
    lines.sort(key=lambda m: m['at'] or '')
    return '\n'.join(_fmt_line(m) for m in lines)[:4000]

pairs=[]
for c in d:
    msgs=[m for m in c['messages'] if clean(m['text']) or m.get('has_attach')]
    for m in msgs: m['_k']=kind(m)
    real=[m for m in msgs if m['_k']!='auto']
    turns=[]
    for m in real:
        if turns and turns[-1]['side']==m['_k']: turns[-1]['msgs'].append(m)
        else: turns.append({'side':m['_k'],'msgs':[m]})
    for i,t in enumerate(turns):
        if t['side']!='cust': continue
        ask=' '.join([x for x in (clean(m['text']) for m in t['msgs']) if x]).strip()
        first_at=t['msgs'][0]['at']; last_at=t['msgs'][-1]['at']
        if not (FROM <= first_at[:10] <= TO): continue
        if len(ask)<=8 or not INTENT.search(ask): continue
        nxt = turns[i+1] if i+1<len(turns) else None   # lượt kế tiếp chắc chắn là 'sale' (đã bỏ auto)
        reply=None; sale=None
        if nxt and nxt['side']=='sale':
            txts=[clean(m['text']) for m in nxt['msgs']]
            reply=' | '.join([x for x in txts if x]).strip() or None
            if not reply and any(m.get('has_attach') for m in nxt['msgs']): reply='(gửi ảnh/tệp)'
            for m in nxt['msgs']:
                if m['admin']: sale=m['admin']; break
        # có bot/hệ thống trả lời sau lượt này không?
        bot_after=any(m['_k']=='auto' and m['at']>last_at for m in msgs)
        # Bình luận chưa ai rep TẠI CHỖ nhưng khách đã được sale tư vấn trong inbox → KHÔNG tính lỗi
        inbox_conv = (None if reply or c.get('type')!='COMMENT' else answered_in_inbox(c, last_at))
        in_inbox = inbox_conv is not None
        # Link mở thẳng hội thoại trên Pancake để đối chiếu chéo — pattern xác nhận thật (user cung cấp
        # 4/9/2026): https://pancake.vn/{page_id}?c_id={conv_id}. Ưu tiên trỏ tới conv INBOX khi bị chuyển
        # kênh (đó mới là nơi có câu trả lời thật), không thì trỏ conv gốc.
        link_conv = inbox_conv or c
        pancake_url = f"https://pancake.vn/{link_conv.get('page_id')}?c_id={link_conv.get('conv_id')}"
        pairs.append({
            'page':c['page_name'],'conv_id':c['conv_id'],'type':c['type'],
            'customer':c['customer'],'phone':c['phone'],
            'sale': sale or (c['assignees'][0] if c['assignees'] else None),
            'date':first_at[:10],'at':first_at,'ask':ask[:700],
            'reply':(reply[:1000] if reply else None),
            'bot_only': (not reply) and bot_after and not in_inbox,
            'answered_in_inbox': in_inbox,
            'thread': build_thread(c, inbox_conv),
            'url': pancake_url,
        })
json.dump(pairs, open(OUT,'w',encoding='utf-8'), ensure_ascii=False, indent=1)

from collections import Counter
print('tổng lượt:',len(pairs))
print('có sale trả lời:',sum(1 for p in pairs if p['reply']))
print('chỉ bot trả lời:',sum(1 for p in pairs if p['bot_only']))
print('bình luận → đã tư vấn trong inbox (KHÔNG tính lỗi):',sum(1 for p in pairs if p['answered_in_inbox']))
print('hoàn toàn không ai trả lời:',sum(1 for p in pairs if not p['reply'] and not p['bot_only'] and not p['answered_in_inbox']))
