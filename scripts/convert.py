"""Konversi Excel LIST OUTLET BB TDK JUAL S7K & COLLAGENA -> data/outlets.js untuk web.

Membaca semua sheet. Sheet Jakarta (Jakbar, Jaksel 1, Jaksel 2, Jaktim, Jakut, Jakpus) punya
kolom survei BB/S7K/Collagena; sheet BEKASI KOTA punya kolom berbeda (brand susu, supplier BB).
Koordinat diambil dari kolom teks "Koordinat Geotag" / "Lat Long" (kolom latitude/longitude
angka di Excel sering rusak format ribuannya). Kota ditentukan dari nama kecamatan
(scripts/kecamatan_kota.json), bukan dari nama sheet.

id outlet dibentuk dari nama + koordinat, jadi tetap sama saat Excel diperbarui dan tanda
kunjungan di Google Sheet tidak hilang.

Pemakaian: python3 scripts/convert.py "LIST_OUTLET_BB_TDK_JUAL_S7K___COLLAGENA.xlsx"
"""
import datetime
import hashlib
import json
import pathlib
import re
import sys
from collections import Counter

import openpyxl

from stamp import stamp

ROOT = pathlib.Path(__file__).resolve().parent.parent
KEC = json.loads((ROOT / "scripts" / "kecamatan_kota.json").read_text(encoding="utf-8"))
RSM_KOTA = {"JAKBAR": "Kota Jakarta Barat", "JAKSEL": "Kota Jakarta Selatan", "JAKTIM": "Kota Jakarta Timur",
            "JAKUT": "Kota Jakarta Utara", "JAKPUS": "Kota Jakarta Pusat", "BEKASI": "Kota Bekasi"}

COLS = ["id", "Nama Toko", "Pemilik", "RSM", "Segmen", "Kota", "Kecamatan", "Kelurahan", "latitude", "longitude",
        "Kode Outlet", "Status FU/NOO", "Transaksi Collagena", "Transaksi S7K", "Transaksi S7K Kids",
        "Beli Collagena di", "Beli S7K - Nama", "Beli S7K - Lokasi", "Beli BB - Nama", "Beli BB - Alamat",
        "Sales", "TPH LS", "Brand Susu di Toko", "Brand Susu di Chiller", "Supplier BB", "Grosir BB",
        "Lokasi Grosir BB", "Tanggal Survei", "Foto Toko", "Foto Chiller", "Sheet"]
NA = {"#N/A", "-", "None"}


def s(v):
    if v is None:
        return ""
    if isinstance(v, datetime.datetime):
        return v.strftime("%Y-%m-%d %H:%M")
    if isinstance(v, float):
        return str(int(v)) if v.is_integer() else f"{v:g}"
    v = re.sub(r"\s+", " ", str(v).replace("⁠", "")).strip()
    return "" if v in NA else v


def tc(v):
    return " ".join(w[:1].upper() + w[1:].lower() for w in s(v).split())


def coord(text):
    m = re.findall(r"-?\d+\.\d+", s(text))
    if len(m) < 2:
        return None
    lat, lng = float(m[0]), float(m[1])
    return (lat, lng) if -7.2 < lat < -5.8 and 106.3 < lng < 107.7 else None


def url(v):
    v = s(v)
    return v if v.startswith("https://") and "/users//" not in v else ""


def kota_kec(kec, rsm):
    hit = KEC.get(re.sub(r"[^a-z]", "", kec.lower()))
    if hit:
        return hit[1], hit[0]
    return next((k for p, k in RSM_KOTA.items() if rsm.startswith(p)), ""), tc(kec)


src = sys.argv[1] if len(sys.argv) > 1 else "LIST_OUTLET_BB_TDK_JUAL_S7K___COLLAGENA.xlsx"
wb = openpyxl.load_workbook(src, read_only=True, data_only=True)
rows, seen, skipped = [], set(), Counter()

