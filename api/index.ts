import express, { type Request, Response, NextFunction } from "express";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import { signInWithEmailAndPassword } from 'firebase/auth';
import { storage } from "./storage.js";
import cors from 'cors';
import { adminAuth } from './firebase-config.js';
import { Utente } from "./types.js";
import dotenv from "dotenv";
import { pathToFileURL } from 'url';

// Servizi
import AuthService from "./auth.service.js";
import UserService from "./user.service.js";
import VotoService from "./voto.service.js";
import AdminService from "./admin.service.js";
import ComunicazioneService from "./comunicazione.service.js";
import ElezioneService from "./elezione.service.js";
import ComizioService from "./comizio.service.js";
import NotificaService from "./notifica.service.js";
import SostenitoriService from "./sostenitori.service.js";

dotenv.config();

const app = express();

// Dichiarazione Tipi per Express User
declare global {
  namespace Express {
    interface User extends Utente {}
  }
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const allowedOrigins = [process.env.VITE_CLIENT_URL, 'http://localhost:5173'];
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Configurazione Sessione
app.set('trust proxy', 1);
app.use(
  session({
    store: storage.sessionStore,
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: true,
      sameSite: 'none',
    },
  }),
);

// Configurazione Passport
app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
    try {
      if (!adminAuth) return done(null, false, { message: "Auth service not available" });
      // Qui dovresti implementare la verifica della password tramite un sistema custom
      // Per ora, accettiamo qualsiasi password se l'utente esiste
      const userRecord = await adminAuth.getUserByEmail(email);
      if (!userRecord) return done(null, false, { message: "User not found" });
      const userProfile = await UserService.getUserByEmail(email);
      if (!userProfile) return done(null, false, { message: "User profile not found" });
      return done(null, userProfile);
    } catch (error) {
      return done(error);
    }
  }),
);

passport.serializeUser((user: Express.User, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await UserService.getUserById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});


// Middleware di Autenticazione
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  next();
};

const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated() || req.user?.ruolo !== 'Admin') return res.status(403).json({ error: "Forbidden" });
  next();
};


// ROTTE
// ===============================================

// Auth
app.post("/api/register", async (req, res, next) => {
  try {
    const { email, password, ...userDetails } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
    const result = await AuthService.registerUser(email, password, userDetails);
    if (!result.success || !result.data) return res.status(400).json({ error: result.error || "Registration failed" });
    const userToLogin = await UserService.getUserByEmail(email);
    if (!userToLogin) return res.status(500).json({error: "Failed to retrieve user after registration"});
    req.login(userToLogin, (err) => {
      if (err) return next(err);
      res.status(201).json(userToLogin);
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});
app.post("/api/login", passport.authenticate("local"), (req, res) => res.status(200).json(req.user));
app.post("/api/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.sendStatus(200);
  });
});

// User
app.get('/api/user', requireAuth, (req, res) => res.json(req.user));
app.get('/api/users', requireAuth, async (req, res) => res.json(await UserService.getAllUsers()));
app.get('/api/users/:email', requireAuth, async (req, res) => res.json(await UserService.getUserByEmail(decodeURIComponent(req.params.email))));
app.put('/api/users/:uid', requireAuth, async (req, res) => {
    const { uid } = req.params;
    if (req.user?.id !== uid && req.user?.ruolo !== 'Admin') return res.status(403).json({ error: 'Forbidden' });
    const result = await UserService.updateUserData(uid, req.body);
    res.status(result.success ? 200 : 500).json(result);
});
app.post('/api/users/:uid/avatar', requireAuth, async (req, res) => {
    const { uid } = req.params;
    if (req.user?.id !== uid) return res.status(403).json({ error: 'Forbidden' });
    const result = await UserService.updateUserData(uid, { avatar_config: req.body.avatar_config });
    res.json(result);
});

// Opinioni
app.post('/api/opinioni', requireAuth, async (req, res) => res.json(await UserService.saveUserOpinions(req.user!.id, req.body)));
app.get('/api/opinioni', requireAuth, async (req, res) => res.json(await UserService.getUserOpinions(req.user!.id)));
app.get('/api/statistiche-opinioni', requireAdmin, async (req, res) => res.json(await UserService.getAllUsers()));
app.get('/api/opinioni-dettaglio/:opinionField', requireAdmin, async (req, res) => {
    const { opinionField } = req.params;
    const regione = req.query.regione as string | undefined;
    const validFields = ["energia_nucleare", "sperimentazione_animale", "legalizzazione_canapa", "caccia", "unione_europea"];
    if (!validFields.includes(opinionField)) return res.status(400).json({ error: "Invalid opinion field" });
    res.json(await UserService.getOpinionDetailStats(opinionField, regione));
});

// Sostenitori & Politici
app.get('/api/candidati', requireAuth, async (req, res) => res.json(await UserService.getCandidati()));
app.get('/api/search-politicians', requireAuth, async (req, res) => res.json(await UserService.searchPoliticians(req.query.q as string)));
app.get('/api/sostenitori/:uid', requireAuth, async (req, res) => {
    const { uid } = req.params;
    if (req.user?.ruolo !== 'Politico' && req.user?.ruolo !== 'Candidato' && req.user?.ruolo !== 'Candidato Politico') return res.status(403).json({ error: "Forbidden" });
    if (req.user?.id !== uid) return res.status(403).json({ error: "Forbidden" });
    const user = await UserService.getUserById(uid);
    if (!user?.email) return res.status(404).json({ error: "User not found" });
    res.json(await SostenitoriService.getSupporterStats(user.email));
});

