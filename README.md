# Agrilonic (PWA)

Aplikasi web Agrilonic yang bisa diinstal di HP (Android/iOS) dan dipakai offline untuk tampilan dasarnya.

## Deploy ke GitHub Pages
1. Buat repository baru di GitHub (mis. `agrilonic`), lalu unggah semua isi folder ini (termasuk `.nojekyll`, folder `icons`).
2. Buka **Settings → Pages**, pada *Build and deployment* pilih **Deploy from a branch**, branch `main`, folder `/ (root)`, lalu Save.
3. Tunggu 1–2 menit. Alamat: `https://USERNAME.github.io/agrilonic/`
4. Buka alamat itu di HP lewat HTTPS:
   - **Android (Chrome):** tombol *Instal* muncul, atau menu ⋮ → *Instal aplikasi*.
   - **iPhone (Safari):** tombol Bagikan → *Tambah ke Layar Utama*.

## Memperbarui
Setiap mengubah `index.html`, ganti `VERSION` di `sw.js` (mis. `agrilonic-v2`) agar HP pengguna mengambil versi baru.
