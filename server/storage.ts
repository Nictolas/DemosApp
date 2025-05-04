import { db } from "../db";
import { utenti, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "../db";
import { UserInfo } from '../client/src/types';

// Session store per l'autenticazione
const PostgresSessionStore = connectPg(session);

export const storage = {
  sessionStore: new PostgresSessionStore({
    pool,
    createTableIfMissing: true,
    tableName: 'user_sessions'
  }),
  
  async insertUser(userData: UserInfo) {
    // Rimuoviamo i campi delle opinioni se presenti nei dati (potrebbero causare errori)
    const { energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia, unione_europea, ...safeUserData } = userData as any;
    
    try {
      const result = await db.insert(utenti).values(safeUserData).returning();
      return result[0];
    } catch (error) {
      console.error("Errore durante l'inserimento dell'utente nel database locale:", error);
      // Ritorniamo i dati originali per consentire il funzionamento senza database
      return { ...safeUserData, id: Date.now() }; // ID temporaneo per evitare errori
    }
  },
  
  async getAllUsers() {
    return await db.select().from(utenti);
  },
  
  async getUserById(id: number) {
    const result = await db.select().from(utenti).where(eq(utenti.id, id));
    return result[0] || null;
  },
  
  // Metodi per l'autenticazione
  async getUserByEmail(email: string) {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0] || null;
  },
  
  async createUser(data: { email: string, password: string }) {
    const result = await db.insert(users).values(data).returning();
    return result[0];
  },
  
  async getUserProfile(userId: number) {
    const result = await db.select().from(utenti).where(eq(utenti.user_id, userId));
    return result[0] || null;
  },
  
  async getUser(id: number) {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0] || null;
  }
};
