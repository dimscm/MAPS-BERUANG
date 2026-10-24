import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { del, get as idbGet, set as idbSet } from 'idb-keyval';
import type { Outlet, UserLocation, Visit } from './types';

// Data ±5.000 outlet terlalu besar untuk localStorage → simpan di IndexedDB browser
const idbStorage: StateStorage = {
  // saat build (tanpa browser) IndexedDB tidak ada → no-op
  getItem: async (name) => (typeof indexedDB === 'undefined' ? null : ((await idbGet<string>(name)) ?? null)),
  setItem: async (name, value) => {
    if (typeof indexedDB !== 'undefined') await idbSet(name, value);
  },
  removeItem: async (name) => {
    if (typeof indexedDB !== 'undefined') await del(name);
  },
};

interface AppState {
  hydrated: boolean;
  seedVersion: string;
  setSeedVersion: (v: string) => void;
  outlets: Outlet[];
  visits: Visit[];
  seeded: boolean;
  userLocation: UserLocation | null;
  setOutlets: (outlets: Outlet[]) => void;
  upsertOutlet: (outlet: Outlet) => void;
  deleteOutlet: (id: string) => void;
  bulkAddOutlets: (outlets: Outlet[]) => number; // mengembalikan jumlah yg benar-benar ditambahkan (skip duplikat)
  addVisit: (visit: Visit) => void;
  markVisitSynced: (id: string) => void;
  mergeRemoteVisits: (visits: Visit[]) => number;
  salesName: string;
  setSalesName: (name: string) => void;
  setUserLocation: (loc: UserLocation | null) => void;
  markSeeded: () => void;
}

function sameOutlet(a: Outlet, b: Outlet): boolean {
  if (a.outlet_code && b.outlet_code && a.outlet_code === b.outlet_code) return true;
  if (a.name.trim().toUpperCase() === b.name.trim().toUpperCase()) return true;
  return (
    Math.abs(a.latitude - b.latitude) < 0.00005 && Math.abs(a.longitude - b.longitude) < 0.00005
  );
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      seedVersion: '',
      setSeedVersion: (seedVersion) => set({ seedVersion }),
      outlets: [],
      visits: [],
      seeded: false,
      userLocation: null,

      setOutlets: (outlets) => set({ outlets, seeded: true }),

      upsertOutlet: (outlet) =>
        set((s) => {
          const idx = s.outlets.findIndex((o) => o.id === outlet.id);
          const outlets = [...s.outlets];
          if (idx >= 0) outlets[idx] = outlet;
          else outlets.push(outlet);
          return { outlets };
        }),

      deleteOutlet: (id) =>
        set((s) => ({
          outlets: s.outlets.filter((o) => o.id !== id),
          visits: s.visits.filter((v) => v.outlet_id !== id),
        })),

      bulkAddOutlets: (incoming) => {
        const existing = get().outlets;
        const fresh: Outlet[] = [];
        for (const o of incoming) {
          const dup =
            existing.some((e) => sameOutlet(e, o)) || fresh.some((e) => sameOutlet(e, o));
          if (!dup) fresh.push(o);
        }
        if (fresh.length > 0) set((s) => ({ outlets: [...s.outlets, ...fresh] }));
        return fresh.length;
      },

      addVisit: (visit) => set((s) => ({ visits: [...s.visits, visit], salesName: visit.sales_name })),
      mergeRemoteVisits: (incoming) => {
        const have = new Set(get().visits.map((v) => v.id));
        const fresh = incoming.filter((v) => !have.has(v.id));
        if (fresh.length) set((s) => ({ visits: [...s.visits, ...fresh] }));
        return fresh.length;
      },
      markVisitSynced: (id) =>
        set((s) => ({ visits: s.visits.map((v) => (v.id === id ? { ...v, synced: true } : v)) })),
      salesName: '',
      setSalesName: (salesName) => set({ salesName }),
      setUserLocation: (loc) => set({ userLocation: loc }),
      markSeeded: () => set({ seeded: true }),
    }),
    {
      name: 'maps-beruang-v1', // persist di IndexedDB -> data tetap ada saat refresh
      storage: createJSONStorage(() => idbStorage),
      onRehydrateStorage: () => () => {
        useStore.setState({ hydrated: true });
      },
      partialize: (s) => ({
        outlets: s.outlets,
        visits: s.visits,
        seeded: s.seeded,
        userLocation: s.userLocation,
        salesName: s.salesName,
        seedVersion: s.seedVersion,
      }),
    }
  )
);
