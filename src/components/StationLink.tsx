'use client';

import Link from 'next/link';

import { CHART_ANCHOR } from '@/lib/routes';

/**
 * Le lien d'une ligne du classement, qui ne fait pas perdre sa place au lecteur.
 *
 * Chaque combinaison station/carburant/période est une page à part (export statique), donc
 * cliquer une station est une navigation. Par défaut Next remonte alors en haut de page, ce qui
 * est exactement le contraire du geste : on clique une station *pour* regarder sa courbe.
 *
 * - `scroll={false}` : la position de lecture est conservée. Sur ordinateur, classement et
 *   courbe sont côte à côte, il n'y a donc rien d'autre à faire.
 * - Sur mobile la courbe est en bas de page, hors écran : on l'amène sous les yeux. La section
 *   existe déjà au même endroit dans la page suivante, le défilement peut donc partir tout de
 *   suite, sans attendre la fin de la navigation.
 *
 * Le seuil 640 px est celui du `sm:` de Tailwind, où la mise en page passe à deux colonnes.
 */
export default function StationLink({
  href,
  className,
  current,
  children,
}: {
  href: string;
  className?: string;
  current?: boolean;
  children: React.ReactNode;
}) {
  const revealChart = () => {
    if (window.matchMedia('(min-width: 640px)').matches) return;
    document.getElementById(CHART_ANCHOR)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Link
      href={href}
      scroll={false}
      onClick={revealChart}
      aria-current={current ? 'true' : undefined}
      className={className}
    >
      {children}
    </Link>
  );
}
