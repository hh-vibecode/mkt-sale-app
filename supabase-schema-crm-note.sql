-- GHI CHÚ HỌP Ở CRM (anh Hải 02/10/2026): nút sổ note cạnh bong bóng chat. Có ghi chú chưa clear = nút đỏ (việc giao
-- trong buổi họp), Sale xử xong bấm Clear -> nút trắng lại, ghi chú cũ vẫn giữ làm lịch sử (cleared_at / cleared_by).
-- Dùng chung Lẻ + Sỉ (cột loai), gắn khách theo lead_id như salesi_crm. Bảng của MKT / Sale.
create table if not exists public.salesi_crm_note (
  id            bigserial primary key,
  loai          text,                       -- 'Lẻ' / 'Sỉ'
  lead_id       text not null,
  customer_name text,
  noi_dung      text not null,
  created_by    text,
  created_at    timestamptz not null default now(),
  cleared_at    timestamptz,                -- null = đang mở (nút đỏ)
  cleared_by    text
);
create index if not exists salesi_crm_note_lead_idx on public.salesi_crm_note (lead_id);
alter table public.salesi_crm_note enable row level security;
drop policy if exists salesi_crm_note_read on public.salesi_crm_note;
drop policy if exists salesi_crm_note_ins on public.salesi_crm_note;
drop policy if exists salesi_crm_note_upd on public.salesi_crm_note;
create policy salesi_crm_note_read on public.salesi_crm_note for select to authenticated using (true);
create policy salesi_crm_note_ins on public.salesi_crm_note for insert to authenticated with check (true);
create policy salesi_crm_note_upd on public.salesi_crm_note for update to authenticated using (true) with check (true);
-- không cho xoá: ghi chú đã clear vẫn phải còn để tra lại
