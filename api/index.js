import express from "express";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import { signInWithEmailAndPassword } from 'firebase/auth';
import { storage } from "./storage.js";
import cors from 'cors';
import { adminAuth, auth } from './firebase-config.js';
import dotenv from "dotenv";
import { pathToFileURL } from 'url';
import { adminDb } from './firebase-config.js';

// Servizi
import AuthService from "../server/auth.service.js";
import UserService from "../server/user.service.js";
import VotoService from "../server/voto.service.js";
import AdminService from "../server/admin.service.js";
import ComunicazioneService from "../server/comunicazione.service.js";
import ElezioneService from "../server/elezione.service.js";
import EventiService from "../server/eventi.service.js";
import NotificaService from "../server/notifica.service.js";
import SostenitoriService from "../server/sostenitori.service.js";
import OpinioniService from '../server/opinioni.service.js';
import { getAllMinisteri, addMinistero, updateMinistero, deleteMinistero } from './ministeri.service.js';

dotenv.config();

const app = express();

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
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    },
  }),
);

// Configurazione Passport
app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
    try {
      // 1. Verifico che i servizi di autenticazione siano disponibili
      if (!auth || !adminAuth) {
        return done(null, false, { message: "Auth service not available" });
      }

      // 2. Verifico le credenziali (email e password) usando il Client SDK
      await signInWithEmailAndPassword(auth, email, password);

      // 3. Se le credenziali sono corrette, recupero il profilo utente da Firestore
      const userProfile = await UserService.getUserById(email);
      if (!userProfile) {
        return done(null, false, { message: "User profile not found in Firestore" });
      }
      
      // 4. Verifico che l'utente non sia 'pending' o 'banned'
      if (userProfile.status !== 'active') {
          return done(null, false, { message: `User status is ${userProfile.status}`});
      }

      return done(null, userProfile);

    } catch (error) {
      // Se signInWithEmailAndPassword fallisce, l'errore viene catturato qui
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        return done(null, false, { message: "Invalid email or password" });
      }
      return done(error);
    }
  }),
);

passport.serializeUser((user, done) => {
  // Salvo nella sessione l'ID univoco dell'utente.
  // Assicuriamoci di usare 'uid' se esiste, altrimenti 'id'.
  const userId = user.uid || user.id;
  done(null, userId);
});

passport.deserializeUser(async (id, done) => {
  try {
    // Ad ogni richiesta, recupero i dati aggiornati dell'utente dal DB.
    const user = await UserService.getUserById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});


// Middleware di Autenticazione
const requireAuth = (req, res, next) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  next();
};

// Middleware per ruoli statistici
const requireStatsRole = (req, res, next) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  const allowed = ["Admin", "Politico", "Candidato Politico", "Candidato"];
  if (!allowed.includes(req.user?.ruolo)) {
    return res.status(403).json({ error: "Forbidden: ruolo non autorizzato" });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  // DEBUG: Loggo l'oggetto utente per vedere cosa contiene la sessione
  console.log('DEBUGGING ADMIN ROLE:', req.user); 
  
  if (!req.isAuthenticated() || req.user?.ruolo !== 'Admin') {
    return res.status(403).json({ error: "Forbidden" });
  }
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
    if (!result.success || !result.user) return res.status(400).json({ error: result.error || "Registration failed" });
    const userToLogin = await UserService.getUserById(result.user.uid);
    if (!userToLogin) return res.status(500).json({error: "Failed to retrieve user after registration"});
    req.login(userToLogin, (err) => {
      if (err) return next(err);
      res.status(201).json(userToLogin);
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});
app.post("/api/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ message: info.message || "Invalid credentials" });
    req.logIn(user, (err) => {
      if (err) return next(err);
      return res.status(200).json(req.user);
    });
  })(req, res, next);
});
app.post("/api/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.sendStatus(200);
  });
});

// User
app.get('/api/user', requireAuth, (req, res) => res.json(req.user));
app.get('/api/users', requireAuth, async (req, res) => res.json(await UserService.getAllUsers()));
app.get('/api/users/:uid', requireAuth, async (req, res) => res.json(await UserService.getUserById(decodeURIComponent(req.params.uid))));
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
app.get('/api/users/:uid/public', requireAdmin, async (req, res) => {
  const user = await UserService.getUserById(decodeURIComponent(req.params.uid));
  if (!user) return res.status(404).json({ error: 'Utente non trovato' });
  res.json({ id: user.id, nome: user.nome, cognome: user.cognome });
});

