'use client';

import { useEffect, useState } from 'react';
import Modal from './Modal';
import { uid, nowIso, toLocalInputValue } from '@/lib/id';
import type { Outlet, Visit } from '@/lib/types';

interface Props {
  open: boolean;
  outlet: Outlet | null;
  defaultSales: string;
  onClose: () => void;
  onSave: (visit: Visit) => void;
}

export default function VisitDialog({ open, outlet, defaultSales, onClose, onSave }: Props) {
  const [sales, setSales] = useState(defaultSales);
  const [time, setTime] = useState(toLocalInputValue());
  const [status, setStatus] = useState<'sudah' | 'followup'>('sudah');
  const [notes, setNotes] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [err, setErr] = useState('');

  // Setiap membuka form untuk outlet lain: isi ulang nama sales & waktu sekarang
  useEffect(() => {
    if (!open) return;
    setSales(defaultSales);
    setTime(toLocalInputValue());
    setStatus('sudah');
    setErr('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, outlet?.id]);

  if (!outlet) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!outlet) return;
    if (sales.trim().length < 2) {
      setErr('Nama sales wajib diisi.');
      return;
    }
    if (status === 'followup' && !followUp) {
      setErr('Tanggal follow-up wajib diisi untuk status Perlu follow-up.');
      return;
    }
    setErr('');
    const local = new Date(time);
    onSave({
      id: uid(),
      outlet_id: outlet.id,
      sales_name: sales.trim(),
      visit_time: local.toISOString(),
      visit_status: status,
      notes: notes.trim(),
      follow_up_date: status === 'followup' ? followUp : '',
      created_at: nowIso(),
    });
    setNotes('');
    setFollowUp('');
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={`Catat Visit — ${outlet.name}`}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Nama Sales</label>
          <input
            value={sales}
            onChange={(e) => setSales(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Nama salesman"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Waktu Kunjungan</label>
          <input
            type="datetime-local"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Hasil Visit</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'sudah' | 'followup')}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="sudah">Sudah dikunjungi</option>
            <option value="followup">Perlu follow-up</option>
          </select>
        </div>
        {status === 'followup' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Tanggal Follow-up</label>
            <input
              type="date"
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Catatan</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Hasil kunjungan, pesanan, kendala…"
          />
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button type="submit" className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white">
          Simpan Kunjungan
        </button>
      </form>
    </Modal>
  );
}
