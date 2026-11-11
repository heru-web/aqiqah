# 03 — Feature Inventory (IMPLEMENTED / PARTIAL / UI ONLY / BACKEND ONLY / BROKEN / MISSING)

Verifikasi per fitur dengan melihat file, route, dan tabel. "✅" implik IMPLEMENTED, "◐" PARTIAL.

## 1. Dashboard
| Fitur | Status | Bukti |
|---|---|---|
| Ringkasan KPI & chart | ✅ | /(app)/dashboard/page.tsx (aggregasi langsung) |
| Ringkas notif lonceng | ✅ | app-shell/notification-bell + notifications (IN_APP) |

## 2. CRM
| Fitur | Status | Bukti |
|---|---|---|
| Kanban 6 tahap (drag) | ✅ | /crm + crm-board-client.tsx + crm_stages |
| Buat/ubah/tutup deal | ✅ | crm/pengaturan + services/crm |
| Follow-up (Aktivitas) | ✅ | /crm/activities + lead_followups |
| Kontak: people & orgs (CRUD + import/export) | ✅ | /crm/contacts (+/[id]) + api/crm/contacts/import |
| Detail person/org | ✅ | /crm/contacts/people/[id], organizations/[id] |
| Integrasi WA (auto deal) | ✅ | services/whatsapp sendAutoWhatsappForDeal (trigger DEAL_CREATED/STAGE_CHANGED) |
| Anti-duplikasi kontak | ◐ | UI tidak memverifikasi sama → anjuran later |

## 3. Customers (Pelanggan)
| Fitur | Status | Bukti |
|---|---|---|
| CRUD pelanggan | ✅ | /customers + services/customers |
| Pilih-baris + hapus masal | ✅ | customer-data-table (selectable) + bulkArchiveCustomers |
| Export Excel/PDF | ✅ | /api/customers/export (xlsx+jspdf) |
| Import Excel (template) | ✅ | /api/customers/import + tombol template |
| Form intake aqiqah 9 kolom | ✅ | customer-form-dialog (ayah/ibu/TTL/paket/jadwal/consent) |
| Kirim WA konfirmasi per baris | ✅ | sendCustomerConfirmationAction; crm_activities log |
| Kartu pelanggan tampil kolom baru | ✅ | crm.ts & customer-data-table |

## 4. Penjualan
| Fitur | Status | Bukti |
|---|---|---|
| Quotation CRUD | ✅ | /quotations + quotation_items |
| Quotation → Order | ✅ | orders.quoteId |
| Order CRUD + status pipeline (11 status) | ✅ | /orders (orderStatus enum) + order_status_logs |
| Order detail + status timeline | ✅ | /orders/[id] |
| Invoice auto + status (DRAFT/ISSUED/PARTIAL/PAID/VOID/BAD_DEBT) | ✅ | invoiceStatus; service invoices |
| Payment (Transfer/VA/QRIS/…) + konfirmasi | ✅ | /payments + paymentStatus |
| Export Excel/PDF di 4 tabel | ✅ | table-export.tsx (generic) |

## 5. Produksi & Stock & Delivery (Ops)
| Fitur | Status | Bukti |
|---|---|---|
| Batch produksi + tahap + QC | ✅ | /production + production_batches |
| Batch dari order (link) | ❌ MISSING | production_batches.orderId belum diwire |
| Auto-kurangi stok saat produksi pakai | ❌ MISSING | inventory_moves.refModule kosong |
| Inventory CRUD + kartu stok | ✅ | /inventory + inventory_items/moves |
| FIFO / HPP | ❌ MISSING | schema products.price_versions ada; engine belum |
| Supplier/pembelian hewan | ❌ MISSING | suppliers (schema saja) |
| Pengiriman jadwal + status + tiba otomatis | ✅ | /delivery + delivery_tasks/deliveries |
| POD foto/bukti | ❌ MISSING | delivery_pods (schema saja) |

## 6. HR
| Fitur | Status | Bukti |
|---|---|---|
| Karyawan CRUD + import | ✅ | /karyawan + api/hr/employees/import |
| Absensi (HADIR/TERLAMBAT/…) | ✅ (module di-hide UI) | /attendance hidden + attendance_records |
| Payroll run regime + finalisasi | ✅ | /payroll + payroll_runs/lines |
| Jurnal OTOMATIS payroll | ❌ MISSING | journal type PAYROLL ada; not wired |
| Kasbon alur APPROVAL | ✅ | /kasbon (+ kasbonStatus) |

## 7. Keuangan
| Fitur | Status | Bukti |
|---|---|---|
| Jurnal manual + jurnal otomatis penjualan | ✅ | /accounting + journals POSTED |
| COA full (11 akun) | ✅ | /coa + accounts |
| Kas & bank | ✅ | /cash + cash_accounts |
| AR/AP | ✅ | /receivables, /payables |
| Laporan: Laba Rugi | ✅ | /reports (accountBalances filter period) |
| Laporan: Neraca | ✅ | idem + tie-out laba berjalan |
| Laporan: Arus kas | ◐ | idem (basis varirline tidak 3 segmen) |
| Laporan: Buku besar | ✅ | ledger limit 400 |
| Rekening koreksi (BSI auto) | ✅ | webhooks/bsi-va + reconciliationStatus |
| HPP & persediaan otomatis | ❌ MISSING | accountType income/expense treat manual |

## 8. Performance & KPI
| Fitur | Status | Bukti |
|---|---|---|
| Scorecard harian diisi per dept | ✅ | /kinerja/harian + daily_scorecards/lines |
| Review mingguan/bulanan + angka agregat | ✅ | /kinerja/mingguan, bulanan (+services) |
| Setup indikator/target | ✅ | /kinerja/pengaturan |
| KPI sync jurnal (runner) | ✅ | /api/jobs/kpi + kpi-runner |
| Laporan per unit-saluran/dept/unit | ✅ | /kinerja/unit-usaha, saluran, jabatan, departemen, perusahaan |

## 9. Sistem
| Fitur | Status | Bukti |
|---|---|---|
| Pengguna & peran & cabang CRUD | ✅ | /users, /roles, /branches |
| RBAC menu filter & guard (`requirePermission`) | ✅ | nav.ts + lib/permissions + getAuth |
| Audit log | ✅ | /audit |
| Alarm panel (5 aturan, cron) | ✅ | /alarm + /api/jobs/wa-alerts |
| Dokumentasi (3 kartu, mermaid diagrams) | ✅ | /docs |
| Data demo & WA multi-provider | ✅ | /settings + whatsapp service |
| Landing publik root (og:image) | ✅ | app/page.tsx |

## BACKEND ONLY
| Fitur | Detail |
|---|---|
| Order status hooks (11 statuses) | halaman detail menampilkan tapi belum semua UI untuk aksi bermacam |
| Sending whatsapp image/media | WAHA Plus semantics belum dilayani |

## BROKEN
| Fitur | Detail |
|---|---|
| Module attendance page | Halaman kini redirect /dashboard (owner keputusan); status BROKEN/INTEGRAL belaku |

## MISSING (paling relevan aqiqah)
1. Pembelian hewan & pemeliharaan (herd management).
2. FIFO stok & HPP otomatis dari produksi.
3. Jurnal otomatis payroll & kasbon.
4. POD foto kirim (delivery_pods schema siap).
5. Dashboard BI (trend bulanan sales/omzet).
6. Undo/rollback audit pada dokumen penting.
7. Multi-cabang aktif (branches sudah ada di layout, belum dipakai penuh).