// Admin
app.delete('/api/users/:uid', requireAdmin, async (req, res) => {
    const user = await UserService.getUserById(req.params.uid);
    if (!user?.email) return res.status(404).json({ error: "User not found" });
    res.json(await AdminService.deleteUserByEmail(user.email));
});
app.get('/api/pending-users', requireAdmin, async (req, res) => res.json(await AdminService.getPendingUsers()));
app.post('/api/approve-user', requireAdmin, async (req, res) => res.json(await AdminService.approveUser(req.body.userId)));
app.post('/api/reject-user', requireAdmin, async (req, res) => res.json(await AdminService.rejectUser(req.body.userId, req.body.reason)));

// Comunicazioni & Notifiche
app.post('/api/comunicazioni', requireAuth, async (req, res) => res.status(201).json(await ComunicazioneService.createComunicazione(req.user!, req.body)));
app.get('/api/podio-trasparenza', async (req, res) => res.json(await ComunicazioneService.getPodioTrasparenza()));
app.post('/api/comunicazioni/:id/react', requireAuth, async (req, res) => res.json(await ComunicazioneService.reactToComunicazione(req.params.id, req.user!.id, req.body.reaction)));
app.get('/api/notifiche', requireAuth, async (req, res) => res.json(await NotificaService.getUserNotifications(req.user!.id)));
app.patch('/api/notifiche/:id/read', requireAuth, async (req, res) => res.json(await NotificaService.markNotificationAsRead(req.params.id, req.user!.id)));

// Elezioni & Comizi
app.get('/api/elezioni', requireAuth, async (req, res) => res.json(await ElezioneService.getAllElezioni()));
app.post('/api/comizi', requireAuth, async (req, res) => res.status(201).json(await ComizioService.saveComizio(req.body, req.user!)));
app.get('/api/comizi', async (req, res) => res.json(await ComizioService.getAllComizi()));

// Voti
const createVotingEndpoints = (path: string, methods: { vote: string, getUserVoti: string, removeVote?: string, getClassifica: string }, entityKey: 'nome' | 'legge' = 'nome') => {
  app.post(`/api/${path}/vota`, requireAuth, async (req, res) => {
    let name = entityKey === 'nome' ? req.body.nome : req.body.legge;
    if (!name) return res.status(400).json({ error: "Missing name/law" });
    
    const voteMethod = methods.vote;
    if (typeof (VotoService as any)[voteMethod] !== 'function') {
        return res.status(500).json({ error: "Invalid vote method configured" });
    }
    const result = await (VotoService as any)[voteMethod](req.user!.id, name);
    res.json(result);
  });

  app.get(`/api/${path}/voti`, requireAuth, async (req, res) => {
    const getUserVotiMethod = methods.getUserVoti;
    if (typeof (VotoService as any)[getUserVotiMethod] !== 'function') {
        return res.status(500).json({ error: "Invalid getUserVoti method configured" });
    }
    res.json(await (VotoService as any)[getUserVotiMethod](req.user!.id));
  });

  if (methods.removeVote) {
    app.delete(`/api/${path}/voti/:name`, requireAuth, async (req, res) => {
        const removeVoteMethod = methods.removeVote!;
        if (typeof (VotoService as any)[removeVoteMethod] !== 'function') {
            return res.status(500).json({ error: "Invalid removeVote method configured" });
        }
        res.json(await (VotoService as any)[removeVoteMethod](req.user!.id, decodeURIComponent(req.params.name)))
    });
  }
  
  app.get(`/api/${path}/classifica`, async (req, res) => {
    const getClassificaMethod = methods.getClassifica;
    if (typeof (VotoService as any)[getClassificaMethod] !== 'function') {
        return res.status(500).json({ error: "Invalid getClassifica method configured" });
    }
    res.json(await (VotoService as any)[getClassificaMethod]());
  });
};

createVotingEndpoints('governo', { vote: 'voteMinistro', getUserVoti: 'getUserVotiMinistri', getClassifica: 'getAllClassificheMinistri' });
createVotingEndpoints('capo-stato', { vote: 'voteCapoDiStato', getUserVoti: 'getUserVotiCapoDiStato', removeVote: 'removeVoteCapoDiStato', getClassifica: 'getClassificaCapoDiStato' });
createVotingEndpoints('grazia', { vote: 'voteGrazia', getUserVoti: 'getUserVotiGrazia', removeVote: 'removeVoteGrazia', getClassifica: 'getClassificaGrazia' });
createVotingEndpoints('amnistia', { vote: 'voteAmnistia', getUserVoti: 'getUserVotiAmnistia', removeVote: 'removeVoteAmnistia', getClassifica: 'getClassificaAmnistia' }, 'legge');
createVotingEndpoints('iniziative-popolari', { vote: 'voteIniziativaPopolare', getUserVoti: 'getUserVotiIniziativaPopolare', getClassifica: 'getClassificaIniziativaPopolare' });
createVotingEndpoints('referendum-abrogativo', { vote: 'voteReferendumAbrogativo', getUserVoti: 'getUserVotiReferendumAbrogativo', getClassifica: 'getClassificaReferendumAbrogativo' });

// Esporta come handler per Vercel
export default app;