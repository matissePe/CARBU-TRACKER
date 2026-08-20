import Link from 'next/link';

type Props = {
  href: string;
  active: boolean;
  children: React.ReactNode;
  title?: string;
  /**
   * Reste où on est plutôt que de remonter en haut de page — pour les puces qui ne changent
   * que ce qu'on a déjà sous les yeux (la période de la courbe). Changer de carburant, lui,
   * refait toute la page : là, remonter est le bon geste.
   */
  keepScroll?: boolean;
};

export default function Chip({ href, active, children, title, keepScroll }: Props) {
  return (
    <Link
      href={href}
      title={title}
      scroll={!keepScroll}
      aria-current={active ? 'true' : undefined}
      className={[
        'shrink-0 rounded-full border px-3 py-1.5 text-[13px] transition-colors',
        active
          ? 'border-transparent bg-ink font-medium text-page'
          : 'border-hairline bg-surface text-ink-soft hover:text-ink',
      ].join(' ')}
    >
      {children}
    </Link>
  );
}
