# Perbaikan setelah audit — 11 November 2026

Perubahan diterapkan pada salinan sumber dari Archive.zip. Tidak ada deploy, akses ke database produksi, atau rotasi rahasia di layanan eksternal.

## Perubahan

- Izin spesifik pada Server Action penjualan, CRM, kas, COA, inventaris, payroll dan operasional; konfirmasi langsung pembayaran memerlukan izin konfirmasi terpisah.
- Guard halaman per modul, halaman penolakan tanpa redirect loop, menu untuk izin eksplisit, dan pengaturan menu pengguna tidak bisa memperluas izin peran.
- Guard cabang pada ID transaksi utama, daftar operasional/payroll/kas/karyawan, detail pesanan/kontak, dan sejumlah data KPI/scorecard/review.
- Konfirmasi pembayaran, invoice dan pesanan menggunakan row lock; pembuatan rencana pembayaran berbagi transaksi pesanan. Counter dokumen memakai transaksi pemanggil.
- Finalisasi payroll dan kasbon beserta jurnal atomik. Payroll final terkunci. Kasbon mengikuti transisi dan menggunakan akun piutang karyawan.
- Jurnal otomatis menggunakan writer bersama, akun eksplisit, validasi baris dan periode. Reversal dikunci dan atomik.
- Stok keluar yang kurang ditolak, input stok divalidasi, ADJUST nol didukung. QC wajib lolos sebelum SIAP; aktor diteruskan untuk jurnal HPP.
- Pengiriman mengikuti transisi, tidak dapat memproses pesanan batal, dan penyimpanan POD atomik. Pelacakan publik tidak menampilkan alamat/nama anak/penerima.
- Pratinjau harga dari server mencakup paket, voucher dan ongkir; total divalidasi ulang saat membuat pesanan. Form memiliki draft pada sessionStorage per pengguna/tab.
- Sejumlah form operasional memakai feedback proses/sukses/gagal, tanpa membuang error. Label tab mobile aktif dan ukuran pagination diperbaiki.
- Pelanggan memakai pagination server; ekspor API tidak berhenti diam-diam pada 1.000 baris. Ekspor tabel dijelaskan sebagai halaman saat ini.
- KPI memakai rupiah penuh; neraca menggunakan tanda saldo ekuitas yang sesuai dan laba kumulatif.
- Notifikasi cabang dan read receipt broadcast per pengguna.
- Pemeriksaan akses berkas POD/avatar, tipe gambar dari signature file, dan key storage acak kriptografis.
- Idempotency dapat mencoba ulang kegagalan secara atomik. Webhook memakai identitas sistem nonaktif yang benar-benar ada untuk foreign key.
- Tutorial disertakan dan smoke test yang tidak berjalan ditandai skip.
- .env.example disediakan; arsip distribusi tidak menyertakan .env atau data runtime.

## Database dan penerapan

1. Buat backup dan uji pemulihannya. Gunakan salinan staging dari database lama.
2. Salin konfigurasi Anda ke .env. Jangan memakai nilai contoh sebagai kredensial produksi.
3. Jalankan npm ci, npm run db:migrate, npm run typecheck, npm test, dan npm run build pada staging.
4. Migrasi 0005 menambahkan COA beban gaji/piutang karyawan; 0006 menambahkan read receipt serta kolom yang belum tercatat pada snapshot lama; 0007 memasukkan tabel ERP extensions yang sebelumnya tidak tercakup migrasi.
5. Jika database lama pernah dibuat dengan db:push atau SQL manual, rekonsiliasi skema dan riwayat migrasinya terlebih dahulu. CREATE/ADD pada database yang sudah memiliki objek tersebut dapat gagal. Jangan menghapus objek atau memaksa migrasi untuk mengatasi perbedaan.
6. Tinjau mapping akun gaji/piutang karyawan/bank sebelum finalisasi. Periksa payroll lama yang sudah FINAL tanpa jurnal; perubahan ini tidak mengubah transaksi historis secara otomatis.
7. Hitung ulang aktual KPI AUTO setelah koreksi satuan. Tinjau aktual MANUAL/IMPORT dan saldo awal bersama keuangan.
8. Rotasi rahasia aktif yang pernah dibagikan dalam .env melalui pengaturan layanan terkait.

## Validasi

- Database PostgreSQL 17 terpisah dibuat dari migrasi, lalu diisi data uji.
- Unit/regression mencakup cabang, permission menu, stok, QC, payroll, pengiriman, harga paket, notifikasi, konkurensi pembayaran, dan retry webhook bertanda tangan.
- Login dan 14 halaman desktop/mobile diperiksa dengan Chromium. Akun pembaca diuji ditolak dari payroll dan endpoint ekspor/inbox.
- Pesanan mobile paket Rp900.000 + ongkir Rp25.000 berhasil dibuat dan invoice/pesanan menyimpan Rp925.000.
- Hasil pengujian bukan bukti rekonsiliasi data produksi atau sertifikasi keamanan menyeluruh.

## Batas yang masih perlu ditangani

- Hutang, cicilan kasbon otomatis, dan integrasi penuh absensi/lembur/KPI ke payroll merupakan pengembangan fitur baru.
- WhatsApp/BSI/S3 perlu uji staging memakai provider sebenarnya. Gateway WhatsApp yang digunakan bersama banyak cabang masih memerlukan pemetaan sesi/percakapan/media ke cabang; jangan anggap izin modul saja sebagai isolasi inbox antar cabang.
- Sebagian master (supplier, voucher, COA, pipeline) memang bersifat bersama pada skema lama. Ubah model data terlebih dahulu jika master harus dipisah per cabang.
- Beberapa daftar operasional masih memakai batas jumlah baris. Pagination server baru diterapkan pada pelanggan.
- Belum ada pembukaan ulang payroll final atau perbaikan otomatis terhadap ketidaksesuaian jurnal/data historis.
- Audit tambahan untuk rate limit login, penempatan secret provider, seluruh relasi foreign key CRM/KPI, dan uji penetrasi tetap diperlukan sebelum menyatakan seluruh aplikasi aman produksi.
