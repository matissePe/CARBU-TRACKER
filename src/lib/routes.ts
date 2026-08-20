import { FUELS, type Fuel } from '@/lib/fuels';

/** Trois choix suffisent sur un téléphone ; six transformaient la barre en labyrinthe. */
export const PERIODS = [
  { key: '90', label: '3 mois', days: 90 },
  { key: '365', label: '1 an', days: 365 },
  { key: 'all', label: 'Tout', days: null },
] as const;

export type PeriodKey = (typeof PERIODS)[number]['key'];

export const DEFAULT_FUEL: Fuel = 'gazole';
export const DEFAULT_PERIOD: PeriodKey = '90';

export type DashboardProps = { fuel: Fuel; stationId: number; periodKey: string };

/**
 * Le site est exporté en statique : il n'y a pas de serveur pour lire des paramètres de requête,
 * chaque combinaison est donc un fichier à son propre chemin.
 */
export function pagePath({ fuel, stationId, periodKey }: DashboardProps): string {
  return `/${fuel}/${stationId}/${periodKey}`;
}

export function isPeriodKey(value: string): value is PeriodKey {
  return PERIODS.some((period) => period.key === value);
}

export function isKnownFuel(value: string): value is Fuel {
  return (FUELS as readonly string[]).includes(value);
}

/**
 * Ancre de la section qui porte la courbe. Changer de station ne change *que* cette section :
 * sur mobile elle est tout en bas de page, d'où le défilement automatique (cf. `StationLink`).
 */
export const CHART_ANCHOR = 'courbe';