// Opinioni
app.post('/api/opinioni', requireAuth, async (req, res) => res.json(await UserService.saveUserOpinions(req.user.id, req.body)));
app.get('/api/opinioni', requireAuth, async (req, res) => res.json(await UserService.getUserOpinions(req.user.id)));
app.get('/api/opinioni/:id', requireAuth, async (req, res) => {
  const user = await UserService.getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: "Utente non trovato" });
  res.json({
    energia_nucleare: user.energia_nucleare,
    sperimentazione_animale: user.sperimentazione_animale,
    legalizzazione_canapa: user.legalizzazione_canapa,
    caccia: user.caccia,
    unione_europea: user.unione_europea,
  });
});
app.get('/api/statistiche-opinioni', requireStatsRole, async (req, res) => {
  const users = await UserService.getAllUsers();
  console.log("STATISTICHE UTENTI:", users.length, users[0]);
  res.json(users);
});
app.get('/api/opinioni-dettaglio/:opinionField', requireStatsRole, async (req, res) => {
    const { opinionField } = req.params;
    const regione = req.query.regione;
    const provincia = req.query.provincia;
    const comune = req.query.comune;
    // Recupera la lista dinamica delle opinioni
    const opinioniList = await OpinioniService.listOpinioni();
    const validFields = opinioniList.map(o => o.id);
    if (!validFields.includes(opinionField)) return res.status(400).json({ error: "Invalid opinion field" });
    res.json(await UserService.getOpinionDetailStats(opinionField, regione, provincia, comune));
});

// Sostenitori & Politici
app.get('/api/candidati', requireAuth, async (req, res) => res.json(await UserService.getCandidati()));
app.get('/api/search-politicians', requireAuth, async (req, res) => res.json(await UserService.searchPoliticians(req.query.q)));
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

// !!! ROTTA DI MIGRAZIONE TEMPORANEA !!!
// Da rimuovere dopo l'uso
app.get('/api/admin/add-status-to-users', requireAdmin, async (req, res) => {
  // Un piccolo controllo di sicurezza extra
  if (req.query.secret_key !== 'demos_migration_2024') {
    return res.status(403).json({ error: "Forbidden: chiave segreta non valida." });
  }

  try {
    const usersSnapshot = await adminDb.collection('utenti').get();
    if (usersSnapshot.empty) {
        return res.status(200).json({ message: "Nessun utente trovato." });
    }

    const batch = adminDb.batch();
    let updatedCount = 0;

    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      if (!userData.status) {
        batch.update(doc.ref, { status: 'active' });
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      await batch.commit();
      res.status(200).json({ message: `Successo! Aggiornati ${updatedCount} utenti.` });
    } else {
      res.status(200).json({ message: "Nessuna modifica necessaria. Tutti gli utenti hanno già uno stato." });
    }
  } catch (error) {
    res.status(500).json({ error: "Errore durante la migrazione", details: error.message });
  }
});

// Comunicazioni & Notifiche
app.post('/api/comunicazioni', requireAuth, async (req, res) => res.status(201).json(await ComunicazioneService.createComunicazione(req.user, req.body)));
app.get('/api/podio-trasparenza', async (req, res) => res.json(await ComunicazioneService.getPodioTrasparenza()));
app.post('/api/comunicazioni/:id/react', requireAuth, async (req, res) => res.json(await ComunicazioneService.reactToComunicazione(req.params.id, req.user.id, req.body.reaction)));
app.get('/api/notifiche', requireAuth, async (req, res) => res.json(await NotificaService.getUserNotifications(req.user.id)));
app.patch('/api/notifiche/:id/read', requireAuth, async (req, res) => res.json(await NotificaService.markNotificationAsRead(req.params.id, req.user.id)));

// Elezioni & Eventi
app.get('/api/elezioni', requireAuth, async (req, res) => res.json(await ElezioneService.getAllElezioni()));
app.post('/api/eventi', requireAuth, async (req, res) => res.status(201).json(await EventiService.saveEvento(req.body, req.user)));
app.get('/api/eventi', async (req, res) => res.json(await EventiService.getAllEventi()));

