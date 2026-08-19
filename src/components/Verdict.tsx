import type { Advice } from '@/lib/advice';

const TONE_DOT: Record<Advice['tone'], string> = {
  go: 'bg-down',
  wait: 'bg-accent-bright',
};

/** La réponse à « quand y aller », avant tout le reste et sans avoir à faire défiler. */
export default function Verdict({ advice }: { advice: Advice }) {
  return (
    <section className="min-w-0 bg-panel px-5 py-6 text-panel-ink sm:px-6">
      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.1em] text-panel-muted">
        <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT[advice.tone]}`} aria-hidden />
        {advice.tag}
      </div>
      <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight text-balance sm:text-[28px]">
        {advice.title}
      </h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-panel-muted">{advice.body}</p>
    </section>
  );
}
