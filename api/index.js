// Server DEMOS - Configurazione autenticazione Firebase
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
import OpinioniProposteService from '../server/opinioni-proposte.service.js';
import ICEService from '../server/ice.service.js';
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
    store: storage.sessionStore || undefined, // Usa undefined se sessionStore è null
    secret: process.env.SESSION_SECRET || 'fallback-secret',
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: true, // PATCH: sempre true per HTTPS (Vercel)
      sameSite: 'none', // PATCH: sempre none per compatibilità cross-site
      // Se vuoi tornare alla versione condizionata:
      // secure: process.env.NODE_ENV === 'production',
      // sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
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
  console.log("INIZIO requireAuth");
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  console.log("FINE requireAuth");
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

// Middleware di autenticazione Firebase
const requireFirebaseAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token mancante' });
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    console.log('DEBUG decodedToken:', decodedToken); // <-- LOG AGGIUNTO
    req.user = decodedToken;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token non valido' });
  }
};

// Middleware di controllo ruolo Admin dopo verifica token Firebase
const requireFirebaseAdmin = async (req, res, next) => {
  await requireFirebaseAuth(req, res, async () => {
    // Dopo la verifica del token, controllo il ruolo O l'email admin
    if (
      req.user?.role !== 'Admin' &&
      req.user?.ruolo !== 'Admin' &&
      req.user?.email !== 'admin@admin.com'
    ) {
      return res.status(403).json({ error: 'Forbidden: solo Admin' });
    }
    next();
  });
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
app.get('/api/user', requireFirebaseAuth, async (req, res) => {
  try {
    let userProfile = await UserService.getUserById(req.user.uid);
    if (!userProfile) {
      // Se il profilo non esiste, restituisci almeno i dati base dal token
      userProfile = {
        uid: req.user.uid,
        email: req.user.email,
        ruolo: req.user.ruolo || 'Utente'
      };
    } else {
      userProfile.ruolo = req.user.ruolo || userProfile.ruolo;
    }
    res.json(userProfile);
  } catch (error) {
    res.status(500).json({ error: "Errore nel recupero del profilo utente" });
  }
});
// /api/users
app.get('/api/users', requireFirebaseAdmin, async (req, res) => res.json(await UserService.getAllUsers()));
// /api/users-stats
app.get('/api/users-stats', requireFirebaseAuth, async (req, res) => res.json(await UserService.getAllUsers()));
app.get('/api/users/:uid', requireFirebaseAuth, async (req, res) => {
  const { uid } = req.params;
  const user = await UserService.getUserById(decodeURIComponent(uid));
  if (!user) return res.json({}); // 200 con oggetto vuoto

  // Se l'utente è admin o sta chiedendo i propri dati, restituisci tutto
  if (
    req.user?.role === 'Admin' ||
    req.user?.ruolo === 'Admin' ||
    req.user?.uid === uid
  ) {
    return res.json(user);
  }

  // Altrimenti restituisci solo i dati pubblici
  return res.json({
    id: user.id,
    nome: user.nome,
    cognome: user.cognome,
    avatar_config: user.avatar_config,
    ruolo: user.ruolo
  });
});
app.put('/api/users/:uid', requireFirebaseAdmin, async (req, res) => {
    const { uid } = req.params;
    if (req.user?.id !== uid && req.user?.role !== 'Admin' && req.user?.ruolo !== 'Admin') return res.status(403).json({ error: 'Forbidden' });
    const result = await UserService.updateUserData(uid, req.body);
    res.status(result.success ? 200 : 500).json(result);
});
app.post('/api/users/:uid/avatar', requireFirebaseAuth, async (req, res) => {
    const { uid } = req.params;
    if (req.user?.id !== uid) return res.status(403).json({ error: 'Forbidden' });
    const result = await UserService.updateUserData(uid, { avatar_config: req.body.avatar_config });
    res.json(result);
});
app.get('/api/users/:uid/public', requireFirebaseAdmin, async (req, res) => {
  const user = await UserService.getUserById(decodeURIComponent(req.params.uid));
  if (!user) return res.status(404).json({ error: 'Utente non trovato' });
  res.json({ id: user.id, nome: user.nome, cognome: user.cognome });
});

// Opinioni
app.post('/api/opinioni', requireFirebaseAuth, async (req, res) => res.json(await UserService.saveUserOpinions(req.user.uid, req.body)));
app.get('/api/opinioni', requireFirebaseAuth, async (req, res) => res.json(await UserService.getUserOpinions(req.user.uid)));
app.get('/api/opinioni/:id', requireFirebaseAuth, async (req, res) => {
  const opinioni = await UserService.getUserOpinions(req.params.id);
  if (!opinioni) return res.json({}); // 200 con oggetto vuoto
  res.json(opinioni);
});
// /api/statistiche-opinioni
app.get('/api/statistiche-opinioni', requireFirebaseAuth, async (req, res) => {
  try {
    const users = await UserService.getAllUsers();
    console.log("STATISTICHE UTENTI:", users.length, users[0]);
    res.json(Array.isArray(users) ? users : []);
  } catch (e) {
    res.json([]); // Mai 404/500 se il token è valido
  }
});
app.get('/api/opinioni-dettaglio/:opinionField', requireFirebaseAdmin, async (req, res) => {
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
app.get('/api/candidati', requireFirebaseAuth, async (req, res) => res.json(await UserService.getCandidati()));
app.get('/api/search-politicians', requireFirebaseAuth, async (req, res) => res.json(await UserService.searchPoliticians(req.query.q)));
app.get('/api/sostenitori/:uid', requireFirebaseAuth, async (req, res) => {
    const { uid } = req.params;
    if (req.user?.ruolo !== 'Politico' && req.user?.ruolo !== 'Candidato' && req.user?.ruolo !== 'Candidato Politico') return res.status(403).json({ error: "Forbidden" });
    if (req.user?.uid !== uid) return res.status(403).json({ error: "Forbidden" });
    const user = await UserService.getUserById(uid);
    if (!user?.email) return res.status(404).json({ error: "User not found" });
    res.json(await SostenitoriService.getSupporterStats(user.email));
});

// Admin
app.delete('/api/users/:uid', requireFirebaseAdmin, async (req, res) => {
    const user = await UserService.getUserById(req.params.uid);
    if (!user?.email) return res.status(404).json({ error: 'User not found' });
    res.json(await AdminService.deleteUserByEmail(user.email));
});
// /api/pending-users
app.get('/api/pending-users', requireFirebaseAdmin, async (req, res) => {
  const users = await UserService.getAllUsers();
  const pending = users.filter(u => u.status === 'pending');
  res.json(pending);
});
// /api/approve-user
app.post('/api/approve-user', requireFirebaseAdmin, async (req, res) => {
  const { userId } = req.body;
  await adminDb.collection('utenti').doc(userId).update({ status: 'active' });
  res.json({ success: true });
});
// /api/reject-user
app.post('/api/reject-user', requireFirebaseAdmin, async (req, res) => {
  const { userId } = req.body;
  await adminDb.collection('utenti').doc(userId).update({ status: 'rejected' });
  res.json({ success: true });
});

// !!! ROTTA DI MIGRAZIONE TEMPORANEA !!!
// Da rimuovere dopo l'uso
app.get('/api/admin/add-status-to-users', requireFirebaseAdmin, async (req, res) => {
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
  app.post(`/api/${path}/vota`, requireFirebaseAuth, async (req, res) => {
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

  app.get(`/api/${path}/voti`, requireFirebaseAuth, async (req, res) => {
    const getUserVotiMethod = methods.getUserVoti;
    if (typeof VotoService[getUserVotiMethod] !== 'function') {
        return res.status(500).json({ error: "Invalid getUserVoti method configured" });
    }
    res.json(await VotoService[getUserVotiMethod](req.user.id));
  });

  if (methods.removeVote) {
    app.delete(`/api/${path}/voti/:name`, requireFirebaseAuth, async (req, res) => {
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
app.post('/api/grazia/richiesta', requireFirebaseAuth, async (req, res) => {
  const { nome, urlProva } = req.body;
  if (!nome || !urlProva) return res.status(400).json({ error: 'Nome e urlProva sono obbligatori' });
  const result = await VotoService.proposeGraziaRequest(req.user.uid, nome, urlProva);
  res.status(result.success ? 200 : 400).json(result);
});

app.get('/api/grazia/richieste', requireFirebaseAdmin, async (req, res) => {
  const richieste = await VotoService.getPendingGraziaRequests();
  res.json(richieste);
});

app.post('/api/grazia/richiesta/:id/accetta', requireFirebaseAdmin, async (req, res) => {
  const { id } = req.params;
  const result = await VotoService.acceptGraziaRequest(id);
  res.status(result.success ? 200 : 400).json(result);
});

app.post('/api/grazia/richiesta/:id/rifiuta', requireFirebaseAdmin, async (req, res) => {
  const { id } = req.params;
  const result = await VotoService.rejectGraziaRequest(id);
  res.status(result.success ? 200 : 400).json(result);
});

// Opinioni dinamiche
app.get('/api/opinioni-list', requireFirebaseAuth, async (req, res) => {
  res.json(await OpinioniService.listOpinioni());
});
app.post('/api/opinioni-list', requireFirebaseAdmin, async (req, res) => {
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
app.delete('/api/opinioni-list/:id', requireFirebaseAdmin, async (req, res) => {
  const result = await OpinioniService.deleteOpinione(req.params.id);
  res.status(result.success ? 200 : 400).json(result);
});
app.patch('/api/opinioni-list/:id', requireFirebaseAdmin, async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text obbligatorio' });
  const result = await OpinioniService.updateOpinione(id, text);
  res.status(result.success ? 200 : 400).json(result);
});

// === OPINIONI PROPOSTE ===
app.get('/api/opinioni-proposte', requireAuth, async (req, res) => {
  try {
    const opinioni = await OpinioniProposteService.listOpinioniProposte();
    res.json(opinioni);
  } catch (error) {
    res.status(500).json({ error: 'Errore nel recupero delle opinioni proposte' });
  }
});

app.post('/api/opinioni-proposte', requireAuth, async (req, res) => {
  try {
    const { testo } = req.body;
    if (!testo || !testo.trim()) {
      return res.status(400).json({ error: 'Testo dell\'opinione richiesto' });
    }
    
    const result = await OpinioniProposteService.addOpinioneProposta({
      testo: testo.trim(),
      proponente: req.user.id,
      proponente_email: req.user.email
    });
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ error: 'Errore nell\'aggiunta dell\'opinione proposta' });
  }
});

app.post('/api/opinioni-proposte/vota', requireAuth, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'ID opinione richiesto' });
    }
    
    const result = await OpinioniProposteService.votaOpinioneProposta(id, req.user.id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ error: 'Errore nel voto dell\'opinione proposta' });
  }
});

app.get('/api/opinioni-proposte/voti', requireAuth, async (req, res) => {
  try {
    const voti = await OpinioniProposteService.getUserVoti(req.user.id);
    res.json(voti);
  } catch (error) {
    res.status(500).json({ error: 'Errore nel recupero dei voti utente' });
  }
});

app.delete('/api/opinioni-proposte/:id', requireFirebaseAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await OpinioniProposteService.deleteOpinioneProposta(id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ error: 'Errore nell\'eliminazione dell\'opinione proposta' });
  }
});

