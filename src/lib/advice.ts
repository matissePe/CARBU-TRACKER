import { parisDaysAgo, toEpoch } from '@/lib/paris-time';
import type { HistoryPoint } from '@/lib/prices';

/**
 * Le conseil « maintenant ou plus tard » repose sur deux faits mesurables, jamais sur une
 * prévision : où se situe le prix dans sa fourchette récente, et dans quel sens il bouge.
 *
 * Les seuils ne sont pas choisis à l'intuition. Simulation d'un plein tous les 30 jours avec
 * 14 jours de souplesse, moyennée sur 30 phases de départ, sur l'historique réel des 9 stations :
 *
 * | Règle                        | 2022 → 2026 | 12 derniers mois |
 * |------------------------------|-------------|------------------|
 * | position 30 j < 30 %         |  +0,41 €/an |      +6,08 €/an  |
 * | position 90 j < 30 %         |  −2,16 €/an |      +1,89 €/an  |
 * | position 180 j < 30 %        | −10,08 €/an |      +4,25 €/an  |
 * | position 90 j < 50 % ou rebond | −1,49 €/an |     −5,03 €/an  |
 *
 * Un signe + signifie qu'on paie PLUS cher qu'en ignorant l'app. Deux enseignements :
 *
 * 1. Raccourcir la fenêtre est contre-productif. Pendant une baisse continue, le prix est chaque
 *    jour proche de son plus bas des 30 derniers jours : la jauge donne le feu vert en permanence
 *    alors qu'attendre aurait été meilleur. Plus la fenêtre est courte, plus elle efface la
 *    tendance, qui est justement ce qui porte l'information. D'où les 90 jours.
 * 2. Attendre le moment parfait ne paie pas. La fenêtre de 180 jours, plus juste sur le papier,
 *    ne donne le feu vert que 1 % des jours et reste muette jusqu'à 229 jours d'affilée —
 *    inutilisable pour quelqu'un qui fait le plein tous les mois. La seule règle gagnante achète
 *    quand le prix est simplement RAISONNABLE, ou quand le creux est manifestement passé.
 *
 * Conséquence sur la formulation : l'app ne dit jamais « attends » sans horizon. Le report
 * maximum qu'elle peut conseiller est d'une à deux semaines, la souplesse réelle d'un plein.
 */

/** Fenêtre de référence pour situer le prix du jour. */
export const POSITION_DAYS = 90;
/** Fenêtre pour lire le sens de la variation. */
export const DIRECTION_DAYS = 14;

/** En deçà de ce mouvement sur la fenêtre, on considère le prix stable. */
const STABLE_MILLI = 10;
/** Sous ce seuil, le prix est franchement bas. */
const CHEAP_PERCENT = 30;
/** Sous ce seuil, le prix est raisonnable — c'est le seuil d'achat validé par la simulation. */
const REASONABLE_PERCENT = 50;

export type Position = {
  percent: number;
  minMilli: number;
  maxMilli: number;
  currentMilli: number;
  /** Date du plus bas de la fenêtre, pour pouvoir dire « depuis le 29 juin ». */
  lowestAt: string;
};

export type Direction = {
  deltaMilli: number;
  trend: 'hausse' | 'baisse' | 'stable';
  /** Écart avec le point le plus bas de la fenêtre de position. */
  reboundMilli: number;
};

/** Deux issues seulement : y aller, ou décaler de quelques jours. Jamais « n'y va pas ». */
export type Tone = 'go' | 'wait';

export type Advice = {
  tone: Tone;
  tag: string;
  title: string;
  body: string;
  position: Position;
  direction: Direction;
};

export function computePosition(series: HistoryPoint[]): Position | null {
  if (series.length === 0) return null;

  let lowest = series[0];
  let highest = series[0];
  for (const point of series) {
    if (point.priceMilli < lowest.priceMilli) lowest = point;
    if (point.priceMilli > highest.priceMilli) highest = point;
  }

  const currentMilli = series[series.length - 1].priceMilli;
  const span = highest.priceMilli - lowest.priceMilli;
  // Prix strictement plat sur 90 jours : on ne peut rien dire de la position, on répond « au milieu ».
  const percent = span === 0 ? 50 : ((currentMilli - lowest.priceMilli) / span) * 100;

  return {
    percent: Math.round(percent),
    minMilli: lowest.priceMilli,
    maxMilli: highest.priceMilli,
    currentMilli,
    lowestAt: lowest.recordedAt,
  };
}

export function computeDirection(series: HistoryPoint[], position: Position): Direction {
  const current = series[series.length - 1].priceMilli;
  const threshold = toEpoch(parisDaysAgo(DIRECTION_DAYS));

  // Dernier prix en vigueur avant le début de la fenêtre, pas le premier point après.
  let reference = series[0].priceMilli;
  for (const point of series) {
    if (toEpoch(point.recordedAt) <= threshold) reference = point.priceMilli;
    else break;
  }

  const deltaMilli = current - reference;
  return {
    deltaMilli,
    trend: Math.abs(deltaMilli) < STABLE_MILLI ? 'stable' : deltaMilli > 0 ? 'hausse' : 'baisse',
    reboundMilli: current - position.minMilli,
  };
}

function cents(milli: number): string {
  const value = Math.round(Math.abs(milli) / 10);
  return `${value} centime${value > 1 ? 's' : ''}`;
}

export function buildAdvice(series: HistoryPoint[]): Advice | null {
  const position = computePosition(series);
  if (!position) return null;
  const direction = computeDirection(series, position);
  const context = { position, direction };

  if (position.percent < CHEAP_PERCENT) {
    return {
      ...context,
      tone: 'go',
      tag: 'Bon moment',
      title: 'Fais le plein maintenant.',
      body: `Le prix est dans le bas de sa fourchette des ${POSITION_DAYS} derniers jours. C’est le genre d’occasion qui ne revient que quelques fois par an.`,
    };
  }

  if (position.percent < REASONABLE_PERCENT) {
    return {
      ...context,
      tone: 'go',
      tag: 'Feu vert',
      title: 'Prix correct, vas-y.',
      body: `Le prix est dans la moitié basse de sa fourchette des ${POSITION_DAYS} derniers jours. Guetter mieux fait perdre plus souvent que ça ne rapporte.`,
    };
  }

  // Le prix est haut, mais il remonte : le creux est derrière, attendre coûte de l'argent.
  if (direction.trend === 'hausse') {
    return {
      ...context,
      tone: 'go',
      tag: 'Ne traîne pas',
      title: 'Le creux est passé, ça remonte.',
      body: `Le prix a repris ${cents(direction.deltaMilli)} en deux semaines. Ce n’est pas un bon prix, mais attendre te coûterait plus cher que d’y aller maintenant.`,
    };
  }

  if (direction.trend === 'baisse') {
    return {
      ...context,
      tone: 'wait',
      tag: 'Tu peux attendre',
      title: 'C’est cher, mais ça redescend.',
      body: `Le prix a perdu ${cents(direction.deltaMilli)} en deux semaines. Si ton réservoir tient, repasse dans une semaine — pas plus, la tendance peut s’inverser en trois jours.`,
    };
  }

  return {
    ...context,
    tone: 'wait',
    tag: 'Sans urgence',
    title: 'Prix haut, mais stable.',
    body: `Il est ${cents(direction.reboundMilli)} au-dessus de son plus bas des ${POSITION_DAYS} derniers jours et ne bouge plus depuis deux semaines. Décale de quelques jours si tu peux, sans plus attendre.`,
  };
}
