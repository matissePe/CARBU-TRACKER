/**
 * Ingestion du flux instantané (API Opendatasoft Explore v2.1).
 *
 *   npm run ingest
 *
 * Un seul appel réseau par exécution, filtré côté serveur sur nos stations : on récupère
 * une dizaine de lignes, pas l'export national de 28 Mo.
 *
 * Chaque carburant porte sa propre date de dernier changement (`<fuel>_maj`). On insère un
 * point si et seulement si ce couple (station, carburant, date) est inconnu — donc lancer le
 * script toutes les 15 minutes n'ajoute une ligne que lorsqu'un prix a réellement bougé.
 */

import { STATION_IDS } from '@/config/stations';
import { FUELS, toMilli, type Fuel } from '@/lib/fuels';
import { stripFakeOffset } from '@/lib/paris-time';
import { insertPrices, type PricePoint } from '@/lib/prices';
import { logIngest } from '@/lib/db';

const ENDPOINT =
  'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/' +
  'prix-des-carburants-en-france-flux-instantane-v2/records';
const USER_AGENT = 'carbu-tracker/0.1 (projet personnel, https://github.com/)';

type FeedRecord = Record<string, unknown> & { id: number };

async function fetchFeed(): Promise<FeedRecord[]> {
  const select = ['id', ...FUELS.flatMap((fuel) => [`${fuel}_prix`, `${fuel}_maj`])].join(',');
  const url = new URL(ENDPOINT);
  url.searchParams.set('where', `id in (${STATION_IDS.join(',')})`);
  url.searchParams.set('select', select);
  url.searchParams.set('limit', String(STATION_IDS.length));

  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Flux instantané : HTTP ${response.status}`);

  const payload = (await response.json()) as { results?: FeedRecord[] };
  return payload.results ?? [];
}

function toPoints(record: FeedRecord): PricePoint[] {
  const points: PricePoint[] = [];
  for (const fuel of FUELS as readonly Fuel[]) {
    const rawPrice = record[`${fuel}_prix`];
    const rawDate = record[`${fuel}_maj`];
    if (rawPrice == null || typeof rawDate !== 'string') continue; // carburant non distribué

    const priceMilli = toMilli(rawPrice as number);
    if (priceMilli === null) continue;

    points.push({
      stationId: record.id,
      fuel,
      // Le "+00:00" de l'API est faux : c'est déjà de l'heure de Paris, on le retire tel quel.
      recordedAt: stripFakeOffset(rawDate),
      priceMilli,
    });
  }
  return points;
}

async function main(): Promise<void> {
  const records = await fetchFeed();
  if (records.length !== STATION_IDS.length) {
    console.warn(
      `Attention : ${records.length} stations renvoyées sur ${STATION_IDS.length} attendues. ` +
        'Une station a peut-être fermé ou changé de commune.',
    );
  }

  const points = records.flatMap(toPoints);
  const inserted = insertPrices(points);

  console.log(
    `${records.length} stations, ${points.length} prix affichés, ${inserted} changements enregistrés.`,
  );
  logIngest('flux', inserted, `${records.length} stations`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