app.post('/api/opinioni-proposte/:id/accetta', requireFirebaseAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await OpinioniProposteService.accettaOpinioneProposta(id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ error: 'Errore nell\'accettazione dell\'opinione proposta' });
  }
});

// Endpoint per limiti Firebase (mock, pronto per dati reali)
app.get('/api/limiti', requireFirebaseAdmin, async (req, res) => {
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
console.log("DEFINIZIONE ENDPOINT /api/referendum-abrogativi/lista");
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
app.delete('/api/capo-stato/classifica/:nome', requireFirebaseAdmin, async (req, res) => {
  const nome = decodeURIComponent(req.params.nome);
  try {
    const result = await VotoService.deleteAllVotesForCandidate('voti_capo_stato', nome);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Errore nella cancellazione del candidato' });
  }
});

// Endpoint per eliminare un candidato dalla classifica Grazia (solo admin)
app.delete('/api/grazia/classifica/:nome', requireFirebaseAdmin, async (req, res) => {
  const nome = decodeURIComponent(req.params.nome);
  try {
    const result = await VotoService.deleteAllVotesForCandidate('voti_grazia', nome);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Errore nella cancellazione del candidato' });
  }
});

// Endpoint per eliminare una legge dalla classifica Amnistia (solo admin)
app.delete('/api/amnistia/classifica/:nome', requireFirebaseAdmin, async (req, res) => {
  const nome = decodeURIComponent(req.params.nome);
  try {
    const result = await VotoService.deleteAllVotesForCandidate('voti_amnistia', nome);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Errore nella cancellazione della legge' });
  }
});

// === INIZIATIVE POPOLARI: Cancella iniziativa ===
app.delete('/api/iniziative-popolari/:id', requireFirebaseAdmin, async (req, res) => {
  const { id } = req.params;
  const result = await VotoService.deleteIniziativaPopolare(id);
  res.status(result.success ? 200 : 400).json(result);
});

// Endpoint per cancellare un candidato dalla classifica di una categoria (solo admin)
app.delete('/api/governo/classifica/:categoria/:nome', requireFirebaseAdmin, async (req, res) => {
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

app.post('/api/ministeri', requireFirebaseAdmin, async (req, res) => {
  try {
    const { nome, categoria, descrizione, icona, colore, ordine, abilitato } = req.body;
    if (!nome || !categoria) return res.status(400).json({ error: 'Nome e categoria sono obbligatori' });
    const result = await addMinistero({ nome, categoria, descrizione, icona, colore, ordine, abilitato });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Errore nell\'aggiunta del ministero' });
  }
});

app.put('/api/ministeri/:id', requireFirebaseAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    await updateMinistero(id, data);
    res.json({ id });
  } catch (e) {
    res.status(500).json({ error: 'Errore nella modifica del ministero' });
  }
});

