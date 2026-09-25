// EDGE FUNCTION "dang-nhap": đăng nhập app -> cấp THẺ PHIÊN (JWT của Supabase Auth) cho người dùng.
// VÌ SAO (24/9/2026): trước đây app nói chuyện với CSDL bằng khoá công khai (nằm trong index.html), nên luật
// CSDL phải mở cho khoá đó -> ai cầm khoá cũng đọc/ghi/xoá được. Có thẻ phiên thì CSDL chỉ mở cho người
// đã đăng nhập, khoá công khai một mình không làm được gì.
//
// Luồng:
//   1) Kiểm tên + mật khẩu bằng hàm app_login() có sẵn (mật khẩu vẫn nằm ở sales_user_credentials, KHÔNG đổi).
//   2) Mỗi tài khoản app có 1 tài khoản Supabase Auth "bóng" (email <user_id>@mkt-sale.app, không ai dùng tay).
//      Mỗi lần đăng nhập đặt cho nó 1 mật khẩu ngẫu nhiên mới rồi đăng nhập ngay -> lấy thẻ phiên.
//      Người dùng không bao giờ biết mật khẩu bóng này, nên không có đường nào vào thẳng Supabase Auth.
//   3) Trả về thông tin tài khoản (như app_login cũ) + thẻ phiên. Vị trí / quyền được ghi vào app_metadata
//      của thẻ để CSDL tự kiểm (vd chỉ Admin mới tạo được tài khoản) -- người dùng không sửa được app_metadata.
// Monsieur Claude
import { createClient } from 'jsr:@supabase/supabase-js@2';

const URL = Deno.env.get('SUPABASE_URL') ?? '';
const SRV = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const ngu = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ngauNhien = () => {
  const a = new Uint8Array(24); crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Chỉ nhận POST' }, 405);
  if (!URL || !SRV || !ANON) return json({ error: 'Thiếu cấu hình máy chủ' }, 500);

  const { username = '', password = '' } = await req.json().catch(() => ({}));
  const u = String(username).trim().toLowerCase(), p = String(password);
  if (!u || !p) return json({ error: 'Thiếu tên đăng nhập hoặc mật khẩu' }, 400);

  const admin = createClient(URL, SRV, { auth: { persistSession: false, autoRefreshToken: false } });

  // 1) kiểm mật khẩu bằng đúng hàm cũ
  const { data: acc, error: e1 } = await admin.rpc('app_login', { p_username: u, p_password: p });
  if (e1) return json({ error: 'Lỗi kiểm tra đăng nhập' }, 500);
  if (!acc) { await ngu(700); return json({ error: 'Sai tên đăng nhập hoặc mật khẩu' }, 401); } // chậm lại để chống dò mật khẩu

  // 2) tài khoản bóng bên Supabase Auth
  const email = String(acc.user_id).toLowerCase().replace(/[^a-z0-9_.-]/g, '') + '@mkt-sale.app';
  const matKhauBong = ngauNhien();
  const meta = {
    app_user_id: acc.user_id, username: acc.username, name: acc.name,
    position: acc.position_title || 'sales', permissions: acc.permissions || [],
  };
  let authId = acc.auth_uid as string | undefined;
  if (!authId) {
    const { data: tao, error: e2 } = await admin.auth.admin.createUser({
      email, password: matKhauBong, email_confirm: true, app_metadata: meta,
    });
    if (tao?.user) authId = tao.user.id;
    else {
      // đã có từ lần trước (vd cột auth_uid chưa ghi kịp) -> tìm lại theo email
      const { data: ds } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      authId = ds?.users?.find((x) => x.email === email)?.id;
      if (!authId) return json({ error: 'Không tạo được phiên: ' + (e2?.message || '') }, 500);
    }
    await admin.from('sales_users').update({ auth_uid: authId }).eq('user_id', acc.user_id);
  }
  const { error: e3 } = await admin.auth.admin.updateUserById(authId, { password: matKhauBong, app_metadata: meta });
  if (e3) return json({ error: 'Không cập nhật được phiên: ' + e3.message }, 500);

  // 3) đăng nhập tài khoản bóng -> thẻ phiên
  const pub = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: s, error: e4 } = await pub.auth.signInWithPassword({ email, password: matKhauBong });
  if (e4 || !s?.session) return json({ error: 'Không cấp được thẻ phiên: ' + (e4?.message || '') }, 500);

  const { auth_uid: _bo, ...taiKhoan } = acc;
  return json({
    account: taiKhoan,
    session: {
      access_token: s.session.access_token,
      refresh_token: s.session.refresh_token,
      expires_at: s.session.expires_at,
    },
  });
});
