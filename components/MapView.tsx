'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { googleMapsDirUrl } from '@/lib/geo';
import OutletInfo from './OutletInfo';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { statusDot, VisitStatus } from '@/lib/visits';

export interface MapOutlet {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  status: VisitStatus;
  address?: string;
  category?: string;
  info?: { label: string; value: string }[];
  photos?: { label: string; url: string }[];
}

interface Props {
  userLoc: { lat: number; lng: number } | null;
  outlets: MapOutlet[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  heightClass?: string;
  onVisit?: (id: string) => void;
  popupFor?: { id: string; n: number } | null; // buka popup titik ini (mis. dari tombol "Lihat di Peta")
  fitKey?: string; // jika berubah (dan tidak kosong), peta di-zoom agar semua outlet terlihat
}

function dotIcon(color: string, highlight: boolean) {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};width:16px;height:16px;border-radius:50%;border:3px solid ${highlight ? '#0f172a' : '#ffffff'};box-shadow:0 1px 4px rgba(0,0,0,.45)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

const USER_ICON = L.divIcon({
  className: '',
  html: `<div style="background:#2563eb;width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 8px rgba(37,99,235,.22)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function FlyToSelected({
  outlets,
  selectedId,
}: {
  outlets: MapOutlet[];
  selectedId: string | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (!selectedId) return;
    const o = outlets.find((x) => x.id === selectedId);
    if (o) map.flyTo([o.latitude, o.longitude], Math.max(map.getZoom(), 15), { duration: 0.5 });
  }, [selectedId, outlets, map]);
  return null;
}

function FitToOutlets({ outlets, fitKey }: { outlets: MapOutlet[]; fitKey?: string }) {
  const map = useMap();
  useEffect(() => {
    if (!fitKey || outlets.length === 0) return;
    const b = L.latLngBounds(outlets.map((o) => [o.latitude, o.longitude] as [number, number]));
    map.fitBounds(b, { padding: [30, 30], maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, map]);
  return null;
}

// Basemap OpenStreetMap — outlet yang dirender HANYA data internal database.
export default function MapView({
  userLoc,
  outlets,
  selectedId,
  onSelect,
  heightClass = 'h-[52vh]',
  fitKey,
  onVisit,
  popupFor,
}: Props) {
  const showLabels = outlets.length <= 30;
  const markerRefs = useRef(new Map<string, L.Marker>());
  useEffect(() => {
    if (!popupFor) return;
    const t = setTimeout(() => markerRefs.current.get(popupFor.id)?.openPopup(), 550); // setelah animasi flyTo
    return () => clearTimeout(t);
  }, [popupFor]);
  const center: [number, number] = userLoc ? [userLoc.lat, userLoc.lng] : [-6.2, 106.85];
  return (
    <MapContainer
      center={center}
      zoom={userLoc ? 14 : 11}
      scrollWheelZoom
      className={`${heightClass} relative z-0 w-full rounded-xl border border-slate-200`}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {userLoc && <Marker position={[userLoc.lat, userLoc.lng]} icon={USER_ICON} />}
      {outlets.map((o) => (
        <Marker
          key={o.id}
          ref={(m) => {
            if (m) markerRefs.current.set(o.id, m);
            else markerRefs.current.delete(o.id);
          }}
          position={[o.latitude, o.longitude]}
          icon={dotIcon(statusDot[o.status], o.id === selectedId)}
          eventHandlers={{
            click: () => onSelect(o.id),
            popupopen: (e) => e.target.closeTooltip(),
            popupclose: (e) => {
              if (showLabels) e.target.openTooltip();
            },
          }}
        >
          {/* Nama toko: selalu tampil jika hasil sedikit, selain itu muncul saat disentuh/hover */}
          <Tooltip
            key={String(showLabels)}
            direction="top"
            offset={[0, -8]}
            permanent={showLabels}
            className="nof-label"
          >
            {o.name}
          </Tooltip>
          <Popup offset={[0, -6]} autoPanPaddingTopLeft={[20, 60]} closeButton>
            <div className="min-w-[200px] max-w-[260px]">
              <p className="text-sm font-bold leading-tight text-slate-900">{o.name}</p>
              {o.category && <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">{o.category}</span>}
              {o.address && <p className="mt-1 text-xs leading-snug text-slate-600">{o.address}</p>}
              <OutletInfo outlet={o} compact />
              <div className="mt-2 flex gap-1.5">
                <a
                  href={googleMapsDirUrl(o.latitude, o.longitude)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nof-popup-btn flex-1 rounded-lg bg-green-600 px-2 py-1.5 text-center text-xs font-semibold"
                >
                  🧭 Navigasi
                </a>
                {onVisit && (
                  <button
                    onClick={() => onVisit(o.id)}
                    className="flex-1 rounded-lg bg-blue-600 px-2 py-1.5 text-xs font-semibold text-white"
                  >
                    Catat Visit
                  </button>
                )}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
      <FlyToSelected outlets={outlets} selectedId={selectedId} />
      <FitToOutlets outlets={outlets} fitKey={fitKey} />
    </MapContainer>
  );
}
