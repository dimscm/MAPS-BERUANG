'use client';

import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { SEED_VERSION } from '@/lib/config';
import type { Outlet } from '@/lib/types';

// Memuat seed-outlets.json (hasil konversi Excel survei) setelah data tersimpan di browser terbaca.
// Jika SEED_VERSION berubah (Excel diperbarui), outlet seed diganti versi baru; outlet yang
// ditambahkan manual dan riwayat kunjungan tetap dipertahankan.
export default function SeedLoader() {
  const hydrated = useStore((s) => s.hydrated);
  const seedVersion = useStore((s) => s.seedVersion);

  useEffect(() => {
    if (!hydrated || seedVersion === SEED_VERSION) return;
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/seed-outlets.json?v=${SEED_VERSION}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('seed tidak ditemukan'))))
      .then((data: Outlet[]) => {
        if (!Array.isArray(data)) return;
        const { outlets, setOutlets, setSeedVersion } = useStore.getState();
        const manual = outlets.filter((o) => !o.id.startsWith('b-'));
        setOutlets([...data, ...manual]);
        setSeedVersion(SEED_VERSION);
      })
      .catch(() => undefined);
  }, [hydrated, seedVersion]);

  return null;
}
