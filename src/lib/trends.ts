import { parisDaysAgo, toEpoch } from '@/lib/paris-time';
import { history, latestPrice, priceAt, type HistoryPoint } from '@/lib/prices';
import type { Fuel } from '@/lib/fuels';
import { STATIONS, type Station } from '@/config/stations';

export type Window = { days: number; label: string };

export const WINDOWS: Window[] = [
  { days: 7, label: '7 jours' },
  { days: 30, label: '30 jours' },
  { days: 90, label: '90 jours' },
];

export type Variation = {
  label: string;
  /** null si la station n'a pas d'historique assez profond pour cette fenêtre. */
  deltaMilli: number | null;
  percent: number | null;
};

export type Stats = {
  latest: { priceMilli: number; recordedAt: string } | null;
  variations: Variation[];
  minMilli: number | null;
  maxMilli: number | null;
  /** Moyenne pondérée par la durée : un prix tenu 3 semaines pèse plus qu'un prix tenu 2 jours. */
  averageMilli: number | null;
  changeCount: number;
  firstRecordedAt: string | null;
};

export function computeStats(points: HistoryPoint[], stationId: number, fuel: Fuel): Stats {
  const latest = latestPrice(stationId, fuel);

  const variations = WINDOWS.map(({ days, label }) => {
    const past = priceAt(stationId, fuel, parisDaysAgo(days));
    if (past === null || latest === null) return { label, deltaMilli: null, percent: null };
    const deltaMilli = latest.priceMilli - past;
    return { label, deltaMilli, percent: (deltaMilli / past) * 100 };
  });

  if (points.length === 0) {
    return { latest, variations, minMilli: null, maxMilli: null, averageMilli: null, changeCount: 0, firstRecordedAt: null };
  }

  const prices = points.map((point) => point.priceMilli);
  return {
    latest,
    variations,
    minMilli: Math.min(...prices),
    maxMilli: Math.max(...prices),
    averageMilli: timeWeightedAverage(points),
    changeCount: points.length,
    firstRecordedAt: points[0].recordedAt,
  };
}

/**
 * Un relevé n'est pas un échantillon périodique mais un changement de prix : faire la moyenne
 * arithmétique des points surpondérerait les journées agitées. On pondère donc chaque prix par
 * la durée pendant laquelle il est resté en vigueur.
 */
function timeWeightedAverage(points: HistoryPoint[]): number | null {
  if (points.length === 1) return points[0].priceMilli;

  let weighted = 0;
  let totalMs = 0;

  for (let i = 0; i < points.length - 1; i += 1) {
    const durationMs = toEpoch(points[i + 1].recordedAt) - toEpoch(points[i].recordedAt);
    if (durationMs <= 0) continue;
    weighted += points[i].priceMilli * durationMs;
    totalMs += durationMs;
  }
  return totalMs > 0 ? Math.round(weighted / totalMs) : points[points.length - 1].priceMilli;
}

export type Cheapest = { station: Station; priceMilli: number; recordedAt: string };

/** Station la moins chère du moment pour un carburant, parmi celles qui le distribuent. */
export function cheapestNow(fuel: Fuel): Cheapest[] {
  const rows: Cheapest[] = [];
  for (const station of STATIONS) {
    const latest = latestPrice(station.id, fuel);
    if (latest) rows.push({ station, ...latest });
  }
  return rows.sort((a, b) => a.priceMilli - b.priceMilli);
}

export function loadHistory(stationId: number, fuel: Fuel, days: number | null): HistoryPoint[] {
  return history(stationId, fuel, days === null ? undefined : parisDaysAgo(days));
}