// Voti
const createVotingEndpoints = (path, methods, entityKey = 'nome') => {
  app.post(`/api/${path}/vota`, requireAuth, async (req, res) => {
    let name;
    if (path === 'iniziative-popolari') {
      name = req.body.iniziativaId;
    } else if (path === 'referendum-abrogativi') {
      name = req.body.referendumId;
    } else {
      name = entityKey === 'nome' ? req.body.nome : req.body.legge;
    }
    if (!name) return res.status(400).json({ error: "Missing name/law" });
    const voteMethod = methods.vote;
    if (typeof VotoService[voteMethod] !== 'function') {
        return res.status(500).json({ error: "Invalid vote method configured" });
    }
    const result = await VotoService[voteMethod](req.user.id, name);
    res.json(result);
  });

  app.get(`/api/${path}/voti`, requireAuth, async (req, res) => {
    const getUserVotiMethod = methods.getUserVoti;
    if (typeof VotoService[getUserVotiMethod] !== 'function') {
        return res.status(500).json({ error: "Invalid getUserVoti method configured" });
    }
    res.json(await VotoService[getUserVotiMethod](req.user.id));
  });

  if (methods.removeVote) {
    app.delete(`/api/${path}/voti/:name`, requireAuth, async (req, res) => {
        const removeVoteMethod = methods.removeVote;
        if (typeof VotoService[removeVoteMethod] !== 'function') {
            return res.status(500).json({ error: "Invalid removeVote method configured" });
        }
        res.json(await VotoService[removeVoteMethod](req.user.id, decodeURIComponent(req.params.name)))
    });
  }
  
  app.get(`/api/${path}/classifica`, async (req, res) => {
    const getClassificaMethod = methods.getClassifica;
    if (typeof VotoService[getClassificaMethod] !== 'function') {
        return res.status(500).json({ error: "Invalid getClassifica method configured" });
    }
    res.json(await VotoService[getClassificaMethod]());
  });
};

createVotingEndpoints('governo', { vote: 'voteMinistro', getUserVoti: 'getUserVotiMinistri', getClassifica: 'getAllClassificheMinistri' });
createVotingEndpoints('capo-stato', { vote: 'voteCapoDiStato', getUserVoti: 'getUserVotiCapoDiStato', removeVote: 'removeVoteCapoDiStato', getClassifica: 'getClassificaCapoDiStato' });
createVotingEndpoints('grazia', { vote: 'voteGrazia', getUserVoti: 'getUserVotiGrazia', removeVote: 'removeVoteGrazia', getClassifica: 'getClassificaGrazia' });
createVotingEndpoints('amnistia-indulto-grazia', { vote: 'voteIniziativa', getUserVoti: 'getUserVotiIniziative', getClassifica: 'getClassificaIniziative' }, 'legge');
createVotingEndpoints('referendum-abrogativi', { vote: 'voteReferendum', getUserVoti: 'getUserVotiReferendum', getClassifica: 'getClassificaReferendum' }, 'legge');
createVotingEndpoints('iniziative-popolari', { vote: 'voteIniziativaPopolare', getUserVoti: 'getUserVotiIniziativePopolari', getClassifica: 'getClassificaIniziativePopolari' }, 'legge');

// === GRAZIA: Richieste di nuovi individui ===
app.post('/api/grazia/richiesta', requireAuth, async (req, res) => {
  const { nome, urlProva } = req.body;
  if (!nome || !urlProva) return res.status(400).json({ error: 'Nome e urlProva sono obbligatori' });
  const result = await VotoService.proposeGraziaRequest(req.user.id, nome, urlProva);
  res.status(result.success ? 200 : 400).json(result);
});

app.get('/api/grazia/richieste', requireAdmin, async (req, res) => {
  const richieste = await VotoService.getPendingGraziaRequests();
  res.json(richieste);
});

app.post('/api/grazia/richiesta/:id/accetta', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const result = await VotoService.acceptGraziaRequest(id);
  res.status(result.success ? 200 : 400).json(result);
});

app.post('/api/grazia/richiesta/:id/rifiuta', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const result = await VotoService.rejectGraziaRequest(id);
  res.status(result.success ? 200 : 400).json(result);
});

