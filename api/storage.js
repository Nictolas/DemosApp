// Import da librerie esterne
import { eq } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";

// ===== IMPORT LOCALI CON GESTIONE ERRORI =====
let db, pool;

try {
  const dbModule = await import("../db/index.js");
  db = dbModule.db;
  pool = dbModule.pool;
} catch (error) {
  console.warn("Database non configurato, usando fallback per session store");
  db = null;
  pool = null;
}

import { utenti, users } from "../shared/schema.js"; // Percorso corretto alla cartella shared
// import { Utente } from './types'; // Non serve in JS

// Session store per l'autenticazione
const PostgresSessionStore = connectPg(session);

export const storage = {
  sessionStore: pool ? new PostgresSessionStore({
    pool,
    createTableIfMissing: true,
    tableName: 'user_sessions'
  }) : null,

  /**
   * Inserisce un nuovo profilo utente nel database locale.
   * Usa il tipo 'Utente' dal nostro file di tipi condiviso.
   */
  async insertUser(userData) {
    if (!db) {
      console.warn("Database non disponibile, usando fallback");
      return { ...userData, id: Date.now() };
    }

    // Rimuoviamo i campi che potrebbero non essere nella tabella 'utenti' di Drizzle
    const { energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia, unione_europea, ...safeUserData } = userData;

    try {
      // @ts-ignore - Drizzle può dare errori di tipo se i campi non combaciano perfettamente, ignoriamo per ora
      const result = await db.insert(utenti).values(safeUserData).returning();
      return result[0];
    } catch (error) {
      console.error("Errore durante l'inserimento dell'utente nel database locale:", error);
      // Fallback per consentire il funzionamento senza DB locale
      return { ...safeUserData, id: Date.now() }; 
    }
  },

  async getAllUsers() {
    if (!db) return [];
    return await db.select().from(utenti);
  },

  async getUserById(id) {
    if (!db) return null;
    const result = await db.select().from(utenti).where(eq(utenti.id, id));
    return result[0] || null;
  },

  // Metodi per la tabella di autenticazione 'users'
  async createUser(data) {
    if (!db) return { ...data, id: Date.now() };
    const result = await db.insert(users).values(data).returning();
    return result[0];
  },

  // Metodi per il profilo 'utenti'
  async getUserProfile(userId) {
    if (!db) return null;
    const result = await db.select().from(utenti).where(eq(utenti.user_id, userId));
    return result[0] || null;
  },
}; 