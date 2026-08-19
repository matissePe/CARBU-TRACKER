/**
 * Les six carburants publiés par la source.
 *
 * `sourceId` est l'identifiant utilisé dans les archives annuelles (<prix id="1" nom="Gazole" />).
 * `feedPrefix` est le préfixe des colonnes du flux instantané (gazole_prix, gazole_maj…).
 */

export const FUELS = ['gazole', 'sp95', 'sp98', 'e10', 'e85', 'gplc'] as const;

export type Fuel = (typeof FUELS)[number];

export const FUEL_META: Record<Fuel, { label: string; sourceId: number; sourceName: string }> = {
  gazole: { label: 'Gazole', sourceId: 1, sourceName: 'Gazole' },
  sp95:   { label: 'SP95',   sourceId: 2, sourceName: 'SP95' },
  e85:    { label: 'E85',    sourceId: 3, sourceName: 'E85' },
  gplc:   { label: 'GPLc',   sourceId: 4, sourceName: 'GPLc' },
  e10:    { label: 'E10',    sourceId: 5, sourceName: 'E10' },
  sp98:   { label: 'SP98',   sourceId: 6, sourceName: 'SP98' },
};

/** Index inverse : nom tel qu'écrit dans les archives -> clé interne. */
export const FUEL_BY_SOURCE_NAME: Record<string, Fuel> = Object.fromEntries(
  FUELS.map((fuel) => [FUEL_META[fuel].sourceName, fuel]),
);

export function isFuel(value: string): value is Fuel {
  return (FUELS as readonly string[]).includes(value);
}

/**
 * Bornes de plausibilité d'un prix au litre, en millièmes d'euro : 0,50 € à 3,50 €.
 * Le plancher laisse passer l'E85 et le GPLc (descendus à 0,535 € en 2020) ; le plafond est
 * très au-dessus du maximum réellement observé sur 19 ans (2,499 € en avril 2026).
 */
const MIN_MILLI = 500;
const MAX_MILLI = 3500;

/**
 * Normalise un prix vers des entiers de millièmes d'euro — on ne manipule jamais de flottant
 * sur de l'argent.
 *
 * L'unité de la source a changé en cours de route : les archives 2007→2021 publient des entiers
 * déjà exprimés en millièmes (`valeur="1141"` = 1,141 €), celles de 2022 et après des euros
 * décimaux (`valeur="1.572"`), tout comme le flux instantané. On tranche sur l'ordre de grandeur
 * plutôt que sur l'année : les deux échelles ne se recouvrent pas (un prix au litre en euros
 * reste sous 10, le même prix en millièmes dépasse 200), donc la règle reste valable si la
 * source rebascule.
 *
 * Renvoie null pour les valeurs hors bornes : la source contient de vraies fautes de frappe
 * (gazole à « 5.579 » le 11/01/2022 alors qu'il était à 1,579 € la veille, E10 à « 4469 »
 * le 23/10/2018 et à « 304 » le 25/06/2020). Elles sont rares — 4 relevés sur 98 000 — mais
 * elles écrasent les min/max si on les garde. Le backfill les compte et les affiche.
 */
export function toMilli(rawPrice: string | number): number | null {
  const value = typeof rawPrice === 'string' ? Number(rawPrice.replace(',', '.')) : rawPrice;
  if (!Number.isFinite(value) || value <= 0) return null;

  const milli = Math.round(value >= 100 ? value : value * 1000);
  return milli >= MIN_MILLI && milli <= MAX_MILLI ? milli : null;
}

export function formatPrice(priceMilli: number): string {
  return `${(priceMilli / 1000).toFixed(3)} €`;
}
