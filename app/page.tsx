'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import OutletInfo from '@/components/OutletInfo';
import { kecamatanOptions, kelurahanOptions, matchArea } from '@/lib/area';
import { formatDistance, googleMapsDirUrl, haversineKm } from '@/lib/geo';
import { latestVisit, outletStatus, statusBadge, statusLabel } from '@/lib/visits';
import VisitDialog from '@/components/VisitDialog';
import type { EnrichedOutlet, Visit, VisitStatus } from '@/lib/types';

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[52vh] w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-sm text-slate-500">
      Memuat peta…
    </div>
  ),
});

const RADIUS_OPTIONS = [
  { label: '500 m', km: 0.5 },
  { label: '1 km', km: 1 },
  { label: '3 km', km: 3 },
  { label: '5 km', km: 5 },
  { label: '10 km', km: 10 },
];

export default function MapPage() {
  const outlets = useStore((s) => s.outlets);
  const visits = useStore((s) => s.visits);
  const userLoc = useStore((s) => s.userLocation);
  const setUserLoc = useStore((s) => s.setUserLocation);
  const addVisit = useStore((s) => s.addVisit);
  const salesName = useStore((s) => s.salesName);

  const [gpsState, setGpsState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [gpsError, setGpsError] = useState('');
  const [radiusKm, setRadiusKm] = useState(3);
  const [customKm, setCustomKm] = useState('');
  const [statusF, setStatusF] = useState<'all' | VisitStatus>('all');
  const [rayonF, setRayonF] = useState('all');
  const [salesF, setSalesF] = useState('all');
  const [catF, setCatF] = useState('all');
  const [kecF, setKecF] = useState('all');
  const [kelF, setKelF] = useState('all');
  const [q, setQ] = useState('');
  const [drawer, setDrawer] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // true = dipilih lewat klik titik di peta (popup sudah berisi Navigasi, kartu bawah disembunyikan di HP)
  const [fromMap, setFromMap] = useState(false);
  const [popupReq, setPopupReq] = useState<{ id: string; n: number } | null>(null);
  const [visitFor, setVisitFor] = useState<string | null>(null);
  const [manual, setManual] = useState({ lat: '', lng: '' });
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    if (!userLoc) locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function locate() {
    setGpsError('');
    if (!('geolocation' in navigator)) {
      setGpsState('error');
      setGpsError('Perangkat tidak mendukung GPS. Gunakan input koordinat manual.');
      setShowManual(true);
      return;
    }
    setGpsState('loading');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setUserLoc({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy ?? null,
          timestamp: p.timestamp,
        });
        setGpsState('ok');
      },
      (e) => {
        setGpsState('error');
        setGpsError(
          e.code === 1
            ? 'Izin lokasi ditolak. Aktifkan izin lokasi di browser, atau gunakan koordinat manual.'
            : e.code === 2
              ? 'Sinyal GPS tidak tersedia. Coba di luar ruangan atau gunakan koordinat manual.'
              : 'Timeout memperoleh lokasi. Periksa koneksi lalu coba lagi.'
        );
        setShowManual(true);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }

  function applyManual() {
    const lat = Number(manual.lat);
    const lng = Number(manual.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setGpsError('Koordinat manual tidak valid.');
      return;
    }
    setGpsError('');
    setUserLoc({ lat, lng, accuracy: null, timestamp: Date.now() });
    setGpsState('ok');
  }

  const enriched = useMemo<EnrichedOutlet[]>(
    () =>
      outlets
        .filter((o) => o.is_active)
        .map((o) => {
          const distanceKm = userLoc ? haversineKm(userLoc.lat, userLoc.lng, o.latitude, o.longitude) : null;
          return { ...o, distanceKm, status: outletStatus(o.id, visits), lastVisit: latestVisit(o.id, visits) };
        }),
    [outlets, visits, userLoc]
  );

  const areaActive = kecF !== 'all' || kelF !== 'all';
  // Pencarian teks mencari ke SEMUA outlet (tidak dibatasi radius / GPS)
  const [qDebounced, setQDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const searchActive = qDebounced.length >= 2;
  const ignoreRadius = areaActive || searchActive;

  const filtered = useMemo(
    () =>
      enriched
        .filter((o) => {
          // Jika filter kecamatan/kelurahan dipilih, tampilkan semua outlet di wilayah itu (tanpa batas radius)
          if (!ignoreRadius && (o.distanceKm === null || o.distanceKm > radiusKm)) return false;
          if (!matchArea(o, kecF, kelF)) return false;
          if (statusF !== 'all' && o.status !== statusF) return false;
          if (rayonF !== 'all' && o.rayon !== rayonF) return false;
          if (salesF !== 'all' && o.salesman !== salesF) return false;
          if (catF !== 'all' && o.category !== catF) return false;
          if (qDebounced) {
            const s = `${o.name} ${o.address} ${o.outlet_code} ${o.city} ${o.kelurahan} ${o.kecamatan} ${o.category} ${(o.info ?? []).map((i) => i.value).join(' ')}`.toLowerCase();
            // semua kata harus ada (urutan bebas), mis. "jihan cibubur"
            if (!qDebounced.toLowerCase().split(/\s+/).every((w) => s.includes(w))) return false;
          }
          return true;
        })
        .sort((a, b) => (a.distanceKm ?? 9e9) - (b.distanceKm ?? 9e9)),
    [enriched, radiusKm, statusF, rayonF, salesF, catF, kecF, kelF, ignoreRadius, qDebounced]
  );

  const uniq = (fn: (o: EnrichedOutlet) => string) =>
    Array.from(new Set(enriched.map(fn).filter(Boolean))).sort();
  const rayons = uniq((o) => o.rayon);
  const salesmen = uniq((o) => o.salesman);
  const cats = uniq((o) => o.category);
  const kecOpts = useMemo(() => kecamatanOptions(outlets), [outlets]);
  const kelOpts = useMemo(() => kelurahanOptions(outlets, kecF), [outlets, kecF]);

  const activeFilters =
    (statusF !== 'all' ? 1 : 0) + (rayonF !== 'all' ? 1 : 0) + (salesF !== 'all' ? 1 : 0) + (catF !== 'all' ? 1 : 0) + (kecF !== 'all' ? 1 : 0) + (kelF !== 'all' ? 1 : 0);

  // batasi titik/daftar yang dirender agar tetap ringan di HP (data ±5.000 outlet)
  const MAX_SHOWN = 300;
  const shown = useMemo(() => filtered.slice(0, MAX_SHOWN), [filtered]);
  const selected = filtered.find((o) => o.id === selectedId) ?? null;
  const visitOutlet = outlets.find((o) => o.id === visitFor) ?? null;

  const selStyle = 'rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700';
  const chip = (on: boolean) =>
    `rounded-full px-3 py-1.5 text-xs font-semibold ${on ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-300'}`;

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Bar kontrol GPS + radius */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={locate}
          disabled={gpsState === 'loading'}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow disabled:bg-blue-400"
        >
          {gpsState === 'loading' ? '⏳ Mendeteksi…' : '📍 Gunakan Lokasi Saya'}
        </button>
        {userLoc && (
          <span className="text-xs text-slate-600">
            {userLoc.lat.toFixed(5)}, {userLoc.lng.toFixed(5)}
            {userLoc.accuracy !== null && userLoc.accuracy < 1000 && ` (±${Math.round(userLoc.accuracy)} m)`}
          </span>
        )}
        <button
          onClick={() => setShowManual((v) => !v)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-600"
        >
          Koordinat manual
        </button>
        <div className="flex flex-wrap items-center gap-1">
          {RADIUS_OPTIONS.map((r) => (
            <button key={r.km} onClick={() => { setRadiusKm(r.km); setCustomKm(''); }} className={chip(radiusKm === r.km && !customKm)}>
              {r.label}
            </button>
          ))}
          <span className="flex items-center gap-1">
            <input
              value={customKm}
              onChange={(e) => {
                setCustomKm(e.target.value);
                const v = Number(e.target.value);
                if (!Number.isNaN(v) && v > 0 && v <= 500) setRadiusKm(v);
              }}
              placeholder="Custom km"
              inputMode="decimal"
              className="w-20 rounded-full border border-slate-300 px-2 py-1.5 text-xs"
            />
          </span>
        </div>
      </div>

      {gpsError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{gpsError}</div>
      )}
      {gpsState === 'error' && showManual && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3">
          <div>
            <label className="mb-1 block text-xs text-slate-600">Latitude</label>
            <input value={manual.lat} onChange={(e) => setManual({ ...manual, lat: e.target.value })} className="w-32 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" placeholder="-6.12345" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-600">Longitude</label>
            <input value={manual.lng} onChange={(e) => setManual({ ...manual, lng: e.target.value })} className="w-32 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" placeholder="106.78901" />
          </div>
          <button onClick={applyManual} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white">
            Terapkan
          </button>
        </div>
      )}

      {/* Pencarian + filter */}
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama toko, alamat, kode…"
          className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <button
          onClick={() => setDrawer((v) => !v)}
          className={`relative rounded-xl border px-3 py-2 text-sm ${drawer ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 bg-white text-slate-600'}`}
        >
          Filter{activeFilters > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
              {activeFilters}
            </span>
          )}
        </button>
      </div>

      {drawer && (
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-4">
          <select value={statusF} onChange={(e) => setStatusF(e.target.value as 'all' | VisitStatus)} className={selStyle}>
            <option value="all">Semua status</option>
            <option value="belum">Belum dikunjungi</option>
            <option value="sudah">Sudah dikunjungi</option>
            <option value="followup">Perlu follow-up</option>
          </select>
          <select value={rayonF} onChange={(e) => setRayonF(e.target.value)} className={selStyle}>
            <option value="all">Semua RSM</option>
            {rayons.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={salesF} onChange={(e) => setSalesF(e.target.value)} className={selStyle}>
            <option value="all">Semua salesman</option>
            {salesmen.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={catF} onChange={(e) => setCatF(e.target.value)} className={selStyle}>
            <option value="all">Semua segmen</option>
            {cats.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={kecF} onChange={(e) => { setKecF(e.target.value); setKelF('all'); }} className={selStyle}>
            <option value="all">Semua kecamatan</option>
            {kecOpts.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
          <select value={kelF} onChange={(e) => setKelF(e.target.value)} className={selStyle}>
            <option value="all">Semua kelurahan</option>
            {kelOpts.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          {areaActive && (
            <p className="col-span-full text-[11px] text-slate-500">
              Filter wilayah aktif: menampilkan semua outlet di wilayah ini, tanpa batas radius.
            </p>
          )}
          {activeFilters > 0 && (
            <button
              onClick={() => { setStatusF('all'); setRayonF('all'); setSalesF('all'); setCatF('all'); setKecF('all'); setKelF('all'); }}
              className="col-span-full text-left text-xs font-semibold text-red-600"
            >
              ✕ Reset semua filter
            </button>
          )}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <MapView
            userLoc={userLoc}
            outlets={shown}
            onVisit={(id) => setVisitFor(id)}
            popupFor={popupReq}
            selectedId={selectedId}
            onSelect={(id) => { setFromMap(true); setSelectedId(id); }}
            heightClass="h-[52vh] lg:h-[70vh]"
            fitKey={ignoreRadius ? `${kecF}|${kelF}|${qDebounced}` : ''}
          />
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#ef4444' }} /> Belum dikunjungi</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#22c55e' }} /> Sudah dikunjungi</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#f59e0b' }} /> Follow-up</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full border-2 border-blue-500" style={{ background: '#2563eb' }} /> Posisi Anda</span>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              {searchActive ? `Hasil pencarian "${qDebounced}"` : areaActive ? 'Outlet di wilayah' : 'Outlet Terdekat'} ({filtered.length})
            </h2>
            {!userLoc && <span className="text-xs text-amber-600">Aktifkan GPS untuk melihat jarak</span>}
          </div>
          <div className="nof-scroll max-h-[52vh] space-y-2 overflow-y-auto pr-1 lg:max-h-[70vh]">
            {filtered.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                {searchActive
                  ? `Tidak ada outlet yang cocok dengan "${qDebounced}"${activeFilters > 0 ? ' dengan filter aktif' : ''}.`
                  : `Tidak ada outlet dalam radius ${radiusKm} km${activeFilters > 0 ? ' dengan filter aktif' : ''}.`}
              </div>
            )}
            {filtered.length > MAX_SHOWN && (
              <div className="rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800">
                Menampilkan {MAX_SHOWN} dari {filtered.length} outlet{userLoc ? ' terdekat' : ''}. Persempit dengan radius, filter, atau kata kunci.
              </div>
            )}
            {shown.map((o) => (
              <div
                key={o.id}
                onClick={() => { setFromMap(false); setSelectedId(o.id === selectedId ? null : o.id); }}
                className={`cursor-pointer rounded-xl border bg-white p-3 shadow-sm transition ${selectedId === o.id ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-300'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold leading-tight text-slate-900">{o.name}</p>
                  <span className="shrink-0 rounded-lg bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
                    {o.distanceKm !== null ? formatDistance(o.distanceKm) : '—'}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{o.address || (o.info ?? []).slice(0, 2).map((i) => `${i.label}: ${i.value}`).join(' · ') || o.city}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5">{o.rayon}</span>
                  {o.salesman && <span className="rounded bg-slate-100 px-1.5 py-0.5">{o.salesman}</span>}
                  {o.category && <span className="rounded bg-slate-100 px-1.5 py-0.5">{o.category}</span>}
                  {o.kecamatan && <span className="rounded bg-slate-100 px-1.5 py-0.5">{o.kelurahan ? `${o.kelurahan}, ` : ''}{o.kecamatan}</span>}
                  <span className={`rounded px-1.5 py-0.5 font-medium ${statusBadge[o.status]}`}>
                    {statusLabel[o.status]}
                  </span>
                </div>
                {o.lastVisit && (
                  <p className="mt-1 text-[11px] text-slate-400">
                    Kunjungan terakhir: {new Date(o.lastVisit.visit_time).toLocaleString('id-ID')} — {o.lastVisit.sales_name}
                  </p>
                )}
                <div className="mt-2 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFromMap(true); setSelectedId(o.id); setPopupReq((r) => ({ id: o.id, n: (r?.n ?? 0) + 1 })); }}
                    className="rounded-lg border border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-600"
                  >
                    Lihat di Peta
                  </button>
                  <a
                    href={googleMapsDirUrl(o.latitude, o.longitude)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-green-600 px-2.5 py-1 text-[11px] font-medium text-white"
                  >
                    Navigasi
                  </a>
                  <button
                    onClick={() => setVisitFor(o.id)}
                    className="rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white"
                  >
                    Catat Visit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detail outlet terpilih */}
      {selected && (
        <div className={`fixed inset-x-0 bottom-14 z-40 mx-auto max-w-lg px-3 ${fromMap ? 'hidden lg:block' : ''} lg:static lg:z-auto lg:mx-0 lg:max-w-none lg:px-0`}>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{selected.name}</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {selected.distanceKm !== null && <span className="mr-2 font-semibold text-blue-700">{formatDistance(selected.distanceKm)}</span>}
                  {selected.rayon} · {selected.salesman || 'Tanpa salesman'}
                </p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadge[selected.status]}`}>
                {statusLabel[selected.status]}
              </span>
            </div>
            {selected.address && <p className="mt-2 text-xs text-slate-600">{selected.address}</p>}
            <p className="mt-1 text-[11px] text-slate-500">
              {[selected.kelurahan, selected.kecamatan, selected.city].filter(Boolean).join(', ')} · {selected.category}
            </p>
            <div className="max-h-[38vh] overflow-y-auto lg:max-h-none">
              <OutletInfo outlet={selected} />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              {selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)}
              {selected.outlet_code && ` · Kode: ${selected.outlet_code}`}
            </p>
            {selected.lastVisit && (
              <p className="mt-2 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600">
                <b>Riwayat terakhir:</b> {new Date(selected.lastVisit.visit_time).toLocaleString('id-ID')} — {selected.lastVisit.sales_name}
                {selected.lastVisit.notes && ` · ${selected.lastVisit.notes}`}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <a
                href={googleMapsDirUrl(selected.latitude, selected.longitude)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-xl bg-green-600 py-2 text-center text-sm font-semibold text-white"
              >
                Navigasi ke Outlet
              </a>
              <button
                onClick={() => setVisitFor(selected.id)}
                className="flex-1 rounded-xl bg-blue-600 py-2 text-sm font-semibold text-white"
              >
                Catat Visit
              </button>
            </div>
          </div>
        </div>
      )}

      <VisitDialog
        open={visitFor !== null}
        outlet={visitOutlet}
        defaultSales={salesName || visitOutlet?.salesman || ''}
        onClose={() => setVisitFor(null)}
        onSave={(v: Visit) => addVisit({ ...v, sales_lat: userLoc?.lat ?? null, sales_lng: userLoc?.lng ?? null })}
      />
    </div>
  );
}
