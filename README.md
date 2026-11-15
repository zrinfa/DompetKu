<div align="center">
  <img src="icons/icon-192.png" alt="DompetKu Logo" width="110" />
  <h1>DompetKu</h1>
  <p><strong>Aplikasi Pencatatan Keuangan UMKM Terintegrasi Kecerdasan Buatan</strong></p>

  <p>
    <a href="https://dompetku.is-local.org" target="_blank"><img src="https://img.shields.io/badge/Akses%20Web-dompetku.is--local.org-2563EB?style=flat-square" alt="Domain"></a>
    <a href="panduan.html" target="_blank"><img src="https://img.shields.io/badge/Buku%20Panduan-PDF%20(15%20Hal)-DC2626?style=flat-square" alt="Buku Panduan PDF"></a>
    <img src="https://img.shields.io/badge/Platform-Progressive%20Web%20App%20(PWA)-10B981?style=flat-square" alt="Platform PWA">
    <img src="https://img.shields.io/badge/Penyimpanan-IndexedDB%20(Offline--First)-6366F1?style=flat-square" alt="IndexedDB">
    <img src="https://img.shields.io/badge/Integrasi%20AI-Google%20Gemini%20API-4285F4?style=flat-square" alt="Google Gemini AI">
    <img src="https://img.shields.io/badge/Backup-Google%20Drive-34A853?style=flat-square" alt="Google Drive">
  </p>

  <div style="margin-top: 12px;">
    <img src="icons/Logo-Unesa.png" alt="Logo UNESA" height="52" style="margin-right: 24px;" />
    <img src="icons/Logo-RB-Ngawi.png" alt="Logo Rumah BUMN BNI Ngawi" height="52" />
  </div>
</div>

<br>

---

## Deskripsi Aplikasi

DompetKu adalah aplikasi pencatatan keuangan berbasis web (Progressive Web App/PWA) yang dirancang untuk membantu UMKM mengelola keuangan usaha dan pribadi secara praktis, terstruktur, dan efisien. Mengusung arsitektur offline-first dengan penyimpanan lokal menggunakan IndexedDB serta fitur backup & restore melalui Google Drive pengguna, DompetKu dapat digunakan tanpa ketergantungan pada server berbayar. Aplikasi ini mengintegrasikan teknologi Artificial Intelligence (AI) untuk pencatatan transaksi melalui input teks bahasa sehari-hari, pemindaian foto struk belanja, dan interaksi suara secara real-time melalui fitur Telepon Live. AI secara otomatis memahami informasi transaksi, menentukan kantong Usaha atau Pribadi, mengklasifikasikan Pemasukan atau Pengeluaran, serta mengekstraksi detail transaksi. Dilengkapi pengelolaan kategori, transfer Suntik Modal/Prive, laporan laba bersih dan prive dalam bentuk grafik dan tabel, serta ekspor data CSV/JSON. DompetKu dikembangkan sebagai inovasi digital dalam mendukung digitalisasi dan peningkatan literasi keuangan UMKM melalui Program Magang Berdampak 2026 Universitas Negeri Surabaya bersama Rumah BUMN BNI Ngawi.

---

## Informasi Pengembangan

| Parameter | Keterangan |
| :--- | :--- |
| **Nama Pengembang** | Fazrin Mauza Dwi Zuhudi |
| **NIM** | 24050974090 |
| **Program Studi** | S1 Pendidikan Teknologi Informasi |
| **Fakultas** | Fakultas Teknik |
| **Perguruan Tinggi** | Universitas Negeri Surabaya |
| **Mitra Instansi** | Rumah BUMN BNI Ngawi |
| **Program** | Program Magang Berdampak Semester Gasal 2026/2027 |
| **Periode Pelaksanaan** | 03 Agustus 2026 sampai dengan 03 Desember 2026 |

---

## Arsitektur dan Landasan Teknis

Sistem dikembangkan dengan berlandaskan pada prinsip rekayasa perangkat lunak untuk menjamin skalabilitas, efisiensi operasional, dan kepatuhan privasi data pengguna:

