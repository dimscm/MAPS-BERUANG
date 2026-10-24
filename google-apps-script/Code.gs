/**
 * MAPS BERUANG ↔ Google Sheet
 *
 * POST  : setiap kunjungan ditulis ke tab "SEMUA" (rekap) dan tab wilayah
 *         per RSM (JAKBAR 1, JAKBAR 2, JAKSEL 1, JAKSEL 2, JAKTIM, JAKUT, JAKPUS, BEKASI KOTA).
 * GET ?action=visits : mengirim balik semua kunjungan agar status titik di peta
 *         sama untuk semua pengguna aplikasi.
 *
 * Setelah mengganti script: Deploy → Manage deployments → ✏️ → Version: New version → Deploy
 * (JANGAN "New deployment", supaya URL tidak berubah).
 */
const ALL_TAB = 'SEMUA';
const HEADERS = [
  'visit_id', 'waktu_kunjungan', 'dicatat_pada', 'salesman', 'hasil', 'tanggal_follow_up', 'catatan',
  'kode_outlet', 'nama_outlet', 'alamat', 'kelurahan', 'kecamatan', 'kota', 'wilayah', 'rayon', 'kategori',
  'lat_outlet', 'lng_outlet', 'lat_sales', 'lng_sales', 'jarak_sales_ke_outlet_m', 'diterima_server',
  'outlet_id', 'waktu_iso',
];

// Ambil tab; buat bila belum ada; pastikan semua kolom HEADERS ada (kolom baru ditambah di kanan)
function getTab_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
  } else {
    const cur = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(String);
    const missing = HEADERS.filter((h) => cur.indexOf(h) < 0);
    if (missing.length) sh.getRange(1, cur.length + 1, 1, missing.length).setValues([missing]);
  }
  sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold').setBackground('#dbeafe');
  sh.setFrozenRows(1);
  return sh;
}

function headerOf_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const d = JSON.parse(e.postData.contents);
    const area = String(d.area || 'LAINNYA').toUpperCase().replace(/[^A-Z0-9 _-]/g, '').slice(0, 30) || 'LAINNYA';
    d.wilayah = area;
    d.waktu_iso = d.waktu_kunjungan || '';
    const all = getTab_(ALL_TAB);

    // Cegah dobel: visit_id yang sama tidak ditulis dua kali
    const last = all.getLastRow();
    if (last > 1) {
      const found = all.getRange(2, 1, last - 1, 1).createTextFinder(String(d.visit_id)).matchEntireCell(true).findNext();
      if (found) return out_({ ok: true, duplicate: true });
    }

    const tz = Session.getScriptTimeZone();
    const fmt = (iso) => (iso ? Utilities.formatDate(new Date(iso), tz, 'yyyy-MM-dd HH:mm') : '');
    const value = (h) => {
      if (h === 'waktu_kunjungan' || h === 'dicatat_pada') return fmt(d[h]);
      if (h === 'diterima_server') return Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss');
      return d[h] === undefined || d[h] === null ? '' : d[h];
    };
    all.appendRow(headerOf_(all).map(value));
    const tab = getTab_(area);
    tab.appendRow(headerOf_(tab).map(value));
    return out_({ ok: true, tab: area });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  const all = getTab_(ALL_TAB);
  if (!e || !e.parameter || e.parameter.action !== 'visits') {
    return out_({ ok: true, info: 'MAPS BERUANG webhook aktif (per RSM + baca status)' });
  }
  const last = all.getLastRow();
  if (last < 2) return out_({ ok: true, visits: [] });
  const head = headerOf_(all);
  const col = (h) => head.indexOf(h);
  const rows = all.getRange(2, 1, last - 1, head.length).getValues();
  const iso = (v) => (v instanceof Date ? v.toISOString() : String(v || ''));
  const visits = rows
    .filter((r) => r[col('visit_id')] && String(r[col('salesman')]).indexOf('TES DARI CLAUDE') !== 0)
    .map((r) => ({
      id: String(r[col('visit_id')]),
      outlet_id: col('outlet_id') >= 0 ? String(r[col('outlet_id')] || '') : '',
      outlet_code: String(r[col('kode_outlet')] || ''),
      outlet_name: String(r[col('nama_outlet')] || ''),
      // waktu_iso (presisi) bila ada; jika tidak, waktu_kunjungan dari sel (Date / teks)
      visit_time: (col('waktu_iso') >= 0 && r[col('waktu_iso')]) ? iso(r[col('waktu_iso')]) : iso(r[col('waktu_kunjungan')]),
      sales_name: String(r[col('salesman')] || ''),
      hasil: String(r[col('hasil')] || ''),
      follow_up_date: r[col('tanggal_follow_up')] instanceof Date
        ? Utilities.formatDate(r[col('tanggal_follow_up')], Session.getScriptTimeZone(), 'yyyy-MM-dd')
        : String(r[col('tanggal_follow_up')] || ''),
      notes: String(r[col('catatan')] || ''),
    }));
  return out_({ ok: true, visits: visits });
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
