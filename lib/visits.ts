import { Visit, VisitStatus } from './types';
export type { VisitStatus } from './types';

export function latestVisit(outletId: string, visits: Visit[]): Visit | undefined {
  return visits
    .filter((v) => v.outlet_id === outletId)
    .sort((a, b) => b.visit_time.localeCompare(a.visit_time))[0];
}

export function outletStatus(outletId: string, visits: Visit[]): VisitStatus {
  const v = latestVisit(outletId, visits);
  if (!v) return 'belum';
  return v.visit_status === 'followup' ? 'followup' : 'sudah';
}

export const statusLabel: Record<VisitStatus, string> = {
  belum: 'Belum dikunjungi',
  sudah: 'Sudah dikunjungi',
  followup: 'Perlu follow-up',
};

export const statusBadge: Record<VisitStatus, string> = {
  belum: 'bg-red-100 text-red-700',
  sudah: 'bg-green-100 text-green-700',
  followup: 'bg-amber-100 text-amber-700',
};

export const statusDot: Record<VisitStatus, string> = {
  belum: '#ef4444',
  sudah: '#22c55e',
  followup: '#f59e0b',
};
