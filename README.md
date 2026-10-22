# Jawa Timur 6 — Performance Dashboard

Dashboard web statis yang terpisah dari Marley. Dibuat dengan HTML, CSS, JavaScript, dan Chart.js; dapat dijalankan di browser atau dipasang di GitHub Pages.

## Fitur
- KPI regional/hasil filter: jumlah branch, RR Current tertimbang, NOA Current, NOA DPD 1–30, dan NOA DPD 90+.
- Grafik tren RR Current dan komposisi DPD.
- Filter area/branch, pencarian, pengurutan tabel, dan export CSV.
- Layout responsif untuk desktop dan ponsel.

## Menjalankan
1. Extract ZIP ini.
2. Jalankan dengan local web server (direkomendasikan) karena browser dapat memblokir `fetch()` saat membuka `index.html` langsung. Contoh: `python -m http.server 8000`, lalu buka `http://localhost:8000`.
3. Secara default dashboard memakai `data.example.json` (demo anonim).
4. Untuk data internal, siapkan file `data.json` dengan struktur yang sama. File `data.json` sengaja masuk `.gitignore` agar tidak ikut terunggah secara tidak sengaja.

## Memakai data Excel
- Simpan file Excel sumber di folder kerja lokal, lalu jalankan skrip `build_data.py` dengan path file sebagai argumen:
  `python build_data.py "Jawa Timur 6.xlsx"`
- Skrip akan menghasilkan `data.json` lokal untuk dashboard.
- Pastikan data yang diekspor memang diizinkan untuk dipakai. Skrip hanya mengekspor metrik branch, area, status/movement, dan tren agregat; tidak mengekspor nama/NIK pegawai.

## GitHub
**Jangan commit `data.json` atau file Excel internal ke repository publik.** Data operasional portofolio dapat bersifat rahasia. Untuk demo publik, gunakan `data.example.json`. Jika dashboard perlu menampilkan data aktual, gunakan repository privat dan pastikan kebijakan akses/hosting perusahaan mengizinkan publikasi tersebut. GitHub Pages tidak otomatis membuat data privat menjadi aman; file yang dipublikasikan lewat Pages dapat diakses publik.

## Deploy GitHub Pages (demo)
1. Buat repository baru.
2. Upload `index.html`, `style.css`, `app.js`, `data.example.json`, `README.md`, `.gitignore`, dan `build_data.py`.
3. Buka **Settings → Pages**.
4. Pilih **Deploy from a branch**, branch `main`, folder `/ (root)`, lalu Save.
5. Buka URL Pages yang diberikan GitHub.

## Catatan
- Grafik tren menggunakan tren regional 30 hari terakhir dan tidak berubah saat filter branch/area digunakan; tabel, KPI, dan komposisi DPD mengikuti filter aktif.
- Persentase RR dihitung sebagai weighted rate berdasarkan NOA pada bucket.
- `data.example.json` sepenuhnya demo dan tidak merepresentasikan kinerja aktual.
