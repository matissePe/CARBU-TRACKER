type Props = {
  label: string;
  value: string;
  /** Signe de la variation : une hausse de prix est mauvaise, donc rouge. */
  direction?: 'up' | 'down' | 'flat';
  hint?: string;
};

export default function StatTile({ label, value, direction, hint }: Props) {
  const color =
    direction === 'up' ? 'text-up' : direction === 'down' ? 'text-down' : 'text-ink';

  return (
    <div className="rounded-lg border border-hairline bg-surface px-4 py-3">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${color}`}>{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-ink-muted">{hint}</div> : null}
    </div>
  );
}
