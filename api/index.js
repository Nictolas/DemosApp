// API Server con Database Neon PostgreSQL
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
console.log('✅ DEBUG: File index.js corretto in esecuzione');

const app = express();

// Middleware
// CORS con whitelist domini frontend (produzione e sviluppo)
const allowedOrigins = [
  'https://www.demos.community',
  'https://demos.community',
  'https://demos-c7x52aj0p2q2.onrender.com',
  'https://demos-c7k0.onrender.com',
  'http://localhost:5173',
  'http://localhost:4173'
];

const isAllowedOrigin = (origin) => {
  if (!origin) return true; // consenti chiamate server-to-server e healthchecks
  if (allowedOrigins.includes(origin)) return true;
  // Consenti tutti i sotto-domini Vercel preview e Render
  if (/^https:\/\/.*\.vercel\.app$/.test(origin)) return true;
  if (/^https:\/\/.*\.onrender\.com$/.test(origin)) return true;
  return false;
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','Accept','X-Requested-With'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
// Fallback CORS headers espliciti (assicura ACAO sempre presente)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
  }
  next();
});
app.use(express.json());

// Configurazione database Neon
console.log('🔍 DEBUG: DATABASE_URL =', process.env.DATABASE_URL ? 'TROVATA' : 'NON TROVATA');
console.log('🔍 DEBUG: DATABASE_URL primi 50 char =', process.env.DATABASE_URL?.substring(0, 50));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Assicurazione schema minimale (colonne necessarie)
async function ensureSchema() {
  // Compat: vecchia tabella `utenti`
  try {
    await pool.query("ALTER TABLE utenti ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'");
  } catch (e) {
    console.warn('WARN ensureSchema utenti.status:', e?.message || e);
  }

  // Nuova tabella standard `users`
  try {
    const alter = async (sql) => pool.query(sql).catch(() => void 0);
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS ruolo VARCHAR(50) DEFAULT 'Elettore'");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending'");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS nome TEXT");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS cognome TEXT");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_config TEXT");
    // Opinioni base per compatibilità
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS energia_nucleare TEXT");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS sperimentazione_animale TEXT");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS legalizzazione_canapa TEXT");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS caccia TEXT");
  } catch (e) {
    console.warn('WARN ensureSchema users:*:', e?.message || e);
  }
}
ensureSchema();

// JWT Secret (in produzione usare una variabile d'ambiente sicura)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Middleware per verificare JWT
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Token di accesso richiesto'
    });
  }
  
  const token = authHeader.substring(7); // Rimuove "Bearer "
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Token non valido'
    });
  }
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'API Server Neon funzionante' });
});

