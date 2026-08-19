/**
 * Le véhicule de référence pour convertir un écart de prix en euros.
 *
 * « 0,081 €/L » demande un calcul mental, « 4,05 € de plus sur un plein » décide tout de suite.
 * Peugeot 207 SW de 2008 : 50 L de réservoir (valeur constructeur, identique sur toutes les
 * motorisations de la génération 2006-2009).
 */
export const TANK_LITERS = 50;

/** Convertit un écart de prix (en millièmes d'euro par litre) en euros sur un plein. */
export function perTank(deltaMilli: number): number {
  return (deltaMilli / 1000) * TANK_LITERS;
}