app.delete('/api/ministeri/:id', requireFirebaseAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await deleteMinistero(id);
    res.json({ id });
  } catch (e) {
    res.status(500).json({ error: 'Errore nella cancellazione del ministero' });
  }
});

// Recupera le fonti delle opinioni di un utente
app.get('/api/opinioni-fonti/:id', requireAuth, async (req, res) => {
  const fonti = await UserService.getUserFonti(req.params.id);
  res.json(fonti);
});
// Salva le fonti delle opinioni di un utente (solo admin)
app.put('/api/opinioni-fonti/:id', requireFirebaseAdmin, async (req, res) => {
  const result = await UserService.saveUserFonti(req.params.id, req.body);
  res.status(result.success ? 200 : 500).json(result);
});

// Aggiorna le opinioni di un utente specifico (solo admin)
app.put('/api/opinioni/:id', requireFirebaseAdmin, async (req, res) => {
  const result = await UserService.saveUserOpinions(req.params.id, req.body);
  res.status(result.success ? 200 : 500).json(result);
});

// === ICE: Lista e gestione ===
app.get('/api/ice/lista', requireAuth, async (req, res) => {
  try {
    const lista = await ICEService.listICE();
    res.json(lista);
  } catch (error) {
    res.status(500).json({ error: 'Errore nel recupero delle ICE' });
  }
});

