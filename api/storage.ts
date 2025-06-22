// Import da librerie esterne
import session from "express-session";
import { Utente } from "./types.js";

// Session store per l'autenticazione - usando memory store per ora
// In produzione, considera di usare Redis o un altro store compatibile con Firebase
const MemoryStore = session.MemoryStore;

export const storage = {
  sessionStore: new MemoryStore()
};