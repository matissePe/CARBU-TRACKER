import type { Position } from '@/lib/advice';
import { POSITION_DAYS } from '@/lib/advice';
import { formatPrice } from '@/lib/fuels';
import { formatDate, toEpoch } from '@/lib/paris-time';

/** Où se situe le prix du jour entre le plus bas et le plus haut des 90 derniers jours. */
export default function Gauge({ position }: { position: Position }) {
  return (
    <section className="min-w-0 border-b border-hairline bg-surface px-5 py-5 sm:px-6">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-ink-muted">Meilleur prix, sur {POSITION_DAYS} jours</span>
        <span className="font-mono text-sm font-semibold tabular-nums">{position.percent}&#8239;%</span>
      </div>

      <div className="relative mt-4 h-2.5 rounded-full bg-gradient-to-r from-down-wash via-surface-2 to-up-wash ring-1 ring-inset ring-hairline">
        <span
          className="absolute -top-[5px] h-5 w-[3px] rounded-sm bg-ink"
          style={{ left: `calc(${position.percent}% - 1.5px)` }}
          aria-hidden
        />
      </div>

      <div className="mt-2.5 flex justify-between gap-3 font-mono text-[11px] text-ink-muted">
        <span>
          {formatPrice(position.minMilli)}
          <span className="ml-1.5">le {formatDate(toEpoch(position.lowestAt))}</span>
        </span>
        <span>{formatPrice(position.maxMilli)}</span>
      </div>
    </section>
  );
}