// Opinioni dinamiche
app.get('/api/opinioni-list', requireAuth, async (req, res) => {
  res.json(await OpinioniService.listOpinioni());
});
app.post('/api/opinioni-list', requireAdmin, async (req, res) => {
  const { id, text } = req.body;
  if (!id || !text) return res.status(400).json({ error: 'id e text obbligatori' });
  const result = await OpinioniService.addOpinione({ id, text });
  if (result.success) {
    // Notifica a tutti gli utenti
    await NotificaService.inviaNotificaGlobale({
      titolo: 'Nuova opinione disponibile',
      messaggio: `È stata aggiunta una nuova opinione: ${text}. Rispondi ora!`,
      tipo: 'info',
    });
  }
  res.status(result.success ? 200 : 400).json(result);
});
app.delete('/api/opinioni-list/:id', requireAdmin, async (req, res) => {
  const result = await OpinioniService.deleteOpinione(req.params.id);
  res.status(result.success ? 200 : 400).json(result);
});
app.patch('/api/opinioni-list/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text obbligatorio' });
  const result = await OpinioniService.updateOpinione(id, text);
  res.status(result.success ? 200 : 400).json(result);
});

// Endpoint per limiti Firebase (mock, pronto per dati reali)
app.get('/api/limiti', requireStatsRole, async (req, res) => {
  try {
    // Dati statici/mock, senza chiamate a firebaseUsage
    res.json({
      firestore: {
        storedData: { value: 0.2, max: 1, unit: 'GiB' },
        networkEgress: { value: 2, max: 10, unit: 'GiB/mese' },
        writes: { value: 5000, max: 20000, unit: '/giorno' },
        reads: { value: 12000, max: 50000, unit: '/giorno' },
        deletes: { value: 1000, max: 20000, unit: '/giorno' },
      },
      realtimeDb: {
        connections: { value: 40, max: 100, unit: '' },
        storedGB: { value: 0.3, max: 1, unit: 'GB' },
        downloadGB: { value: 2, max: 10, unit: 'GB/mese' },
      },
      storage: {
        storedGB: { value: 0.1, max: 1, unit: 'GB' },
        downloadGB: { value: 0.2, max: 1, unit: 'GB/giorno' },
        uploads: { value: 2000, max: 20000, unit: '/giorno' },
        downloads: { value: 5000, max: 50000, unit: '/giorno' },
      },
      hosting: {
        storage: { value: 2, max: 10, unit: 'GB' },
        dataTransfer: { value: 100, max: 360, unit: 'MB/giorno' },
      },
      functions: {
        invocations: { value: 500, max: 2000, unit: '/mese' },
        gbSeconds: { value: 100000, max: 400000, unit: 'GB-s/mese' },
        cpuSeconds: { value: 50000, max: 200000, unit: 'CPU-s/mese' },
        outbound: { value: 1, max: 5, unit: 'GB/mese' },
      },
      build: {
        minutes: { value: 30, max: 120, unit: 'min/giorno' },
        container: { value: 200, max: 500, unit: 'MB' },
      },
      testlab: {
        virtual: { value: 2, max: 10, unit: '/giorno' },
        physical: { value: 1, max: 5, unit: '/giorno' },
        streaming: { value: 10, max: 30, unit: 'min/mese' },
      },
    });
  } catch (e) {
    res.status(500).json({ error: 'Errore nel recupero limiti' });
  }
});

// === INIZIATIVE POPOLARI: Lista e voti utente ===
app.get('/api/iniziative-popolari/lista', requireAuth, async (req, res) => {
  try {
    const lista = await VotoService.getListaIniziativePopolari();
    res.json(lista);
  } catch (error) {
    res.status(500).json({ error: 'Errore nel recupero delle iniziative popolari' });
  }
});
app.get('/api/iniziative-popolari/voti', requireAuth, async (req, res) => {
  try {
    console.log("Chiamata a /api/iniziative-popolari/voti da utente:", req.user?.id, req.user?.email);
    const result = await VotoService.getUserVotiIniziativePopolari(req.user.id);
    res.json(result);
  } catch (error) {
    console.error("Errore in /api/iniziative-popolari/voti:", error);
    res.status(500).json({ error: error.message || "Errore interno" });
  }
});
// === INIZIATIVE POPOLARI: Lista votanti per una specifica iniziativa ===
app.get('/api/iniziative-popolari/:id/votanti', requireAuth, async (req, res) => {
  const { id } = req.params;
  res.json(await VotoService.getVotersIniziativaPopolare(id));
});