app.post('/api/ice', requireAuth, async (req, res) => {
  try {
    const { nome, dataInizio, dataFine, sitoWeb } = req.body;
    if (!nome || !dataInizio || !dataFine) {
      return res.status(400).json({ error: 'Tutti i campi obbligatori' });
    }
    const result = await ICEService.addICE({ nome, dataInizio, dataFine, sitoWeb });
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ error: 'Errore nell\'aggiunta della ICE' });
  }
});

app.patch('/api/ice/:id/quorum', requireFirebaseAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { quorum } = req.body;
    if (!quorum) return res.status(400).json({ error: 'Quorum richiesto' });
    const result = await ICEService.patchQuorum(id, quorum);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Errore nell\'aggiornamento del quorum' });
  }
});

app.patch('/api/ice/:id', requireFirebaseAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, descrizione, dataInizio, dataFine, sitoWeb } = req.body;
    if (!nome || !descrizione || !dataInizio || !dataFine) {
      return res.status(400).json({ error: 'Tutti i campi obbligatori' });
    }
    const result = await ICEService.updateICE(id, { nome, descrizione, dataInizio, dataFine, sitoWeb });
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Errore nella modifica della ICE' });
  }
});

app.delete('/api/ice/:id', requireFirebaseAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await ICEService.deleteICE(id);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Errore nella cancellazione della ICE' });
  }
});

export default app; 