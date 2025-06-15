import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from '../shared/schema.js';

// Configura il WebSocket per la connessione serverless, necessario per Neon
neonConfig.webSocketConstructor = ws;

// Controlla che la variabile d'ambiente fondamentale esista
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set in environment variables.');
}

// ===== CONFIGURAZIONE DEL POOL OTTIMIZZATA PER AMBIENTI SERVERLESS (VERCEL) E NEONDB =====
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  // Timeout di connessione lungo per dare a Neon il tempo di "svegliarsi"
  // dal suo stato di sleep nel piano gratuito.
  connectionTimeoutMillis: 15000, // 15 secondi

  // Mantiene le connessioni inattive più a lungo, ma non troppo.
  // Aiuta a riutilizzare le connessioni per richieste ravvicinate.
  idleTimeoutMillis: 20000, 

  // Numero massimo di client nel pool. 10 è un buon punto di partenza.
  max: 10,

  // Neon consiglia di impostare questo per chiudere le connessioni in modo pulito
  // e prevenire che rimangano "appese" dopo che la funzione serverless ha terminato.
  allowExitOnIdle: true, 
});

// Esporta l'istanza di Drizzle ORM pronta per essere usata
export const db = drizzle({ client: pool, schema });