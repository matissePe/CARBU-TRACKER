/**
 * Périmètre du projet : liste explicite des stations suivies.
 *
 * C'est LA source de vérité du périmètre. On ne filtre jamais sur la commune ni sur le code
 * postal : la source rattache par exemple la station 56000008 à Ploeren dans le flux instantané
 * et à Vannes dans les archives (cf. piège n°3 dans docs/DATA-SOURCE.md).
 *
 * `brand` n'existe pas dans la donnée publique (les noms et enseignes sont exclus à la source).
 * Les valeurs ci-dessous viennent d'un annuaire tiers, recoupé par identifiant de station.
 * Elles servent uniquement à l'affichage — l'adresse reste nécessaire pour distinguer les deux
 * Carrefour et les trois TotalEnergies.
 */

export type Station = {
  id: number;
  brand: string | null;
  address: string;
  city: string;
  postalCode: string;
  latitude: number;
  longitude: number;
};

export const STATIONS: Station[] = [
  { id: 56000003, brand: 'Carrefour',    address: 'Rue Jean Perrin',          city: 'Vannes', postalCode: '56000', latitude: 47.644, longitude: -2.743 },
  { id: 56000004, brand: 'E.Leclerc',    address: 'ZC Parc Lann',             city: 'Vannes', postalCode: '56000', latitude: 47.666, longitude: -2.794 },
  { id: 56000005, brand: 'Super U',      address: '8 avenue de Suffren',      city: 'Vannes', postalCode: '56000', latitude: 47.639, longitude: -2.776 },
  { id: 56000006, brand: 'Intermarché',  address: '6 avenue Georges Pompidou', city: 'Vannes', postalCode: '56000', latitude: 47.664, longitude: -2.767 },
  { id: 56000008, brand: 'TotalEnergies', address: '16 avenue de la Marne',    city: 'Vannes', postalCode: '56000', latitude: 47.669, longitude: -2.803 },
  { id: 56000009, brand: 'TotalEnergies', address: 'Boulevard de la Paix',     city: 'Vannes', postalCode: '56000', latitude: 47.661, longitude: -2.755 },
  { id: 56006001, brand: 'Carrefour',    address: '101 avenue de la Marne',   city: 'Vannes', postalCode: '56000', latitude: 47.660, longitude: -2.792 },
  { id: 56860003, brand: 'Intermarché',  address: 'Route de Nantes',          city: 'Séné',  postalCode: '56860', latitude: 47.651, longitude: -2.723 },
  { id: 56860004, brand: 'TotalEnergies', address: '165 route de Nantes',      city: 'Séné',  postalCode: '56860', latitude: 47.650, longitude: -2.722 },
];

export const STATION_IDS = STATIONS.map((s) => s.id);

/** Nom court, celui qu'on lit en premier dans une liste. */
export function stationName(station: Station): string {
  return station.brand ?? station.address;
}

/**
 * Sous-titre qui lève l'ambiguïté : deux Carrefour et trois TotalEnergies dans le périmètre,
 * donc l'adresse reste indispensable — mais en second.
 */
export function stationSubtitle(station: Station): string {
  return station.brand ? `${station.address}, ${station.city}` : station.city;
}

/** Libellé sur une seule ligne, pour les endroits où il n'y a pas de place pour deux. */
export function stationLabel(station: Station): string {
  return station.brand ? `${station.brand} — ${station.address}` : station.address;
}
