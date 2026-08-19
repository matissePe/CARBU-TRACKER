'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatDate, formatDateTime } from '@/lib/paris-time';

export type ChartPoint = { t: number; price: number };

type Props = {
  points: ChartPoint[];
  /** Sert au libellé du tooltip et à l'accessibilité : la série unique n'a pas de légende. */
  seriesLabel: string;
};

/**
 * Chaque point est un CHANGEMENT de prix, pas un relevé périodique : le prix reste en vigueur
 * jusqu'au point suivant. D'où `stepAfter` — une interpolation linéaire dessinerait une pente
 * douce là où le prix est resté strictement plat pendant parfois plusieurs semaines.
 */
export default function PriceChart({ points, seriesLabel }: Props) {
  if (points.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center text-sm text-ink-muted">
        Aucun relevé sur cette période.
      </div>
    );
  }

  const prices = points.map((point) => point.price);
  const { domain, ticks } = axisScale(Math.min(...prices), Math.max(...prices));

  return (
    <div className="h-80 w-full sm:h-96">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="var(--grid)" strokeWidth={1} vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatDate}
            stroke="var(--axis)"
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            tickLine={false}
            minTickGap={48}
          />
          <YAxis
            domain={domain}
            ticks={ticks}
            tickFormatter={(value: number) => value.toFixed(2)}
            stroke="var(--axis)"
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={52}
            unit=" €"
          />
          <Tooltip
            cursor={{ stroke: 'var(--axis)', strokeWidth: 1 }}
            content={({ active, payload }) => (
              <PriceTooltip
                active={Boolean(active)}
                point={payload?.[0]?.payload as ChartPoint | undefined}
                seriesLabel={seriesLabel}
              />
            )}
          />
          <Line
            type="stepAfter"
            dataKey="price"
            stroke="var(--series-1)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={false}
            activeDot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Cale l'axe des prix sur des graduations rondes (1,40 / 1,60 / 1,80…) plutôt que sur des
 * valeurs issues du min et du max, illisibles.
 */
function axisScale(min: number, max: number): { domain: [number, number]; ticks: number[] } {
  const span = Math.max(max - min, 0.05);
  const rawStep = span / 5;
  const step =
    [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1].find((candidate) => candidate >= rawStep) ?? 1;

  const low = Math.floor(min / step) * step;
  const high = Math.ceil(max / step) * step;

  const ticks: number[] = [];
  for (let value = low; value <= high + step / 2; value += step) {
    ticks.push(Number(value.toFixed(3)));
  }
  return { domain: [ticks[0], ticks[ticks.length - 1]], ticks };
}

function PriceTooltip({
  active,
  point,
  seriesLabel,
}: {
  active: boolean;
  point: ChartPoint | undefined;
  seriesLabel: string;
}) {
  if (!active || !point) return null;

  return (
    <div className="rounded-md border border-hairline bg-surface px-3 py-2 text-sm shadow-sm">
      <div className="text-ink-muted">{formatDateTime(point.t)}</div>
      <div className="mt-1 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-series-1" aria-hidden />
        <span className="text-ink-soft">{seriesLabel}</span>
        <span className="ml-auto font-semibold tabular-nums text-ink">
          {point.price.toFixed(3)} €
        </span>
      </div>
    </div>
  );
}
