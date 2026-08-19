'use client';

import { useEffect, useState } from 'react';

import { formatShortDateTime, nowInParis, toEpoch } from '@/lib/paris-time';

/**
 * « il y a 13 h » calculé dans le navigateur, pas au build.
 *
 * Les pages sont du HTML statique régénéré toutes les deux heures : un libellé relatif figé
 * serait faux dès la minute suivante, et franchement faux si un build échoue. On rend donc la
 * date absolue côté serveur — vraie indéfiniment, et lisible même sans JavaScript — puis on la
 * remplace par le libellé relatif une fois la page chargée, à partir de l'heure réelle.
 *
 * Le premier rendu client doit être identique au rendu serveur, sinon React signale une
 * incohérence d'hydratation : d'où le passage au relatif dans un effet, et non à la volée.
 */
export default function RelativeTime({
  recordedAt,
  staleAfterHours,
}: {
  recordedAt: string;
  /** Au-delà de ce délai, le prix affiché n'est plus fiable pour se déplacer. */
  staleAfterHours?: number;
}) {
  const absolute = formatShortDateTime(toEpoch(recordedAt));
  const [label, setLabel] = useState(absolute);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const refresh = () => {
      const hours = (toEpoch(nowInParis()) - toEpoch(recordedAt)) / 3_600_000;
      setLabel(relative(hours, absolute));
      setStale(staleAfterHours !== undefined && hours > staleAfterHours);
    };
    refresh();
    // Une page ouverte sur l'écran d'accueil peut rester affichée longtemps.
    const timer = setInterval(refresh, 60_000);
    return () => clearInterval(timer);
  }, [recordedAt, absolute, staleAfterHours]);

  return (
    <time dateTime={recordedAt} title={absolute} className={stale ? 'text-up' : undefined}>
      {label}
    </time>
  );
}

function relative(hours: number, absolute: string): string {
  if (hours < 0) return absolute;
  if (hours < 1 / 60) return "à l'instant";
  if (hours < 1) return `il y a ${Math.round(hours * 60)} min`;
  if (hours < 24) return `il y a ${Math.round(hours)} h`;

  const days = Math.round(hours / 24);
  if (days === 1) return 'hier';
  // Au-delà d'une semaine, « il y a 23 jours » est moins parlant qu'une date.
  return days < 8 ? `il y a ${days} jours` : absolute;
}
