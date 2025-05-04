import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import connectPg from "connect-pg-simple";
import { pool } from "../db";
// Importa SupabaseService e il client supabase dalla classe di servizio
import SupabaseService, { supabase, supabaseAdmin } from "./supabase-service";

const PostgresSessionStore = connectPg(session);

declare global {
  namespace Express {
    interface User {
      id: number;
      email: string;
    }
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "DEMOS_secret_key",
    resave: false,
    saveUninitialized: false,
    store: new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true,
      tableName: 'user_sessions'
    }),
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
      try {
        // Verifica credenziali direttamente con Supabase
        console.log("Tentativo login con Supabase Auth per:", email);
        
        // Prima verifichiamo se l'utente esiste in Supabase
        const supabaseUser = await SupabaseService.getUserByEmail(email);
        if (!supabaseUser) {
          console.log("Utente non trovato in Supabase:", email);
          return done(null, false);
        }
        
        // Poi proviamo ad autenticare l'utente con Supabase Auth
        if (supabase) {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
          });
          
          if (error || !data.user) {
            console.error("Errore login con Supabase Auth:", error);
            return done(null, false);
          }
          
          console.log("Login con Supabase Auth riuscito per:", email);
          const userId = Date.now(); // ID temporaneo per questa sessione
          return done(null, { id: userId, email: email });
        } else {
          console.error("Client Supabase non configurato per login");
          return done(null, false);
        }
      } catch (error) {
        console.error("Eccezione durante il login:", error);
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => {
    // Se è un oggetto con id e email, serialize l'intero oggetto
    if (user && typeof user === 'object' && 'id' in user && 'email' in user) {
      return done(null, JSON.stringify(user));
    }
    return done(null, user);
  });
  
  passport.deserializeUser(async (userDataStr, done) => {
    try {
      // Deserialize l'oggetto utente
      const userData = JSON.parse(String(userDataStr));
      return done(null, userData);
    } catch (error) {
      console.error("Errore deserializzando l'utente:", error);
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      console.log("Registrazione dati utente:", JSON.stringify(req.body, null, 2));
      const { email, password, ...userDetails } = req.body;
      
      console.log("Email:", email);
      console.log("UserDetails:", JSON.stringify(userDetails, null, 2));
      
      // Registrazione esclusivamente su Supabase (nessun database locale)
      console.log("=== INIZIO REGISTRAZIONE SU SUPABASE AUTH ===");
      console.log("Dati utente per registrazione:", { email, ...userDetails });
      
      // UNICO FLUSSO: Il metodo registerUserOnSupabaseAuth esegue signUp e
      // salva DIRETTAMENTE i dati utente con saveUserOpinions
      const supabaseAuthResult = await SupabaseService.registerUserOnSupabaseAuth(email, password, userDetails);
      
      console.log("Risultato registrazione su Supabase Auth:", JSON.stringify(supabaseAuthResult, null, 2));
      
      if (!supabaseAuthResult.success) {
        console.error("Errore registrando l'utente su Supabase Auth:", supabaseAuthResult.error);
        return res.status(400).json({ error: "Errore durante la registrazione con Supabase: " + supabaseAuthResult.error });
      }
      
      console.log("=== UTENTE REGISTRATO CON SUCCESSO SU SUPABASE AUTH E SALVATO IN TABELLA UTENTI ===");
      
      // Crea una sessione temporanea con i dati dell'utente
      const userId = Date.now(); // ID temporaneo per questa sessione
      req.login({ id: userId, email: email }, (err) => {
        if (err) return next(err);
        res.status(201).json({ id: userId, email: email });
      });
    } catch (error) {
      console.error("Registration error:", error);
      return res.status(500).json({ error: "Errore durante la registrazione" });
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: Express.User | false, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ error: "Email o password non validi" });
      }
      req.login(user, (err) => {
        if (err) return next(err);
        return res.status(200).json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Non autenticato" });
    res.json(req.user);
  });
}