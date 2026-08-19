'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatAxisDate, formatDateTime } from '@/lib/paris-time';

export type ChartPoint = { t: number; price: number };

type Props = { points: ChartPoint[]; seriesLabel: string };

/**
 * Chaque point est un CHANGEMENT de prix, pas un relevé périodique : le prix reste en vigueur
 * jusqu'au point suivant. D'où `stepAfter` — une interpolation linéaire dessinerait une pente
 * douce là où le prix est resté strictement plat pendant parfois plusieurs semaines.
 */
export default function PriceChart({ points, seriesLabel }: Props) {
  if (points.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-ink-muted">
        Aucun relevé sur cette période.
      </div>
    );
  }

  const prices = points.map((point) => point.price);
  const { domain, ticks } = axisScale(Math.min(...prices), Math.max(...prices));
  const spanDays = (points[points.length - 1].t - points[0].t) / 86_400_000;

  return (
    <div className="h-56 w-full sm:h-72 lg:h-96">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="priceFade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-bright)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--accent-bright)" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="var(--line)" strokeWidth={1} vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(value: number) => formatAxisDate(value, spanDays)}
            stroke="var(--line-strong)"
            tick={{ fill: 'var(--ink-muted)', fontSize: 11 }}
            tickLine={false}
            minTickGap={44}
          />
          <YAxis
            domain={domain}
            ticks={ticks}
            tickFormatter={(value: number) => value.toFixed(2)}
            stroke="var(--line-strong)"
            tick={{ fill: 'var(--ink-muted)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={44}
            orientation="right"
          />
          <Tooltip
            cursor={{ stroke: 'var(--line-strong)', strokeWidth: 1 }}
            content={({ active, payload }) => (
              <PriceTooltip
                active={Boolean(active)}
                point={payload?.[0]?.payload as ChartPoint | undefined}
                seriesLabel={seriesLabel}
              />
            )}
          />
          <Area
            type="stepAfter"
            dataKey="price"
            stroke="var(--accent-bright)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="url(#priceFade)"
            dot={false}
            activeDot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
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
  const step =
    [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1].find((candidate) => candidate >= span / 4) ?? 1;

  const ticks: number[] = [];
  const low = Math.floor(min / step) * step;
  const high = Math.ceil(max / step) * step;
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
    <div className="rounded-md border border-hairline bg-surface px-3 py-2 shadow-sm">
      <div className="font-mono text-[11px] text-ink-muted">{formatDateTime(point.t)}</div>
      <div className="mt-1 flex items-center gap-2 text-sm">
        <span className="h-2 w-2 rounded-full bg-accent-bright" aria-hidden />
        <span className="text-ink-soft">{seriesLabel}</span>
        <span className="ml-auto font-mono font-semibold tabular-nums">
          {point.price.toFixed(3).replace('.', ',')} €
        </span>
      </div>
    </div>
  );
}