1. **Penyimpanan Lokal Mandiri (Local-First Architecture)**
   Seluruh data transaksi dan entitas finansial disimpan langsung pada basis data lokal peramban klien menggunakan IndexedDB. Pendekatan ini mengeliminasi ketergantungan pada basis data peladen terpusat yang berbayar serta menjamin fungsionalitas penuh saat perangkat berada dalam kondisi luring (offline).

2. **Sinkronisasi Terdesentralisasi Google Drive**
   Untuk mitigasi risiko kehilangan data lokal, sistem mengimplementasikan mekanisme pencadangan dan pemulihan data mandiri langsung ke media penyimpanan awan Google Drive milik pengguna melalui protokol OAuth 2.0 tanpa perantara pihak ketiga.

3. **Pemisahan Entitas Keuangan Usaha dan Pribadi**
   Mengadopsi prinsip akuntansi dasar UMKM dengan memisahkan kas operasional usaha dari kas konsumtif pribadi. Aliran kas antar-kantong dicatat melalui mekanisme penambahan modal (Suntik Modal) dan penarikan ekuitas pemilik (Prive).

4. **Pemrosesan Kecerdasan Buatan Multi-Modal**
   Pemanfaatan antarmuka pemrograman aplikasi Google Gemini memungkinkan konversi data tidak terstruktur (teks percakapan bebas, berkas citra nota, dan masukan suara) menjadi entri transaksi terstruktur secara otomatis.

---

## Buku Panduan Pengguna (User Guidebook)

Guna mempercepat proses adopsi, edukasi, dan pendampingan literasi keuangan bagi pelaku UMKM binaan, telah disusun dokumen resmi **Buku Panduan Penggunaan Aplikasi DompetKu** setebal 15 halaman (format A4) dengan pembahasan sistematis langkah demi langkah:

<div align="center">
  <a href="assets/panduan/Panduan%20DompetKu.pdf" target="_blank">
    <img src="assets/panduan/cover_panduan.png" alt="Sampul Buku Panduan DompetKu" width="360" style="border-radius: 14px; box-shadow: 0 10px 30px rgba(0,0,0,0.18); border: 1px solid #e2e8f0;" />
  </a>
  <br><br>
  <p>
    <a href="https://dompetku.is-local.org/panduan.html" target="_blank">
      <img src="https://img.shields.io/badge/Akses%20Web-Halaman%20Panduan-059669?style=for-the-badge&logo=googledocs&logoColor=white" alt="Halaman Panduan">
    </a>
    &nbsp;
    <a href="assets/panduan/Panduan%20DompetKu.pdf" download="Panduan DompetKu.pdf">
      <img src="https://img.shields.io/badge/Unduh%20Berkas-PDF%20Resmi%20(5.2%20MB)-DC2626?style=for-the-badge&logo=adobeacrobatreader&logoColor=white" alt="Unduh PDF Panduan">
    </a>
  </p>
</div>

### Rangkuman Pokok Bahasan Panduan:
* **BAB 01:** Memulai Aplikasi, Registrasi Entitas Usaha, dan Penetapan Kas Awal
* **BAB 02:** Konsep Dua Kantong (Pemisahan Kas Bisnis vs Kas Pribadi Pemilik)
* **BAB 03:** Pencatatan Transaksi Bisnis (Penerimaan Omzet Jasa & Pengeluaran Bahan Baku)
* **BAB 04:** Pencatatan Transaksi Kas Kantong Pribadi Rumah Tangga
* **BAB 05:** Tata Kelola Mutasi Penarikan Prive dan Suntik Modal Berbasis Akuntansi
* **BAB 06:** Riwayat Transaksi, Penyaringan Multi-Kriteria, dan Koreksi Data
* **BAB 07:** Laporan Keuangan Laba Rugi Otomatis dan Visualisasi Tren Arus Kas
* **BAB 08:** Otomasi AI Catat Cepat (Bahasa Sehari-hari) & Pemindaian Citra Nota/Struk (OCR)
* **BAB 09:** Fitur Telepon Live AI (Panggilan Suara Interaktif Dua Arah Waktu Nyata)
* **BAB 10:** Konfigurasi Sistem, Kategori Kustom, dan Pencadangan Mandiri ke Google Drive
* **BAB 11:** Prosedur Pemasangan PWA (Home Screen) & Pengoperasian Luring (Offline)
* **PENUTUP:** Tanya Jawab Kendala Teknis (FAQ) dan Kontak Bantuan Pengembang

