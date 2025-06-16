import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "../db/index.js"; // Aggiunto .js
import { signInWithEmailAndPassword } from 'firebase/auth';

// ===== IMPORT CORRETTI DAI NUOVI SERVIZI E CONFIGURAZIONI =====
import AuthService from "./auth.service.js";
import UserService from "./user.service.js";
import { auth } from './firebase-config.js';

const PostgresSessionStore = connectPg(session);

// (La dichiarazione global è corretta e rimane invariata)
declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      uid?: string;
      nome?: string;
      cognome?: string;
      ruolo?: string;
      profile?: any;
    }
  }
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

  // === STRATEGIA PASSAPORT CHE USA I NUOVI SERVIZI ===
  passport.use(
    new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
      try {
        console.log(`[AUTH-DEBUG] 1. Inizio strategia login per: ${email}`);

        if (!auth) {
          console.error("[AUTH-DEBUG] CRASH: Istanza Firebase Auth non disponibile.");
          return done(null, false, { message: "Servizio auth non disponibile" });
        }

        console.log("[AUTH-DEBUG] 2. Eseguo signInWithEmailAndPassword...");
        const userCredential = await signInWithEmailAndPassword(auth, email, password);

        if (!userCredential.user) {
          console.error("[AUTH-DEBUG] CRASH: signIn non ha restituito un utente.");
          return done(null, false, { message: "Credenziali non valide" });
        }

        console.log(`[AUTH-DEBUG] 3. Login Firebase Auth OK. UID: ${userCredential.user.uid}. Cerco profilo Firestore.`);
        let userProfile = await UserService.getUserByEmail(email);

        if (!userProfile) {
          console.log("[AUTH-DEBUG] 3a. Profilo non trovato, creo un profilo base...");
          const basicProfile = {
              email, uid: userCredential.user.uid, nome: '', cognome: '', data_nascita: '', genere: '', cittadinanza: '',
              paese_residenza: '', regione_residenza: '', provincia_residenza: '', comune_residenza: '',
            ruolo: 'Elettore' as const,
          };
          await UserService.saveUserData(basicProfile);
          userProfile = await UserService.getUserByEmail(email);
          console.log("[AUTH-DEBUG] 3b. Profilo base creato e recuperato.");
        }

        if (!userProfile) {
            console.error("[AUTH-DEBUG] CRASH: Impossibile creare o recuperare il profilo utente dopo il login.");
            return done(null, false, { message: "Errore interno durante il recupero del profilo." });
        }

        const userForSession = { 
          id: userProfile.uid!, 
          email: userProfile.email,
          uid: userProfile.uid,
          nome: userProfile.nome,
          cognome: userProfile.cognome,
          ruolo: userProfile.ruolo
        };

        console.log("[AUTH-DEBUG] 4. Profilo pronto. Chiamo done() per passare a Passport.");
        return done(null, userForSession);

      } catch (error: any) {
        console.error("[AUTH-DEBUG] CRASH: Eccezione nel blocco try-catch!", error.code, error.message);
        if (error.code === 'auth/invalid-credential') {
            return done(null, false, { message: "Credenziali non valide." });
        }
        return done(error);
      }
    }),
  );

  // (serializeUser e deserializeUser rimangono invariati)
  passport.serializeUser((user, done) => {
    if (user && typeof user === 'object' && 'id' in user) {
      done(null, JSON.stringify(user));
    } else {
      done(new Error("Oggetto utente non serializzabile"));
    }
  });

  passport.deserializeUser(async (userDataStr, done) => {
    try {
      const userData = JSON.parse(String(userDataStr));
      done(null, userData);
    } catch (error) {
      done(error);
    }
  });

  // ===== ENDPOINT DI REGISTRAZIONE CHE USA AuthService =====
  app.post("/api/register", async (req, res, next) => {
    try {
      const { email, password, ...userDetails } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email e password sono obbligatori" });
      }

      // **USA IL NUOVO AuthService**
      const result = await AuthService.registerUserOnFirebaseAuth(email, password, userDetails);

      if (!result.success || !result.user) {
        return res.status(400).json({ error: result.error || "Errore durante la registrazione" });
      }

      const userToLogin: Express.User = {
        id: result.user.uid,
        uid: result.user.uid,
        email: email,
        nome: userDetails.nome,
        cognome: userDetails.cognome,
        ruolo: userDetails.ruolo,
        profile: userDetails
      };

      req.login(userToLogin, (err) => {
        if (err) return next(err);
        res.status(201).json(userToLogin);
      });
    } catch (error) {
      console.error("Registration error:", error);
      return res.status(500).json({ error: "Errore interno del server" });
    }
  });

  // (Endpoint /api/login, /api/logout, /api/user rimangono invariati)
app.post("/api/login", (req, res, next) => {
  console.log("[AUTH-DEBUG] 5. Ricevuta richiesta a /api/login. Avvio passport.authenticate.");
  passport.authenticate("local", (err: any, user: Express.User | false, info: any) => {
    if (err) {
      console.error("[AUTH-DEBUG] CRASH: Errore da passport.authenticate:", err);
      return next(err);
    }
    if (!user) {
      console.error("[AUTH-DEBUG] Login fallito:", info.message);
      return res.status(401).json({ error: info.message || "Email o password non validi" });
    }

    console.log("[AUTH-DEBUG] 6. Autenticazione riuscita. Avvio req.login per creare la sessione.");
    req.login(user, (err) => {
      if (err) {
        // Se l'errore avviene qui, è al 99% il database delle sessioni (NeonDB)
        console.error("[AUTH-DEBUG] CRASH: Errore durante req.login (probabile problema con session store/DB):", err);
        return next(err);
      }
      console.log("[AUTH-DEBUG] 7. Sessione creata con successo. Invio risposta 200.");
      return res.status(200).json(user);
    });
  })(req, res, next);
});
}