import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from '../shared/schema.js';

// Configura il WebSocket per la connessione serverless, necessario per Neon
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set in environment variables.');
}

// Estrai i parametri dalla stringa di connessione per una configurazione più granulare
const dbUrl = new URL(process.env.DATABASE_URL);

// ===== CONFIGURAZIONE DEL POOL OTTIMIZZATA PER AMBIENTI SERVERLESS E NEONDB =====
export const pool = new Pool({
  // Parametri di base
  host: dbUrl.hostname,
  port: Number(dbUrl.port),
  user: dbUrl.username,
  password: dbUrl.password,
  database: dbUrl.pathname.slice(1), // Rimuove lo slash iniziale

  // Parametri di connessione e performance
  ssl: true, // Neon richiede sempre SSL
  max: 10,   // Numero massimo di client nel pool

  // Timeout FONDAMENTALI per dare a Neon il tempo di svegliarsi
  connectionTimeoutMillis: 20000, // 20 secondi, molto generoso
  idleTimeoutMillis: 30000,       // 30 secondi

  // Neon consiglia questo per chiudere le connessioni in modo pulito
  allowExitOnIdle: true,
});

// Esporta l'istanza di Drizzle ORM pronta per essere usata
export const db = drizzle({ client: pool, schema });