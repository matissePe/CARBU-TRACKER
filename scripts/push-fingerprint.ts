/*
 * Imprime l'empreinte de l'abonnement configuré, rien d'autre.
 *
 * Le build en a besoin pour la publier dans la page : c'est ce qui permet à l'app de constater
 * elle-même que l'abonnement du téléphone n'est plus celui de l'expéditeur, et de réclamer un
 * nouveau copier-coller au lieu de se taire.
 */
import { fingerprint } from '@/lib/push';

const raw = process.env.PUSH_SUBSCRIPTION;
if (!raw) process.exit(0);

const { endpoint } = JSON.parse(raw) as { endpoint: string };
fingerprint(endpoint).then((value) => process.stdout.write(value));
