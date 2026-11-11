# Panduan Madani Aqiqah

## Mulai menggunakan aplikasi
Masuk menggunakan akun yang diberikan pengurus. Menu mengikuti izin peran dan cabang Anda. Halaman akses tidak tersedia berarti izin belum diberikan; hubungi pengurus.

## Pesanan
Buka Pesanan → Pesanan Baru. Pilih pelanggan, isi detail aqiqah, pilih produk atau paket, lalu isi pengiriman. Periksa ringkasan harga dari server: subtotal, diskon, ongkir, dan total. Tunggu perhitungan selesai sebelum membuat pesanan. Jika harga berubah, tinjau ulang ringkasan.
Opsi rencana pembayaran transfer membuat pembayaran PENDING; opsi ini tidak menyatakan dana sudah diterima.

## Pembayaran
Catat pembayaran dengan invoice dan pesanan yang sesuai. Hanya petugas berizin boleh mengonfirmasi penerimaan. Konfirmasi memperbarui invoice, piutang, pesanan, serta jurnal dalam satu transaksi.

## Produksi
Urutan batch: RPH → Potong → Masak → Packing → QC → Siap. Isi hasil QC saat tahap QC. Batch hanya bisa menjadi Siap setelah QC lolos. Jika stok kurang, lengkapi stok sebelum melanjutkan.

## Inventaris
Stok masuk menambah lot FIFO. Stok keluar memakai lot tertua dan ditolak jika tidak mencukupi. ADJUST adalah jumlah akhir absolut; nol berarti stok akhir nol. Gunakan alasan mutasi yang jelas.

## Pengiriman
Mulai dari Menunggu, lalu Dalam Perjalanan dan Tiba. Kegagalan dapat dicatat; tugas gagal dapat dikembalikan ke Menunggu. Pesanan batal tidak bisa diproses. POD membutuhkan gambar JPEG/PNG/WebP dan lokasi GPS yang valid.

## Penggajian
Buat periode, tinjau gaji dasar, tunjangan dan potongan, kemudian finalisasi. Finalisasi membuat jurnal dan mengunci payroll; kegagalan jurnal membatalkan finalisasi. Tidak tersedia pembukaan ulang payroll final dalam versi ini.

## Kasbon
Pengajuan → Disetujui → Dibayar. Pengajuan atau persetujuan dapat dibatalkan sebelum pembayaran. Kasbon dibayar dicatat sebagai piutang karyawan, bukan beban. Cicilan otomatis belum tersedia.

## Laporan
Pilih rentang tanggal dan cabang yang diizinkan. Laba rugi mengikuti periode; neraca memakai saldo dan laba kumulatif sampai tanggal akhir. Pastikan saldo awal benar dan lakukan rekonsiliasi sebelum mengandalkan laporan.

## KPI
Nominal mata uang memakai rupiah penuh. Setelah memperbarui versi dari perhitungan lama, jalankan sinkronisasi aktual AUTO agar metrik dihitung ulang. Aktual MANUAL/IMPORT perlu ditinjau pengurus.

## Notifikasi
Notifikasi cabang hanya ditampilkan kepada cabang terkait. Status baca broadcast disimpan per pengguna.

## Modul lain
CRM mengelola deal, kontak dan aktivitas. Keluhan mencatat masalah pelanggan. Voucher memiliki masa berlaku dan kuota. WhatsApp membutuhkan provider yang dikonfigurasi pengurus. Data karyawan dan absensi membutuhkan izin masing-masing. ZISWAF menyediakan pencatatan dasar. Hutang belum tersedia.

## Bantuan
Jika form menampilkan kegagalan, periksa data dan izin sebelum mencoba ulang. Integrasi bank, WhatsApp, serta data lama harus diuji di staging sebelum dipakai operasional.
