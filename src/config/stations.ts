/**
 * Périmètre du projet : liste explicite des stations suivies.
 *
 * C'est LA source de vérité du périmètre. On ne filtre jamais sur la commune ni sur le code
 * postal : la source rattache par exemple la station 56000008 à Ploeren dans le flux instantané
 * et à Vannes dans les archives (cf. piège n°3 dans docs/DATA-SOURCE.md).
 *
 * `brand` n'existe pas dans la donnée publique (les noms et enseignes sont exclus à la source).
 * C'est une saisie manuelle, uniquement pour l'affichage.
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
  { id: 56000003, brand: null, address: 'Rue Jean Perrin',           city: 'Vannes', postalCode: '56000', latitude: 47.644, longitude: -2.743 },
  { id: 56000004, brand: null, address: 'ZC Parc Lann',              city: 'Vannes', postalCode: '56000', latitude: 47.666, longitude: -2.794 },
  { id: 56000005, brand: null, address: '8 avenue de Suffren',       city: 'Vannes', postalCode: '56000', latitude: 47.639, longitude: -2.776 },
  { id: 56000006, brand: null, address: '6 avenue Georges Pompidou', city: 'Vannes', postalCode: '56000', latitude: 47.664, longitude: -2.767 },
  { id: 56000008, brand: null, address: '16 avenue de la Marne',     city: 'Vannes', postalCode: '56000', latitude: 47.669, longitude: -2.803 },
  { id: 56000009, brand: null, address: 'Boulevard de la Paix',      city: 'Vannes', postalCode: '56000', latitude: 47.661, longitude: -2.755 },
  { id: 56006001, brand: null, address: '101 avenue de la Marne',    city: 'Vannes', postalCode: '56000', latitude: 47.660, longitude: -2.792 },
  { id: 56860003, brand: null, address: 'Route de Nantes',           city: 'Séné',   postalCode: '56860', latitude: 47.651, longitude: -2.723 },
  { id: 56860004, brand: null, address: '165 route de Nantes',       city: 'Séné',   postalCode: '56860', latitude: 47.650, longitude: -2.722 },
];

export const STATION_IDS = STATIONS.map((s) => s.id);

/** Libellé d'affichage : l'enseigne si on la connaît, l'adresse sinon. */
export function stationLabel(station: Station): string {
  return station.brand ? `${station.brand} — ${station.address}` : station.address;
}
