import { formatAxisDate, formatDate } from '@/lib/paris-time';

export type ChartPoint = { t: number; price: number };

type Props = { points: ChartPoint[] };

/**
 * Courbe rendue **côté serveur**, en SVG, sans une ligne de JavaScript.
 *
 * La version précédente utilisait Recharts, donc un composant client : le graphique était le seul
 * élément de la page à dépendre du bundle. Résultat, sur un iPhone où ce bundle ne s'exécutait pas,
 * toute la page s'affichait sauf la courbe. Un graphique statique n'a aucune raison d'exiger du JS.
 *
 * Deux détails rendent ça possible sans déformer le tracé :
 * - le SVG est en coordonnées 0→100 avec `preserveAspectRatio="none"`, donc il épouse n'importe
 *   quelle taille de conteneur ;
 * - `vector-effect="non-scaling-stroke"` garde un trait de 2 px quelle que soit l'échelle.
 *
 * Les textes et les points sont en HTML positionné en pourcentage, pas dans le SVG : sinon ils
 * seraient étirés par le même facteur que le tracé.
 */
export default function PriceChart({ points }: Props) {
  if (points.length < 2) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-ink-muted">
        Pas assez de relevés pour tracer une courbe sur cette période.
      </div>
    );
  }

  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const spanMs = Math.max(t1 - t0, 1);
  const spanDays = spanMs / 86_400_000;

  const prices = points.map((point) => point.price);
  const ticks = roundTicks(Math.min(...prices), Math.max(...prices));
  const low = ticks[0];
  const high = ticks[ticks.length - 1];

  const x = (t: number) => ((t - t0) / spanMs) * 100;
  const y = (price: number) => ((high - price) / (high - low)) * 100;

  // Escalier : le prix tient jusqu'au changement suivant, d'où le palier horizontal avant chaque saut.
  let path = `M0,${y(points[0].price).toFixed(2)}`;
  for (let i = 1; i < points.length; i += 1) {
    const px = x(points[i].t).toFixed(2);
    path += `L${px},${y(points[i - 1].price).toFixed(2)}L${px},${y(points[i].price).toFixed(2)}`;
  }
  path += `L100,${y(points[points.length - 1].price).toFixed(2)}`;

  const lowest = points.reduce((best, point) => (point.price < best.price ? point : best));
  const last = points[points.length - 1];

  const xLabels = [points[0], points[Math.floor(points.length / 2)], last];

  return (
    <figure className="m-0">
      <div className="relative h-56 sm:h-72 lg:h-96">
        {ticks.map((tick) => (
          <div
            key={tick}
            className="pointer-events-none absolute inset-x-0 border-t border-hairline"
            style={{ top: `${y(tick)}%` }}
          >
            <span className="absolute right-0 -translate-y-1/2 bg-surface pl-1.5 font-mono text-[10px] text-ink-muted">
              {tick.toFixed(2).replace('.', ',')}
            </span>
          </div>
        ))}

        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
          role="img"
          aria-label={`Prix de ${prices[0].toFixed(3)} € le ${formatDate(t0)} à ${last.price.toFixed(3)} € le ${formatDate(t1)}, plus bas ${lowest.price.toFixed(3)} €.`}
        >
          <defs>
            <linearGradient id="priceFade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-bright)" stopOpacity={0.2} />
              <stop offset="100%" stopColor="var(--accent-bright)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={`${path}L100,100L0,100Z`} fill="url(#priceFade)" />
          <path
            d={path}
            fill="none"
            stroke="var(--accent-bright)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <Marker left={x(lowest.t)} top={y(lowest.price)} kind="low" />
        <Marker left={x(last.t)} top={y(last.price)} kind="last" />
      </div>

      <div className="mt-2 flex justify-between font-mono text-[10px] text-ink-muted">
        {xLabels.map((point, index) => (
          <span key={point.t} className={index === 1 ? 'hidden sm:inline' : undefined}>
            {formatAxisDate(point.t, spanDays)}
          </span>
        ))}
      </div>

      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-ink-muted">
        <span>
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full border-2 border-down align-middle" />
          plus bas {lowest.price.toFixed(3).replace('.', ',')} € le {formatDate(lowest.t)}
        </span>
        <span>
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-accent-bright align-middle" />
          aujourd&apos;hui {last.price.toFixed(3).replace('.', ',')} €
        </span>
      </figcaption>
    </figure>
  );
}

/** Repère positionné en pourcentage, hors du SVG pour ne pas être ovalisé par l'échelle. */
function Marker({ left, top, kind }: { left: number; top: number; kind: 'low' | 'last' }) {
  return (
    <span
      className={`absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface ${
        kind === 'last' ? 'bg-accent-bright' : 'border-2 border-down bg-surface'
      }`}
      style={{ left: `${left}%`, top: `${top}%` }}
      aria-hidden
    />
  );
}

/**
 * Graduations rondes (1,40 / 1,60 / 1,80…) plutôt que des valeurs issues du min et du max,
 * illisibles. Le domaine de l'axe est donné par la première et la dernière graduation.
 */
function roundTicks(min: number, max: number): number[] {
  const span = Math.max(max - min, 0.05);
  const step = [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1].find((s) => s >= span / 4) ?? 1;

  const ticks: number[] = [];
  for (
    let value = Math.floor(min / step) * step;
    value <= Math.ceil(max / step) * step + step / 2;
    value += step
  ) {
    ticks.push(Number(value.toFixed(3)));
  }
  return ticks;
}