for ws in wb.worksheets:
    data = list(ws.iter_rows(values_only=True))
    hi = next(i for i, r in enumerate(data) if r and any(s(c) in ("name", "Store Name") for c in r))
    head = [s(h) for h in data[hi]]
    col = {}
    for j, h in enumerate(head):
        if h and h not in col:
            col[h] = j
    bekasi = "Lat Long" in col
    for r in data[hi + 1:]:
        g = lambda h: r[col[h]] if h in col and col[h] < len(r) else None
        name = s(g("Store Name") if bekasi else g("name")) or s(g("name"))
        if not name:
            skipped["tanpa nama"] += 1
            continue
        c = coord(g("Lat Long") if bekasi else g("Koordinat Geotag"))
        if not c:
            skipped["koordinat tidak valid"] += 1
            continue
        key = (name.upper(), round(c[0], 5), round(c[1], 5))
        if key in seen:
            skipped["duplikat"] += 1
            continue
        seen.add(key)
        o = dict.fromkeys(COLS, "")
        o["id"] = "b-" + hashlib.sha1(f"{name.upper()}|{c[0]:.5f}|{c[1]:.5f}".encode()).hexdigest()[:12]
        o.update({"Nama Toko": name, "Pemilik": s(g("Owner Name")), "latitude": round(c[0], 7),
                  "longitude": round(c[1], 7), "Sheet": ws.title})
        if bekasi:
            o["RSM"] = "BEKASI KOTA"
            o["Segmen"] = s(r[1]) or "Lainnya"
            o["Kota"], o["Kecamatan"] = kota_kec(s(g("Kecamatan")), "BEKASI")
            o["Kelurahan"] = tc(g("Kelurahan"))
            o["TPH LS"] = s(r[0])
            o["Brand Susu di Toko"] = s(g("List of Brands RTD Milk Available in-store"))
            o["Brand Susu di Chiller"] = s(g("List of Brands RTD Milk Available in Chiller"))
            o["Supplier BB"] = s(g("Bear Brand - Supplier Type"))
            o["Grosir BB"] = s(g("Bear Brand - Wholesale Name"))
            o["Lokasi Grosir BB"] = s(g("Bear Brand - Wholesale Location"))
            o["Tanggal Survei"] = s(g("created_at"))
            o["Foto Toko"] = url(g("Storefront Photo"))
        else:
            o["RSM"] = s(g("RSM")).upper() or ws.title.upper()
            first = s(r[0])
            o["Segmen"] = "Solus BB" if first.lower() == "solus bb" else "Lainnya"
            if first and first.lower() != "solus bb":
                o["Sales"] = first
            o["Kota"], o["Kecamatan"] = kota_kec(s(g("KECAMATAN")), o["RSM"])
            o["Kelurahan"] = tc(g("Kelurahan"))
            ko = s(g("KODE OUTLET"))
            if re.fullmatch(r"\d{5,}", ko):
                o["Kode Outlet"] = ko
            elif ko not in ("", "0"):
                o["Status FU/NOO"] = ko
            o["Transaksi Collagena"] = s(g("TRANSAKSI COLLAGENA (Jumlah Ctn)"))
            o["Transaksi S7K"] = s(g("TRANSAKSI S7K (Jumlah Ctn)"))
            o["Transaksi S7K Kids"] = s(g("TRANSAKSI S7K kids (Jumlah Ctn)"))
            o["Beli Collagena di"] = s(g("Tempat membeli Collagena"))
            o["Beli S7K - Nama"] = s(g("Nama Grosir/toko beli S7K"))
            o["Beli S7K - Lokasi"] = s(g("Tempat Grosir/toko beli S7K"))
            o["Beli BB - Nama"] = s(g("Nama Toko Grosir tempat membeli BB"))
            o["Beli BB - Alamat"] = s(g("Alamat Toko Grosir tempat membeli BB"))
            o["Foto Toko"] = url(g("Storefront Photo"))
            o["Foto Chiller"] = url(g("Chiler Photo"))
        rows.append([o[k] for k in COLS])

with open(ROOT / "data" / "outlets.js", "w", encoding="utf-8") as f:
    f.write("window.OUTLET_DATA=")
    json.dump({"cols": COLS, "rows": rows}, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")
print(f"{len(rows)} outlet ditulis ke data/outlets.js; dilewati: {dict(skipped)}")
print(Counter(r[COLS.index('RSM')] for r in rows))
stamp()
