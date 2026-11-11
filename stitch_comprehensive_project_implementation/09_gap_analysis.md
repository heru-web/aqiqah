# 09 — Gap Analysis: kebutuhan bisnis Aqiqah vs implementasi saat ini

Basis: alur bisnis ideal perusahaan aqiqah/katering yang bisa dijalankan, dibandingkan dengan kondisi implementasi. "❔" = belum dikonfirmasi (UNKNOWN).

## 1. Sumber Pelanggan & Marketing
| Kebutuhan | Status | Gap |
|---|---|---|
| Intake calon dari semua sumber (IG/referral/afiliate/agen/WA blast/meta ads) | ✅ | — |
| Otomatis WA sapaan calon | ✅ (provider Fonnte/Cloud/WAHA) | WAHA belum di-docker |
| Pipeline visual & follow-up alarm | ✅ | — |
| Campaign & attribution (metrik per iklan) | ❌ | marketing_spends schema ada, UI belum |
| WhatsApp broadcast massal (ke list contact) | ❌ (disarankan Cloud API) | — |

## 2. Order → Produksi → Pengiriman
| Kebutuhan | Status | Gap |
|---|---|---|
| Form pesanan lengkap aqiqah | ✅ | — |
| Konversi pesanan → batch produksi otomatis | ❌ | production_batches.orderId belum wire |
| Task kategori dapur per item/porsi | ❌ | BOM per package belum hadir (package_items ada) |
| Schedule kurir otomatis dari aqiqahDate | ❌ | delivery_tasks manual |
| POD foto & tanda tangan penerima | ❌ | delivery_pods schema siap, UI belum |
| Live status tracking untuk pelanggan (link share) | ❌ | — |

## 3. Persediaan hewan & bahan
| Kebutuhan | Status | Gap |
|---|---|---|
| Pembelian hewan (suppliers) | ❌ | schema suppliers siap, UI/module missing |
| Pemeliharaan/kandang (herd)  | ❌ | animals schema ada, UI missing |
| FIFO stock valuation | ❌ | inventory_moves cukup, engine belum |
| HPP otomatis dari produksi | ❌ | — |
| Qc wy z |◐| QC status batch only (checklist doc belum string) |

## 4. Keuangan
| Kebutuhan | Status | Gap |
|---|---|---|
| Jurnal otomatis penjualan | ✅ | — |
| AR/AP (piutang/hutang) | ✅ | — |
| BACA—Neraca, laba rugi, arus kas, buku besar | ✅ | neraca uses & cash-flow (pct poin) |
| Payroll journal auto | ❌ | type enum siap |
| Bank reconciliation VA BSI | ✅ | — |
| Multi-branch financial consolidation | ⚠️ | branchId scoping manual; reports branch filter belum |
| Pajak / keuangan umum (PPN, zakat-corpus) | ❌ | — |

## 5. HR
| Kebutuhan | Status | Gap |
|---|---|---|
| Data karyawan & contract, gaji | ✅ | — |
| Presensi harian | ✅ | UI hidden atas request owner |
| Payroll (per periode, finalisasi) | ✅ | — |
| Tunjangan/potongan dynamic formulas | ◐ | manual input per employee |
| Cuti, kontrak, dokumen HR | ❌ | — |
| Rekrutmen/probation flow | ❌ | — |

## 6. Laporan & Management
| Kebutuhan | Status | Gap |
|---|---|---|
| Dashboard KPI global (per dept, per unit, per saluran) | ✅ | — |
| Review mingguan/bulanan (quota) | ✅ | — |
| Export semua module ke Excel/PDF | ✅ | — |
| Business Intelligence: chart trend, target vs actual timeline | ◐ | recharts di dashboard; butuh report module-style graphs |
| Customer satisfaction (keluhan customer_complaints) | ❌ | schema ready; UI missing |

## 7. Support & admin
| Kebutuhan | Status | Gap |
|---|---|---|
| Audit trail semua perubahan | ✅ | — |
| Roles & approvals | ✅ | — |
| WAHA gateway & keys | ✅ service; WAHA docker not yet on VPS |
| Notification panel (alarm) | ✅ | — |
| Dokumentasi internal | ✅ | — |
| Backup otomatis & DR plan | ❌ | UNKNOWN; VPS manual only |
| PWA/dark-mode/offline untouched | ❌ | — |

## Partial & Implementasi gaps at a glance
1. Link pipeline to production & delivery (order status flow partial).
2. Automatic journals for payroll/kasbon.
3. Animals & suppliers modules.
4. Voucher system & marketing spend; complaints; POD.
5. Reports & accounting: ledger flow的多 per-branch filter plus polishing.
6. Business intelligence & reporting dashboards (module-fied).
7. Test coverage — unit/e2e zero.
