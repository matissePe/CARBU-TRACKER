import Dashboard from '@/components/Dashboard';
import { DEFAULT_FUEL, DEFAULT_PERIOD } from '@/lib/routes';
import { ranking } from '@/lib/trends';

/**
 * Page d'accueil : gazole, la station la moins chère du moment, trois mois.
 *
 * Un export statique ne peut pas rediriger (il n'y a pas de serveur), donc la racine rend
 * directement le contenu par défaut plutôt que de renvoyer vers une autre URL.
 */
export default function Page() {
  const cheapest = ranking(DEFAULT_FUEL)[0]?.station.id ?? 0;
  return <Dashboard fuel={DEFAULT_FUEL} stationId={cheapest} periodKey={DEFAULT_PERIOD} />;
}
