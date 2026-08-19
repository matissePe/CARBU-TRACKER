import Chip from '@/components/Chip';
import Gauge from '@/components/Gauge';
import PriceChart, { type ChartPoint } from '@/components/PriceChart';
import RankList from '@/components/RankList';
import Verdict from '@/components/Verdict';
import { STATIONS, stationName, stationSubtitle } from '@/config/stations';
import { TANK_LITERS, perTank } from '@/config/vehicle';
import { POSITION_DAYS, buildAdvice } from '@/lib/advice';
import { FUELS, FUEL_META, formatPrice, isFuel, type Fuel } from '@/lib/fuels';
import { formatDate, parisDaysAgo, toEpoch } from '@/lib/paris-time';
import { bestPriceSeries, history } from '@/lib/prices';
import { computeStats, ranking } from '@/lib/trends';

export const dynamic = 'force-dynamic';

/** Trois choix suffisent sur un téléphone ; six transformaient la barre en labyrinthe. */
const PERIODS = [
  { key: '90', label: '3 mois', days: 90 },
  { key: '365', label: '1 an', days: 365 },
  { key: 'all', label: 'Tout', days: null },
] as const;

const DEFAULT_FUEL: Fuel = 'gazole';

type Search = { carburant?: string; station?: string; periode?: string };

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;

  const fuel: Fuel = params.carburant && isFuel(params.carburant) ? params.carburant : DEFAULT_FUEL;
  const period = PERIODS.find((candidate) => candidate.key === params.periode) ?? PERIODS[0];

  const rows = ranking(fuel);

  // Le conseil porte sur le meilleur prix disponible dans la zone, pas sur une station donnée :
  // c'est ce que tu paierais réellement en allant à la moins chère.
  const advice = buildAdvice(
    bestPriceSeries(
      fuel,
      parisDaysAgo(POSITION_DAYS),
      rows.map((row) => row.station.id),
    ),
  );

  // La courbe suit la station choisie ; par défaut la moins chère du moment.
  const focused =
    STATIONS.find((station) => String(station.id) === params.station) ?? rows[0]?.station;

  const series = focused
    ? history(focused.id, fuel, period.days === null ? undefined : parisDaysAgo(period.days))
    : [];
  const chartPoints: ChartPoint[] = series.map((point) => ({
    t: toEpoch(point.recordedAt),
    price: point.priceMilli / 1000,
  }));
  const stats = focused ? computeStats(series, focused.id, fuel) : null;

  const href = (next: Partial<Record<keyof Search, string>>) => {
    const query = new URLSearchParams({
      carburant: fuel,
      periode: period.key,
      ...(focused ? { station: String(focused.id) } : {}),
      ...next,
    });
    return `/?${query.toString()}`;
  };

  const spread = rows.length > 1 ? perTank(rows[rows.length - 1].priceMilli - rows[0].priceMilli) : 0;

  return (
    <div className="mx-auto max-w-6xl px-0 pb-16 sm:px-6 sm:pt-6">
      <header className="px-5 pb-4 pt-6 sm:px-0">
        <h1 className="text-lg font-semibold tracking-tight">
          {FUEL_META[fuel].label} — Vannes et Séné
        </h1>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          {rows.length} station{rows.length > 1 ? 's' : ''} · plein de {TANK_LITERS} L
        </p>
      </header>

      {/*
        Mobile : une seule colonne, dans l'ordre du besoin — le conseil, puis où aller, puis
        la courbe qui justifie le conseil.
        Ordinateur : le conseil et le classement en colonne fixe, la courbe prend la place gagnée.
      */}
      <div className="grid gap-px bg-hairline sm:grid-cols-[minmax(0,400px)_minmax(0,1fr)] sm:overflow-hidden sm:rounded-xl sm:border sm:border-hairline">
        <div className="grid min-w-0 content-start gap-px bg-hairline">
          {/*
            Le classement d'abord. Mesuré sur les 12 derniers mois : aller à la moins chère
            plutôt qu'à une station quelconque vaut ~29 €/an, contre ~10 €/an au mieux pour le
            choix du jour. La question « où » rapporte trois à dix fois la question « quand ».
          */}
          {rows.length > 0 && focused ? (
            <RankList rows={rows} focusedId={focused.id} hrefFor={(id) => href({ station: String(id) })} />
          ) : null}

          {spread > 0 ? (
            <p className="bg-surface px-5 pb-5 pt-1 text-[13px] leading-relaxed text-ink-muted sm:px-6">
              Entre la moins chère et la plus chère,{' '}
              <span className="font-medium text-ink">
                {spread.toFixed(2).replace('.', ',')} € d&apos;écart
              </span>{' '}
              sur un plein.
            </p>
          ) : null}

          {advice ? (
            <>
              <Verdict advice={advice} />
              <Gauge position={advice.position} />
            </>
          ) : (
            <section className="bg-surface px-5 py-6 text-sm text-ink-muted sm:px-6">
              Pas encore assez d&apos;historique sur {FUEL_META[fuel].label} pour donner un conseil.
            </section>
          )}
        </div>

        <div className="grid min-w-0 content-start gap-px bg-surface">
          <section className="bg-surface px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="text-sm font-semibold">
                {focused ? stationName(focused) : FUEL_META[fuel].label}
              </h2>
              {focused ? (
                <span className="font-mono text-[11px] text-ink-muted">
                  {stationSubtitle(focused)}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs text-ink-muted">
              {series.length} changement{series.length > 1 ? 's' : ''} de prix
              {series.length > 0 ? ` depuis le ${formatDate(toEpoch(series[0].recordedAt))}` : ''}
            </p>

            <div className="mt-4">
              <PriceChart points={chartPoints} />
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                {PERIODS.map((candidate) => (
                  <Chip
                    key={candidate.key}
                    href={href({ periode: candidate.key })}
                    active={candidate.key === period.key}
                  >
                    {candidate.label}
                  </Chip>
                ))}
              </div>
              <p className="font-mono text-[11px] text-ink-muted">
                {series.length > 0
                  ? `dernier prix ${formatPrice(series[series.length - 1].priceMilli)}`
                  : ''}
              </p>
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
              Courbe en escalier : chaque marche est un changement de prix, le tarif reste en
              vigueur jusqu&apos;au suivant.
            </p>

            {stats && stats.minMilli !== null ? (
              <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-hairline pt-4 sm:grid-cols-4">
                <Stat label={`Min (${period.label.toLowerCase()})`} value={formatPrice(stats.minMilli)} />
                <Stat label={`Max (${period.label.toLowerCase()})`} value={formatPrice(stats.maxMilli!)} />
                <Stat
                  label="Moyenne"
                  value={formatPrice(stats.averageMilli!)}
                  hint="pondérée par la durée"
                />
                <Stat
                  label="Sur 30 jours"
                  value={signed(stats.variations[1]?.deltaMilli ?? null)}
                  tone={toneOf(stats.variations[1]?.deltaMilli ?? null)}
                />
              </dl>
            ) : null}
          </section>
        </div>
      </div>

      {/*
        Le gazole est le défaut. Les cinq autres carburants restent accessibles, mais en bas
        de page : ils sont l'exception, pas le choix principal.
      */}
      <section className="mt-8 px-5 sm:px-0">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">
          Carburant
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {FUELS.map((candidate) => (
            <Chip
              key={candidate}
              href={href({ carburant: candidate, station: '' })}
              active={candidate === fuel}
            >
              {FUEL_META[candidate].label}
            </Chip>
          ))}
        </div>
        <div className="mt-5 max-w-prose space-y-3 text-[13px] leading-relaxed text-ink-muted">
          <p>
            <span className="font-medium text-ink">Le choix de la station compte plus que celui du jour.</span>{' '}
            Sur les 12 derniers mois, aller à la moins chère plutôt qu&apos;à une station quelconque
            vaut environ 29 € par an. Bien choisir son jour, une dizaine d&apos;euros au mieux.
          </p>
          <p>
            Le conseil repose sur deux faits mesurés : la position du prix dans sa fourchette des{' '}
            {POSITION_DAYS} derniers jours, et son sens de variation sur deux semaines. Ce n&apos;est
            pas une prévision — une tendance peut s&apos;inverser en trois jours. Il ne te dira jamais
            d&apos;attendre plus d&apos;une semaine ou deux : sur ton historique, guetter le moment
            parfait fait perdre de l&apos;argent plus souvent que ça n&apos;en fait gagner.
          </p>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'up' | 'down';
}) {
  const color = tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : 'text-ink';
  return (
    <div>
      <dt className="text-[11px] text-ink-muted">{label}</dt>
      <dd className={`mt-0.5 font-mono text-[15px] font-semibold tabular-nums ${color}`}>{value}</dd>
      {hint ? <dd className="text-[11px] text-ink-muted">{hint}</dd> : null}
    </div>
  );
}

function signed(deltaMilli: number | null): string {
  if (deltaMilli === null) return '—';
  const sign = deltaMilli > 0 ? '+' : deltaMilli < 0 ? '−' : '';
  return `${sign}${(Math.abs(deltaMilli) / 1000).toFixed(3).replace('.', ',')} €`;
}

/** Une hausse du prix est une mauvaise nouvelle : le rouge suit le sens pour le portefeuille. */
function toneOf(deltaMilli: number | null): 'up' | 'down' | undefined {
  if (deltaMilli === null || deltaMilli === 0) return undefined;
  return deltaMilli > 0 ? 'up' : 'down';
}
