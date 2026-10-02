# Quy ước dùng chung 1 project Supabase cho nhiều app

Áp dụng cho MỌI app / luồng của anh Hải dùng chung project Supabase `bcrpxfvvjsjpvbksqzls` (org hh-vibecode, gói Pro,
máy chủ Micro). Mục tiêu: nhiều app dùng chung dữ liệu (khách, đơn, Sale, đăng nhập) mà app này không làm hỏng app kia.
Bản gốc nằm ở repo `hh-vibecode/mkt-sale-app` — app nào cũng đọc bản này; sửa quy ước thì sửa ở đây + báo anh.
Soạn 29/9/2026 bởi Monsieur Claude.

## 1. Sổ đăng ký app (mở app mới thì THÊM 1 DÒNG vào đây trước khi tạo bất cứ thứ gì)

| App | Repo | Tiền tố | Ghi chú |
|---|---|---|---|
| MKT / Sale | hh-vibecode/mkt-sale-app | *(không tiền tố — các bảng có từ trước)* | Chủ các bảng lõi ở mục 2 |
| QC CSKH | hh-vibecode/qc-cskh | `qc_` / `qc-` | Chủ `sale_response_review`, `sale_review_report` và mọi thứ `qc_*` |
| Kế toán (tài chính) | hh-vibecode/ke-toan | `kt_` / `kt-` | Đăng ký 1/10/2026. Vào app bằng mã truy cập riêng (như QC), không dùng `dang-nhap` |
| Dashboard-Meta (cũ) | hh-vibecode/Dashboard-Meta | — | CHỈ ĐỌC, không sửa repo đó |
| *(app mới)* | … | `xx_` / `xx-` | tiền tố 2–4 chữ, không trùng |

## 2. Ai sở hữu bảng nào

- **MKT / Sale (lõi, nhiều app đọc):** `datahub_orders`, `datahub_manual`, `saleretail_manual`, `salesi_crm`, `salesi_crm_note`, `kiot_orders`,
  `kiot_invoices`, `kiot_customers`, `kiot_don_giu_tinh`, `mkt_spend`, `danh_muc`, `sale_nhan_su`, `pancake_tu_tao_don`, `job_moc`,
  `activity_log`, `sync_log`, `datahub_sync_log`, `backup_snapshots`.
- **Tài khoản & đăng nhập (dùng chung, MKT / Sale giữ):** `sales_users`, `sales_user_credentials`, Edge Function `dang-nhap`,
  hàm `la_quan_tri()`, `app_*` (tạo / sửa tài khoản).
- **QC CSKH:** `sale_response_review`, `sale_review_report`, `qc_*` (bảng, hàm, lịch chạy).
- **Kế toán:** mọi thứ `kt_*` / `kt-*`.
- **Dashboard-Meta cũ:** `product_faq`, `faq_feedback`, `faq_chat_usage`, `dash_presence`, `social_page_stats`.
- **Bảng CŨ giữ có chủ đích — không xoá, không sửa:** `customers`, `leads`, `orders`, `crm_activities`, `assignments`,
  `config_options`, `audit_log`, `issue_handled`, `saonl_*`, view `v_saleretail_*` (còn dữ liệu lịch sử thật).

## 3. Luật chính

1. **Đặt tên theo tiền tố của app** cho MỌI thứ app tạo: bảng, view, hàm, lịch pg_cron, Edge Function, secret trong Vault,
   khoá trong `job_moc`, workflow GitHub. Vd app kho `kho_ton`, `kho_nhap_lo()`, cron `kho-dong-bo-2h`.
   App lớn có thể dùng schema riêng thay tiền tố — phải thêm schema vào *Settings → Data API → Exposed schemas* và báo anh.
2. **Chỉ app chủ được đổi cấu trúc và GHI** vào bảng của mình. App khác chỉ ĐỌC. Cần ghi sang bảng app khác thì app chủ
   làm 1 hàm (RPC) có kiểm tra, app kia gọi hàm đó — không ghi thẳng.
3. **Bảng dùng chung chỉ được THÊM** (thêm cột, thêm bảng, thêm hàm). Không đổi tên / xoá / đổi kiểu cột mà app khác đang đọc,
   không đổi RLS / trigger / hàm của app khác. Cần đổi thì báo anh để phiên của app chủ làm.
4. **Tuyệt đối không đụng:** khoá legacy (`anon`, `service_role`), JWT secret, cài đặt Auth (site URL, redirect — chỉ được THÊM
   domain của app mình vào danh sách redirect), Edge Function `dang-nhap`, `la_quan_tri()`, cấu trúc `sales_users`.