// Test connessione
app.get('/api/test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as current_time, version() as postgres_version');
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Connessione database riuscita'
    });
  } catch (error) {
    console.error('Errore test connessione:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Helpers
async function isRequesterAdmin(userId) {
  try {
    const r = await pool.query('SELECT ruolo FROM users WHERE id = $1', [userId]);
    return r.rows.length > 0 && r.rows[0].ruolo === 'Admin';
  } catch {
    return false;
  }
}

// API Utenti
app.get('/api/utenti', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY COALESCE(created_at, NOW()) DESC');
    const rows = result.rows.map(u => ({ ...u, uid: u.id }));
    res.json({ success: true, data: rows, count: rows.length });
  } catch (error) {
    console.error('Errore caricamento utenti:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POSIZIONA /me PRIMA DI /:id PER EVITARE SHADOWING
app.get('/api/utenti/me', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Utente non trovato' });
    }
    const user = result.rows[0];
    if (user.password_hash !== undefined) delete user.password_hash;
    return res.json({ success: true, data: { ...user, name: `${user.nome || ''} ${user.cognome || ''}`.trim(), role: user.ruolo || user.role || 'Elettore' } });
  } catch (error) {
    console.error('Errore recupero utente (me):', error);
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

// Recupera singolo utente per id (compatibilità)
app.get('/api/utenti/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (id === 'me') {
      // Safety: inoltra a handler /me (anche se abbiamo definito /me prima)
      req.url = '/api/utenti/me';
      return app._router.handle(req, res, () => {});
    }
    if (!id) {
      return res.status(400).json({ success: false, error: 'ID utente mancante' });
    }
    const result = await pool.query(
      'SELECT id, email, nome, cognome, ruolo, avatar_config, COALESCE(created_at, NOW()) as created_at, status FROM users WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Utente non trovato' });
    }
    const u = result.rows[0];
    res.json({ success: true, data: { ...u, uid: u.id } });
  } catch (error) {
    console.error('Errore recupero utente per id:', error);
    res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

// Endpoint auth con Neon (sostituzione Firebase)
const handleLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email e password sono richiesti'
      });
    }
    
    // Cerca l'utente nel database users (fallback su utenti per retro-compat)
    let result = await pool.query(
      'SELECT id, email, nome, cognome, ruolo, password_hash FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    if (result.rows.length === 0) {
      result = await pool.query(
        'SELECT id, email, nome, cognome, ruolo, password_hash FROM utenti WHERE email = $1',
        [email.toLowerCase()]
      );
    }
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Email o password non corretti'
      });
    }
    
    const user = result.rows[0];
    
    // Verifica se l'utente ha una password hash
    if (!user.password_hash) {
      return res.status(401).json({
        success: false,
        error: 'Account non migrato. Per favore registrati nuovamente per motivi di sicurezza.'
      });
    }
    
    // Verifica la password con bcrypt
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        error: 'Email o password non corretti'
      });
    }
    
    // Genera JWT token
    const token = jwt.sign(
      { 
        userId: user.id,
        email: user.email 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Rimuovi la password_hash dalla risposta e componi il nome completo
    const { password_hash, nome, cognome, ruolo, ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      data: {
        ...userWithoutPassword,
        name: `${nome} ${cognome}`.trim(),
        role: ruolo || 'Elettore'
      },
      token,
      message: 'Login effettuato con successo'
    });
  } catch (error) {
    console.error('Errore login:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
};

// Preflight esplicito e route mapping multipli (con e senza prefisso /api)
app.options('/api/auth/login', cors(corsOptions));
app.options('/auth/login', cors(corsOptions));
app.post('/api/auth/login', handleLogin);
app.post('/auth/login', handleLogin);

const handleRegister = async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: 'Email, password e nome sono richiesti'
      });
    }
    
    // Verifica se l'utente esiste già
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Un utente con questa email esiste già'
      });
    }
    
    // Hash della password con bcrypt
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Determina ruolo dalla richiesta (default Elettore)
    const ruolo = (req.body.role || req.body.ruolo || '').toString().trim() || 'Elettore';
    const status = ruolo === 'Admin' ? 'active' : 'pending';
    
    // Crea nuovo utente nella tabella users, salvando anche il ruolo e lo status
    const result = await pool.query(
      'INSERT INTO users (id, email, nome, cognome, password_hash, ruolo, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, email, nome, cognome, ruolo, status',
      [
        'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9), // ID univoco
        email.toLowerCase(), 
        name.split(' ')[0] || name, // primo nome
        name.split(' ').slice(1).join(' ') || '', // cognome
        passwordHash,
        ruolo,
        status
      ]
    );
    
    const user = result.rows[0];
    
    // Genera JWT token
    const token = jwt.sign(
      { 
        userId: user.id,
        email: user.email 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: `${user.nome} ${user.cognome}`.trim(),
        role: user.ruolo || 'Elettore',
        status: user.status
      },
      token,
      message: 'Registrazione completata con successo'
    });
  } catch (error) {
    console.error('Errore registrazione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
};

app.options('/api/auth/register', cors(corsOptions));
app.options('/auth/register', cors(corsOptions));
app.post('/api/auth/register', handleRegister);
app.post('/auth/register', handleRegister);

app.post('/api/auth/logout', async (req, res) => {
  try {
    // Per ora non facciamo nulla lato server
    // In futuro potremmo invalidare i token in un database
    res.json({
      success: true,
      message: 'Logout effettuato'
    });
  } catch (error) {
    console.error('Errore logout:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// Endpoint utenti (compatibilità)
app.post('/api/utenti/login', async (req, res) => {
  // Redirect al nuovo endpoint
  return res.redirect(307, '/api/auth/login');
});

// Utenti pending (placeholder)
app.get('/api/utenti/pending', verifyToken, async (req, res) => {
  try {
    const admin = await isRequesterAdmin(req.user.userId);
    if (!admin) return res.status(403).json({ success: false, error: 'Non autorizzato' });
    const r = await pool.query("SELECT id, email, nome, cognome, ruolo, status, COALESCE(created_at, NOW()) as created_at FROM users WHERE status = 'pending' ORDER BY created_at DESC");
    const rows = r.rows.map(u => ({ ...u, uid: u.id }));
    return res.json(rows);
  } catch (e) {
    console.error('Errore pending:', e);
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

app.post('/api/utenti/approve', verifyToken, async (req, res) => {
  try {
    const admin = await isRequesterAdmin(req.user.userId);
    if (!admin) return res.status(403).json({ success: false, error: 'Non autorizzato' });
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ success: false, error: 'userId mancante' });
    await pool.query("UPDATE users SET status = 'active' WHERE id = $1", [userId]);
    return res.json({ success: true });
  } catch (e) {
    console.error('Errore approve:', e);
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

app.post('/api/utenti/reject', verifyToken, async (req, res) => {
  try {
    const admin = await isRequesterAdmin(req.user.userId);
    if (!admin) return res.status(403).json({ success: false, error: 'Non autorizzato' });
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ success: false, error: 'userId mancante' });
    await pool.query("UPDATE users SET status = 'rejected' WHERE id = $1", [userId]);
    return res.json({ success: true });
  } catch (e) {
    console.error('Errore reject:', e);
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

app.delete('/api/utenti/:id', verifyToken, async (req, res) => {
  try {
    const admin = await isRequesterAdmin(req.user.userId);
    if (!admin) return res.status(403).json({ success: false, error: 'Non autorizzato' });
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, error: 'ID mancante' });
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    return res.json({ success: true });
  } catch (e) {
    console.error('Errore delete utente:', e);
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

app.get('/api/utenti/me', verifyToken, async (req, res) => {
  try {
    // Il middleware verifyToken ha già verificato il token e impostato req.user
    const userId = req.user.userId;
    
    // Recupera tutte le colonne dell'utente in modo resiliente
    const result = await pool.query('SELECT * FROM utenti WHERE id = $1', [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const user = result.rows[0];
    if (user && user.password_hash !== undefined) delete user.password_hash;
    
    res.json({
      success: true,
      data: {
        ...user,
        name: `${user.nome || ''} ${user.cognome || ''}`.trim(),
        role: user.ruolo || user.role || 'Elettore'
      }
    });
  } catch (error) {
    console.error('Errore recupero utente:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Errore interno del server' 
    });
  }
});

// API Opinioni
app.get('/api/opinions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM opinioni ORDER BY created_at DESC');
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Errore caricamento opinioni:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint opinioni (compatibilità)
app.get('/api/opinioni', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM opinioni ORDER BY created_at DESC');
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Errore caricamento opinioni:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint governo (placeholder)
app.get('/api/governo', async (req, res) => {
  try {
    res.json({
      success: true,
      data: [],
      message: 'Endpoint governo - da implementare'
    });
  } catch (error) {
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Endpoint ministeri (placeholder)
app.get('/api/ministeri', async (req, res) => {
  try {
    res.json({
      success: true,
      data: [],
      message: 'Endpoint ministeri - da implementare'
    });
  } catch (error) {
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Altri endpoint (placeholder per compatibilità)
const endpoints = [
  'sondaggi', 'elezioni', 'referendum', 'ice', 'iniziative-popolari',
  'grazia', 'amnistia', 'capo-stato', 'statistiche', 'sostenitori',
  'comunicazioni', 'notifiche', 'programma'
];

endpoints.forEach(endpoint => {
  app.get(`/api/${endpoint}`, async (req, res) => {
    try {
      res.json({
        success: true,
        data: [],
        message: `Endpoint ${endpoint} - da implementare con Neon`
      });
    } catch (error) {
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });
});

// Endpoint opinioni-list richiesto dal frontend
// Base questions configurate lato codice
const BASE_OPINION_QUESTIONS = [
  { id: 'energia_nucleare', text: "Sei favorevole all'utilizzo dell'energia nucleare?" },
  { id: 'sperimentazione_animale', text: 'Sei favorevole alla sperimentazione sugli animali?' },
  { id: 'legalizzazione_canapa', text: 'Sei favorevole alla legalizzazione della canapa?' },
  { id: 'caccia', text: 'Sei favorevole alla caccia?' }
];

app.get('/api/opinioni-list', async (req, res) => {
  try {
    // Recupera opinioni dinamiche create dagli admin (tabella opinioni)
    const dyn = await pool
      .query(`SELECT id, COALESCE(titolo, text) AS text FROM opinioni ORDER BY created_at DESC LIMIT 200`)
      .catch(() => ({ rows: [] }));

    const dynamicQuestions = dyn.rows
      .filter(r => r.text)
      .map(r => ({ id: String(r.id), text: r.text }));

    const all = [...BASE_OPINION_QUESTIONS, ...dynamicQuestions];
    res.json(all);
  } catch (error) {
    console.error('Errore opinioni-list:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Opinioni utente: recupero e salvataggio
const OPINION_FIELDS = ['energia_nucleare', 'sperimentazione_animale', 'legalizzazione_canapa', 'caccia'];
const OPINION_ALLOWED_VALUES = new Set(['Favorevole', 'Indeciso', 'Contrario']);

app.get('/api/opinioni/utente', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // 1) Domande base + dinamiche
    const dyn = await pool
      .query(`SELECT id, COALESCE(titolo, text) AS text FROM opinioni ORDER BY created_at DESC LIMIT 200`)
      .catch(() => ({ rows: [] }));

    const dynamicQuestions = dyn.rows
      .filter(r => r.text)
      .map(r => ({ id: String(r.id), text: r.text }));

    const questions = [...BASE_OPINION_QUESTIONS, ...dynamicQuestions];

    // 2) Risposte utente: base su tabella utenti, dinamiche su tabella opinioni_risposte
    const baseRow = await pool.query(
      `SELECT ${OPINION_FIELDS.join(', ')} FROM utenti WHERE id = $1`,
      [userId]
    );
    if (baseRow.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Utente non trovato' });
    }

    // Assicurati esista tabella risposte dinamiche
    await pool
      .query(`
        CREATE TABLE IF NOT EXISTS opinioni_risposte (
          user_id VARCHAR(255) NOT NULL,
          opinione_id VARCHAR(255) NOT NULL,
          valore VARCHAR(50) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, opinione_id)
        )
      `)
      .catch(() => undefined);

    const dynAnswers = await pool
      .query(`SELECT opinione_id, valore FROM opinioni_risposte WHERE user_id = $1`, [userId])
      .catch(() => ({ rows: [] }));

    const userAnswers = {};
    for (const f of OPINION_FIELDS) {
      const v = baseRow.rows[0][f];
      if (v != null) userAnswers[f] = v;
    }
    for (const r of dynAnswers.rows) {
      userAnswers[String(r.opinione_id)] = r.valore;
    }

    res.json({ questions, userAnswers, blocco: { isBlocked: false } });
  } catch (error) {
    console.error('Errore opinioni/utente:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

app.post('/api/opinioni/salva', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const opinions = req.body?.opinions || {};

    // 1) Aggiorna campi base su tabella utenti
    const updates = [];
    const values = [];
    let idx = 1;
    for (const field of OPINION_FIELDS) {
      if (field in opinions) {
        const val = opinions[field];
        if (!OPINION_ALLOWED_VALUES.has(val)) {
          return res.status(400).json({ success: false, error: `Valore non valido per ${field}` });
        }
        updates.push(`${field} = $${idx++}`);
        values.push(val);
      }
    }
    if (updates.length > 0) {
      values.push(userId);
      const sql = `UPDATE utenti SET ${updates.join(', ')} WHERE id = $${idx}`;
      await pool.query(sql, values);
    }

    // 2) Upsert risposte dinamiche su tabella opinioni_risposte
    await pool
      .query(`
        CREATE TABLE IF NOT EXISTS opinioni_risposte (
          user_id VARCHAR(255) NOT NULL,
          opinione_id VARCHAR(255) NOT NULL,
          valore VARCHAR(50) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, opinione_id)
        )
      `)
      .catch(() => undefined);

    const dynKeys = Object.keys(opinions).filter(k => !OPINION_FIELDS.includes(k));
    for (const k of dynKeys) {
      const val = opinions[k];
      if (!OPINION_ALLOWED_VALUES.has(val)) {
        return res.status(400).json({ success: false, error: `Valore non valido per opinione ${k}` });
      }
      await pool.query(
        `INSERT INTO opinioni_risposte (user_id, opinione_id, valore)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, opinione_id) DO UPDATE SET valore = EXCLUDED.valore, updated_at = NOW()`,
        [userId, String(k), val]
      );
    }

    res.json({ success: true, message: 'Opinioni salvate' });
  } catch (error) {
    console.error('Errore opinioni/salva:', error);
    res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

// Endpoint elezioni-utente richiesto dal frontend
app.get('/api/elezioni-utente', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    // Recupera elezioni attive (placeholder)
    const elezioni = await pool.query(
      `SELECT id, tipo, zona, data_inizio, data_fine
       FROM elezioni
       WHERE (data_inizio IS NULL OR data_inizio <= NOW())
         AND (data_fine IS NULL OR data_fine >= NOW())
       ORDER BY data_inizio NULLS LAST`
    ).catch(() => ({ rows: [] }));

    res.json({ success: true, data: { elezioni: elezioni.rows, userId } });
  } catch (error) {
    console.error('Errore elezioni-utente:', error);
    res.status(500).json({ success: false, error: 'Errore nel recupero delle elezioni' });
  }
});

// Endpoint candidati con filtro per grado/categoria
app.get('/api/candidati', verifyToken, async (req, res) => {
  try {
    const { grado, categoria } = req.query;
    // Seleziona candidati in base ai ruoli supportati dall'app
    // Per la pagina Scegli Candidato mostriamo: Candidato, Candidato Politico
    const result = await pool.query(
      `SELECT id, nome, cognome, ruolo, avatar_config,
              energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia
       FROM users
       WHERE ruolo IN ('Candidato', 'Candidato Politico')
       ORDER BY COALESCE(created_at, NOW()) DESC
       LIMIT 200`
    );

    // Calcola placeholder opinioni comuni (0 per ora)
    const candidati = result.rows.map(r => ({ ...r, opinioni_comuni: 0 }));
    
    res.json({ success: true, data: { candidati, candidatoSelezionatoId: null, userOpinions: {} } });
  } catch (error) {
    console.error('Errore caricamento candidati:', error);
    res.status(500).json({ success: false, error: 'Errore nel caricamento dei candidati' });
  }
});

// Endpoint rappresentanti (per Scegli Rappresentante): Politico, Candidato Politico
app.get('/api/rappresentanti', verifyToken, async (req, res) => {
  try {
    const { grado, categoria } = req.query;
    const result = await pool.query(
      `SELECT id, nome, cognome, ruolo, avatar_config,
              energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia
       FROM users
       WHERE ruolo IN ('Politico', 'Candidato Politico')
       ORDER BY COALESCE(created_at, NOW()) DESC
       LIMIT 200`
    );

    const rappresentanti = result.rows.map(r => ({ ...r, opinioni_comuni: 0 }));
    res.json({ success: true, candidati: rappresentanti, utente: {} });
  } catch (error) {
    console.error('Errore caricamento rappresentanti:', error);
    res.status(500).json({ success: false, error: 'Errore nel caricamento dei rappresentanti' });
  }
});

// Gestione route non trovate
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Rota non trovata', 
    path: req.originalUrl 
  });
});

// Avvio server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('🚀 Server API database avviato sulla porta', PORT);
  console.log('📊 Database Neon connesso');
  console.log('🌐 API pronto (prefisso: /api)');
});

module.exports = app;