// === REFERENDUM ABROGATIVI: Lista e voti utente ===
app.get('/api/referendum-abrogativi/lista', requireAuth, async (req, res) => {
  // ... (la tua logica esistente)
});
app.get('/api/referendum-abrogativi/voti', requireAuth, async (req, res) => {
  try {
    console.log("Chiamata a /api/referendum-abrogativi/voti da utente:", req.user?.id, req.user?.email);
    const result = await VotoService.getUserVotiReferendum(req.user.id);
    res.json(result);
  } catch (error) {
    console.error("Errore in /api/referendum-abrogativi/voti:", error);
    res.status(500).json({ error: error.message || "Errore interno" });
  }
});
// === REFERENDUM ABROGATIVI: Lista votanti per uno specifico referendum ===
app.get('/api/referendum-abrogativi/:id/votanti', requireAuth, async (req, res) => {
  const { id } = req.params;
  res.json(await VotoService.getVotersReferendumAbrogativo(id));
});

// Endpoint per eliminare un candidato dalla classifica Capo di Stato (solo admin)
app.delete('/api/capo-stato/classifica/:nome', requireAdmin, async (req, res) => {
  const nome = decodeURIComponent(req.params.nome);
  try {
    const result = await VotoService.deleteAllVotesForCandidate('voti_capo_stato', nome);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Errore nella cancellazione del candidato' });
  }
});

// Endpoint per eliminare un candidato dalla classifica Grazia (solo admin)
app.delete('/api/grazia/classifica/:nome', requireAdmin, async (req, res) => {
  const nome = decodeURIComponent(req.params.nome);
  try {
    const result = await VotoService.deleteAllVotesForCandidate('voti_grazia', nome);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Errore nella cancellazione del candidato' });
  }
});

// Endpoint per eliminare una legge dalla classifica Amnistia (solo admin)
app.delete('/api/amnistia/classifica/:nome', requireAdmin, async (req, res) => {
  const nome = decodeURIComponent(req.params.nome);
  try {
    const result = await VotoService.deleteAllVotesForCandidate('voti_amnistia', nome);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Errore nella cancellazione della legge' });
  }
});

// === INIZIATIVE POPOLARI: Cancella iniziativa ===
app.delete('/api/iniziative-popolari/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const result = await VotoService.deleteIniziativaPopolare(id);
  res.status(result.success ? 200 : 400).json(result);
});

// Endpoint per cancellare un candidato dalla classifica di una categoria (solo admin)
app.delete('/api/governo/classifica/:categoria/:nome', requireAdmin, async (req, res) => {
  const { categoria, nome } = req.params;
  try {
    // Normalizza il nome per la ricerca
    const nomeKey = decodeURIComponent(nome).trim().toLowerCase();
    const result = await VotoService.deleteAllVotesForCandidate('voti_ministri', nomeKey, categoria);
    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Candidato non trovato o già eliminato' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Errore nella cancellazione del candidato' });
  }
});

app.post('/api/governo/vota', requireAuth, async (req, res) => {
  // Accetta sia 'nome' che 'nomeMinistro' per compatibilità
  const { categoria, nome, nomeMinistro } = req.body;
  console.log('POST /api/governo/vota body:', req.body);
  const nomeCandidato = nome || nomeMinistro;
  if (!categoria || !nomeCandidato) return res.status(400).json({ error: "Missing category or name" });
  const result = await VotoService.voteMinistro(req.user.id, categoria, nomeCandidato);
  res.json(result);
});

// === API CRUD per la raccolta 'ministeri' ===
app.get('/api/ministeri', async (req, res) => {
  try {
    const ministeri = await getAllMinisteri();
    res.json(ministeri);
  } catch (e) {
    res.status(500).json({ error: 'Errore nel recupero dei ministeri' });
  }
});

app.post('/api/ministeri', requireAdmin, async (req, res) => {
  try {
    const { nome, categoria, descrizione, icona, colore, ordine, abilitato } = req.body;
    if (!nome || !categoria) return res.status(400).json({ error: 'Nome e categoria sono obbligatori' });
    const result = await addMinistero({ nome, categoria, descrizione, icona, colore, ordine, abilitato });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Errore nell\'aggiunta del ministero' });
  }
});

app.put('/api/ministeri/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    await updateMinistero(id, data);
    res.json({ id });
  } catch (e) {
    res.status(500).json({ error: 'Errore nella modifica del ministero' });
  }
});

app.delete('/api/ministeri/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await deleteMinistero(id);
    res.json({ id });
  } catch (e) {
    res.status(500).json({ error: 'Errore nella cancellazione del ministero' });
  }
});

export default app; 