import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { Outlet } from './types';
import { isValidCoord } from './geo';

export interface ParsedRow {
  rowNumber: number;
  name: string;
  outlet: Partial<Outlet> | null;
  errors: string[];
  duplicate: boolean;
}

// Alias header (dinormalisasi: lowercase, tanpa spasi/simbol) -> field
const FIELD_ALIASES: Record<string, string[]> = {
  outlet_code: ['outletcode', 'kodepelanggan', 'idcustomer', 'idpelanggan', 'kodeoutlet', 'id', 'kode'],
  name: ['name', 'nama', 'namatoko', 'namapelanggan', 'namaoutlet', 'namaahs', 'namapelanggan1'],
  address: ['address', 'alamat', 'alamatahs', 'alamatlengkap', 'alamatsepertiktpgooglemaps'],
  kelurahan: ['kelurahan'],
  kecamatan: ['kecamatan'],
  city: ['city', 'kota', 'kotakabupaten', 'kota/kabupaten'],
  salesman: ['salesman', 'sales', 'visitor', 'tim', 'timgenesis', 'namasales'],
  rayon: ['rayon', 'depo', 'region', 'segmen', 'segmendsa', 'wilayah'],
  category: ['category', 'kategori', 'segmen', 'segmendsa', 'tipe'],
  latitude: ['latitude', 'lat', 'koordinatlat'],
  longitude: ['longitude', 'long', 'lng', 'koordinatlng', 'koordinatlong'],
};

const rowSchema = z.object({
  outlet_code: z.string().default(''),
  name: z.string().trim().min(2, 'Nama outlet wajib diisi (min. 2 karakter)'),
  address: z.string().default(''),
  kelurahan: z.string().default(''),
  kecamatan: z.string().default(''),
  city: z.string().default(''),
  salesman: z.string().default(''),
  rayon: z.string().default(''),
  category: z.string().default('Umum'),
  latitude: z.coerce.number({ invalid_type_error: 'Latitude harus berupa angka' }),
  longitude: z.coerce.number({ invalid_type_error: 'Longitude harus berupa angka' }),
});

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9/]/g, '');

export async function parseFileToRows(file: File): Promise<Record<string, unknown>[]> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'csv' || ext === 'txt') {
    const text = await file.text();
    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, unknown>>(text, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => resolve(res.data),
        error: (err: Error) => reject(err),
      });
    });
  }
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf);
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
}

function pickField(row: Record<string, unknown>, field: keyof typeof FIELD_ALIASES): string {
  const aliases = FIELD_ALIASES[field];
  for (const key of Object.keys(row)) {
    const nk = norm(key);
    if (aliases.includes(nk)) {
      const v = row[key];
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
    }
  }
  return '';
}

function toNumber(v: string): number {
  const n = Number(v.replace(',', '.'));
  return Number.isNaN(n) ? NaN : n;
}

export function mapRows(rows: Record<string, unknown>[], existing: Outlet[]): ParsedRow[] {
  const existingKeys = new Set(
    existing.map(
      (o) =>
        `${o.name.trim().toUpperCase()}|${o.latitude.toFixed(4)}|${o.longitude.toFixed(4)}`
    )
  );
  return rows.map((row, i) => {
    const raw = {
      outlet_code: pickField(row, 'outlet_code'),
      name: pickField(row, 'name'),
      address: pickField(row, 'address'),
      kelurahan: pickField(row, 'kelurahan'),
      kecamatan: pickField(row, 'kecamatan'),
      city: pickField(row, 'city'),
      salesman: pickField(row, 'salesman'),
      rayon: pickField(row, 'rayon'),
      category: pickField(row, 'category'),
      latitude: toNumber(pickField(row, 'latitude')),
      longitude: toNumber(pickField(row, 'longitude')),
    };

    const dupKey = `${raw.name.trim().toUpperCase()}|${raw.latitude.toFixed(4)}|${raw.longitude.toFixed(4)}`;
    const duplicate = raw.name.length > 1 && existingKeys.has(dupKey);

    const parsed = rowSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        rowNumber: i + 2,
        name: raw.name || '(tanpa nama)',
        outlet: null,
        errors: parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`),
        duplicate,
      };
    }

    const d = parsed.data;
    if (!isValidCoord(d.latitude, d.longitude)) {
      return {
        rowNumber: i + 2,
        name: d.name,
        outlet: null,
        errors: ['Koordinat tidak valid (latitude -90..90, longitude -180..180)'],
        duplicate,
      };
    }

    return { rowNumber: i + 2, name: d.name, outlet: d, errors: [], duplicate };
  });
}
