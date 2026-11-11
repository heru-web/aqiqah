# MADANI AQIQAH V3

ERP (sistem administrasi terpadu) untuk usaha aqiqah: CRM, penjualan, pesanan, pembayaran,
akuntansi, kepegawaian, dan manajemen kinerja dalam satu aplikasi.

- **Aplikasi produksi:** https://aqiqah.benuatech.web.id
- **Versi:** 0.1.1
- **Stack:** Next.js 16 (App Router), React 19, TypeScript, PostgreSQL + Drizzle, Redis, Tailwind CSS 4

---

## Perbaikan hasil audit

Lihat [catatan perbaikan dan penerapan](docs/PERBAIKAN.md). Perubahan belum dideploy dan perlu verifikasi staging terhadap database serta provider Anda.

## Dokumentasi

| Dokumen | Isi |
|---|---|
| [docs/README.md](docs/README.md) | Indeks dokumentasi & status ringkas |
| [docs/01-PANDUAN-PENGGUNA.md](docs/01-PANDUAN-PENGGUNA.md) | Panduan pemakaian sehari-hari (bahasa awam) |
| [docs/02-REFERENSI-MODUL.md](docs/02-REFERENSI-MODUL.md) | Rujukan modul, rute, hak akses, database |
| [docs/03-OPERASIONAL-DAN-DEPLOY.md](docs/03-OPERASIONAL-DAN-DEPLOY.md) | Deploy, backup, cron, troubleshooting |
| [docs/04-KAMUS-ISTILAH.md](docs/04-KAMUS-ISTILAH.md) | Arti istilah (prospek, piutang, jurnal, KPI, dll.) |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Riwayat perubahan versi |
| [docs/PERFORMANCE_MANAGEMENT_SYSTEM.md](docs/PERFORMANCE_MANAGEMENT_SYSTEM.md) | Rancangan sistem manajemen kinerja (KPI 8 level) |

---

## Fitur utama

- **CRM & Pipeline** — prospek, kontak, aktivitas, tahapan penjualan.
- **Penjualan** — penawaran, pesanan (wizard 5 langkah), tagihan otomatis, pembayaran.
- **Keuangan** — piutang, kas & bank, jurnal otomatis, bagan akun (COA).
- **Kepegawaian** — data karyawan, absensi harian.
- **Manajemen Kinerja** — KPI 8 level, scorecard harian, review mingguan/bulanan.
- **Integrasi** — webhook BSI VA, WhatsApp gateway, penyimpanan lokal/S3.
- **Keamanan** — sesi httpOnly, RBAC per peran, log audit.

Modul yang masih dalam pengembangan: produksi, inventaris, pengiriman, penggajian, kasbon,
hutang, laporan siap-saji, ZISWAF. Lihat [docs/02-REFERENSI-MODUL.md](docs/02-REFERENSI-MODUL.md).

---

## Menjalankan di lokal

Prasyarat: Node.js 20+, PostgreSQL 17, Redis (opsional).

```bash
cp .env.example .env          # jika tersedia; isi DATABASE_URL, REDIS_URL, SESSION/secret
npm ci
npm run db:migrate
npm run db:seed               # data master (idempoten)
npm run db:seed:demo          # opsional: data contoh
npm run dev
```

Buka http://localhost:3000.

Perintah penting:

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Jalankan mode pengembangan |
| `npm run build` / `npm start` | Build & jalankan produksi |
| `npm run typecheck` | Cek tipe TypeScript |
| `npm run lint` | ESLint |
| `npm test` | Unit & integration test (Vitest) |
| `npm run db:generate` | Buat file migrasi dari schema |
| `npm run db:migrate` | Terapkan migrasi |
| `npm run db:seed` | Seed data master |
| `npm run db:seed:demo` | Seed data demo (jangan di produksi) |
| `npm run db:studio` | UI database (lingkungan aman saja) |

---

## Struktur folder

```
src/
  app/            Halaman (App Router) & API route
  components/     Komponen UI per modul
  db/             Schema Drizzle, migrasi, seed
  lib/            Util, auth, permission, uang, KPI
  server/         Service & server action (logika bisnis)
docs/             Dokumentasi
tests/            Test Vitest
```

---

## Keamanan

- Jangan commit `.env` atau rahasia apa pun.
- Ganti password admin hasil seed sebelum dipakai produksi.
- Batasi akses database ke localhost dan gunakan HTTPS.
- Panduan lengkap: [docs/03-OPERASIONAL-DAN-DEPLOY.md](docs/03-OPERASIONAL-DAN-DEPLOY.md).
