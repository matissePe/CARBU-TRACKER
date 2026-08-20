'use client';

import { useEffect, useState } from 'react';

import { PUBLISHED_FINGERPRINT, VAPID_PUBLIC_KEY, fingerprint } from '@/lib/push';

const SW_PATH = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/sw.js`;

type Status =
  | 'loading'
  /** Ni Safari ni Chrome sur un vieil iOS ne proposent le push : rien à faire ici. */
  | 'unsupported'
  /** Ouvert dans un onglet : iOS n'accorde le push qu'aux apps de l'écran d'accueil. */
  | 'browser'
  | 'denied'
  | 'off'
  /** Abonné, mais l'expéditeur n'a pas cet abonnement-là : il faut le recopier. */
  | 'stale'
  | 'on';

/**
 * L'activation des notifications, et le rattrapage quand elles décrochent.
 *
 * Trois contraintes d'iOS dictent la forme de ce composant :
 * l'app doit avoir été ajoutée à l'écran d'accueil, la demande de permission doit partir d'un
 * geste (d'où le bouton, jamais un appel au chargement), et un abonnement peut être invalidé
 * sans prévenir. Le dernier cas est le plus vicieux : sans le contrôle d'empreinte, les
 * notifications s'arrêteraient en silence et on ne s'en apercevrait qu'en ne recevant rien
 * pendant des mois — or le feu vert ne passe que cinq fois par an, donc le silence est normal.
 */
export default function PushSetup() {
  // Comme `RelativeTime`, le premier rendu client doit être identique au rendu serveur : on
  // part donc de « loading », qui n'affiche rien, et on regarde l'état réel dans un effet.
  const [status, setStatus] = useState<Status>('loading');
  const [payload, setPayload] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void inspect().then((result) => {
      if (cancelled) return;
      setStatus(result.status);
      if (result.payload) setPayload(result.payload);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = async () => {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setStatus(permission === 'denied' ? 'denied' : 'off');
      return;
    }
    const registration = await navigator.serviceWorker.register(SW_PATH);
    const subscription = await registration.pushManager.subscribe({
      // iOS l'exige : tout message reçu doit se voir. Pas de push silencieux, donc pas de
      // pastille qu'on éteindrait à distance.
      userVisibleOnly: true,
      applicationServerKey: decodeKey(VAPID_PUBLIC_KEY),
    });
    setPayload(JSON.stringify(subscription.toJSON()));
    setStatus('stale');
  };

  const copy = async () => {
    await navigator.clipboard.writeText(payload);
    setCopied(true);
  };

  if (status === 'loading' || status === 'unsupported') return null;

  return (
    <section className="mt-8 border-t border-hairline px-5 pt-6 sm:px-0">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">
        Notifications
      </h2>

      {status === 'browser' ? (
        <p className="mt-3 max-w-prose text-[13px] leading-relaxed text-ink-muted">
          iOS ne délivre les notifications qu&apos;aux apps ajoutées à l&apos;écran d&apos;accueil.
          Ouvre le menu de partage de Safari, « Sur l&apos;écran d&apos;accueil », puis reviens ici
          depuis l&apos;icône.
        </p>
      ) : null}

      {status === 'denied' ? (
        <p className="mt-3 max-w-prose text-[13px] leading-relaxed text-ink-muted">
          Les notifications sont refusées pour cette app. Réglages → Notifications → Le plein pour
          les réautoriser.
        </p>
      ) : null}

      {status === 'off' ? (
        <>
          <p className="mt-3 max-w-prose text-[13px] leading-relaxed text-ink-muted">
            Une quinzaine de fois par an, le conseil passe au vert. C&apos;est le seul moment qui
            vaut un dérangement — le classement, lui, change trop souvent pour être notifié.
          </p>
          <button
            type="button"
            onClick={enable}
            className="mt-3 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-page"
          >
            Préviens-moi
          </button>
        </>
      ) : null}

      {status === 'stale' ? (
        <>
          <p className="mt-3 max-w-prose text-[13px] leading-relaxed text-ink-muted">
            {payload
              ? 'Dernière étape, une seule fois : colle ce code dans le secret'
              : 'Les notifications ont été déconnectées. Réactive-les et colle le nouveau code dans le secret'}{' '}
            <span className="font-mono text-ink">PUSH_SUBSCRIPTION</span> du dépôt.
          </p>
          {payload ? (
            <>
              <textarea
                readOnly
                value={payload}
                onFocus={(event) => event.currentTarget.select()}
                className="mt-3 h-24 w-full resize-none rounded-lg border border-hairline bg-surface p-3 font-mono text-[11px] text-ink-soft"
              />
              <button
                type="button"
                onClick={copy}
                className="mt-2 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-page"
              >
                {copied ? 'Copié' : 'Copier le code'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={enable}
              className="mt-3 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-page"
            >
              Réactiver
            </button>
          )}
        </>
      ) : null}

      {status === 'on' ? (
        <p className="mt-3 max-w-prose text-[13px] leading-relaxed text-ink-muted">
          Notifications actives. Tu seras prévenu à chaque passage au vert — une quinzaine de
          fois par an sur l&apos;historique, à l&apos;heure où la bascule tombe.
        </p>
      ) : null}
    </section>
  );
}

/** L'état réel du poste, lu une fois au montage. */
async function inspect(): Promise<{ status: Status; payload?: string }> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { status: 'unsupported' };
  }
  // `standalone` est la façon iOS de le dire, `display-mode` la façon standard.
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true;
  if (!standalone) return { status: 'browser' };
  if (Notification.permission === 'denied') return { status: 'denied' };

  const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return { status: 'off' };

  // La pastille a fait son travail : on l'éteint puisque l'app est sous les yeux.
  navigator.clearAppBadge?.();

  const mine = await fingerprint(subscription.endpoint);
  if (mine === PUBLISHED_FINGERPRINT) return { status: 'on' };
  return { status: 'stale', payload: JSON.stringify(subscription.toJSON()) };
}

/** La clé VAPID voyage en base64url ; `applicationServerKey` la veut en octets. */
function decodeKey(base64url: string): ArrayBuffer {
  const padded = base64url
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(base64url.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