5. **Bảo mật bảng mới:** bật RLS; hàm `security definer` luôn `set search_path=public`, `revoke ... from public, anon` rồi chỉ
   `grant` đúng vai (`authenticated` hoặc `service_role`). Dữ liệu khách chỉ mở cho người đăng nhập.
6. **Đăng nhập dùng chung:** app mới gọi Edge Function `dang-nhap` (1 tài khoản dùng mọi app). Phân quyền theo app = THÊM mã
   quyền mới vào `sales_users.permissions` (vd `kho-xem`, `kho-sua`), không đổi cấu trúc.
7. **Khoá riêng cho mỗi app:** tạo secret key riêng (*Settings → API Keys → New secret key*, đặt tên theo app) để thu hồi riêng
   khi lộ và phân biệt lưu lượng. Token dùng chung (Pancake, Kiot, Meta) thay ở chỗ nào thì phải thay ở MỌI repo đang dùng.
8. **Mọi thay đổi CSDL lưu file** `supabase-schema-*.sql` trong repo của app làm thay đổi đó.
9. **Xoá / sửa hàng loạt** chỉ trên bảng của mình, chạy xem trước (KHO=1) và chụp sao lưu trước (`chup_backup()`).

## 4. Tài nguyên dùng chung (cả org chung 1 hạn mức)

Hạn mức Pro: egress 250 GB, log 20 GB, CSDL 8 GB / tháng; máy chủ Micro (2 nhân, 1 GB RAM) chung cho mọi app.
- Đọc bảng PHẢI phân trang (PostgREST tối đa 1000 dòng / lần) và chỉ chọn cột cần; không kéo lại cả bảng mỗi lượt —
  đọc phần mới (theo id / ngày lớn hơn mốc) hoặc chỉ chạy khi dữ liệu đổi (mẫu: `job_dau_van` + `scripts/lib/gianh-moc.js`).
- Ghi hàng loạt: gộp 1 lệnh (upsert mảng / RPC nhận mảng), `Prefer: return=minimal`. Không gọi 1 lệnh cho mỗi dòng.
- Job theo lịch: tránh trùng giờ nặng của app khác (bảng dưới), gặp 429 / 5xx thì nghỉ rồi thử lại, không chạy dồn.
- Gói tăng tiền theo máy chủ, không theo số app: app mới dùng chung project KHÔNG tốn thêm; tạo project riêng thì
  +~10 USD / tháng (tín dụng Pro chỉ đủ 1 máy Micro).

**Lịch chạy hiện có (giờ VN):**

| App | Việc | Giờ |
|---|---|---|
| MKT / Sale | Đồng bộ Pancake | mỗi 10 phút; quét toàn bộ 7h05 · 12h30 · 18h00 |
| MKT / Sale | Đồng bộ Kiot | 5,20,35,50 phút mỗi giờ; quét toàn bộ 7h20 |
| MKT / Sale | Tạo đơn từ hội thoại / Phân loại SP | 6h & 18h / 7h & 18h |
| MKT / Sale | Meta Ads · Chốt mốc số liệu · Sao lưu | 7h, 12h, 15h · 0h, 8h, 16h · 1h sáng |
| QC CSKH | `qc-keo-gio`, `qc-keo-6h` | xem repo qc-cskh |

## 5. Phối hợp giữa các phiên Claude

- Phiên của các app KHÔNG đọc được hội thoại của nhau. Việc gì ảnh hưởng app khác (thêm cột vào bảng dùng chung, đổi lịch,
  cần app chủ làm hàm) → ghi vào `VIEC.md` của app mình mục "Phụ thuộc chéo" + báo anh chuyển lời.
- Đổi quy ước dùng chung → sửa file này trong repo mkt-sale-app (qua anh) để mọi app cùng theo.

## 6. Checklist mở app mới

1. Chọn tiền tố, thêm dòng vào mục 1 (báo anh).
2. Repo riêng + GitHub Pages; `CLAUDE.md` + `VIEC.md` riêng; chép luật chung (giao diện, cách làm việc) từ repo mkt-sale-app.
3. Secret key Supabase riêng; secrets GitHub riêng; file khoá cục bộ `*.local.txt` (gitignore).
4. Đăng nhập qua `dang-nhap`; quyền mới thêm vào `permissions`.
5. Bảng / hàm / lịch chạy đặt đúng tiền tố, RLS bật, lưu `supabase-schema-*.sql`.
6. Đọc bảng lõi: phân trang, chọn cột, đọc phần mới. Ghi: chỉ bảng của mình.
