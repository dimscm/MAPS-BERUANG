"""Konversi LIST_OUTLET_BB_TDK_JUAL_S7K & COLLAGENA.xlsx -> seed-outlets.json untuk MAPS-BERUANG."""
import json, re, sys, collections
import openpyxl

src, dst = sys.argv[1], sys.argv[2]
wb = openpyxl.load_workbook(src, data_only=True)

def s(v):
    if v is None: return ''
    if isinstance(v, float):
        return str(int(v)) if v.is_integer() else f'{v:g}'
    return re.sub(r'\s+', ' ', str(v).replace('⁠', '')).strip()

def tc(v):
    v = s(v)
    return ' '.join(w[:1].upper() + w[1:].lower() for w in v.split()) if v else ''

def coord(text):
    m = re.findall(r'-?\d+\.\d+', s(text))
    if len(m) < 2: return None
    lat, lng = float(m[0]), float(m[1])
    if not (-7.2 < lat < -5.8 and 106.3 < lng < 107.7): return None
    return lat, lng

def is_url(v): return s(v).startswith('http')
NA = {'#N/A', '-', 'v', 'V'}

out, skipped = [], collections.Counter()
seen = set()
for ws in wb.worksheets:
    rows = list(ws.iter_rows(values_only=True))
    hi = next(i for i, r in enumerate(rows) if r and any(s(c) in ('name', 'Store Name') for c in r))
    H = [s(h) for h in rows[hi]]
    col = {h: j for j, h in enumerate(H) if h and h not in ('',)}
    bekasi = 'Lat Long' in col
    for r in rows[hi + 1:]:
        g = lambda h: r[col[h]] if h in col and col[h] < len(r) else None
        name = s(g('Store Name') if bekasi else g('name')) or s(g('name'))
        if not name: skipped['tanpa nama'] += 1; continue
        c = coord(g('Lat Long') if bekasi else g('Koordinat Geotag'))
        if not c: skipped['koordinat tidak valid'] += 1; continue
        info = []
        def add(label, v):
            v = s(v)
            if v and v not in NA: info.append({'label': label, 'value': v})
        if bekasi:
            rayon = 'BEKASI KOTA'
            category = s(r[1]) or 'Lainnya'
            code = ''
            add('Pemilik', g('Owner Name'))
            add('TPH LS', r[0])
            add('Brand susu di toko', g('List of Brands RTD Milk Available in-store'))
            add('Supplier Bear Brand', g('Bear Brand - Supplier Type'))
            add('Grosir Bear Brand', ' — '.join(x for x in [s(g('Bear Brand - Wholesale Name')), s(g('Bear Brand - Wholesale Location'))] if x))
            add('Tanggal survei', g('created_at'))
            kec, kel, city = tc(g('Kecamatan')), tc(g('Kelurahan')), 'Kota Bekasi'
            photos = [{'label': 'Foto toko', 'url': s(g('Storefront Photo'))}] if is_url(g('Storefront Photo')) else []
        else:
            rayon = s(g('RSM')).upper() or ws.title.upper()
            category = 'Solus BB' if s(r[0]).lower() == 'solus bb' else 'Lainnya'
            ko = s(g('KODE OUTLET'))
            code = ko if re.fullmatch(r'\d{5,}', ko) else ''
            add('Pemilik', g('Owner Name'))
            if ko and not code and ko not in ('0',): add('Status', ko)
            add('Collagena (ctn)', g('TRANSAKSI COLLAGENA (Jumlah Ctn)'))
            add('S7K (ctn)', g('TRANSAKSI S7K (Jumlah Ctn)'))
            add('S7K Kids (ctn)', g('TRANSAKSI S7K kids (Jumlah Ctn)'))
            add('Beli Collagena di', g('Tempat membeli Collagena'))
            add('Beli S7K di', ' — '.join(x for x in [s(g('Nama Grosir/toko beli S7K')), s(g('Tempat Grosir/toko beli S7K'))] if x))
            add('Beli Bear Brand di', ' — '.join(x for x in [s(g('Nama Toko Grosir tempat membeli BB')), s(g('Alamat Toko Grosir tempat membeli BB'))] if x))
            if ws.title == 'Jaksel 2' and s(r[0]) and s(r[0]).lower() != 'solus bb': add('Sales', r[0])
            kec, kel = tc(g('KECAMATAN')), tc(g('Kelurahan'))
            city = ''
            photos = [{'label': l, 'url': s(g(h))} for l, h in [('Foto toko', 'Storefront Photo'), ('Foto chiller', 'Chiler Photo')] if is_url(g(h))]
        key = (name.upper(), round(c[0], 5), round(c[1], 5))
        if key in seen: skipped['duplikat'] += 1; continue
        seen.add(key)
        out.append({
            'id': f'b-{len(out)+1:05d}', 'outlet_code': code, 'name': name, 'address': '',
            'kelurahan': kel, 'kecamatan': kec, 'city': city, 'salesman': '', 'rayon': rayon,
            'category': category, 'latitude': round(c[0], 7), 'longitude': round(c[1], 7),
            'is_active': True, 'created_at': '2026-10-24T00:00:00.000Z', 'updated_at': '2026-10-24T00:00:00.000Z',
            'info': info, 'photos': photos, 'sheet': ws.title,
        })
json.dump(out, open(dst, 'w'), ensure_ascii=False, separators=(',', ':'))
print('outlet:', len(out), 'dilewati:', dict(skipped), file=sys.stderr)
print(collections.Counter(o['rayon'] for o in out), file=sys.stderr)
print(collections.Counter(o['category'] for o in out), file=sys.stderr)
