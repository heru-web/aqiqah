# 06 — Role & Permission Matrix (implementasi aktual)

## Peran di database (tabel `roles`, query PGA)
| Slug | Nama | Deskripsi |
|---|---|---|
| superadminSuper Admin | Akses penuh `*` |
| sales | Tim Sales | penjualan & CRM |
| ops | Tim Operasional | produksi/gudang/karyawan/absensi/payroll/kasbon/performance + crm.view |
| acct | Akuntan | cash/AR/AP/journal/COA/HPP/laporan/ziswaf + crm.view |
| hr | Tim HR & Payroll | dashboard/employees/kpi/performance/payroll/kasbon + crm.view |
| marketing | Tim Marketing | dashboard/crm/customers/notifications (dibuat 2026-11-05) |

## Matriks Menu × Role (implementasi aktual — nav.ts perm + getAllowedMenuHrefs)

| Menu / group | superadmin | sales | marketing | ops | acct | hr |
|---|---|---|---|---|---|---|
| Dasbor | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dokumentasi | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| CRM (kanban/kontak/aktivitas) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Pelanggan | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (crm.*) |
| Penawaran/Pesanan/Tagihan/Pembayaran | ✅ | ✅ | ✅(customer-view) | ✅ (crm.view+) | ✅ | ✅ |
| Produksi / Inventaris / Pengiriman | ✅ | ✗ | ✗ | ✅ | ✗ | ✗ |
| Karyawan (Karyawan) | ✅ | ✗ | ✗ | ✅ | ✗ | ✅ |
| Payroll / Kasbon | ✅ | ✗ | ✗ | ✅ | ✗ | ✅ |
| Kinerja (5 lag) + Data Induk | ✅ | ✗ | ✗ | ✅ | ✗ | ✅ |
| Kas & Bank / Piutang / Hutang | ✅ | ✗ | ✗ | ✗ | ✅ | ✗ |
| Akuntansi / COA / Laporan / ZISWAF | ✅ | ✗ | ✗ | ✗ | ✅ | ✗ |
| WA Gateway / Alarm Notifikasi | ✅ | ✗ | ✗ | ✗ | ✗ | ✗ (settings.*) |
| Pengguna / Peran / Cabang / Audit | ✅ | ✗ | ✗ | ✗ | ✗ | ✗ |

(Ya — yang belum: menu absensi disembunyikan dari nav untuk semua peran; page redirect ke dashboard.)

## Row-level & feature-level adalah
- **Menu filter**: `nav.ts` + `getAllowedMenuHrefs(userPermissions)` (lib permissions) → menu hanya muncul bila punya module wildcard `crm.*` dll.
- **Server guards**: page wajib `requirePageUser()`; action wajib `requireAuth()`, menugenat API pakai `requirePermission(<module>.*|<module>.<entity>...)`.
- **Data-level**: `branchId` dari actor mengikat `listCustomers`, attendance, etc. (branch scoping di service).

## Aksi transkasi (matriks fungsi CRUD)
| Fungsi kunci | superadmin | sales | ops | acct | hr |
|---|---|---|---|---|---|
| Buat/edit pelanggan, CRM deal | ✅ | ✅ | ✅ (crm.view) | ✅ | ✅ |
| Buat order + invoice + payment verifikasi | ✅ | ✅ (order create) | ✗ (view) | ✅ (payment confirm) | ✗ |
| Massal delete (bulkArchive) | ✅ (customers table) | ✅ | ✗ | ✗ | ✗ |
| WA keys / set provider | ✅ | ✗ | ✗ | ✗ | ✗ |
| Alarm rules toggles | ✅ | ✗ | ✗ | ✗ | ✗ |
| Payroll finalisasi | ✅ | ✗ | ✅ | ✗ | ✅ |
| User & roles & branches setup | ✅ | ✗ | ✗ | ✗ | ✗ |

## Pembatasan data & antara two

- Semua user terdaftar per branch (`branches`), actor.branchId dipakai sebagai filter kebanyakan list.
- `superadmin` = akses wildcard `*` (permissions.ts), sebetulnya tepti semua, mutlak.
- Marketing roles dibuat dengan `crm.*` saja — halaman pelanggan masuk (via customers action) tapi tidak memiliki order create permisson → still read-only visible for sales page.
- Notification menu menusabelkan alarm alarm per role if receiver targets match role slug list.
