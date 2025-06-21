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
      sameSite: "lax"
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
        if (!auth) {
          return done(null, false, { message: "Servizio di autenticazione non disponibile" });
        }

        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (!userCredential.user) {
          return done(null, false, { message: "Credenziali non valide" });
        }

        // **USA IL NUOVO UserService**
        const userProfile = await UserService.getUserByEmail(email);

        if (!userProfile) {
          return done(null, false, { message: "Profilo utente non trovato nel database." });
        }

        return done(null, { 
          id: userProfile.uid!,
          uid: userProfile.uid,
          email: userProfile.email,
          nome: userProfile.nome,
          cognome: userProfile.cognome,
          ruolo: userProfile.ruolo
        });
      } catch (error) {
        console.error("Eccezione durante il login:", error);
        return done(null, false, { message: "Credenziali non valide" });
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
  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.status(200).json(req.user);
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