---

## Implementasi Antarmuka Pengguna

> Dokumentasi interaktif spesifikasi visual, filosofi desain, dan rincian frame layar dapat diakses pada dokumen: [**Perancangan Antarmuka Pengguna (UI/UX) DompetKu**](ui-design.html).

### Spesifikasi Identitas Visual dan Palet Warna Sistem

<table>
  <tr>
    <td width="50%" align="center" valign="top">
      <img src="assets/ui/DompetKu_logo_filosofi.png" alt="Identitas Logo dan Filosofi Desain DompetKu" width="100%" />
      <br><br><strong>Gambar A.</strong><br>Identitas Logo dan Filosofi Desain Sistem
    </td>
    <td width="50%" align="center" valign="top">
      <img src="assets/ui/palet_warna_DompetKu.png" alt="Palet Warna Sistem Antarmuka DompetKu" width="100%" />
      <br><br><strong>Gambar B.</strong><br>Palet Warna dan Hierarki Visual Antarmuka
    </td>
  </tr>
</table>

<br>

Pengembangan antarmuka pengguna mengadopsi pendekatan Mobile-First Responsive Design untuk menjamin kemudahan interaksi pada perangkat seluler. Pengujian fungsionalitas sistem mencakup 15 tampilan antarmuka utama yang dikelompokkan ke dalam 5 modul operasional sebagai berikut:

### 1. Inisialisasi dan Konfigurasi Profil

<table>
  <tr>
    <td width="33%" align="center" valign="top">
      <img src="assets/ui/01b_tampilan_awal_pilih_profil.png" alt="Layar 01" width="220" />
      <br><br><strong>Gambar 1.</strong><br>Pemilihan Profil Kas (Entitas Usaha dan Pribadi)
    </td>
    <td width="33%" align="center" valign="top">
      <img src="assets/ui/02_form_pendaftaran_profil_usaha.png" alt="Layar 02" width="220" />
      <br><br><strong>Gambar 2.</strong><br>Formulir Registrasi Entitas Usaha
    </td>
    <td width="33%" align="center" valign="top">
      <img src="assets/ui/03_panduan_tur_aplikasi.png" alt="Layar 03" width="220" />
      <br><br><strong>Gambar 3.</strong><br>Panduan Orientasi Fitur Aplikasi
    </td>
  </tr>
</table>

### 2. Manajemen Transaksi dan Alur Kas

<table>
  <tr>
    <td width="50%" align="center" valign="top">
      <img src="assets/ui/04_tampilan_home_dashboard.png" alt="Layar 04" width="220" />
      <br><br><strong>Gambar 4.</strong><br>Dasbor Utama Saldo dan Arus Kas
    </td>
    <td width="50%" align="center" valign="top">
      <img src="assets/ui/05_tampilan_form_transaksi.png" alt="Layar 05" width="220" />
      <br><br><strong>Gambar 5.</strong><br>Formulir Pencatatan Transaksi Kas Usaha
    </td>
  </tr>
  <tr>
    <td width="50%" align="center" valign="top">
      <img src="assets/ui/05c_tampilan_form_transaksi_pribadi.png" alt="Layar 06" width="220" />
      <br><br><strong>Gambar 6.</strong><br>Formulir Pencatatan Transaksi Kas Pribadi
    </td>
    <td width="50%" align="center" valign="top">
      <img src="assets/ui/06_tampilan_form_transfer_prive.png" alt="Layar 07" width="220" />
      <br><br><strong>Gambar 7.</strong><br>Formulir Transfer Modal dan Penarikan Prive
    </td>
  </tr>
