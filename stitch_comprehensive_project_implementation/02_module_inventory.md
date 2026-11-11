# 02 — Module Inventory: Daftar Seluruh Modul ERP Aqiqah

Semua entri verikasi: route direktori aktual + tabel DB + halaman yang DioOutput → langsung file-route mungkin.

## Daftar modul

| # | Modul | Tujuan bisnis | Route kamu | Tabel inti | Status |
|---|---|---|---|---|---|
| 1 | **Dashboard** | Beranda & ringkasan | /(app)/dashboard | (agg) | ✅ Implemented |
| 2 | **CRM** — kanban, deals, kontak, aktivitas | Calon pelanggan, follow-up t蓝色 | /(app)/crm, /crm/contacts (+detail org/person), /crm/activities, /crm/pengaturan, /crm/deals/[id], /crm/[id] | crm_pipelines, crm_stages, crm_deals, crm_people, crm_organizations, crm_activities, crm_notes, crm_stage_history, lead_followups, leads | ✅ Implemented |
| 3 | **Customers (Pelanggan)** | Data induk pembeli `CST-…`, form aqiqah "Alhamdulillah Barakallah", WA konfirmasi, export/import | /(app)/customers | customers, customer_communications, customer_complaints | ✅ Implemented |
| 4 | **Quotations (Penawaran)** | Jasa aqiqah + komposisi item | /(app)/quotations | quotations, quotation_items | ✅ Implemented |
| 5 | **Orders (Pesanan)** | Pesanan inti; RFP → produksi/pengiriman | /(app)/orders, /orders/new, /orders/[id] | orders, order_items, order_status_logs | ✅ Implemented |
| 6 | **Invoices (Tagihan)** | Tagihan auto dari orders | /(app)/invoices | invoices, invoice_items | ✅ Implemented |
| 7 | **Payments (Pembayaran)** | Konfirmasi pembayaran (Transfer/VA/QRIS) | /(app)/payments | payments | ✅ Implemented |
| 8 | **Production (Produksi)** | Batch produksi tahap RPH→…→Siap + QC | /(app)/production | production_batches | ⚠️ Partial (MVP, belum terhubung order/inventory otomatis) |
| 9 | **Inventory (Inventaris)** | Item + kartu stok | /(app)/inventory | inventory_items, inventory_moves, animals, suppliers | ⚠️ Partial (MVP; FIFO/HPP belum) |
| 10 | **Delivery (Pengiriman)** | Jadwal antar & status kurir | /(app)/delivery | delivery_tasks, deliveries, delivery_pods | ⚠️ Partial (MVP) |
| 11 | **Karyawan** | Data karyawan & gaji dasar, import | /(app)/karyawan | employees | ✅ Implemented |
| 12 | **Attendance** | Absensi harian | /(app)/attendance (hidden; redirect /dashboard) | attendance_records | ⚠️ Partial — model di-hide permintaan owner |
| 13 | **Payroll (Penggajian)** | Periode payroll karyawan aktif, finalisasi | /(app)/payroll | payroll_runs, payroll_lines | ✅ Implemented (jurnal → COA belum otomatis) |
| 14 | **Kasbon** | Pinjaman karyawan | /(app)/kasbon | kasbons | ✅ Implemented |
| 15 | **Kinerja (Performance/KPI)** | Scorecard harian, review mingguan/bulanan, KPI, target | /(app)/kinerja… (9 halaman) | kpi_indicators, kpi_targets, kpi_actuals, daily_scorecards/lines, monthly_reviews(+lines), weekly_reviews, sop_checks, sops, coaching_notes, corrective_actions, rewards, employee_performances | ✅ Implemented |
| 16 | **Data Induk** | Unit usaha, departemen, jabatan, saluran | /(app)/data-induk/… ×4 | business_units, departments, positions, sales_channels | ✅ Implemented |
| 17 | **Cash & Bank** | Rekening & saldo | /(app)/cash | cash_accounts | ✅ Implemented |
| 18 | **Receivables / Payables** | Piutang & hutang usaha | /(app)/receivables, /(app)/payables | receivables (payables do jasat suppliers/orders) | ✅ Implemented |
| 19 | **Accounting (Jurnal) + COA (Bagan Akun)** | Jurnal general & COA | /(app)/accounting, /(app)/coa | journals, journal_lines, accounts | ✅ Implemented |
| 20 | **Reports (Laporan)** | Laba rugi, neraca, arus kas, buku besar | /(app)/reports | (agg dari journals/accounts) | ✅ Implemented (arus kas basis relevan kas 1-11xx) |
| 21 | **ZISWAF** | Zakat/Infak/Sedekah/Wakaf | /(app)/ziswaf | ziswaf_entries | ✅ Implemented |
| 22 | **Audit Log** | Jejak perubahan | /(app)/audit | audit_logs | ✅ Implemented |
| 23 | **User mgmt / Roles / Branches / Settings** | Sistem | /(app)/users,roles,branches,settings(+whatsapp),[module] | users, roles, role_permissions, user_roles, branches, app_settings | ✅ Implemented |
| 24 | **Alarm Notifikasi (modul)** | Alarm 5 jenis → lonceng panel | /(app)/alarm | wa_alert_rules, wa_alerts_log | ✅ Implemented (cron /api/jobs/wa-alerts) |
| 25 | **WhatsApp Gateway & API keys** | Multi-provider Fonnte / Cloud API / WAHA | /(app)/settings/whatsapp | app_settings (keys), wa_api_keys | ✅ Implemented (WAHA service belum ada di VPS) |
| 26 | **Dokumentasi** | /docs (panduan+ diag./tutorial/…) | /(app)/docs, /docs/[slug] | docs/*.md | ✅ Implemented |
| 27 | **Landing Publik "/"** | WA/FB scraper friendly | src/app/page.tsx | — | ✅ Implemented |

## Submodul & Peta fitur (ringkas)

- **CRM**: Kanban 6 tahap draggable; Deals detail; Kontak People/Organizations (import/export); Aktivitas; Pengaturan pipeline & stages.
- **Customers**: Pilih-baris + hapus masal; Export Excel/PDF; Import Excel (template); form aqiqah 9 kolom (ayah, ibu, TTL, paket, jadwal, sharing consent); **Kirim WA konfirmasi** per baris (Fonnte/Cloud/WAHA).
- **Performance**: 9 halaman kavط 5 pengaturan + laporan; aktifasi harian (scorecard) & review mingguan/bulanan; integrasi kpi_actuals job.
- **Alarm**: 5 jenis aturan (laporan belum digerja/target/followup/stok/absensi), target peran, cron per menit.
- **WA Gateway**: provider multi (Fonnte/Cloud/WAHA), API keys manager (tabel `wa_api_keys`), kirim WA konfirmasi, auto WA deal, API keys Aktivasi.

## Unknown / to confirm
- `suppliers`, `animals`, `vouchers`, `price_versions`, `webhook_events`, `order_items` — schema ada;
  beberapa UI belum menampilkan (dilaporkan OCR 0 di 03-feature-inventory).
