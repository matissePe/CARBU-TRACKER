import { notFound } from 'next/navigation';

import Dashboard from '@/components/Dashboard';
import { getDb } from '@/lib/db';
import { isKnownFuel } from '@/lib/routes';
import { PERIODS, isPeriodKey } from '@/lib/routes';

type Params = { carburant: string; station: string; periode: string };

/**
 * Une page par combinaison réellement distribuée. On lit `station_fuels` plutôt que de faire
 * le produit cartésien : le SP95 n'est vendu que par une station, inutile de générer neuf pages
 * dont huit seraient vides.
 */
export function generateStaticParams(): Params[] {
  const couples = getDb()
    .prepare('SELECT station_id AS stationId, fuel FROM station_fuels ORDER BY fuel, station_id')
    .all() as { stationId: number; fuel: string }[];

  return couples.flatMap(({ stationId, fuel }) =>
    PERIODS.map((period) => ({
      carburant: fuel,
      station: String(stationId),
      periode: period.key,
    })),
  );
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { carburant, station, periode } = await params;
  if (!isKnownFuel(carburant) || !isPeriodKey(periode)) notFound();

  return <Dashboard fuel={carburant} stationId={Number(station)} periodKey={periode} />;
}
