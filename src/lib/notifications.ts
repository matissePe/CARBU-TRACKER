import { stationName } from '@/config/stations';
import { formatEuros, tankPrice } from '@/config/vehicle';
import { POSITION_DAYS, buildAdvice } from '@/lib/advice';
import { getDb } from '@/lib/db';
import { DEFAULT_FUEL } from '@/lib/routes';
import { nowInParis, parisDaysAgo } from '@/lib/paris-time';
import { bestPriceSeries } from '@/lib/prices';
import { SITE_URL } from '@/lib/push';
import { pagePath } from '@/lib/routes';
import { ranking } from '@/lib/trends';

/**
 * Quand vaut-il la peine de déranger ?
 *
 * Une notification ne peut répondre qu'au « quand », plafonné à une dizaine d'euros par an par
 * la simulation (cf. CLAUDE.md) : la question « où », qui vaut trois fois plus, se regarde au
 * moment de partir. La seule bascule qui mérite une vibration est donc le passage au feu vert,
 * mesuré à 13 fois par an sur les 12 derniers mois de la base — et jamais le classement, qui
 * change de tête 109 fois par an pour 1,30 € d'écart moyen.
 */

/*
 * Il n'y a qu'un garde-fou : seules les bascules notifient. Le verrou de 21 jours et les heures
 * calmes ont été retirés à la demande — conséquence assumée, 13 alertes par an au lieu de 8, et
 * une bascule de nuit sonne à l'heure où elle tombe.
 */

/** Format du Declarative Web Push, compris tel quel par Safari 18.4+ et par notre `sw.js`. */
export type PushPayload = {
  web_push: 8030;
  notification: {
    title: string;
    body: string;
    navigate: string;
    app_badge: number;
  };
};

export type Decision =
  | { send: PushPayload; detail: string }
  | { send: null; reason: string };

/**
 * La bascule est détectée en comparant à la couleur mémorisée au tour précédent, et non en
 * rejouant l'historique : `computeDirection` lit la fenêtre de 14 jours depuis l'horloge, un
 * rejeu décalerait cette fenêtre et pourrait inventer une bascule qui n'a pas eu lieu.
 * Le prix de cette exactitude est un état à conserver — d'où la table `push_state`, qui vit
 * dans la base déjà republiée à chaque exécution.
 */
export function decide(): Decision {
  const db = getDb();
  const rows = ranking(DEFAULT_FUEL);
  if (rows.length === 0) return { send: null, reason: 'aucun prix connu' };

  const advice = buildAdvice(
    bestPriceSeries(
      DEFAULT_FUEL,
      parisDaysAgo(POSITION_DAYS),
      rows.map((row) => row.station.id),
    ),
  );
  if (!advice) return { send: null, reason: 'pas assez d’historique' };

  const previous = readState('tone');
  writeState('tone', advice.tone);

  if (advice.tone !== 'go') return { send: null, reason: `feu ${advice.tone}` };
  if (previous === null) return { send: null, reason: 'première exécution, on mémorise sans notifier' };
  if (previous === 'go') return { send: null, reason: 'feu vert déjà allumé au tour précédent' };

  const best = rows[0];
  const detail = `${advice.tag} · ${stationName(best.station)} · ${formatEuros(best.fullTank)}`;

  return {
    detail,
    send: {
      web_push: 8030,
      notification: {
        title: advice.title,
        body: `${formatEuros(tankPrice(best.priceMilli))} le plein chez ${stationName(best.station)}, la moins chère des ${rows.length}.`,
        navigate: `${SITE_URL}${pagePath({ fuel: DEFAULT_FUEL, stationId: best.station.id, periodKey: '90' })}/`,
        app_badge: 1,
      },
    },
  };

  function readState(key: string): string | null {
    const row = db.prepare('SELECT value FROM push_state WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  }

  function writeState(key: string, value: string): void {
    db.prepare(
      `INSERT INTO push_state (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    ).run(key, value, nowInParis());
  }
}

export function recordSent(kind: string, detail: string): void {
  getDb()
    .prepare('INSERT INTO push_log (kind, sent_at, detail) VALUES (?, ?, ?)')
    .run(kind, nowInParis(), detail);
}