</table>

### 3. Monitoring Riwayat dan Laporan Finansial

<table>
  <tr>
    <td width="50%" align="center" valign="top">
      <img src="assets/ui/07_tampilan_riwayat_transaksi.png" alt="Layar 08" width="220" />
      <br><br><strong>Gambar 8.</strong><br>Riwayat Mutasi dan Log Transaksi Terinci
    </td>
    <td width="50%" align="center" valign="top">
      <img src="assets/ui/08_tampilan_laporan_keuangan.png" alt="Layar 09" width="220" />
      <br><br><strong>Gambar 9.</strong><br>Rekapitulasi Laba Bersih dan Grafik Keuangan
    </td>
  </tr>
</table>

### 4. Otomasi Berbasis Kecerdasan Buatan (AI)

<table>
  <tr>
    <td width="33%" align="center" valign="top">
      <img src="assets/ui/09_tampilan_menu_ai_catat_cepat.png" alt="Layar 10" width="220" />
      <br><br><strong>Gambar 10.</strong><br>Ekstraksi Transaksi melalui Bahasa Alami (NLP)
    </td>
    <td width="33%" align="center" valign="top">
      <img src="assets/ui/10_tampilan_menu_ai_foto_struk.png" alt="Layar 11" width="220" />
      <br><br><strong>Gambar 11.</strong><br>Pemindaian Bukti Fisik Struk Belanja (Vision AI)
    </td>
    <td width="33%" align="center" valign="top">
      <img src="assets/ui/11_tampilan_telepon_live_ai.png" alt="Layar 12" width="220" />
      <br><br><strong>Gambar 12.</strong><br>Interaksi Panggilan Suara Dua Arah (Telepon Live)
    </td>
  </tr>
</table>

### 5. Konfigurasi Sistem dan Keamanan Data

<table>
  <tr>
    <td width="100%" align="center" valign="top">
      <img src="assets/ui/12_tampilan_pengaturan.png" alt="Layar 13" width="220" />
      <br><br><strong>Gambar 13.</strong><br>Konfigurasi Sistem, Kategori, dan Cadangan Google Drive
    </td>
  </tr>
</table>

---

## Analisis Fungsional Antarmuka

Berikut merupakan deskripsi teknis dari setiap komponen antarmuka yang diimplementasikan pada sistem:

