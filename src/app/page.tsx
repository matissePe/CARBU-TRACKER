import PriceChart, { type ChartPoint } from '@/components/PriceChart';
import Chip from '@/components/Chip';
import StatTile from '@/components/StatTile';
import { STATIONS, stationLabel } from '@/config/stations';
import { FUEL_META, formatPrice, isFuel, type Fuel } from '@/lib/fuels';
import { formatDateTime, toEpoch } from '@/lib/paris-time';
import { availableFuels } from '@/lib/prices';
import { cheapestNow, computeStats, loadHistory } from '@/lib/trends';

export const dynamic = 'force-dynamic';

const PERIODS = [
  { key: '30', label: '30 jours', days: 30 },
  { key: '90', label: '90 jours', days: 90 },
  { key: '365', label: '1 an', days: 365 },
  { key: '1825', label: '5 ans', days: 1825 },
  { key: 'all', label: 'Tout', days: null },
] as const;

type Search = { station?: string; fuel?: string; periode?: string };

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;

  const station =
    STATIONS.find((candidate) => String(candidate.id) === params.station) ?? STATIONS[0];

  // L'UI ne propose que les carburants réellement distribués par la station : la profondeur
  // d'historique va de 2007 pour le gazole à 2022 pour le GPLc (cf. docs/DATA-SOURCE.md).
  const fuels = availableFuels(station.id);
  const fuel: Fuel =
    params.fuel && isFuel(params.fuel) && fuels.includes(params.fuel)
      ? params.fuel
      : (fuels[0] ?? 'gazole');

  const period = PERIODS.find((candidate) => candidate.key === params.periode) ?? PERIODS[1];

  const points = loadHistory(station.id, fuel, period.days);
  const stats = computeStats(points, station.id, fuel);
  const ranking = cheapestNow(fuel);

  const chartPoints: ChartPoint[] = points.map((point) => ({
    t: toEpoch(point.recordedAt),
    price: point.priceMilli / 1000,
  }));

  const href = (next: Partial<Record<keyof Search, string>>) => {
    const query = new URLSearchParams({
      station: String(station.id),
      fuel,
      periode: period.key,
      ...next,
    });
    return `/?${query.toString()}`;
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">Prix des carburants</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Stations de Vannes et Séné — historique depuis 2007, source{' '}
          <span className="text-ink-muted">prix-carburants.gouv.fr</span>
        </p>
      </header>

      <section className="mb-8 space-y-4">
        <Selector label="Station">
          {STATIONS.map((candidate) => (
            <Chip
              key={candidate.id}
              href={href({ station: String(candidate.id), fuel: '' })}
              active={candidate.id === station.id}
              title={`${candidate.city} — ${candidate.postalCode}`}
            >
              {stationLabel(candidate)}
            </Chip>
          ))}
        </Selector>

        <Selector label="Carburant">
          {fuels.map((candidate) => (
            <Chip key={candidate} href={href({ fuel: candidate })} active={candidate === fuel}>
              {FUEL_META[candidate].label}
            </Chip>
          ))}
        </Selector>

        <Selector label="Période">
          {PERIODS.map((candidate) => (
            <Chip
              key={candidate.key}
              href={href({ periode: candidate.key })}
              active={candidate.key === period.key}
            >
              {candidate.label}
            </Chip>
          ))}
        </Selector>
      </section>

      <section className="mb-6 rounded-lg border border-hairline bg-surface p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-sm text-ink-muted">
              {FUEL_META[fuel].label} — {stationLabel(station)}
            </div>
            <div className="mt-1 text-5xl font-semibold tabular-nums">
              {stats.latest ? formatPrice(stats.latest.priceMilli) : '—'}
            </div>
          </div>
          {stats.latest ? (
            <div className="text-sm text-ink-muted">
              dernier changement le {formatDateTime(toEpoch(stats.latest.recordedAt))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.variations.map((variation) => (
          <StatTile
            key={variation.label}
            label={`Sur ${variation.label}`}
            value={
              variation.deltaMilli === null
                ? '—'
                : `${variation.deltaMilli >= 0 ? '+' : '−'}${Math.abs(variation.deltaMilli / 1000).toFixed(3)} €`
            }
            direction={
              variation.deltaMilli === null || variation.deltaMilli === 0
                ? 'flat'
                : variation.deltaMilli > 0
                  ? 'up'
                  : 'down'
            }
            hint={variation.percent === null ? undefined : `${variation.percent.toFixed(1)} %`}
          />
        ))}
        <StatTile
          label={`Min (${period.label.toLowerCase()})`}
          value={stats.minMilli === null ? '—' : formatPrice(stats.minMilli)}
        />
        <StatTile
          label={`Max (${period.label.toLowerCase()})`}
          value={stats.maxMilli === null ? '—' : formatPrice(stats.maxMilli)}
        />
        <StatTile
          label="Moyenne pondérée"
          value={stats.averageMilli === null ? '—' : formatPrice(stats.averageMilli)}
          hint="par durée d'application"
        />
      </section>

      <section className="mb-8 rounded-lg border border-hairline bg-surface p-5">
        <h2 className="text-sm font-medium">
          {FUEL_META[fuel].label} — {stationLabel(station)}
          <span className="ml-2 font-normal text-ink-muted">
            {stats.changeCount} changement{stats.changeCount > 1 ? 's' : ''} de prix sur la période
          </span>
        </h2>
        <div className="mt-4">
          <PriceChart points={chartPoints} seriesLabel={FUEL_META[fuel].label} />
        </div>
        <p className="mt-3 text-xs text-ink-muted">
          Courbe en escalier : chaque point est un changement de prix, le tarif reste en vigueur
          jusqu&apos;au suivant.
        </p>
      </section>

      <section className="rounded-lg border border-hairline bg-surface p-5">
        <h2 className="text-sm font-medium">
          {FUEL_META[fuel].label} — la moins chère en ce moment
        </h2>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-muted">
              <th className="pb-2 font-normal">Station</th>
              <th className="pb-2 font-normal">Dernier changement</th>
              <th className="pb-2 text-right font-normal">Prix</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((row, index) => (
              <tr
                key={row.station.id}
                className={row.station.id === station.id ? 'text-ink' : 'text-ink-soft'}
              >
                <td className="border-t border-hairline py-2">
                  {index === 0 ? <span className="mr-1 text-down">●</span> : null}
                  {stationLabel(row.station)}
                  <span className="ml-2 text-xs text-ink-muted">{row.station.city}</span>
                </td>
                <td className="border-t border-hairline py-2 text-ink-muted">
                  {formatDateTime(toEpoch(row.recordedAt))}
                </td>
                <td className="border-t border-hairline py-2 text-right font-medium tabular-nums">
                  {formatPrice(row.priceMilli)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function Selector({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="w-20 shrink-0 text-xs text-ink-muted">{label}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
