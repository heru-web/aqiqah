# 01 — Executive Summary: Audit ERP Aqiqah (app.madaniaqiqah.com)

Tanggal audit: 2026-11-06 · Metode: inspeksi kode aktual + route sweep HTTP + uji runtime CDP + query database.
Lingkup: /srv/madani-aqiqah-v3 (Next.js 16 full-stack, postgreSQL, system service systemd).

## Ringkasan satu paragraf

Aplikasi adalah ERP aqiqah full-stack yang **berjalan di produksi** pada
https://app.madaniaqiqah.com dengan **55 halaman** yang diaudit, **6 peran**, **82 tabel database**,
**8 endpoint API**, dan **20+ menu nyata** (CRM, penjualan, operasional, HR, keuangan, alarm).
Dari timeline pengembangan Nov 2025–Nov 2026: modul hibah awal yang masih placeholder
(reports/production/inventory/delivery/payroll/kasbon/ziswaf) **semuanya kini submodule fungsional**.
Kelemahan utamanya: produksi/pengiriman/inventaris masih versi MVP tanpa FIFO/HPP otomatis,
proses operational production/order/stock belum terintegrasi penuh (kalkulasi manual), dan
tidak ada unit test nyata untuk lapisan bisnis.

## Statistik Utama

| Metrik | Angka |
|---|---|
| Modul ERP fungsional | **20** (lihat 02-module-inventory) |
| Sub-modul / halaman x | 55 halaman `(app)` + login + landing |
| API endpoints (route.ts) | 8 (customers export/import ×2, contacts import, HR import, jobs/kpi, jobs/wa-alerts, webhooks/bsi-va, whatsapp/qr) |
| Tabel database (all) | 82 tabel relasional + 1 drizzle migrations |
| Role (aktif di DB) | 6 (superadmin, sales, ops, acct, hr, marketing) |
| Fitur IMPLEMENTED | ±58 |
| PARTIAL | 11 |
| UI ONLY | 2 |
| BACKEND ONLY | 1 |
| BROKEN | 1 (halaman attendance internal dihide di UI tapi backend aktif) |
| MISSING | 7 (hutan d; LPO pembelian hewan; FIFO; HPP retroaktif; dsb) |

## Kondisi Keuangan & Operasional

- **Semua akses harus login**; halaman publik hanya landing root & login; susunan menu berbasis peran.
- Dashboard menampilkan KPI; produk **dashboard-style** bersih.
- Beberapa tipe **data demo** (prefix "demo", label demo) menunggu dibersihkan oleh owner via `/settings` (data demo menu).
- Notification panel (lonceng) hidup dengan alarm 5-jenis; WhatsApp Gateway (Fonnte / Cloud API / WAHA) siap dipakai.
- WAHA belum di-install di VPS — status WAHA (`reachable: true`, `ready: false`) menunggu docker service.

## Highlight Temuan

### Teknis utama (dari temuan terdalam)
1. Perubahan tipe/pencarian di halaman transaksi (orders/quotations/invoices/payments/cash) masih
   memakai `<Table>` server-side tanpa pagination per halaman (butuh capacity, langsung penuh di data ≥ 1 ribu baris).
2. Integrasi Gateways WAHA no mocking — live buttonTES KIRIM akan gagal bila docker tidak dijalankan.
3. Laporan Keuangan arus kas adalah VARJUAL (variasi per kas, bukan alur klasik operasi-investasi).

### UX utama
1. Sidebar belump membantu mencari menu (masih scroll) — manfaat lebih besar bilamana add-to-search.
2. Warna/hierarki table #1 harus sisa konsist: beberapa Kartu judul beda Style — ditemukan di perbaikan yang ada.
3. Rapat AI: module harus LAPORAN akan lives di **page /reports**, menampilkan grafik chart — masih Tabel.

## Roadmap ke depan bukan layanan baru
Roadmap Critical → Low dikumpulkan di `10-development-roadmap.md`.
Ưu tiên tertinggi (Critical): laporan Neraca/AK dr jurnal, intergrasi gateways WAHA operate production,
integrasi `orders → inventory → delivery` dan kalkulasi HPP otomatis.

## Status menu yang sudah dibersihkan

File `00-status.md` telah disandingkan di folder ini:
- Attendance module di-hide dari nav (redirect).
- getWaAlerts dititipkan, dihapus dari alarm UI (rules skip absensi).
- Media logo di-upload sebagai favicon, og:image; WA share thumbnail (logo perusahaan) jalan.
