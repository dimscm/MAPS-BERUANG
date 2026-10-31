/**
 * Penyimpanan tanda kunjungan untuk web Maps Beruang.
 *
 * Pasang di Google Sheet tim: Extensions → Apps Script, tempel file ini,
 * lalu Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone).
 * Opsional: Project Settings → Script properties → KODE_TIM = <kode rahasia tim>.
 *
 * Tab "Kunjungan" = data utama (satu baris per outlet). Tab per RSM (JAKBAR 1, JAKSEL 2,
 * JAKTIM, BEKASI KOTA, …) dibuat & diperbarui otomatis setiap ada kunjungan disimpan.
 * Untuk memperbaiki/membuat ulang semua tab RSM: pilih fungsi perbaruiSemuaTabRSM → Run.
 */
const SHEET_NAME = "Kunjungan";
const HEADERS = ["id", "Nama Toko", "RSM", "Kecamatan", "Kelurahan", "Status Kunjungan",
  "Tanggal Kunjungan", "Dikunjungi oleh", "Catatan", "Terakhir diperbarui"];
const C = { id: 0, rsm: 2, status: 5, visitedAt: 6, by: 7, note: 8, updatedAt: 9 };

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME, 0);
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#dbeafe");
    sh.setFrozenRows(1);
  }
  return sh;
}

// Tab per RSM: isinya disalin langsung dari tab Kunjungan (tanpa rumus, jadi tidak
// terpengaruh pengaturan bahasa/locale Sheet). Diperbarui setiap ada simpan/hapus.
function rsmName_(rsm) {
  return String(rsm || "").trim().toUpperCase().replace(/[^A-Z0-9 _-]/g, "").slice(0, 40);
}

function syncRsmTab_(rsm) {
  const name = rsmName_(rsm);
  if (!name || name === SHEET_NAME.toUpperCase()) return;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  const rows = getSheet_().getDataRange().getValues().slice(1)
    .filter((r) => r[C.id] && rsmName_(r[C.rsm]) === name);
  sh.clearContents();
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight("bold").setBackground("#dbeafe");
  sh.setFrozenRows(1);
  if (rows.length) sh.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
}

// Jalankan sekali dari editor (pilih fungsi ini → Run) untuk membuat/memperbaiki semua tab RSM.
function perbaruiSemuaTabRSM() {
  const rsms = new Set(getSheet_().getDataRange().getValues().slice(1).map((r) => rsmName_(r[C.rsm])).filter(Boolean));
  rsms.forEach((r) => syncRsmTab_(r));
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function keyOk_(key) {
  const want = PropertiesService.getScriptProperties().getProperty("KODE_TIM");
  return !want || String(key || "") === want;
}

function toIso_(v) { return v instanceof Date ? v.toISOString() : String(v || ""); }
function toDate_(iso) { return iso ? new Date(iso) : ""; }
// Teks yang diawali = + - @ bisa dibaca Sheets sebagai rumus.
function text_(v) { const s = String(v || ""); return /^[=+\-@]/.test(s) ? "'" + s : s; }
function untext_(v) { const s = String(v || ""); return s.charAt(0) === "'" ? s.slice(1) : s; }

function doGet(e) {
  if (!keyOk_(e && e.parameter && e.parameter.key)) return json_({ ok: false, error: "kode" });
  const rows = getSheet_().getDataRange().getValues().slice(1);
  const visits = rows.filter((r) => r[C.id]).map((r) => ({
    id: String(r[C.id]),
    visited: r[C.status] === "Sudah didatangi",
    visitedAt: toIso_(r[C.visitedAt]),
    by: untext_(r[C.by]),
    note: untext_(r[C.note]),
    updatedAt: toIso_(r[C.updatedAt]),
  }));
  return json_({ ok: true, visits: visits });
}

function doPost(e) {
  let b;
  try { b = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: "format" }); }
  if (!keyOk_(b.key)) return json_({ ok: false, error: "kode" });
  if (!b.id) return json_({ ok: false, error: "format" });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = getSheet_();
    const ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues().map((r) => String(r[0]));
    const idx = ids.indexOf(String(b.id));
    if (b.remove) {
      if (idx > 0) {
        const oldRsm = sh.getRange(idx + 1, C.rsm + 1).getValue();
        sh.deleteRow(idx + 1);
        syncRsmTab_(oldRsm);
      }
      return json_({ ok: true });
    }
    const row = [String(b.id), text_(b.nama), text_(b.rsm), text_(b.kecamatan), text_(b.kelurahan),
      b.visited ? "Sudah didatangi" : "Belum didatangi", toDate_(b.visitedAt),
      text_(b.by), text_(b.note), toDate_(b.updatedAt)];
    if (idx > 0) sh.getRange(idx + 1, 1, 1, row.length).setValues([row]);
    else sh.appendRow(row);
    syncRsmTab_(b.rsm);
    return json_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}
