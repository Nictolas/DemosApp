import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from '../shared/schema.js';

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL deve essere impostata nei Secrets / Environment Variables.');
}

// ===== MODIFICA CHIAVE QUI =====
// Aggiungiamo dei timeout per dare a Neon il tempo di "svegliarsi"
// dal suo stato di sleep nel piano gratuito.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  // Attende fino a 10 secondi per stabilire una connessione.
  // Di default è molto più basso.
  connectionTimeoutMillis: 10000, 

  // Mantiene una connessione inattiva per 15 secondi prima di chiuderla.
  // Aiuta a riutilizzare le connessioni per richieste ravvicinate.
  idleTimeoutMillis: 15000 
});

export const db = drizzle({ client: pool, schema });