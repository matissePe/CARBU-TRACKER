import Link from 'next/link';

type Props = { href: string; active: boolean; children: React.ReactNode; title?: string };

export default function Chip({ href, active, children, title }: Props) {
  return (
    <Link
      href={href}
      title={title}
      aria-current={active ? 'true' : undefined}
      className={[
        'rounded-full border px-3 py-1.5 text-sm transition-colors',
        active
          ? 'border-transparent bg-ink text-page font-medium'
          : 'border-hairline bg-surface text-ink-soft hover:text-ink',
      ].join(' ')}
    >
      {children}
    </Link>
  );
}
