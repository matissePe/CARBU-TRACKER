import { getDb } from '@/lib/db';
import type { Fuel } from '@/lib/fuels';
import { toEpoch } from '@/lib/paris-time';

export type PricePoint = {
  stationId: number;
  fuel: Fuel;
  /** ISO naïf en heure de Paris, ex. "2025-01-03T07:32:42". */
  recordedAt: string;
  priceMilli: number;
};

/**
 * Insertion idempotente : la clé (station_id, fuel, recorded_at) est la même dans les deux
 * sources, donc backfill et flux instantané peuvent se recouvrir sans dégât.
 * Renvoie le nombre de lignes réellement ajoutées.
 */
export function insertPrices(points: Iterable<PricePoint>): number {
  const db = getDb();
  const statement = db.prepare(`
    INSERT OR IGNORE INTO prices (station_id, fuel, recorded_at, price_milli)
    VALUES (?, ?, ?, ?)
  `);

  let inserted = 0;
  db.transaction(() => {
    for (const point of points) {
      inserted += statement.run(point.stationId, point.fuel, point.recordedAt, point.priceMilli).changes;
    }
  })();
  return inserted;
}

/** Carburants pour lesquels une station a au moins un relevé. */
export function availableFuels(stationId: number): Fuel[] {
  return getDb()
    .prepare('SELECT DISTINCT fuel FROM prices WHERE station_id = ? ORDER BY fuel')
    .all(stationId)
    .map((row) => (row as { fuel: Fuel }).fuel);
}

export type HistoryPoint = { recordedAt: string; priceMilli: number };

/** Au-delà de cet écart avec le prix précédent, un relevé est suspect. */
const SPIKE_DEVIATION = 0.15;
/** ...et il n'est écarté que s'il est contredit dans ce délai. */
const SPIKE_MAX_HOURS = 2;

/**
 * Écarte les fautes de saisie de la source : un prix aberrant publié puis corrigé quelques
 * minutes plus tard (gazole à 1,329 € le 07/04/2026 à 07:20, remis à 2,329 € à 07:54).
 *
 * Ces valeurs restent dans les bornes plausibles, donc `toMilli` ne peut pas les attraper —
 * c'est leur BRIÈVETÉ combinée au retour au niveau précédent qui les trahit. On exige les trois
 * conditions pour ne pas supprimer une vraie variation brutale : 11 relevés sur 98 000 sont
 * concernés sur l'ensemble de l'historique.
 *
 * La table `prices` conserve la donnée brute : le filtrage est fait à la lecture.
 */
function despike(points: HistoryPoint[]): HistoryPoint[] {
  if (points.length < 3) return points;

  return points.filter((point, index) => {
    const previous = points[index - 1];
    const next = points[index + 1];
    if (!previous || !next) return true;

    const hours = (toEpoch(next.recordedAt) - toEpoch(point.recordedAt)) / 3_600_000;
    if (hours >= SPIKE_MAX_HOURS) return true;

    const deviation = Math.abs(point.priceMilli - previous.priceMilli) / previous.priceMilli;
    const recovery = Math.abs(next.priceMilli - previous.priceMilli) / previous.priceMilli;
    return !(deviation > SPIKE_DEVIATION && recovery < SPIKE_DEVIATION);
  });
}

/**
 * Historique d'une station pour un carburant, à partir de `since` (ISO naïf).
 *
 * On ajoute le dernier point ANTÉRIEUR à `since` : sans lui, la courbe en escalier
 * commencerait dans le vide alors que le prix était déjà à un certain niveau.
 */
export function history(stationId: number, fuel: Fuel, since?: string): HistoryPoint[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT recorded_at AS recordedAt, price_milli AS priceMilli
         FROM prices
        WHERE station_id = ? AND fuel = ? AND (? IS NULL OR recorded_at >= ?)
        ORDER BY recorded_at`,
    )
    .all(stationId, fuel, since ?? null, since ?? null) as HistoryPoint[];

  if (!since) return despike(rows);

  const previous = db
    .prepare(
      `SELECT recorded_at AS recordedAt, price_milli AS priceMilli
         FROM prices
        WHERE station_id = ? AND fuel = ? AND recorded_at < ?
        ORDER BY recorded_at DESC
        LIMIT 1`,
    )
    .get(stationId, fuel, since) as HistoryPoint | undefined;

  return despike(previous ? [previous, ...rows] : rows);
}

/** Prix en vigueur à une date donnée = dernier changement antérieur. */
export function priceAt(stationId: number, fuel: Fuel, at: string): number | null {
  const row = getDb()
    .prepare(
      `SELECT price_milli AS priceMilli
         FROM prices
        WHERE station_id = ? AND fuel = ? AND recorded_at <= ?
        ORDER BY recorded_at DESC
        LIMIT 1`,
    )
    .get(stationId, fuel, at) as { priceMilli: number } | undefined;
  return row?.priceMilli ?? null;
}

export function latestPrice(
  stationId: number,
  fuel: Fuel,
): { priceMilli: number; recordedAt: string } | null {
  const row = getDb()
    .prepare(
      `SELECT price_milli AS priceMilli, recorded_at AS recordedAt
         FROM prices
        WHERE station_id = ? AND fuel = ?
        ORDER BY recorded_at DESC
        LIMIT 1`,
    )
    .get(stationId, fuel) as { priceMilli: number; recordedAt: string } | undefined;
  return row ?? null;
}
