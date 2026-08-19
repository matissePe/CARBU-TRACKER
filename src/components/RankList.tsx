import Link from 'next/link';

import { TANK_LITERS } from '@/config/vehicle';
import { stationName, stationSubtitle } from '@/config/stations';
import { formatPrice } from '@/lib/fuels';
import { STALE_HOURS, type RankedStation } from '@/lib/trends';

function freshness(ageHours: number): string {
  if (ageHours < 1) return "à l'instant";
  if (ageHours < 24) return `il y a ${Math.round(ageHours)} h`;
  const days = Math.round(ageHours / 24);
  return days === 1 ? 'hier' : `il y a ${days} jours`;
}

type Props = {
  rows: RankedStation[];
  /** Station dont la courbe est affichée : la ligne correspondante est marquée. */
  focusedId: number;
  hrefFor: (stationId: number) => string;
};

/** La réponse à « où c'est le moins cher », lisible sans lire un seul chiffre. */
export default function RankList({ rows, focusedId, hrefFor }: Props) {
  return (
    <section className="min-w-0 bg-surface">
      <div className="flex items-baseline justify-between px-5 pb-2 pt-5 sm:px-6">
        <h2 className="text-sm font-semibold">Le moins cher maintenant</h2>
        <span className="text-xs text-ink-muted">écart sur {TANK_LITERS} L</span>
      </div>

      <ul>
        {rows.map((row, index) => {
          const best = index === 0;
          const stale = row.ageHours > STALE_HOURS;
          return (
            <li key={row.station.id} className="border-t border-hairline first:border-t-0">
              <Link
                href={hrefFor(row.station.id)}
                aria-current={row.station.id === focusedId ? 'true' : undefined}
                className={`block px-5 py-3 transition-colors sm:px-6 ${
                  best ? 'bg-accent-wash' : 'hover:bg-surface-2'
                } ${row.station.id === focusedId ? 'ring-1 ring-inset ring-hairline' : ''}`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-[15px] font-medium">
                    {stationName(row.station)}
                  </span>
                  <span
                    className={`shrink-0 font-mono text-base font-semibold tabular-nums ${best ? 'text-accent' : ''}`}
                  >
                    {formatPrice(row.priceMilli)}
                  </span>
                </div>

                <div className="mt-0.5 flex items-baseline justify-between gap-3 font-mono text-[11px] text-ink-muted">
                  <span className={`min-w-0 truncate ${stale ? 'text-up' : ''}`}>
                    {stationSubtitle(row.station)} · {freshness(row.ageHours)}
                  </span>
                  <span className="shrink-0 whitespace-nowrap">
                    {best ? '—' : `+${row.extraPerTank.toFixed(2).replace('.', ',')} €`}
                  </span>
                </div>

                <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2">
                  <span
                    className={`block h-full rounded-full ${best ? 'bg-accent-bright' : 'bg-line-strong'}`}
                    style={{ width: `${row.barPercent}%` }}
                  />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
