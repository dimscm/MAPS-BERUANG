export type VisitStatus = 'belum' | 'sudah' | 'followup';

export interface Outlet {
  id: string;
  outlet_code: string;
  name: string;
  address: string;
  kelurahan: string;
  kecamatan: string;
  city: string;
  salesman: string;
  rayon: string;
  category: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  info?: { label: string; value: string }[]; // data survei (pemilik, status FU/NOO, transaksi, dst.)
  photos?: { label: string; url: string }[];
  sheet?: string; // nama sheet asal di Excel
}

export type OutletInput = Omit<Outlet, 'id' | 'created_at' | 'updated_at'>;

export interface Visit {
  id: string;
  outlet_id: string;
  sales_name: string;
  visit_time: string; // ISO string
  visit_status: 'sudah' | 'followup';
  notes: string;
  follow_up_date: string; // YYYY-MM-DD, kosong jika bukan follow-up
  created_at: string;
  sales_lat?: number | null; // posisi GPS sales saat mencatat (bukti kunjungan)
  sales_lng?: number | null;
  synced?: boolean; // sudah terkirim ke Google Sheet
}

export interface UserLocation {
  lat: number;
  lng: number;
  accuracy: number | null;
  timestamp: number;
}

export interface EnrichedOutlet extends Outlet {
  distanceKm: number | null;
  status: VisitStatus;
  lastVisit?: Visit;
}
