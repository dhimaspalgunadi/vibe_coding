# Papan Status Tim

Satu layar sederhana untuk melihat status kerja tim (Belum Mulai / Dikerjakan /
Selesai), tugas singkat yang sedang dikerjakan, dan kapan terakhir diubah.
Dibuat untuk dibuka dari HP, tanpa perlu login.

## Isi daftar nama tim Anda

Sebelum deploy, edit file `data/team.js` dan ganti 8 nama contoh dengan nama
anggota tim Anda yang sebenarnya (5-10 nama):

```js
export const TEAM_MEMBERS = [
  'Nama 1',
  'Nama 2',
  // ...
];
```

Simpan file, lalu commit & push perubahan ini juga saat Anda deploy/update.

## Cara kerja singkat

- Semua orang bisa membuka halaman dan **melihat** semua baris tanpa login.
- Setiap orang memilih namanya sendiri sekali dari dropdown di awal — pilihan
  ini disimpan di browser HP/laptop-nya (localStorage), jadi tidak perlu
  pilih ulang tiap buka.
- Hanya baris dengan nama yang dipilih itu yang bisa diubah statusnya dan
  tugasnya, dari perangkat itu.
- Layar memperbarui data otomatis setiap 5 detik, dan ada tombol
  "🔄 Perbarui" untuk memaksa refresh langsung.

## Deploy ke Vercel — langkah demi langkah

### 1. Push kode ini ke GitHub

Pastikan repo ini (dengan `data/team.js` yang sudah Anda edit) sudah ada di
GitHub.

### 2. Import proyek di Vercel

1. Buka [vercel.com](https://vercel.com) → **Add New... → Project**.
2. Pilih repo GitHub ini, lalu klik **Deploy**.
   (Deploy pertama ini akan gagal/menampilkan error di halaman status karena
   database belum dipasang — itu wajar, lanjutkan ke langkah berikutnya.)

### 3. Tambahkan database Redis (untuk simpan status)

1. Di dashboard proyek Anda di Vercel, buka tab **Storage**.
2. Klik **Create Database** (atau **Browse Marketplace**), lalu pilih produk
   **Redis** (disediakan oleh Upstash — ini gratis untuk skala kecil seperti
   tim 5-10 orang).
3. Beri nama bebas, pilih region terdekat, lalu buat database.
4. Saat diminta menghubungkan ke proyek, pilih proyek **Papan Status Tim**
   Anda dan konfirmasi. Vercel akan otomatis menambahkan environment variable
   yang dibutuhkan (`KV_REST_API_URL` dan `KV_REST_API_TOKEN`, atau
   `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` tergantung versi
   integrasi — kode ini sudah mendukung keduanya) ke proyek Anda.

### 4. Redeploy

Environment variable baru hanya berlaku setelah deploy ulang:

1. Buka tab **Deployments** di proyek Anda.
2. Pada deployment terakhir, klik menu **... → Redeploy**.

Setelah selesai, buka URL proyek Anda (misalnya
`https://papan-status-tim.vercel.app`) dari HP — halaman siap dipakai tim.

## Development di komputer sendiri (opsional)

Jika ingin menjalankan di komputer sebelum deploy:

1. `npm install`
2. Salin `.env.example` menjadi `.env.local`, lalu isi nilai
   `KV_REST_API_URL` dan `KV_REST_API_TOKEN` — Anda bisa menyalinnya dari tab
   **Storage → (database Anda) → .env.local** di dashboard Vercel, atau
   jalankan `vercel env pull .env.local` jika sudah install Vercel CLI.
3. `npm run dev`, lalu buka `http://localhost:3000`.

## Struktur proyek (untuk referensi)

- `data/team.js` — daftar nama anggota tim (edit manual di sini).
- `app/page.js` — tampilan utama (daftar status, pemilihan nama, form edit).
- `app/api/status/route.js` — API sederhana untuk membaca/menyimpan status.
- `lib/redis.js` — koneksi ke database Redis.
- `lib/status.js` — daftar status dan warnanya.
- `lib/time.js` — format waktu relatif ("diubah 2 jam lalu").
