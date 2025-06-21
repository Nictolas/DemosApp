import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import { signInWithEmailAndPassword } from 'firebase/auth';

import AuthService from "./auth.service.js";
import UserService from "./user.service.js";
import { auth } from './firebase-config.js';

// Dichiarazione dei tipi per l'oggetto User di Express
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

  // Impostazioni per la sessione IN MEMORIA (non usa Postgres)
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "DEMOS_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 giorni
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax"
    }
  };

  // Middleware per le sessioni e Passport
  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Strategia di autenticazione locale di Passport
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

  // Serializzazione e Deserializzazione dell'utente per la sessione
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

  // =====================================
  // ENDPOINT DI AUTENTICAZIONE
  // =====================================

  // Endpoint di Registrazione
  app.post("/api/register", async (req, res, next) => {
    try {
      const { email, password, ...userDetails } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email e password sono obbligatori" });
      }

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

  // Endpoint di Login
  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.status(200).json(req.user);
  });

  // Endpoint di Logout
  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy((destroyErr) => {
        if (destroyErr) return next(destroyErr);
        res.clearCookie('connect.sid'); // Il nome del cookie di default
        res.sendStatus(200);
      });
    });
  });

  // Endpoint per ottenere i dati dell'utente della sessione corrente
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Non autenticato" });
    res.json(req.user);
  });
}