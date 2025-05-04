import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { db } from "../db";
import { users, utenti } from "@shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "./storage";
import connectPg from "connect-pg-simple";
import { pool } from "../db";
import SupabaseService from "./supabase-service";

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
        const user = await storage.getUserByEmail(email);
        
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, { id: user.id, email: user.email });
        }
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser<number>(async (id, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      done(null, { id: user.id, email: user.email });
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      console.log("Registrazione dati utente:", JSON.stringify(req.body, null, 2));
      const { email, password, ...userDetails } = req.body;
      
      console.log("Email:", email);
      console.log("UserDetails:", JSON.stringify(userDetails, null, 2));
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Email già esistente" });
      }

      // Insert new user into local database for authentication
      const hashedPassword = await hashPassword(password);
      console.log("Inserting user with email:", email);
      const result = await db.insert(users).values({
        email,
        password: hashedPassword,
      }).returning();
      
      const newUser = result[0];
      console.log("User inserted:", JSON.stringify(newUser, null, 2));
      
      // Insert user details in local utenti table - WITHOUT opinion fields
      try {
        console.log("Inserting user details with user_id:", newUser.id);
        
        // Filter out any opinion fields from userDetails to avoid SQL errors
        const { energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia, unione_europea, ...cleanUserDetails } = userDetails;
        
        console.log("User details to insert:", JSON.stringify({
          ...cleanUserDetails,
          user_id: newUser.id
        }, null, 2));
        
        await db.insert(utenti).values({
          ...cleanUserDetails,
          user_id: newUser.id // Associate with user account
        });
        
        console.log("User details saved successfully to local database");
        
        // Tentativo di registrazione su Supabase Auth
        try {
          console.log("=== INIZIO REGISTRAZIONE SU SUPABASE AUTH ===");
          console.log("Dati utente per registrazione:", { email, ...userDetails });
          
          // Prima registriamo l'utente su Supabase Auth
          const supabaseAuthResult = await SupabaseService.registerUserOnSupabaseAuth(email, password);
          
          console.log("Risultato registrazione su Supabase Auth:", JSON.stringify(supabaseAuthResult, null, 2));
          
          if (supabaseAuthResult.success && supabaseAuthResult.user) {
            console.log("=== UTENTE REGISTRATO CON SUCCESSO SU SUPABASE AUTH ===");
            console.log("UUID utente:", supabaseAuthResult.user.id);
            
            console.log("=== TENTATIVO SALVATAGGIO DATI UTENTE SU TABELLA UTENTI SUPABASE ===");
            
            // UNIFICAZIONE DEL FLUSSO: Utilizziamo saveUserData invece di saveUserOpinions
            // come specificato nelle istruzioni per risolvere il problema
            
            // Creiamo un payload completo con tutti i dati dell'utente
            const userDataPayload = {
              // ID dall'autenticazione Supabase
              id: supabaseAuthResult.user.id,
              
              // Inizializziamo i campi delle opinioni come vuoti
              energia_nucleare: "",
              sperimentazione_animale: "",
              legalizzazione_canapa: "",
              caccia: "",
              unione_europea: "",
              
              // Aggiungiamo tutti i campi del profilo
              ...userDetails,
              email: email
            };
            
            console.log("Dati utente da salvare con saveUserData:", JSON.stringify(userDataPayload, null, 2));
            console.log("Chiamata a saveUserData invocata con await");
            
            // Chiamiamo saveUserData direttamente con l'intero payload
            const saveResult = await SupabaseService.saveUserData(userDataPayload);
            
            console.log("Risultato salvataggio dati utente:", JSON.stringify(saveResult, null, 2));
            
            if (!saveResult.success) {
              console.error("=== ERRORE SALVATAGGIO DATI UTENTE SU SUPABASE ===");
              console.error("Dettagli errore:", saveResult.error);
            } else {
              console.log("=== DATI UTENTE SALVATI CON SUCCESSO SU SUPABASE ===");
              console.log("Dati salvati:", JSON.stringify(saveResult.data, null, 2));
            }
          } else {
            console.error("Errore registrando l'utente su Supabase Auth:", supabaseAuthResult.error);
            
            // Anche se fallisce su Supabase Auth, proviamo a salvare i dati nella tabella utenti 
            // usando un ID generato o un identificatore alternativo come email
            console.log("Tentativo fallback di salvataggio dati senza UUID da Auth");
            
            // Creiamo un payload per saveUserData (stesso metodo usato nel caso di successo)
            const userDataPayload = {
              energia_nucleare: "",
              sperimentazione_animale: "",
              legalizzazione_canapa: "",
              caccia: "",
              unione_europea: "",
              ...userDetails,
              email: email
            };
            
            console.log("Chiamata a saveUserData (fallback) invocata con await");
            
            // Usiamo saveUserData anche per il fallback
            const saveResult = await SupabaseService.saveUserData(userDataPayload);
            
            if (!saveResult.success) {
              console.error("Errore salvando i dati utente su Supabase (fallback):", saveResult.error);
            } else {
              console.log("Dati utente salvati con successo su Supabase (fallback)");
            }
          }
        } catch (supabaseError) {
          console.error("Eccezione durante la registrazione su Supabase:", supabaseError);
          
          // Tentativo ultimo di salvataggio dati usando saveUserData
          console.log("TENTATIVO FINALE DI EMERGENZA usando saveUserData");
          
          // Creiamo un payload per saveUserData
          const userDataPayload = {
            energia_nucleare: "",
            sperimentazione_animale: "",
            legalizzazione_canapa: "",
            caccia: "",
            unione_europea: "",
            ...userDetails,
            email: email
          };
          
          try {
            console.log("Chiamata a saveUserData (emergenza) invocata con await");
            const lastAttemptResult = await SupabaseService.saveUserData(userDataPayload);
            
            if (!lastAttemptResult.success) {
              // Solo in caso di fallimento completo, salvare in memoria
              console.log("Fallimento finale, salvataggio in memoria temporanea");
              SupabaseService.tempOpinions = SupabaseService.tempOpinions || {};
              SupabaseService.tempOpinions[email] = userDataPayload;
              console.log("Dati utente salvati temporaneamente in memoria per:", email);
            } else {
              console.log("Dati utente salvati con successo nell'ultimo tentativo:", lastAttemptResult.data);
            }
          } catch (finalError) {
            console.error("Fallimento completo di tutti i metodi di salvataggio:", finalError);
            // Salvare in memoria come ultima risorsa
            SupabaseService.tempOpinions = SupabaseService.tempOpinions || {};
            SupabaseService.tempOpinions[email] = userDataPayload;
            console.log("Dati utente salvati solo in memoria come ultima risorsa per:", email);
          }
        }
      } catch (detailsError) {
        console.error("Error saving user details:", detailsError);
        // Continue with login but log the error
      }

      req.login({ id: newUser.id, email: newUser.email }, (err) => {
        if (err) return next(err);
        res.status(201).json({ id: newUser.id, email: newUser.email });
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