# 10 — Development Roadmap (prioritas Critical → Low)

Berdasarkan audit (02/03/09), roadmap ini disusun untuk 3 trimestre ke depan dengan
prinsip: **nilai bisnis dulu, risiko rendah, tidak merusak architecture yang bagus**.

## 🔴 CRITICAL (bulan 1–2) — memperbaiki alur core & koneksi antar modul
1. **links: order → production → inventory → delivery**
   - `production_batches.order_id` FK + auto-create batch saat order confirmed (services/crm & orders)
   - production consume → auto insert `inventory_moves` (refModule="PRODUCTION") + lock FIFO stok
   - delivery task auto-create dari order aqiqahDate + push status DELIVERED ke orders
   - *Manfaat bisnis: mengurangi duplikasi input & kesalahan cloan.*
2. **Jurnal otomatis payroll/kasbon**
   - finalisasi payroll → journal POSTED (type PAYROLL) dari cash account; kasbon → journal on state DIBAYAR
3. **Attendance module restore** (beda alasan: module internal dihide saat audit; perlu diaktifkan kembali atau migrated).
4. **Deployment WAHA docker local 3015** (fase F0 rencana WA) + integrasi UI tes; BSI VA reconciliation test in production.
5. **Unit test minimal untuk services inti** (vitest) — createCustomer, quotation→order, payroll finalize, kpi-runner agar refactoring Aman.

## 🟡 HIGH (bulan 2–3) — menyelesaikan partial & menutup kebocoran proces
6. **Server-side pagination transaksi** (orders/quotations/invoices/payments/cash/receivables/payables) memakai DataTable (reuse).
7. **FIFO & HPP otomatis** (inventory engine); HPP journal auto (account 5-1410).
8. **Suppliers & pembelian hewan module** (schema ada).
9. **POD pengiriman (foto & ttd)** + live tracking link share pelanggan.
10. **Animals (kambing/domba) herd & kelola kandang** — canibalization module ops.
11. **Laporan BI** (trend sales/pembersihan laporan/dept scorecard ties) + dashboard recharts tambahan per dept.
12. **Branch scoping di seluruh reports** (multi-branch consolidated).

## 🟢 MEDIUM (bulan 3–4) — quality-of-life & profit drivers
13. Company complaints / feedback UI (customer_complaints) + followup workflow.
14. Vouchers & promo engine (vouchers tables) + marketing_spends attribution report.
15. Wizards untuk intake kustomer (2 langkah), plus order wizard (reuse).
16. WA panel UI: broadcast list (Cloud API), auto-reminder pesanan j-3, sapaan hari-H, ucapan terima kasih post-completion.
17. ZISWAF distribution report official + audit.
18. Search menu global (Cmd+K) + role dashboards yang ringkas.
19. Financial consolidation: closing period, laba kumulatif tie-out UI.

## ⚪ LOW (backlog)
20. PWA/offline & dark-mode.
21. Multi-language (id/upcoming).
22. Delivery driver mobile app (or PWA) & route optimizing.
23. Integration 3rd party (e-commerce marketplaces, Google Sheets export automation).
24. AI: intake email → order draft — optional.

## Sync dengan audit lain
- `02-module-inventory.md` — status per module
- `03-feature-inventory.md` — status per fitur
- `09-gap-analysis.md` — basis rincian gap yang mapping ke items di sini
