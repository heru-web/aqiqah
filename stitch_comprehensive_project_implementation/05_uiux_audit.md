# 05 — UI/UX Audit seluruh halaman (54 halaman + 1 landing + login)

Paling kentara temuan dikelompokkan: consistency, usability, mobile, states. Tidak mengubah kode.

## KEBERHASILAN (bagus, jangan dirusak)
1. **Pola tabel tunggal** — semua table utama memakai DataTable (pencarian + checkbox + bulk + export strip + pagination) — model produk kuat (lihat `data-table.tsx`).
2. **Strip aksi konsisten** — kiri bar jumlah & kanan pill Excel/PDF di frame tabel (menegakkan aturan UX diterapkan pas 2026-11-05).
3. **Breadcrumb & Aditive Dashboard** (in-app gel custom) four招待牢固, Warna tema hijau waking; radar & kanban board catatan.
4. **Notification bell** universal & tanpa bunyi; banner rendering konsisten; timestamp IDR.
5. **Responsivitas mobile** dari CR kanban & bottom-nav (sesuai fase 2026-11-05) checkpoint `380px` lulus visual.
6. **Excel/PDF export semua table** dengan konsistens pill; CSV import template panduan.
7. **Search & pagination** di master data; di transaksi melalui paginasi server-side一件事.

## TEMUAN **CRITICAL** UX
| # | Area | Masalah | Dampak pengguna | Rekomendasi |
|---|---|---|---|---|
| U1 | Transaksi (orders/quotations/invoices/payments/cash) | list via `<Table>` server, no pagination; export max 1000 baris | Halaman berat di jutaan baris; timer | Migrasi ke DataTable + server-side pagination (sudah ada infra) |
| U2 | Order detail /new | Form panjang; field aqiqah serupa dengan intake customers → duplikasi input | Data masuk 2× manual | Buat reuse: saheb intake form → pembuatan order/kustomer |
| U3 | Landing "/" me-labeled "Masuk ke Aplikasi" | Belum ada CTA kedua (Kalender/market promo) | Kurang convincing share preview | Tambah CTA "Blog WA Moja" jika perlu |
| U4 | Alarm rules — "Kirim Tes ke Saya" & logic per component | User tidak tahu "tes" vs "production" | Taxi | Add badge "test-only (sãrkirim ke kamu)" |
| U5 | Route `/attendance` hidden tapi URL live (redirect) | Lainnya dapat lupa; masih dalam nav 404 sulit | Kefahaman buruk | Buat toast kecil di karyawan "fitur absensi dihide" |
| U6 | WA Gateway page — several submit buttons (Simpan, Tambah Key, Pakai) | Kurang hierarchy visually | Kesalahan klik | Group & separate color consistently |

## TEMUAN **HIGH** UX
| # | Area | Masalah | Rekomendasi |
|---|---|---|---|
| U7 | Form Pelanggan Baru | 16 kolom panjang (scroll tinggi) | Wizard 2 langkah (Identitas → Aqiqah) atau as tabs |
| U8 | Laba Rugi & Neraca — Tabel baris | Belum tree/graphs, kosakata akuntansi | Tambah drill-down per COA + export schedule |
| U9 | Sidebar terlalu lengkap untuk admin (20+ item) | Cari menu sulit | Tambah quick-search Cmd+K |
| U10 | Bukti design systems — badge colors samting | inconsistent brand colors in some tables | Design tokens uniformity |
| U11 | Dialogs overflow kecil di mobile | scroll inland conflict with bottom nav | increase bottom padding layerDialog |
| U12 | WA share preview shows /login title | treat public "/" cukup; masih WA cache | provide stable og:image — WA scrape cache clears timely |

## TEMUAN **MEDIUM/LOW** UX
| Area | Catatan |
|---|---|
| Filters | Filter chip "status" di beberapa halaman paging server-side persetumpaman |
| Table sort | belum ada sorting client side di beberapa table (clue: column header) |
| Accessiblity | aria-label sebagian besar ok; tabel role, focus ring cukup |
| Loading | suspense border? mostly not (fast) |
| Error states | sonner toasts & inline error (baik) |
| i18n | full Indonesian; tak ada bug bahasa campur aduk penting |
| Mobile/tablet | prosperous (bottom-nav + swipe CR) tapi beberapa form dialog spective largeness |

## Konsistensi desain (pola/skema yang diverifikasi)
- Card: `rounded-xl border border-line-warm bg-surface` — semua page.
- Strip aksi: `flex justify-between … px-3 py-2.5 bg-surface/60`, Colors `bg-warning` (kuning) perlu review.
- Table style: dark header (table-head), zebra stripe, row hover — jurnal-master & service-page sama.
- Icon set: lucide-react (`lucide-react@^1.42.0`) konsisten.
- Font: font-display untuk judul, body text default — dark-mode biru? (hanya garis warna).

## Hal yang menyebabkan pengguna operasional (peran lapangan) tersulit
- Pelanggan detail — perlu lin ringkas card pour phone call & WhatsApp direct links.
- Status order di card production batch — masih tulisan kode (namingTYPES muncul indonesian berbahsa Ind).
- WA Gateway gesekan besar untuk operator (key masalan ditampilkan).
