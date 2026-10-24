'use client';

import { useEffect, useState } from 'react';
import Modal from './Modal';
import { isValidCoord } from '@/lib/geo';
import { nowIso, uid } from '@/lib/id';
import type { Outlet } from '@/lib/types';

interface Props {
  open: boolean;
  initial: Outlet | null; // null = tambah baru
  onClose: () => void;
  onSave: (outlet: Outlet) => void;
}

export default function OutletForm({ open, initial, onClose, onSave }: Props) {
  const [f, setF] = useState({
    outlet_code: '', name: '', address: '', kelurahan: '', kecamatan: '', city: '',
    salesman: '', rayon: 'R01', category: 'Umum', latitude: '', longitude: '', is_active: true,
  });
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open) {
      setErr('');
      setF(
        initial
          ? {
              outlet_code: initial.outlet_code,
              name: initial.name,
              address: initial.address,
              kelurahan: initial.kelurahan,
              kecamatan: initial.kecamatan,
              city: initial.city,
              salesman: initial.salesman,
              rayon: initial.rayon,
              category: initial.category,
              latitude: String(initial.latitude),
              longitude: String(initial.longitude),
              is_active: initial.is_active,
            }
          : {
              outlet_code: '', name: '', address: '', kelurahan: '', kecamatan: '', city: '',
              salesman: '', rayon: 'R01', category: 'Umum', latitude: '', longitude: '', is_active: true,
            }
      );
    }
  }, [open, initial]);

  const set = (k: keyof typeof f, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const lat = Number(f.latitude);
    const lng = Number(f.longitude);
    if (f.name.trim().length < 2) return setErr('Nama outlet wajib diisi (min. 2 karakter).');
    if (!isValidCoord(lat, lng)) return setErr('Koordinat tidak valid.');
    setErr('');
    onSave({
      id: initial ? initial.id : uid(),
      outlet_code: f.outlet_code.trim(),
      name: f.name.trim(),
      address: f.address.trim(),
      kelurahan: f.kelurahan.trim(),
      kecamatan: f.kecamatan.trim(),
      city: f.city.trim(),
      salesman: f.salesman.trim(),
      rayon: f.rayon.trim() || 'R01',
      category: f.category.trim() || 'Umum',
      latitude: lat,
      longitude: lng,
      is_active: f.is_active,
      created_at: initial ? initial.created_at : nowIso(),
      updated_at: nowIso(),
    });
    onClose();
  }

  const inp = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Outlet' : 'Tambah Outlet'} wide>
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">Nama Outlet *</label>
          <input value={f.name} onChange={(e) => set('name', e.target.value)} className={inp} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Kode Outlet</label>
          <input value={f.outlet_code} onChange={(e) => set('outlet_code', e.target.value)} className={inp} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Kategori</label>
          <input value={f.category} onChange={(e) => set('category', e.target.value)} className={inp} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">Alamat</label>
          <textarea value={f.address} onChange={(e) => set('address', e.target.value)} rows={2} className={inp} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Kelurahan</label>
          <input value={f.kelurahan} onChange={(e) => set('kelurahan', e.target.value)} className={inp} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Kecamatan</label>
          <input value={f.kecamatan} onChange={(e) => set('kecamatan', e.target.value)} className={inp} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Kota</label>
          <input value={f.city} onChange={(e) => set('city', e.target.value)} className={inp} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Rayon (R01–R12 / Depo)</label>
          <input value={f.rayon} onChange={(e) => set('rayon', e.target.value)} className={inp} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Salesman</label>
          <input value={f.salesman} onChange={(e) => set('salesman', e.target.value)} className={inp} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Latitude *</label>
          <input value={f.latitude} onChange={(e) => set('latitude', e.target.value)} className={inp} placeholder="-6.123456" inputMode="decimal" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Longitude *</label>
          <input value={f.longitude} onChange={(e) => set('longitude', e.target.value)} className={inp} placeholder="106.789012" inputMode="decimal" />
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={f.is_active} onChange={(e) => set('is_active', e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
          Outlet aktif
        </label>
        {err && <p className="text-sm text-red-600 sm:col-span-2">{err}</p>}
        <button type="submit" className="rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white sm:col-span-2">
          {initial ? 'Simpan Perubahan' : 'Tambah Outlet'}
        </button>
      </form>
    </Modal>
  );
}
