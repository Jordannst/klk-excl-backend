# KLK Backend

Sistem backend untuk aplikasi manajemen invoice dan transaksi ekspedisi.

## Tentang Aplikasi

Aplikasi ini merupakan REST API yang menangani pengelolaan data invoice dan transaksi pengiriman barang untuk keperluan operasional internal perusahaan ekspedisi.

## Fitur Utama

- Manajemen invoice dengan sistem soft delete
- Pencatatan transaksi pengiriman
- Autentikasi dengan JWT dan HTTP-only cookies
- Penyimpanan tanda tangan digital
- Rate limiting untuk keamanan

## Tech Stack

- Node.js dengan Express
- TypeScript
- PostgreSQL dengan Prisma ORM
- Supabase sebagai database hosting

## Menjalankan backend

Gunakan Node.js 24 LTS dan jalankan `npm ci`. Siapkan `DATABASE_URL` dan `JWT_SECRET` untuk menjalankan API. `npm run dev` menghasilkan Prisma Client lalu menjalankan server lokal. Untuk memeriksa build dan unit test, jalankan `npm run build` kemudian `npm test`.

`@prisma/config` 7.10.1 mengunci `effect` 3.20.0. Override di `package.json` memakai versi perbaikan 3.22.1. Tinjau kembali override ini saat menaikkan Prisma. [Advisory Effect](https://github.com/advisories/GHSA-7589-6fvf-x4pw)

Prisma 7 menggunakan driver PostgreSQL `pg`. Parameter URL lama `connection_limit` tetap membatasi jumlah koneksi per proses (default 10). Timeout pool mengikuti `pool_timeout`, kemudian `connect_timeout`, dalam detik (default 5). Koneksi Supabase menggunakan TLS dengan verifikasi sertifikat secara default. Untuk server lain yang membutuhkan TLS, tetapkan `sslmode=verify-full` secara eksplisit karena `pg` tidak menegosiasikan TLS secara otomatis. Parameter lama `sslcert` untuk CA server tetap dibaca relatif ke folder `prisma`. Untuk konfigurasi baru, gunakan `sslrootcert` dengan path absolut atau sediakan CA melalui `NODE_EXTRA_CA_CERTS`.

Tes integrasi memerlukan PostgreSQL lokal khusus pengujian. Gunakan database bernama `klk_test` atau berawalan `klk_test_`. Arahkan `DATABASE_URL` dan `TEST_DATABASE_URL` ke database tersebut, jalankan `npx prisma migrate deploy`, lalu `npm run test:integration` setelah build. Tes membuat dan membersihkan invoice serta transaksi contoh.

Jika database lama yang sudah berisi tabel menghasilkan `P3005`, cocokkan skema dan riwayatnya di salinan database sebelum menandai migrasi yang benar-benar sudah terpasang dengan `prisma migrate resolve --applied`.

Untuk membuat akun admin pertama di database yang dituju, sediakan `ADMIN_PASSWORD` lalu jalankan `npm run seed`. Gunakan `ADMIN_USERNAME` untuk mengganti nama akun default.

## Deployment

Aplikasi ini di-deploy menggunakan Microsoft Azure.
