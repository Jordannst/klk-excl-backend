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

Prisma 7 menggunakan driver PostgreSQL `pg`. Parameter URL lama `connection_limit` tetap membatasi jumlah koneksi per proses (default 10). Timeout pool mengikuti `pool_timeout`, kemudian `connect_timeout`, dalam detik (default 5).

Backend memverifikasi sertifikat dan hostname Supabase memakai `prisma/supabase-ca.crt` yang disertakan dalam ZIP rilis. Ini berlaku untuk URL standar maupun `sslmode=require`. Jika penyedia memperbarui CA, ganti berkas tersebut dengan sertifikat resmi dari pengaturan database Supabase. Anda dapat mengganti CA bawaan lewat `sslrootcert` di URL atau `NODE_EXTRA_CA_CERTS` saat proses Node dimulai. Parameter lama `sslcert` tanpa `sslkey` dan `sslrootcert` dibaca sebagai CA server relatif terhadap folder `prisma`. [Panduan sertifikat Supabase](https://supabase.com/docs/guides/platform/ssl-enforcement)

Untuk host PostgreSQL eksternal selain Supabase, tetapkan kebijakan TLS secara eksplisit lewat `sslmode`, `ssl`, atau `PGSSLMODE` agar API bisa mulai. Gunakan `sslmode=verify-full` untuk memverifikasi server. Koneksi loopback dan socket Unix lokal tetap dapat dipakai tanpa parameter TLS. Pengaturan ini berlaku pada koneksi runtime API dan seed. Perintah migrasi Prisma memakai konfigurasi koneksi CLI sendiri.

Tes integrasi memerlukan PostgreSQL lokal khusus pengujian. Gunakan database bernama `klk_test` atau berawalan `klk_test_`. Arahkan `DATABASE_URL` dan `TEST_DATABASE_URL` ke database tersebut, jalankan `npx prisma migrate deploy`, lalu `npm run test:integration` setelah build. Tes membuat dan membersihkan invoice serta transaksi contoh.

Jika database lama yang sudah berisi tabel menghasilkan `P3005`, cocokkan skema dan riwayatnya di salinan database sebelum menandai migrasi yang benar-benar sudah terpasang dengan `prisma migrate resolve --applied`.

Untuk membuat akun admin pertama di database yang dituju, sediakan `ADMIN_PASSWORD` lalu jalankan `npm run seed`. Gunakan `ADMIN_USERNAME` untuk mengganti nama akun default.

## Deployment

Aplikasi ini di-deploy menggunakan Microsoft Azure. Saat GitHub Actions membuat ZIP sumber, `git archive` menyisipkan SHA commit yang kemudian dikompilasi oleh Oryx. Endpoint `GET /api/health` mengembalikan SHA tersebut di field `commit`. Build lokal langsung dari checkout mengembalikan `commit: null`.

Setelah deploy, workflow menunggu paling lama lima menit hingga health mengembalikan HTTP 200, `status=ok`, `db=up`, dan `commit` yang sama dengan SHA run GitHub. Jika batas waktu tercapai, langkah verifikasi gagal.
