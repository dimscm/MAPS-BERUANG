# Maps Beruang 🐻📍

Peta outlet survei **Bear Brand yang belum jual S7K & Collagena** untuk tim sales — cari outlet terdekat,
lihat data survei (pemilik, status FU/NOO, transaksi Collagena/S7K, tempat beli, foto toko), navigasi,
dan catat kunjungan yang otomatis masuk Google Sheet per RSM.

Live: https://dimscm.github.io/maps-beruang/

## Data

`public/seed-outlets.json` dibuat dari Excel `LIST OUTLET BB TDK JUAL S7K & COLLAGENA` (7 sheet: Jakbar,
Jaksel 1, Jaksel 2, Jaktim, Jakut, Jakpus, BEKASI KOTA) — 5.194 outlet. Koordinat diambil dari kolom
`Koordinat Geotag` / `Lat Long`; kecamatan, kelurahan, kota dicocokkan dari titik koordinat ke batas desa
Kemendagri 2020.

Memperbarui data dari Excel baru:

```bash
python3 scripts/build_seed.py "LIST_OUTLET.xlsx" public/seed-outlets.json
# (opsional) isi kecamatan/kelurahan/kota dari batas wilayah dengan skrip tag point-in-polygon
```

lalu naikkan `SEED_VERSION` di `lib/config.ts` dan push. Aplikasi pengguna otomatis memuat data baru;
outlet tambahan manual dan riwayat kunjungan tetap tersimpan.

## Fitur

- Peta (Leaflet + OpenStreetMap), radius dari GPS, pencarian nama/pemilik/status ke semua outlet
- Filter RSM, segmen (Solus BB, BB only, Dual S7K & BB, …), kecamatan → kelurahan, status kunjungan
- Klik titik → popup: segmen, pemilik, foto toko/chiller, **Navigasi** (Google Maps), **Catat Visit**
- Data disimpan di IndexedDB browser (cukup untuk ±5.000 outlet, tetap ada saat offline/refresh)

## Hasil kunjungan ke Google Sheet

Setiap kunjungan dikirim ke tab `SEMUA` dan tab per RSM (JAKBAR 1, JAKBAR 2, JAKSEL 1, JAKSEL 2,
JAKTIM, JAKUT, JAKPUS, BEKASI KOTA). Kunjungan tim dibaca balik sehingga warna titik sama di semua pengguna.

1. Buat Google Sheet baru → **Extensions → Apps Script**, tempel `google-apps-script/Code.gs`, simpan.
2. **Deploy → New deployment → Web app**; Execute as **Me**; Who has access **Anyone** → Deploy.
3. Salin URL Web App ke `SHEET_WEBHOOK_URL` di `lib/config.ts`, push.
4. Perubahan script berikutnya: **Manage deployments → ✏️ → New version** (URL tetap sama).

## Menjalankan lokal

```bash
npm install
npm run dev
BASE_PATH=/maps-beruang npm run build   # static export ke out/
```

Deploy otomatis ke GitHub Pages lewat `.github/workflows/deploy.yml` setiap push ke `main`.
