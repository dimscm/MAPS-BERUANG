'use client';

import { useRef, useState } from 'react';
import Modal from './Modal';
import { parseFileToRows, mapRows, ParsedRow } from '@/lib/importUtils';
import { useStore } from '@/lib/store';
import { uid, nowIso } from '@/lib/id';
import type { Outlet } from '@/lib/types';

export default function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const outlets = useStore((s) => s.outlets);
  const bulkAdd = useStore((s) => s.bulkAddOutlets);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ added: number; skipped: number } | null>(null);
  const [error, setError] = useState('');

  async function handleFile(file: File) {
    setError('');
    setDone(null);
    setLoading(true);
    try {
      const data = await parseFileToRows(file);
      setRows(mapRows(data, outlets));
      setFileName(file.name);
    } catch (e) {
      setError('Gagal membaca file. Pastikan format Excel (.xlsx) atau CSV.');
    } finally {
      setLoading(false);
    }
  }

  const validRows = rows.filter((r) => r.outlet && !r.duplicate);
  const invalidRows = rows.filter((r) => !r.outlet);
  const dupRows = rows.filter((r) => r.outlet && r.duplicate);

  function confirmImport() {
    const toAdd: Outlet[] = validRows.map((r) => ({
      ...(r.outlet as Partial<Outlet>),
      id: uid(),
      is_active: true,
      created_at: nowIso(),
      updated_at: nowIso(),
    })) as Outlet[];
    const added = bulkAdd(toAdd);
    setDone({ added, skipped: rows.length - validRows.length });
    setRows([]);
    setFileName('');
  }

  function reset() {
    setRows([]);
    setFileName('');
    setDone(null);
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <Modal open={open} onClose={onClose} title="Import Outlet (Excel / CSV)" wide>
      {!done && (
        <>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600">
            <span className="text-2xl">📄</span>
            {loading ? 'Membaca file…' : fileName ? `File: ${fileName}` : 'Ketuk untuk pilih file .xlsx atau .csv'}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv,.txt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </label>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          {rows.length > 0 && (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-green-50 p-2">
                  <div className="text-lg font-bold text-green-700">{validRows.length}</div>
                  Data valid
                </div>
                <div className="rounded-lg bg-red-50 p-2">
                  <div className="text-lg font-bold text-red-700">{invalidRows.length}</div>
                  Bermasalah
                </div>
                <div className="rounded-lg bg-amber-50 p-2">
                  <div className="text-lg font-bold text-amber-700">{dupRows.length}</div>
                  Duplikat
                </div>
              </div>

              <p className="text-xs text-slate-500">
                Kolom dikenali otomatis dari header: nama, alamat, koordinat, salesman, rayon,
                kategori, kode. Baris duplikat & bermasalah tidak disimpan.
              </p>

              <div className="max-h-64 overflow-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-100 text-slate-600">
                    <tr>
                      <th className="p-2">Baris</th>
                      <th className="p-2">Nama</th>
                      <th className="p-2">Koordinat</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 100).map((r) => (
                      <tr key={r.rowNumber} className="border-t border-slate-100">
                        <td className="p-2">{r.rowNumber}</td>
                        <td className="p-2 font-medium">{r.name}</td>
                        <td className="p-2">
                          {r.outlet
                            ? `${(r.outlet.latitude as number).toFixed(5)}, ${(r.outlet.longitude as number).toFixed(5)}`
                            : '—'}
                        </td>
                        <td className="p-2">
                          {r.duplicate ? (
                            <span className="text-amber-600">Duplikat</span>
                          ) : r.errors.length > 0 ? (
                            <span className="text-red-600" title={r.errors.join('; ')}>
                              {r.errors[0]}
                            </span>
                          ) : (
                            <span className="text-green-600">Valid</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 100 && (
                  <p className="p-2 text-center text-xs text-slate-400">
                    Menampilkan 100 dari {rows.length} baris
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={confirmImport}
                  disabled={validRows.length === 0}
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:bg-slate-300"
                >
                  Simpan {validRows.length} Outlet
                </button>
                <button
                  onClick={reset}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-600"
                >
                  Ulangi
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {done && (
        <div className="py-6 text-center">
          <p className="text-4xl">✅</p>
          <p className="mt-2 text-sm">
            <b>{done.added}</b> outlet berhasil disimpan, <b>{done.skipped}</b> dilewati
            (duplikat/bermasalah).
          </p>
          <button
            onClick={() => {
              reset();
              onClose();
            }}
            className="mt-4 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white"
          >
            Tutup
          </button>
        </div>
      )}
    </Modal>
  );
}
