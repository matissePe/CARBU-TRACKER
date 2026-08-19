import { parisDaysAgo, toEpoch } from '@/lib/paris-time';
import type { HistoryPoint } from '@/lib/prices';

/**
 * Le conseil « maintenant ou plus tard » repose sur deux faits mesurables, jamais sur une
 * prévision : où se situe le prix dans sa fourchette récente, et dans quel sens il bouge.
 * Une tendance s'inverse en trois jours — l'app le dit, elle ne l'anticipe pas.
 */

/** Fenêtre de référence pour situer le prix du jour. */
export const POSITION_DAYS = 90;
/** Fenêtre pour lire le sens de la variation. */
export const DIRECTION_DAYS = 14;

/** En deçà de ce mouvement sur la fenêtre, on considère le prix stable. */
const STABLE_MILLI = 10;
const LOW_PERCENT = 30;
const HIGH_PERCENT = 70;

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
  /** Écart avec le point le plus bas de la fenêtre de position, souvent plus parlant. */
  reboundMilli: number;
};

export type Tone = 'good' | 'neutral' | 'bad';

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
    trend:
      Math.abs(deltaMilli) < STABLE_MILLI ? 'stable' : deltaMilli > 0 ? 'hausse' : 'baisse',
    reboundMilli: current - position.minMilli,
  };
}

function euros(milli: number): string {
  return `${(Math.abs(milli) / 1000).toFixed(3).replace('.', ',')} €`;
}

function cents(milli: number): string {
  const value = Math.round(Math.abs(milli) / 10);
  return `${value} centime${value > 1 ? 's' : ''}`;
}

export function buildAdvice(series: HistoryPoint[]): Advice | null {
  const position = computePosition(series);
  if (!position) return null;
  const direction = computeDirection(series, position);

  const low = position.percent < LOW_PERCENT;
  const high = position.percent > HIGH_PERCENT;
  const rising = direction.trend === 'hausse';
  const falling = direction.trend === 'baisse';

  if (low) {
    return {
      ...base(position, direction),
      tone: 'good',
      tag: 'Bon moment',
      title: rising ? 'Bon prix, mais ça repart à la hausse.' : 'C’est le moment de faire le plein.',
      body: rising
        ? `Le prix est encore dans le bas de sa fourchette et il a déjà repris ${cents(direction.deltaMilli)} en deux semaines. Fais le plein maintenant.`
        : `Le prix est dans le bas de sa fourchette des ${POSITION_DAYS} derniers jours (${euros(position.minMilli)} à ${euros(position.maxMilli)}). L’occasion se prend.`,
    };
  }

  if (high && rising) {
    return {
      ...base(position, direction),
      tone: 'bad',
      tag: 'Mauvais moment',
      title: 'C’est cher, et ça monte encore.',
      body: `Mets le minimum. Le prix a repris ${cents(direction.reboundMilli)} depuis son plus bas et rien n’indique une baisse à court terme.`,
    };
  }

  if (high && falling) {
    return {
      ...base(position, direction),
      tone: 'neutral',
      tag: 'Plutôt attendre',
      title: 'Encore cher, mais la baisse est amorcée.',
      body: `Le prix a déjà perdu ${cents(direction.deltaMilli)} en deux semaines. Si ton réservoir peut tenir quelques jours, attends.`,
    };
  }

  if (high) {
    return {
      ...base(position, direction),
      tone: 'bad',
      tag: 'Mauvais moment',
      title: 'Le prix est haut et il stagne.',
      body: `Il est à ${cents(direction.reboundMilli)} au-dessus de son plus bas des ${POSITION_DAYS} derniers jours. Mets le minimum et repasse dans une semaine.`,
    };
  }

  return {
    ...base(position, direction),
    tone: 'neutral',
    tag: rising ? 'Ne traîne pas' : 'Sans urgence',
    title: rising
      ? 'Prix moyen, orienté à la hausse.'
      : falling
        ? 'Prix moyen, orienté à la baisse.'
        : 'Prix moyen, plutôt stable.',
    body: rising
      ? `Le prix a pris ${cents(direction.deltaMilli)} en deux semaines. Si ton réservoir est bas, n’attends pas la semaine prochaine.`
      : falling
        ? `Le prix a perdu ${cents(direction.deltaMilli)} en deux semaines. Rien ne presse.`
        : `Le prix bouge peu depuis deux semaines. Va au moins cher, sans te presser.`,
  };
}

function base(position: Position, direction: Direction) {
  return { position, direction };
}
