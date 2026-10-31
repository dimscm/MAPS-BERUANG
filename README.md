# Maps Beruang 🐻

Web statis untuk menjelajahi **5.193 outlet Bear Brand yang belum jual S7K & Collagena**
(Jakbar, Jaksel, Jaktim, Jakut, Jakpus, Kota Bekasi) — tampilan mengikuti
[pokemon-lemine](https://github.com/dimscm/pokemon-lemine).

Live: https://dimscm.github.io/MAPS-BERUANG/

Fitur:
- **Peta** outlet (cluster) dengan popup → detail, **Rute** ke Google Maps, outlet terdekat dari GPS
- **Tabel** yang bisa diurutkan, klik baris untuk detail lengkap + foto toko
- **Ringkasan** per RSM, kecamatan, segmen, status FU/NOO, transaksi, sumber pembelian S7K/BB
- Filter: pencarian, status kunjungan, jarak, RSM → kota → kecamatan → kelurahan, segmen, status FU/NOO, punya data
- Tanda **sudah didatangi** + catatan per outlet, terlihat oleh seluruh tim lewat Google Sheet
- Unduh Excel sesuai filter, termasuk status, tanggal, petugas, dan catatan kunjungan

## Memperbarui data

```sh
pip install openpyxl
python3 scripts/convert.py LIST_OUTLET_BB_TDK_JUAL_S7K___COLLAGENA.xlsx
```

Skrip membaca semua sheet (format sheet BEKASI KOTA berbeda dan ikut ditangani), mengambil koordinat dari
kolom teks `Koordinat Geotag` / `Lat Long`, menentukan kota dari kecamatan (`scripts/kecamatan_kota.json`),
lalu menulis ulang `data/outlets.js` dan memberi penanda versi di `index.html`. id outlet dibentuk dari
nama + koordinat, jadi tanda kunjungan tetap nyambung setelah data diperbarui. Kalau `app.js`/`style.css`/
`config.js` diubah manual, jalankan `python3 scripts/stamp.py`.

## Tanda kunjungan bersama (Google Sheet)

1. Buat Google Sheet baru (mis. "Kunjungan Maps Beruang").
2. **Extensions → Apps Script**, hapus isi `Code.gs`, tempel [`apps-script/Code.gs`](apps-script/Code.gs). Simpan.
3. (Disarankan) **Project Settings → Script Properties**: `KODE_TIM` = kode rahasia tim.
4. **Deploy → New deployment → Web app** · Execute as **Me** · Who has access **Anyone** → Deploy → salin URL `/exec`.
5. Tempel ke `config.js` (`window.VISITS_API = "…"`), jalankan `python3 scripts/stamp.py`, commit & push.

Tab **Kunjungan** berisi satu baris per outlet (id, nama, RSM, kecamatan, kelurahan, status, tanggal, petugas,
catatan). Tab per RSM (JAKBAR 1, JAKSEL 2, JAKTIM, BEKASI KOTA, …) dibuat dan diperbarui otomatis setiap ada
kunjungan disimpan (fungsi `perbaruiSemuaTabRSM` untuk membangun ulang semuanya). Web memuat ulang data tiap 30 detik. Kalau `Code.gs` diubah:
**Deploy → Manage deployments → ✏️ → Version: New version** supaya URL tetap sama.

Deploy otomatis ke GitHub Pages lewat `.github/workflows/deploy.yml` setiap push ke `main`.
