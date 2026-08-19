/**
 * Backfill de l'historique depuis les archives annuelles de donnees.roulez-eco.fr.
 *
 *   npm run backfill              -> 2007 jusqu'à l'année en cours
 *   npm run backfill -- 2024 2026 -> une plage précise
 *
 * Les ZIP sont conservés dans .cache/ : une deuxième exécution ne retélécharge rien.
 * L'insertion étant idempotente, relancer le script est sans risque.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { STATION_IDS } from '@/config/stations';
import { FUEL_BY_SOURCE_NAME, toMilli } from '@/lib/fuels';
import { insertPrices, type PricePoint } from '@/lib/prices';
import { logIngest } from '@/lib/db';

const FIRST_YEAR = 2007;
const CACHE_DIR = path.join(process.cwd(), '.cache');
const USER_AGENT = 'carbu-tracker/0.1 (projet personnel, https://github.com/)';
const WANTED = new Set(STATION_IDS);

async function downloadYear(year: number): Promise<string> {
  const zipPath = path.join(CACHE_DIR, `annee-${year}.zip`);
  if (fs.existsSync(zipPath) && fs.statSync(zipPath).size > 0) {
    console.log(`  ${year} : archive déjà en cache`);
    return zipPath;
  }

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const url = `https://donnees.roulez-eco.fr/opendata/annee/${year}`;
  console.log(`  ${year} : téléchargement de ${url}`);

  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok || !response.body) {
    throw new Error(`${year} : HTTP ${response.status}`);
  }
  // Les ZIP font au plus ~35 Mo : les garder en mémoire est plus simple qu'un flux, et
  // l'écriture passe par un fichier .part pour qu'un téléchargement interrompu ne laisse
  // pas une archive tronquée dans le cache.
  const partial = `${zipPath}.part`;
  fs.writeFileSync(partial, Buffer.from(await response.arrayBuffer()));
  fs.renameSync(partial, zipPath);
  return zipPath;
}

/**
 * Les XML décompressés pèsent jusqu'à 400 Mo : on les lit en flux via `unzip -p`,
 * sans jamais écrire le XML sur le disque ni le charger en mémoire.
 * Encodage ISO-8859-1 et non UTF-8 (piège n°8).
 */
function streamArchive(zipPath: string, onStation: (block: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('unzip', ['-p', zipPath]);
    const decoder = new TextDecoder('iso-8859-1');
    let buffer = '';

    child.stdout.on('data', (chunk: Buffer) => {
      buffer += decoder.decode(chunk, { stream: true });
      let end: number;
      while ((end = buffer.indexOf('</pdv>')) !== -1) {
        onStation(buffer.slice(0, end));
        buffer = buffer.slice(end + '</pdv>'.length);
      }
    });

    child.stderr.on('data', (chunk: Buffer) => process.stderr.write(chunk));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`unzip a renvoyé ${code}`))));
  });
}

const STATION_ID = /<pdv\s+id="(\d+)"/;
const PRICE = /<prix\s+nom="([^"]+)"\s+id="\d+"\s+maj="([^"]+)"\s+valeur="([^"]+)"\s*\/>/g;

/**
 * Les archives 2007→2014 séparent la date et l'heure par une espace ("2007-01-02 07:12:15"),
 * celles de 2015 et après par un "T". On uniformise sur le "T" : sans ça, un même changement
 * de prix pourrait être stocké deux fois et le tri chronologique de SQLite mélangerait les
 * deux formats (l'espace se classe avant le "T").
 */
function normalizeTimestamp(maj: string): string {
  return maj.slice(0, 19).replace(' ', 'T');
}

/** Valeurs écartées parce qu'invraisemblables : on les affiche plutôt que de les avaler. */
const rejected: string[] = [];

function extractPoints(block: string): PricePoint[] {
  const idMatch = STATION_ID.exec(block);
  if (!idMatch) return [];
  const stationId = Number(idMatch[1]);
  if (!WANTED.has(stationId)) return [];

  const points: PricePoint[] = [];
  // Les stations fermées portent un <prix/> vide : la regex ne le capture pas, tant mieux.
  for (const match of block.matchAll(PRICE)) {
    const fuel = FUEL_BY_SOURCE_NAME[match[1]];
    if (!fuel) continue;

    const priceMilli = toMilli(match[3]);
    if (priceMilli === null) {
      rejected.push(`${stationId} ${fuel} ${match[2]} valeur="${match[3]}"`);
      continue;
    }
    points.push({ stationId, fuel, recordedAt: normalizeTimestamp(match[2]), priceMilli });
  }
  return points;
}

async function backfillYear(year: number): Promise<number> {
  const zipPath = await downloadYear(year);
  const points: PricePoint[] = [];
  await streamArchive(zipPath, (block) => points.push(...extractPoints(block)));

  const inserted = insertPrices(points);
  console.log(`  ${year} : ${points.length} relevés lus, ${inserted} nouveaux`);
  logIngest('backfill', inserted, String(year));
  return inserted;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).map(Number).filter(Number.isFinite);
  const currentYear = new Date().getFullYear();
  const from = args[0] ?? FIRST_YEAR;
  const to = args[1] ?? (args.length === 1 ? from : currentYear);

  console.log(`Backfill ${from} → ${to} pour ${WANTED.size} stations`);
  let total = 0;
  for (let year = from; year <= to; year += 1) {
    total += await backfillYear(year);
  }
  console.log(`\nTerminé : ${total} nouvelles lignes.`);
  if (rejected.length > 0) {
    console.log(`\n${rejected.length} relevé(s) écarté(s) car hors des bornes de plausibilité :`);
    for (const line of rejected) console.log(`  ${line}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
