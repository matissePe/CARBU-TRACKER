import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

import { STATIONS } from '@/config/stations';

const DB_PATH = process.env.CARBU_DB ?? path.join(process.cwd(), 'data', 'carbu.db');

/**
 * `recorded_at` est une chaîne ISO NAÏVE en heure murale Europe/Paris, stockée telle que la
 * source la publie. L'API la préfixe d'un "+00:00" mensonger : on le retire à l'ingestion et
 * on ne convertit jamais de fuseau (cf. piège n°1 dans docs/DATA-SOURCE.md).
 * Le tri lexicographique d'une chaîne "YYYY-MM-DDTHH:MM:SS" est un tri chronologique correct,
 * donc SQLite peut trier et comparer directement.
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS stations (
  id           INTEGER PRIMARY KEY,
  brand        TEXT,
  address      TEXT NOT NULL,
  city         TEXT NOT NULL,
  postal_code  TEXT NOT NULL,
  latitude     REAL,
  longitude    REAL
);

CREATE TABLE IF NOT EXISTS prices (
  station_id   INTEGER NOT NULL REFERENCES stations(id),
  fuel         TEXT    NOT NULL,
  recorded_at  TEXT    NOT NULL,
  price_milli  INTEGER NOT NULL,
  PRIMARY KEY (station_id, fuel, recorded_at)
) WITHOUT ROWID;

-- Trace des imports, pour savoir quelles années ont déjà été backfillées.
CREATE TABLE IF NOT EXISTS ingest_log (
  source      TEXT NOT NULL,
  ran_at      TEXT NOT NULL,
  inserted    INTEGER NOT NULL,
  detail      TEXT
);
`;

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.exec(SCHEMA);
  syncStations(db);
  return db;
}

/** Le fichier de config fait foi : on le recopie en base à chaque ouverture. */
function syncStations(handle: Database.Database): void {
  const upsert = handle.prepare(`
    INSERT INTO stations (id, brand, address, city, postal_code, latitude, longitude)
    VALUES (@id, @brand, @address, @city, @postalCode, @latitude, @longitude)
    ON CONFLICT(id) DO UPDATE SET
      brand = excluded.brand,
      address = excluded.address,
      city = excluded.city,
      postal_code = excluded.postal_code,
      latitude = excluded.latitude,
      longitude = excluded.longitude
  `);
  handle.transaction(() => {
    for (const station of STATIONS) upsert.run(station);
  })();
}

export function logIngest(source: string, inserted: number, detail?: string): void {
  getDb()
    .prepare('INSERT INTO ingest_log (source, ran_at, inserted, detail) VALUES (?, ?, ?, ?)')
    .run(source, new Date().toISOString(), inserted, detail ?? null);
}
