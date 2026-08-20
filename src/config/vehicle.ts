/**
 * Le véhicule de référence pour convertir un prix au litre en euros.
 *
 * « 0,081 €/L » demande un calcul mental, « 4,05 € de plus sur un plein » décide tout de suite.
 * Peugeot 207 SW de 2008 : 50 L de réservoir (valeur constructeur, identique sur toutes les
 * motorisations de la génération 2006-2009).
 */
export const TANK_LITERS = 50;

/** Convertit un prix au litre (en millièmes d'euro) en euros pour un plein complet. */
export function tankPrice(priceMilli: number): number {
  return (priceMilli / 1000) * TANK_LITERS;
}

/** Convertit un écart de prix (en millièmes d'euro par litre) en euros sur un plein. */
export function perTank(deltaMilli: number): number {
  return tankPrice(deltaMilli);
}

/** « 86,45 € » — la façon dont un montant en euros s'affiche partout dans l'app. */
export function formatEuros(amount: number): string {
  return `${amount.toFixed(2).replace('.', ',')} €`;
}
