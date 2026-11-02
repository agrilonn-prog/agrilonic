# Agrilonic (PWA) + Agrilonic Plus

Aplikasi web Agrilonic yang bisa diinstal di HP (Android/iOS) dan dipakai offline untuk tampilan dasarnya.
Versi ini menambahkan modul **Agrilonic Plus** (file `agrilonic-plus.js` + `agrilonic-plus.css`).

## Fitur baru di Agrilonic Plus
Semua data tersimpan di perangkat (localStorage), tanpa server dan tanpa akun.

| Fitur | Fungsi |
|---|---|
| **Kebun Saya** | Catat tanaman/ternak yang dipelihara: umur (HST), fase pemupukan, pengingat pupuk, catat panen. |
| **Keuangan Tani** | Kas masuk/keluar per kebun, laba-rugi, R/C ratio, grafik 6 bulan, HPP & titik impas, ekspor CSV. |
| **Radar Risiko Cuaca** | Skor kondisi cuaca yang mendukung jamur, bakteri, dan hama/virus (data Open-Meteo), plus daftar penyakit tanaman Anda yang perlu diwaspadai. Ternak: indeks stres panas. |
| **Kalkulator Lahan** | Konversi m²/are/ha/bata/tumbak, hitung populasi tanaman & kebutuhan bibit dari jarak tanam. |
| **Cari Cepat** | `Ctrl+K` atau `/` — cari tanaman, penyakit, gejala, hama, dan semua fitur sekaligus. |
| **Pengaturan & Cadangan** | Tema terang/gelap, ukuran teks, notifikasi pengingat, unduh/pulihkan cadangan data, penyimpanan permanen. |
| PWA | Penanda offline, info versi baru, pintasan ikon aplikasi (Kebun, Diagnosa, Kamera, Kas), tautan `?a=kebun` dst. |

Fitur lama tidak diubah. Menu Plus muncul di **Alat Tani** (desktop) dan menu ☰ (HP), serta ringkasan "Kebun & Usaha Saya" di beranda.

## Struktur berkas
```
index.html            aplikasi utama (hanya +2 baris: memuat CSS & JS Plus)
agrilonic-plus.js     modul fitur baru
agrilonic-plus.css    gaya modul baru (kelas berawalan ap-)
sw.js                 service worker (offline)
manifest.webmanifest  manifest PWA (+ pintasan)
icons/                ikon aplikasi
.nojekyll
```

## Deploy ke GitHub Pages
1. Buat repository baru di GitHub (mis. `agrilonic`), lalu unggah **semua isi** folder ini (termasuk `.nojekyll` dan folder `icons`).
2. Buka **Settings → Pages**, pada *Build and deployment* pilih **Deploy from a branch**, branch `main`, folder `/ (root)`, lalu Save.
3. Tunggu 1–2 menit. Alamat: `https://USERNAME.github.io/agrilonic/`
4. Buka alamat itu di HP lewat HTTPS:
   - **Android (Chrome):** tombol *Instal* muncul, atau menu ⋮ → *Instal aplikasi*.
   - **iPhone (Safari):** tombol Bagikan → *Tambah ke Layar Utama*.

## Memperbarui
Setiap mengubah `index.html`, `agrilonic-plus.js`, atau `agrilonic-plus.css`, ganti `VERSION` di `sw.js` (mis. `agrilonic-v3`) agar HP pengguna mengambil versi baru. Pengguna akan melihat pemberitahuan "Versi baru aktif".

## Catatan penting
- Data pengguna hanya ada di perangkatnya. Ingatkan pengguna untuk rutin **mengunduh cadangan** (Pengaturan & Cadangan).
- Radar Risiko adalah indikator berbasis cuaca, bukan prediksi pasti serangan; skor dan batasnya dapat disetel di fungsi `riskScores` pada `agrilonic-plus.js`.
- Notifikasi pengingat muncul saat aplikasi dibuka/kembali ke layar (bukan push saat aplikasi tertutup — itu butuh server).
- Mode gelap memakai inversi warna otomatis sehingga sebagian warna aksen bisa sedikit berbeda.
