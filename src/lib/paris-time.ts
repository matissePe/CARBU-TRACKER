/**
 * La source publie de l'heure murale Europe/Paris, que l'API étiquette faussement "+00:00"
 * (vérifié : même station, même prix, même heure des deux côtés — cf. docs/DATA-SOURCE.md).
 * On stocke donc des chaînes ISO naïves "YYYY-MM-DDTHH:MM:SS" sans jamais convertir de fuseau.
 *
 * Pour les calculs et les graphiques, on relit ces chaînes comme si elles étaient en UTC.
 * C'est volontaire : l'écart entre deux dates reste exact, et tant qu'on formate l'affichage
 * en UTC on réaffiche exactement l'heure murale d'origine. Le seul interdit est de laisser le
 * fuseau local de la machine s'en mêler.
 */

const PARIS = 'Europe/Paris';

const PARIS_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: PARIS,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/** Heure murale de Paris maintenant, au format de la source. */
export function nowInParis(): string {
  const parts = Object.fromEntries(
    PARIS_PARTS.formatToParts(new Date()).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

/** Même chose, décalé de N jours dans le passé. Sert aux fenêtres 7 / 30 / 90 jours. */
export function parisDaysAgo(days: number): string {
  const anchor = toEpoch(nowInParis());
  return fromEpoch(anchor - days * 86_400_000);
}

/** Chaîne naïve -> millisecondes, en la lisant comme de l'UTC (voir l'entête). */
export function toEpoch(naive: string): number {
  return Date.parse(`${naive}Z`);
}

/** Millisecondes -> chaîne naïve, sans réintroduire de fuseau. */
export function fromEpoch(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 19);
}

/** Retire le "+00:00" mensonger que l'API accole aux horodatages. */
export function stripFakeOffset(apiTimestamp: string): string {
  return apiTimestamp.replace(/(?:Z|[+-]\d{2}:?\d{2})$/, '').slice(0, 19);
}

const DATE_LABEL = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'UTC',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const DATETIME_LABEL = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'UTC',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(epochMs: number): string {
  return DATE_LABEL.format(new Date(epochMs));
}

export function formatDateTime(epochMs: number): string {
  return DATETIME_LABEL.format(new Date(epochMs));
}
