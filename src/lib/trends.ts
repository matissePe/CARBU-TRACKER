import { parisDaysAgo, toEpoch } from '@/lib/paris-time';
import { perTank } from '@/config/vehicle';
import { distributingStations, history, latestPrice, priceAt, type HistoryPoint } from '@/lib/prices';
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

export type RankedStation = {
  station: Station;
  priceMilli: number;
  recordedAt: string;
  /** Surcoût par rapport à la station la moins chère, en euros sur un plein. */
  extraPerTank: number;
  /** Position du prix entre le moins cher et le plus cher, pour la barre de comparaison. */
  barPercent: number;
};

/**
 * Au-delà de ce délai, le prix affiché n'est plus une information fiable pour se déplacer.
 * L'âge n'est jamais calculé ici : les pages sont statiques, il le serait au build. C'est
 * `RelativeTime` qui le calcule dans le navigateur, à partir de l'heure réelle.
 */
export const STALE_HOURS = 48;

/**
 * Classement des stations pour un carburant, de la moins chère à la plus chère.
 * L'écart est exprimé en euros sur un plein : « +4,05 € » décide, « +0,081 €/L » demande
 * un calcul mental.
 */
export function ranking(fuel: Fuel): RankedStation[] {
  // Sans ce filtre, une station qui a cessé de vendre le GPLc en 2011 réapparaît dans le
  // classement avec son prix de l'époque.
  const distributing = distributingStations(fuel);

  const rows = STATIONS.flatMap((station) => {
    if (distributing && !distributing.has(station.id)) return [];
    const latest = latestPrice(station.id, fuel);
    return latest ? [{ station, ...latest }] : [];
  }).sort((a, b) => a.priceMilli - b.priceMilli);

  if (rows.length === 0) return [];

  const cheapest = rows[0].priceMilli;
  const dearest = rows[rows.length - 1].priceMilli;
  const span = dearest - cheapest;

  return rows.map((row) => ({
    ...row,
    extraPerTank: perTank(row.priceMilli - cheapest),
    barPercent: span === 0 ? 100 : Math.round(((row.priceMilli - cheapest) / span) * 88) + 12,
  }));
}

export function loadHistory(stationId: number, fuel: Fuel, days: number | null): HistoryPoint[] {
  return history(stationId, fuel, days === null ? undefined : parisDaysAgo(days));
}
