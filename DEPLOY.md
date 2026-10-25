# Panduan Deploy DompetKu

Proyek ini terdiri dari dua bagian:

| Bagian | Isi | Hosting |
|---|---|---|
| Frontend | `index.html`, `app.js`, `live-voice.js`, `telemetry.js`, `sw.js`, `manifest.webmanifest`, `assets/`, `icons/` | GitHub Pages (`dompetku.is-local.org`) **dan** cPanel (`dompetku.csproject.org`) |
| Backend | `backend/track.php`, `backend/report.php`, `backend/ai.php`, `backend/config*.php` | **Hanya cPanel** (PHP + MySQL). GitHub Pages tidak menjalankan PHP |

Frontend di GitHub Pages otomatis mengirim telemetry dan request token/proxy AI ke:

```
https://dompetku.csproject.org/backend/track.php
https://dompetku.csproject.org/backend/ai.php
```

Saat dibuka dari `dompetku.csproject.org`, telemetry dan AI memakai endpoint same-origin
`./backend/track.php` dan `./backend/ai.php` (tanpa CORS).
Hal ini menjaga API key Gemini AI Studio tetap aman di cPanel tanpa pernah ter-commit ke GitHub.

---

## 1. Deploy ke GitHub Pages (utama)

### 1.1 Push repo

Repo: <https://github.com/zrinfa/DompetKu> (branch `main`).

Workflow `.github/workflows/deploy-pages.yml` hanya mempublikasikan **file frontend**.
Folder `backend/`, dump `*.sql`, `*.bak`, dan file dev tidak ikut terpublikasi.

### 1.2 Aktifkan Pages

1. Buka repo → **Settings → Pages**.
2. Bagian **Build and deployment → Source** pilih **GitHub Actions**.
3. Setelah workflow pertama sukses, isi **Custom domain**: `dompetku.is-local.org`
   (file `CNAME` sudah ada di repo).
4. Aktifkan **Enforce HTTPS**.

DNS di pengelola domain `is-local.org` harus berisi:

```
CNAME  dompetku  zrinfa.github.io.
```

### 1.3 Verifikasi

- Buka `https://dompetku.is-local.org` (hard refresh / Clear site data untuk SW lama).
- DevTools → Network: harus ada `OPTIONS` 200 lalu `POST` 200 ke
  `dompetku.csproject.org/backend/track.php`.
- Buka `https://dompetku.csproject.org/backend/report.php?key=KUNCI` dan pastikan
  event baru muncul dengan label **GitHub Pages**.
- Pastikan `https://dompetku.is-local.org/backend/config.php` menghasilkan **404**
  (backend tidak ikut ter-deploy).

---

## 2. Deploy ke cPanel (`dompetku.csproject.org`)

Gunakan file `dompetku-cpanel-upload.zip` (sudah disiapkan di folder ini).

1. cPanel → **File Manager** → masuk ke document root `dompetku.csproject.org`
   (biasanya `public_html` atau subfolder khusus subdomain).
2. Upload ZIP → **Extract** → hapus ZIP setelah selesai.
3. Pastikan file berikut ada:
   - `.htaccess`
   - `backend/.htaccess`
   - `backend/config.local.php` (berisi kredensial MySQL Anda)
4. Jika `config.local.php` belum ada, salin `backend/config.example.php` menjadi
   `backend/config.local.php` lalu isi:
   ```php
   define('DB_HOST', 'localhost');
   define('DB_USER', 'xfag9686_dompetku_user');
   define('DB_PASS', 'PASSWORD_DB_ANDA');
   define('DB_NAME', 'xfag9686_dompetku_user');
   define('ADMIN_KEY', 'KUNCI_LAPORAN_RAHASIA');
   define('GEMINI_API_KEY', 'KUNCI_API_GEMINI_ANDA');
   ```
5. Jalankan migrasi database (sekali saja) lewat **phpMyAdmin → Import**:
   `backend/migrate_origin.sql`.
   File ini menambah kolom `origin` (events) dan `last_origin` (devices).
6. Pastikan `backend/` dapat ditulis hanya oleh pemilik (permission `755` folder,
   `644` file). Jangan set `777`.

Catatan keamanan:

- `.htaccess` memblokir akses web ke `*.sql`, `*.bak`, `*.md`, `.yml`, dan
  `backend/config*.php`.
- Jangan meng-upload `xfag9686_dompetku_user.sql` (dump berisi data user) ke
  document root. File itu sudah dikecualikan dari ZIP dan dari Git.
- Ganti `ADMIN_KEY` secara berkala. Kunci hanya dibaca dari
  `backend/config.local.php` / environment variable.

---

## 3. Google OAuth (wajib untuk sinkron Drive)

Di [Google Cloud Console](https://console.cloud.google.com/apis/credentials) →
OAuth Client `520227032774-...` → **Authorized JavaScript origins**, tambahkan:

```
https://dompetku.is-local.org
https://dompetku.csproject.org
http://localhost:8000
```

Tanpa ini, tombol Google Drive / Sign-In akan gagal di domain baru dan laporan
`google_linked` tidak akan terisi.

---

## 4. Pengujian lokal

```bash
python3 -m http.server 8000
# buka http://localhost:8000
```

Telemetry akan dikirim ke csproject (localhost diizinkan oleh CORS backend).
Untuk mematikan telemetry di browser: `localStorage.setItem('dompetku_telemetry_optout','1')`.

---

## 5. Setelah mengubah file

- Perubahan `sw.js`/`app.js`/`telemetry.js`: naikkan `CACHE` di `sw.js`
  (sekarang `dompetku-pwa-v59`) agar service worker lama terbuang.
- Format CSV laporan: `report.php?key=KUNCI&format=csv&type=users|events|daily&days=30`.
- Jangan commit `backend/config.local.php` atau file `*.sql` selain
  `schema.sql` dan `migrate_origin.sql`.
