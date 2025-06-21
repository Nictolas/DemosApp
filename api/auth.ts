import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "../db/index.js"; // Aggiunto .js
import { signInWithEmailAndPassword } from 'firebase/auth';
import { storage } from "./storage.js";

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
  // Imposta trust proxy per far funzionare secure cookies dietro Vercel
  // Questo dice a Express di fidarsi degli header X-Forwarded-* impostati dal proxy di Vercel
  app.set('trust proxy', 1); 

  app.use(
    session({
      store: storage.sessionStore,
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,
      proxy: true, // Fondamentale per Vercel
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 giorni
        httpOnly: true,
        // Con 'trust proxy' e proxy:true, express-session imposta secure automaticamente.
        // Esplicitarlo a 'true' forza il comportamento corretto.
        secure: true, 
        // 'none' è necessario per richieste cross-site e richiede secure: true.
        sameSite: 'none', 
      },
    }),
  );

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

  // Serializza solo l'ID dell'utente nella sessione, come da standard Passport
  passport.serializeUser((user: Express.User, done) => {
    // Aggiungiamo un controllo per assicurarci che l'utente e l'ID esistano
    if (user && user.id) {
      done(null, user.id);
    } else {
      done(new Error("Impossibile serializzare l'utente: ID mancante."));
    }
  });

  // Deserializza l'utente recuperandolo dal DB tramite l'ID salvato in sessione
  passport.deserializeUser(async (id: string, done) => {
    try {
      // Usa il nostro servizio per trovare l'utente tramite il suo ID.
      // Dobbiamo creare un metodo apposito in UserService.
      const userProfile = await UserService.getUserById(id);
      if (userProfile) {
        done(null, userProfile);
      } else {
        done(null, false); // Utente non trovato nel DB
      }
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