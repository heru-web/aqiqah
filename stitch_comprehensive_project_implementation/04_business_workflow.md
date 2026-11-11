# 04 — Business Workflow: dari calon pelanggan sampai pesanan selesai

Berdasark implementasi aktual (file-route/table sebagai bukti).

## 1. Sales Cycle (hanya penjualan)

```
Calon masuk
  (IG/Referal/Afiliate/Agen/WA Blast/Meta Ads)  →  sumber dipenuhi di lead intake
        ↓
CRM / Prospek (papan 6 tahap: Lead Baru → Dihubungi → Tertarik → Penawaran → DP → CLOSED)
  - buat deal, isi nama anak, WA, alamat, paket interest (?productInterest)
  - WA otomatis sapaan saat deal baru (DEAL_CREATED), & saat tahap berubah (STAGE_CHANGED)
        ↓
Tindak lanjut (crm_activities) → alarm FOLLOWUP_TERLAMBAT jika lewat due date & belum selesai
        ↓
Quotations (QTN) → kirim penawaran; SETUJU → jadi pesanan
        ↓
Orders (ORD) — shohibul, anak, TTL → aqiqahDate + jadwal pengiriman: 11 status (ORDER_CONFIRMED → SLAUGHTERED → KITCHEN_COOKED → PACKED → QC_READY → READY_DISPATCH → DELIVERED → COMPLETED)
  - tagihan dibuat otomatis (INV: PARTIAL/PAID)
  - ledgers: REVENUE via journal_lines (auto)
        ↓
Payments (Transfer/VA/QRIS) → sifat posting + reconciliationStatus untuk BSI VA webhook
        ↓
LAPORAN: Laba Rugi / Neraca / Arus Kas / Buku besar dari journals POSTED.
```

## 2. Production & Delivery (operasional) — SAAT INI (breakpoints ditemukan!)

```
Order ORDER_CONFIRMED
        ↓ [⚠ MANUAL]
Production batches dibuat manual di /production (nama item + qty)
  - tahap RPH (sembelih) → Potong → Masak → Packing → QC (PASS/FAIL) → Siap
  - belum: order_id link auto, tanda auto stok use, foto QC
        ↓ [⚠ MANUAL]
Inventory: kartu stok via moves; item min stok alarm STOK_MINIM
  - belum: FIFO, HPP kalkulasi from BATCH lines
        ↓ [⚠ MANUAL]
Delivery /delivery — jadwal kurir manual; status WAITING → IN_TRANSIT → ARRIVED/GAGAL
  (order.deliveryDate = acuan); belum: POD foto upload (delivery_pods siap di schema)
        ↓
Order set DELIVERED → COMPLETED manual.
```
**Tembukan alur putus (gap besar):**
1. Jalur order → batch produksi tidak automatis (perlu cart mapper & inventory item map).
2. Notifikasi WAHA user order utk cust saat lewat tahap (kode orderStatus ada)
3. Stock out per order item not wired to production batch yet.

## 3. HR cycle
```
Employees (import/manual) → Attendance (hidden untuk publik; HR/ops isi) → Payroll
  - run finalisasi terkunci
  - Kasbon alur: Ajukan → Disetujui → Dibayar/Batalkan
Alarm: SCORECARD_BELUM_ISI (dept), ABSENSI_BELUM_LAPOR (giliran abort — owner keputusan)
```
**Gap:** jurnal PAYROLL type ada tapi tak dijalankan saat finalisasi; potongan otomatis dari absensi belum.

## 4. Keuangan cycle
```
Journal type otomatis dari sales/pengeluaran (journals POSTED)
  → ledger posting (debit/credit)
  → closes AR/AP update (receivables/payables)
  → reports & cash flow
BSI VA webhook → auto reconciliation payments
```
**Gap:** closing period, budget, laba bersih vs ekuitas tie-out coach, subschema penyusutan? belum.

## 5. KPI schedule
```
Dept scorecard harian (target & actual per indikator)
  kpi_runner (nightly cron /api/jobs/kpi via KPI_JOB_SECRET)
  → kpi_actuals auto dari formula
  → weekly/monthly review, laporan per unit/dept
Alarm SCORECARD_TAK_TERCAPAI (actual < target dengan direction)
```

## 6. CRM alarm & panel
```
CRON per menit /api/jobs/wa-alerts (Authorization WA_ALARM_SECRET)
  → per rule enabled, compare waktu (WIB)
  → in-app notification lonceng panel (bukan WA lagi) untuk peran target
  → log wa_alerts_log
```

## 7. WA Gateway cycle
```
Pelanggan ditambah (form aqiqah lengkap) → tombol "Kirim WA Konfirmasi"
  → template "Alhamdulillah Barakallah" (ayat permintaan data + BSI, DP, consent)
  → provider Fonnte / Cloud API resmi / WAHA local
  → log crm_activities & export WAHA status
Provider & API key aktif mengelola melalui /settings/whatsapp + WA Gateway (multi key tersimpan di wa_api_keys).
```