### Identitas Visual dan Sistem Warna (Gambar A, Gambar B)
- **Filosofi Desain Logo (Gambar A):** Memuat representasi simbolis bentuk Dompet (kedaulatan data local-first di tangan pengguna), Dua Jari (pencatatan cepat secepat jentikan jari), Siluet Hati (keberpihakan non-komersial tanpa biaya server/iklan), dan Tiga Berkas Cahaya (sinergi tiga fitur multimodal AI: teks, struk, dan suara).
- **Hierarki Palet Warna (Gambar B):** Standarisasi warna fungsional mencakup Emerald Green (#059669) untuk entitas kas usaha, Sky Blue (#0284C7) untuk entitas kas pribadi, Crimson Red (#DC2626) untuk beban belanja dan peringatan, Amber Gold (#D97706) untuk transfer prive/modal, serta Slate Dark (#0F172A) dan Slate Light (#F8FAFC) untuk ergonomi visual pengguna.

### 1. Inisialisasi dan Konfigurasi Pengguna (Gambar 1, Gambar 2, Gambar 3)
- **Pemilihan Profil Kas (Gambar 1):** Berfungsi sebagai gerbang pemisah antara pembukuan usaha mikro dan pengelolaan keuangan personal. Pengguna dapat berganti konteks secara terisolasi tanpa mencampuradukkan saldo rekening.
- **Registrasi Profil Usaha (Gambar 2):** Menampung data legalitas dan identitas usaha, seperti nama usaha, sektor usaha, saldo kas awal, serta preferensi dasar pembukuan.
- **Panduan Pengenalan Sistem (Gambar 3):** Modul interaktif terpadu yang memandu pengguna baru dalam memahami tata cara operasional pencatatan, pemisahan kantong kas, serta pemanfaatan fitur automasi.

### 2. Manajemen Transaksi dan Mutasi Kas (Gambar 4, Gambar 5, Gambar 6, Gambar 7)
- **Dasbor Utama (Gambar 4):** Menampilkan ringkasan total saldo kas usaha aktif, saldo kas pribadi, total akumulasi pemasukan dan pengeluaran bulan berjalan, serta pintasan cepat menuju modul pencatatan.
- **Pencatatan Transaksi Kas Usaha (Gambar 5):** Formulir pencatatan operasional bisnis untuk merekam kas masuk maupun kas keluar yang terikat langsung pada pos akun usaha, lengkap dengan klasifikasi kategori beban atau omzet, metode pembayaran, tanggal transaksi, dan keterangan transaksi.
- **Pencatatan Transaksi Kas Pribadi (Gambar 6):** Formulir pencatatan kebutuhan personal yang terisolasi dari pembukuan bisnis, memastikan pencatatan pengeluaran konsumtif dan pendapatan non-usaha tidak mendistorsi perhitungan laba bersih usaha.
- **Transfer Modal dan Penarikan Prive (Gambar 7):** Fasilitas pencatatan mutasi internal antara kas usaha dan kas pribadi, mencakup transfer Suntik Modal (penambahan modal dari dana pribadi ke kas usaha) dan Prive (penarikan kas usaha untuk kebutuhan pribadi), sehingga akurasi perhitungan laba bersih usaha dan posisi kas riil tetap terjaga.

### 3. Pemantauan Riwayat dan Pelaporan (Gambar 8, Gambar 9)
- **Riwayat Mutasi Transaksi (Gambar 8):** Modul penelusuran seluruh catatan transaksi historis yang dilengkapi fitur penyaringan berdasarkan rentang tanggal, jenis arus kas, kategori transaksi, maupun kata kunci pencarian.
- **Laporan dan Analitik Keuangan (Gambar 9):** Penyajian rekapitulasi kinerja finansial berbasis periode tertentu. Menghitung secara otomatis selisih pendapatan dan beban operasional untuk menghasilkan laba atau rugi bersih, disertai visualisasi grafik tren yang dapat diekspor ke dalam format CSV dan JSON.

### 4. Otomasi Berbasis Kecerdasan Buatan (Gambar 10, Gambar 11, Gambar 12)
- **Pencatatan Bahasa Alami / NLP (Gambar 10):** Memfasilitasi pengguna untuk memasukkan keterangan transaksi dalam bahasa percakapan sehari-hari. Model AI mengekstraksi nominal, entitas kantong, jenis arus kas, serta klasifikasi kategori transaksi secara otomatis tanpa pengisian formulir manual.
- **Pemindaian Bukti Fisik Struk (Gambar 11):** Fitur pemrosesan citra nota atau struk belanja menggunakan Optical Character Recognition (OCR) dan penalaran multimodal untuk mendeteksi tanggal transaksi, nama rekanan dagang, dan total nominal tagihan secara tepat.
- **Panggilan Suara Real-Time Telepon Live (Gambar 12):** Antarmuka interaksi suara dua arah yang memproses masukan audio pengguna secara langsung, mengekstraksi data finansial yang dibicarakan, dan mencatatkannya ke dalam sistem pembukuan secara langsung.

### 5. Konfigurasi Sistem dan Keamanan Data (Gambar 13)
- **Pengaturan Preferensi dan Sinkronisasi (Gambar 13):** Fasilitas untuk mengatur hierarki kategori transaksi kustom, mengelola autentikasi Google Drive untuk keperluan pencadangan (backup) dan pemulihan (restore) berkas basis data, serta mengelola preferensi operasional aplikasi.

---

<div align="center">
  <p>Dikembangkan oleh <strong>Fazrin Mauza Dwi Zuhudi</strong> (NIM: 24050974090)<br>Program Magang Berdampak 2026: Universitas Negeri Surabaya dan Rumah BUMN BNI Ngawi</p>
</div>
