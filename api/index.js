// API Server con Database Neon PostgreSQL
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const crypto = require('crypto');
const { Resend } = require('resend');
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

// Configurazione Resend per email
const resend = new Resend(process.env.RESEND_API_KEY);
console.log('🔍 DEBUG: RESEND_API_KEY =', process.env.RESEND_API_KEY ? 'TROVATA' : 'NON TROVATA');

// Funzione per inviare email di reset password
async function sendResetPasswordEmail(email, resetUrl, userName) {
  try {
    console.log('📧 Tentativo invio email a:', email);
    console.log('📧 RESEND_API_KEY presente:', !!process.env.RESEND_API_KEY);
    
    if (!process.env.RESEND_API_KEY) {
      console.log('⚠️ RESEND_API_KEY non configurata, saltando invio email');
      return { success: false, error: 'Email service not configured' };
    }

    const { data, error } = await resend.emails.send({
      from: 'Demos Community <onboarding@resend.dev>',
      to: [email],
      subject: 'Reset Password - Demos Community',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">Demos Community</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Reset della tua password</p>
          </div>
          
          <div style="background: white; padding: 30px; border: 1px solid #e1e5e9; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-bottom: 20px;">Ciao ${userName || 'utente'}!</h2>
            
            <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
              Hai richiesto il reset della password per il tuo account su Demos Community.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        padding: 15px 30px; 
                        text-decoration: none; 
                        border-radius: 25px; 
                        display: inline-block; 
                        font-weight: bold;
                        font-size: 16px;">
                Reimposta Password
              </a>
            </div>
            
            <p style="color: #666; line-height: 1.6; margin-bottom: 15px;">
              <strong>Importante:</strong> Questo link è valido solo per 1 ora. Se non hai richiesto tu questo reset, 
              puoi ignorare questa email.
            </p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 25px;">
              <p style="color: #666; margin: 0; font-size: 14px;">
                Se il pulsante non funziona, copia e incolla questo link nel browser:<br>
                <a href="${resetUrl}" style="color: #667eea; word-break: break-all;">${resetUrl}</a>
              </p>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
            <p>© 2024 Demos Community. Tutti i diritti riservati.</p>
          </div>
        </div>
      `
    });

    if (error) {
      console.error('❌ Errore invio email Resend:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Email inviata con successo a:', email);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Errore generico invio email:', error);
    return { success: false, error: error.message };
  }
}

// Assicurazione schema minimale (colonne necessarie)
async function ensureSchema() {
  // Compat: vecchia tabella `utenti`
  try {
    await pool.query("ALTER TABLE utenti ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'");
  } catch (e) {
    console.warn('WARN ensureSchema utenti.status:', e?.message || e);
  }

  // Nuova tabella standard `users` - AGGIUNTE TUTTE LE COLONNE MANCANTI
  try {
    const alter = async (sql) => pool.query(sql).catch(() => void 0);
    
    // Colonne base
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS ruolo VARCHAR(50) DEFAULT 'Elettore'");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending'");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS nome TEXT");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS cognome TEXT");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_config TEXT");
    
    // Colonne dati personali
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS data_nascita DATE");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS genere VARCHAR(20)");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS cittadinanza VARCHAR(100)");
    
    // Colonne residenza
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS paese_residenza VARCHAR(100)");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS regione_residenza VARCHAR(100)");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS provincia_residenza VARCHAR(100)");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS comune_residenza VARCHAR(100)");
    
    // Colonne elezione
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS paese_elezione VARCHAR(100)");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS regione_elezione VARCHAR(100)");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS provincia_elezione VARCHAR(100)");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS comune_elezione VARCHAR(100)");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS grado_elezione VARCHAR(100)");
    
    // Colonne candidatura
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS paese_candidatura VARCHAR(100)");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS regione_candidatura VARCHAR(100)");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS provincia_candidatura VARCHAR(100)");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS comune_candidatura VARCHAR(100)");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS grado_candidatura VARCHAR(100)");
    
    // Colonne opinioni base per compatibilità
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS energia_nucleare TEXT");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS sperimentazione_animale TEXT");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS legalizzazione_canapa TEXT");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS caccia TEXT");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS cittadina_animale BOOLEAN");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS eutanasia BOOLEAN");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS case_chiuse BOOLEAN");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS salario_minimo BOOLEAN");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS matrimonio_gay BOOLEAN");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS nato BOOLEAN");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS omobitransfobia BOOLEAN");
    
    // Colonne per reset password
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMP");
    
    // Colonne aggiuntive per compatibilità completa
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS uid VARCHAR(255)");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_tokens TEXT[]");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS notifiche_preferenze JSONB DEFAULT '{}'::jsonb");
    await alter("ALTER TABLE users ADD COLUMN IF NOT EXISTS premium BOOLEAN DEFAULT false");
    
  } catch (e) {
    console.warn('WARN ensureSchema users:*:', e?.message || e);
  }
}
ensureSchema();

// One-time migration: merge contenuti tabella `utenti` in `users`
async function migrateUtentiToUsersOnce() {
  try {
    await pool.query(
      'CREATE TABLE IF NOT EXISTS migration_flags (key TEXT PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT NOW())'
    );
    const chk = await pool
      .query('SELECT 1 FROM migration_flags WHERE key = $1', ['merged_utenti_to_users'])
      .catch(() => ({ rows: [] }));
    if (chk.rows && chk.rows.length > 0) return; // già fatto

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Aggiorna campi mancanti in users dai corrispondenti in utenti
      await client.query(`
        UPDATE users u
        SET nome = COALESCE(u.nome, t.nome),
            cognome = COALESCE(u.cognome, t.cognome),
            ruolo = COALESCE(u.ruolo, t.ruolo, 'Elettore'),
            status = COALESCE(u.status, t.status, 'pending'),
            avatar_config = COALESCE(u.avatar_config, t.avatar_config),
            data_nascita = COALESCE(u.data_nascita, t.data_nascita),
            genere = COALESCE(u.genere, t.genere),
            cittadinanza = COALESCE(u.cittadinanza, t.cittadinanza),
            paese_residenza = COALESCE(u.paese_residenza, t.paese_residenza),
            regione_residenza = COALESCE(u.regione_residenza, t.regione_residenza),
            provincia_residenza = COALESCE(u.provincia_residenza, t.provincia_residenza),
            comune_residenza = COALESCE(u.comune_residenza, t.comune_residenza),
            paese_elezione = COALESCE(u.paese_elezione, t.paese_elezione),
            regione_elezione = COALESCE(u.regione_elezione, t.regione_elezione),
            provincia_elezione = COALESCE(u.provincia_elezione, t.provincia_elezione),
            comune_elezione = COALESCE(u.comune_elezione, t.comune_elezione),
            grado_elezione = COALESCE(u.grado_elezione, t.grado_elezione),
            paese_candidatura = COALESCE(u.paese_candidatura, t.paese_candidatura),
            regione_candidatura = COALESCE(u.regione_candidatura, t.regione_candidatura),
            provincia_candidatura = COALESCE(u.provincia_candidatura, t.provincia_candidatura),
            comune_candidatura = COALESCE(u.comune_candidatura, t.comune_candidatura),
            grado_candidatura = COALESCE(u.grado_candidatura, t.grado_candidatura),
            energia_nucleare = COALESCE(u.energia_nucleare, t.energia_nucleare),
            sperimentazione_animale = COALESCE(u.sperimentazione_animale, t.sperimentazione_animale),
            legalizzazione_canapa = COALESCE(u.legalizzazione_canapa, t.legalizzazione_canapa),
            caccia = COALESCE(u.caccia, t.caccia),
            cittadina_animale = COALESCE(u.cittadina_animale, t.cittadina_animale),
            eutanasia = COALESCE(u.eutanasia, t.eutanasia),
            case_chiuse = COALESCE(u.case_chiuse, t.case_chiuse),
            salario_minimo = COALESCE(u.salario_minimo, t.salario_minimo),
            matrimonio_gay = COALESCE(u.matrimonio_gay, t.matrimonio_gay),
            nato = COALESCE(u.nato, t.nato),
            omobitransfobia = COALESCE(u.omobitransfobia, t.omobitransfobia),
            uid = COALESCE(u.uid, t.uid),
            fcm_tokens = COALESCE(u.fcm_tokens, t.fcm_tokens),
            notifiche_preferenze = COALESCE(u.notifiche_preferenze, t.notifiche_preferenze),
            premium = COALESCE(u.premium, t.premium)
        FROM utenti t
        WHERE LOWER(u.email) = LOWER(t.email)
      `).catch(() => void 0);

      // Inserisci in users gli account presenti solo in utenti
      await client.query(`
        INSERT INTO users (
          id, email, nome, cognome, ruolo, status, avatar_config,
          data_nascita, genere, cittadinanza,
          paese_residenza, regione_residenza, provincia_residenza, comune_residenza,
          paese_elezione, regione_elezione, provincia_elezione, comune_elezione,
          paese_candidatura, regione_candidatura, provincia_candidatura, comune_candidatura,
          grado_elezione, grado_candidatura,
          energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia,
          cittadina_animale, eutanasia, case_chiuse, salario_minimo, matrimonio_gay, nato, omobitransfobia,
          uid, fcm_tokens, notifiche_preferenze, premium
        )
        SELECT 
          t.id, t.email, t.nome, t.cognome, COALESCE(t.ruolo, 'Elettore'),
          COALESCE(t.status, 'pending'), t.avatar_config,
          t.data_nascita, t.genere, t.cittadinanza,
          t.paese_residenza, t.regione_residenza, t.provincia_residenza, t.comune_residenza,
          t.paese_elezione, t.regione_elezione, t.provincia_elezione, t.comune_elezione,
          t.paese_candidatura, t.regione_candidatura, t.provincia_candidatura, t.comune_candidatura,
          t.grado_elezione, t.grado_candidatura,
          t.energia_nucleare, t.sperimentazione_animale, t.legalizzazione_canapa, t.caccia,
          t.cittadina_animale, t.eutanasia, t.case_chiuse, t.salario_minimo, t.matrimonio_gay, t.nato, t.omobitransfobia,
          t.uid, t.fcm_tokens, t.notifiche_preferenze, t.premium
        FROM utenti t
        LEFT JOIN users u ON LOWER(u.email) = LOWER(t.email)
        WHERE u.id IS NULL
      `).catch(() => void 0);

      // Porta anche le password dove presenti e mancanti in users
      await client.query(`
        UPDATE users u
        SET password_hash = t.password_hash
        FROM utenti t
        WHERE LOWER(u.email) = LOWER(t.email)
          AND u.password_hash IS NULL
          AND t.password_hash IS NOT NULL
      `).catch(() => void 0);

      await client.query('INSERT INTO migration_flags(key) VALUES ($1)', ['merged_utenti_to_users']);
      await client.query('COMMIT');
      console.log('✅ MIGRAZIONE: utenti → users completata (one-time)');
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch {}
      console.warn('⚠️ MIGRAZIONE utenti→users fallita:', e?.message || e);
    } finally {
      client.release();
    }
  } catch (e) {
    console.warn('WARN migrateUtentiToUsersOnce:', e?.message || e);
  }
}
// Esegui la migrazione al boot (una sola volta)
migrateUtentiToUsersOnce();

// JWT Secret (in produzione usare una variabile d'ambiente sicura)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Middleware per verificare JWT
const verifyToken = (req, res, next) => {
  console.log('🔍 DEBUG: verifyToken chiamato per:', req.method, req.url);
  console.log('🔍 DEBUG: Authorization header:', req.headers.authorization ? 'Presente' : 'Mancante');
  
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('❌ DEBUG: Token mancante o formato errato');
    return res.status(401).json({
      success: false,
      error: 'Token di accesso richiesto'
    });
  }
  
  const token = authHeader.substring(7); // Rimuove "Bearer "
  console.log('🔍 DEBUG: Token estratto (primi 20 char):', token.substring(0, 20) + '...');
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('✅ DEBUG: Token valido, userId:', decoded.userId);
    req.user = decoded;
    next();
  } catch (error) {
    console.log('❌ DEBUG: Token non valido:', error.message);
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

// Test endpoint per /api/utenti/me senza autenticazione
app.get('/api/utenti/me/test', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Endpoint /api/utenti/me raggiungibile',
    headers: {
      authorization: req.headers.authorization ? 'Presente' : 'Mancante'
    }
  });
});

// Debug endpoint per verificare token
app.get('/api/debug/token', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.json({
      status: 'ERROR',
      message: 'Token mancante',
      token: null
    });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return res.json({
      status: 'OK',
      message: 'Token valido',
      token: {
        userId: decoded.userId,
        email: decoded.email,
        iat: decoded.iat,
        exp: decoded.exp
      }
    });
  } catch (error) {
    return res.json({
      status: 'ERROR',
      message: 'Token non valido',
      error: error.message,
      token: null
    });
  }
});

// Debug endpoint per verificare utente nel database
app.get('/api/debug/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Cerca in users
    let result = await pool.query('SELECT id, email, nome, cognome, ruolo FROM users WHERE id = $1', [userId]);
    
    if (result.rows.length === 0) {
      // Cerca in utenti
      result = await pool.query('SELECT id, email, nome, cognome, ruolo FROM utenti WHERE id = $1', [userId]);
    }
    
    if (result.rows.length === 0) {
      return res.json({
        status: 'ERROR',
        message: 'Utente non trovato',
        user: null
      });
    }
    
    return res.json({
      status: 'OK',
      message: 'Utente trovato',
      user: result.rows[0]
    });
  } catch (error) {
    return res.json({
      status: 'ERROR',
      message: 'Errore database',
      error: error.message,
      user: null
    });
  }
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
    console.log('🔍 DEBUG: Ricerca utente con ID:', userId);
    
    // Prima cerca nella tabella users (nuova)
    let result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    
    // Se non trovato, cerca nella tabella utenti (vecchia)
    if (result.rows.length === 0) {
      console.log('🔍 DEBUG: Utente non trovato in users, cerco in utenti');
      result = await pool.query('SELECT * FROM utenti WHERE id = $1', [userId]);
    }
    
    if (result.rows.length === 0) {
      console.log('❌ DEBUG: Utente non trovato in nessuna tabella');
      return res.status(404).json({ success: false, error: 'Utente non trovato' });
    }
    
    const user = result.rows[0];
    console.log('✅ DEBUG: Utente trovato:', { id: user.id, email: user.email, ruolo: user.ruolo });
    
    if (user.password_hash !== undefined) delete user.password_hash;
    
    return res.json({ 
      success: true, 
      data: { 
        ...user, 
        name: `${user.nome || ''} ${user.cognome || ''}`.trim(), 
        role: user.ruolo || user.role || 'Elettore' 
      } 
    });
  } catch (error) {
    console.error('❌ Errore recupero utente (me):', error);
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

// POSIZIONA /pending PRIMA DI /:id PER EVITARE SHADOWING
app.get('/api/utenti/pending', verifyToken, async (req, res) => {
  try {
    console.log('🔍 DEBUG: Verifico se utente è admin:', req.user.userId);
    const admin = await isRequesterAdmin(req.user.userId);
    console.log('🔍 DEBUG: Utente è admin?', admin);
    
    if (!admin) return res.status(403).json({ success: false, error: 'Non autorizzato' });
    
    console.log('🔍 DEBUG: Eseguo query per utenti pending');
    const r = await pool.query("SELECT id, email, nome, cognome, ruolo, status, COALESCE(created_at, NOW()) as created_at FROM users WHERE status = 'pending' ORDER BY created_at DESC");
    console.log('🔍 DEBUG: Query completata, righe trovate:', r.rows.length);
    
    const rows = r.rows.map(u => ({ ...u, uid: u.id }));
    return res.json(rows);
  } catch (e) {
    console.error('❌ Errore pending:', e);
    return res.status(500).json({ success: false, error: 'Errore interno del server', details: e.message });
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
  console.log('🔍 DEBUG: handleLogin chiamato');
  console.log('🔍 DEBUG: Method:', req.method);
  console.log('🔍 DEBUG: URL:', req.url);
  console.log('🔍 DEBUG: Body:', { email: req.body?.email, password: req.body?.password ? '***' : 'mancante' });
  
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email e password sono richiesti'
      });
    }
    
    // Cerca l'utente: prima users, poi utenti
    console.log('🔍 DEBUG: Cerca utente con email:', email.toLowerCase());
    
    let result = await pool.query('SELECT id, email, nome, cognome, ruolo, password_hash FROM users WHERE email = $1', [email.toLowerCase()]);
    console.log('🔍 DEBUG: Risultato ricerca in users:', result.rows.length, 'righe');
    
    if (result.rows.length === 0) {
      console.log('🔍 DEBUG: Utente non trovato in users, cerco in utenti');
      result = await pool.query('SELECT id, email, nome, cognome, ruolo, password_hash FROM utenti WHERE email = $1', [email.toLowerCase()]);
      console.log('🔍 DEBUG: Risultato ricerca in utenti:', result.rows.length, 'righe');
    }
    
    if (result.rows.length === 0) {
      console.log('❌ DEBUG: Utente non trovato in nessuna tabella');
      return res.status(401).json({
        success: false,
        error: 'Email o password non corretti'
      });
    }
    
    console.log('✅ DEBUG: Utente trovato:', { id: result.rows[0].id, email: result.rows[0].email, ruolo: result.rows[0].ruolo });
    
    const user = result.rows[0];
    
    // Se manca hash in users, prova a recuperarlo da utenti
    if (!user.password_hash) {
      const backup = await pool
        .query('SELECT password_hash FROM utenti WHERE email = $1', [email.toLowerCase()])
        .catch(() => ({ rows: [] }));
      if (backup.rows.length > 0 && backup.rows[0].password_hash) {
        user.password_hash = backup.rows[0].password_hash;
      } else {
        return res.status(401).json({ success: false, error: 'Account non migrato. Reimposta la password.' });
      }
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
    const { 
      email, password, nome, cognome, ruolo, 
      data_nascita, genere, cittadinanza,
      paese_residenza, regione_residenza, provincia_residenza, comune_residenza,
      paese_elezione, regione_elezione, provincia_elezione, comune_elezione,
      paese_candidatura, regione_candidatura, provincia_candidatura, comune_candidatura,
      grado_elezione, grado_candidatura
    } = req.body;
    
    if (!email || !password || !nome || !cognome) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, nome e cognome sono richiesti'
      });
    }
    
    // Verifica se l'utente esiste già
    // Tra users e utenti nessun duplicato per email
    const existingUsers = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    const existingUtenti = await pool.query('SELECT id FROM utenti WHERE email = $1', [email.toLowerCase()]).catch(() => ({ rows: [] }));
    
    if (existingUsers.rows.length > 0 || (existingUtenti.rows || []).length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Un utente con questa email esiste già'
      });
    }
    
    // Hash della password con bcrypt
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Determina ruolo dalla richiesta (default Elettore)
    const userRole = (ruolo || '').toString().trim() || 'Elettore';
    const status = userRole === 'Admin' ? 'active' : 'pending';
    
    // Crea nuovo utente nella tabella users con tutti i campi
    const result = await pool.query(
      `INSERT INTO users (
        id, email, nome, cognome, password_hash, ruolo, status,
        data_nascita, genere, cittadinanza,
        paese_residenza, regione_residenza, provincia_residenza, comune_residenza,
        paese_elezione, regione_elezione, provincia_elezione, comune_elezione,
        paese_candidatura, regione_candidatura, provincia_candidatura, comune_candidatura,
        grado_elezione, grado_candidatura
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
      ) RETURNING id, email, nome, cognome, ruolo, status`,
      [
        crypto.randomUUID(), // Genera UUID valido
        email.toLowerCase(), 
        nome, // nome diretto dal form
        cognome, // cognome diretto dal form
        passwordHash,
        userRole,
        status,
        data_nascita || null,
        genere || null,
        cittadinanza || null,
        paese_residenza || null,
        regione_residenza || null,
        provincia_residenza || null,
        comune_residenza || null,
        paese_elezione || null,
        regione_elezione || null,
        provincia_elezione || null,
        comune_elezione || null,
        paese_candidatura || null,
        regione_candidatura || null,
        provincia_candidatura || null,
        comune_candidatura || null,
        grado_elezione || null,
        grado_candidatura || null
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

// Endpoint per richiesta reset password
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Verifica che l'utente esista
    const userResult = await pool.query('SELECT id, email, nome FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Email non trovata' });
    }

    const user = userResult.rows[0];
    
    // Genera token di reset (valido per 1 ora)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 ora
    
    // Salva token nel database
    await pool.query(
      'UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3',
      [resetToken, resetTokenExpiry, user.id]
    );
    
    // Costruisci URL di reset
    const resetUrl = `${process.env.FRONTEND_URL || 'https://demos.community'}/reset-password-confirm?token=${resetToken}`;
    
    console.log(`🔧 RESET PASSWORD: ${user.email} - Token: ${resetToken}`);
    console.log(`🔧 RESET URL: ${resetUrl}`);
    
    // Invia email di reset
    const emailResult = await sendResetPasswordEmail(
      user.email, 
      resetUrl, 
      user.nome || user.email.split('@')[0]
    );
    
    if (emailResult.success) {
      res.json({ 
        message: 'Email di reset inviata con successo! Controlla la tua casella di posta.',
        resetUrl: resetUrl // Manteniamo per debug in sviluppo
      });
    } else {
      console.error('❌ Errore invio email:', emailResult.error);
      res.json({ 
        message: 'Token di reset generato, ma errore nell\'invio email. Usa questo link per testare:',
        resetUrl: resetUrl,
        error: emailResult.error
      });
    }
  } catch (error) {
    console.error('Errore richiesta reset password:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Endpoint per reset password con token
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    // Verifica token
    const userResult = await pool.query(
      'SELECT id, reset_token, reset_token_expiry FROM users WHERE reset_token = $1',
      [token]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Token non valido' });
    }
    
    const user = userResult.rows[0];
    
    // Verifica scadenza token
    if (new Date() > new Date(user.reset_token_expiry)) {
      return res.status(400).json({ error: 'Token scaduto' });
    }
    
    // Hash nuova password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Aggiorna password e rimuovi token
    await pool.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expiry = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, user.id]
    );
    
    res.json({ message: 'Password reimpostata con successo' });
  } catch (error) {
    console.error('Errore reset password:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Endpoint per cambio password (utente loggato)
app.post('/api/auth/change-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    // Verifica password attuale
    const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    const isValid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!isValid) {
      return res.status(400).json({ error: 'Password attuale non corretta' });
    }

    // Hash nuova password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [hashedPassword, userId]);

    res.json({ message: 'Password aggiornata con successo' });
  } catch (error) {
    console.error('Errore cambio password:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Endpoint utenti (compatibilità)
app.post('/api/utenti/login', async (req, res) => {
  // Redirect al nuovo endpoint
  return res.redirect(307, '/api/auth/login');
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

// Admin: merge dei dati da `utenti` -> `users`
app.post('/api/admin/merge-utenti-in-users', verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const admin = await isRequesterAdmin(req.user.userId);
    if (!admin) return res.status(403).json({ success: false, error: 'Non autorizzato' });

    await client.query('BEGIN');

    // 1) Aggiorna campi mancanti in users dai corrispondenti in utenti
    const updateExisting = await client.query(`
      UPDATE users u
      SET nome = COALESCE(u.nome, t.nome),
          cognome = COALESCE(u.cognome, t.cognome),
          ruolo = COALESCE(u.ruolo, t.ruolo, 'Elettore'),
          status = COALESCE(u.status, t.status, 'pending'),
          avatar_config = COALESCE(u.avatar_config, t.avatar_config),
          energia_nucleare = COALESCE(u.energia_nucleare, t.energia_nucleare),
          sperimentazione_animale = COALESCE(u.sperimentazione_animale, t.sperimentazione_animale),
          legalizzazione_canapa = COALESCE(u.legalizzazione_canapa, t.legalizzazione_canapa),
          caccia = COALESCE(u.caccia, t.caccia)
      FROM utenti t
      WHERE LOWER(u.email) = LOWER(t.email)
    `);

    // 2) Inserisci in users gli account presenti solo in utenti
    const insertNew = await client.query(`
      INSERT INTO users (id, email, nome, cognome, ruolo, status, avatar_config,
                         energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia)
      SELECT t.id, t.email, t.nome, t.cognome, COALESCE(t.ruolo, 'Elettore'),
             COALESCE(t.status, 'pending'), t.avatar_config,
             t.energia_nucleare, t.sperimentazione_animale, t.legalizzazione_canapa, t.caccia
      FROM utenti t
      LEFT JOIN users u ON LOWER(u.email) = LOWER(t.email)
      WHERE u.id IS NULL
    `);

    // 3) Porta anche le password dove presenti e mancanti in users
    const updatePasswords = await client.query(`
      UPDATE users u
      SET password_hash = t.password_hash
      FROM utenti t
      WHERE LOWER(u.email) = LOWER(t.email)
        AND u.password_hash IS NULL
        AND t.password_hash IS NOT NULL
    `);

    await client.query('COMMIT');

    return res.json({
      success: true,
      updatedExisting: updateExisting.rowCount || 0,
      insertedNew: insertNew.rowCount || 0,
      updatedPasswords: updatePasswords.rowCount || 0,
    });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('Errore merge utenti->users:', e);
    return res.status(500).json({ success: false, error: 'Errore interno durante il merge' });
  } finally {
    client.release();
  }
});

// Admin: diagnostica connessione DB
app.get('/api/admin/db-info', verifyToken, async (req, res) => {
  try {
    const admin = await isRequesterAdmin(req.user.userId);
    if (!admin) return res.status(403).json({ success: false, error: 'Non autorizzato' });

    const info = await pool.query('SELECT current_database() as db, version() as postgres_version');
    let host = null;
    try {
      if (process.env.DATABASE_URL) {
        const u = new URL(process.env.DATABASE_URL);
        host = u.hostname;
      }
    } catch {}

    return res.json({ success: true, data: { db: info.rows[0].db, postgres_version: info.rows[0].postgres_version, db_host: host } });
  } catch (e) {
    console.error('Errore db-info:', e);
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

// Admin: imposta/reset password per un'email
app.post('/api/admin/set-password', verifyToken, async (req, res) => {
  try {
    const admin = await isRequesterAdmin(req.user.userId);
    if (!admin) return res.status(403).json({ success: false, error: 'Non autorizzato' });
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ success: false, error: 'Email e password richiesti' });

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Aggiorna prima su users
    const updatedUsers = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE LOWER(email) = LOWER($2) RETURNING id',
      [passwordHash, email]
    );

    // Aggiorna anche su utenti per retro-compat (se presente)
    const updatedUtenti = await pool.query(
      'UPDATE utenti SET password_hash = $1 WHERE LOWER(email) = LOWER($2) RETURNING id',
      [passwordHash, email]
    ).catch(() => ({ rowCount: 0 }));

    if ((updatedUsers.rowCount || 0) === 0 && (updatedUtenti.rowCount || 0) === 0) {
      return res.status(404).json({ success: false, error: 'Nessun utente trovato per questa email' });
    }

    return res.json({ success: true });
  } catch (e) {
    console.error('Errore set-password:', e);
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
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

// Placeholder voti governo (evita 404 in Profilo)
app.get('/api/governo/voti', verifyToken, async (req, res) => {
  try {
    // Restituiamo un oggetto vuoto: { categoria: nomeMinistro }
    return res.json({});
  } catch (error) {
    return res.json({});
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
// Tutte le opinioni sono ora dinamiche e gestite tramite la tabella 'opinioni'

app.get('/api/opinioni-list', async (req, res) => {
  try {
    // Recupera tutte le opinioni dalla tabella opinioni
    const result = await pool
      .query(`SELECT id, COALESCE(titolo, text) AS text FROM opinioni ORDER BY created_at DESC LIMIT 200`)
      .catch(() => ({ rows: [] }));

    const questions = result.rows
      .filter(r => r.text)
      .map(r => ({ id: String(r.id), text: r.text }));

    res.json(questions);
  } catch (error) {
    console.error('Errore opinioni-list:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Endpoint per ottenere tutte le opinioni (per la pagina opinioni)
app.get('/api/opinioni', async (req, res) => {
  try {
    // Recupera tutte le opinioni dalla tabella opinioni
    const result = await pool
      .query(`SELECT id, COALESCE(titolo, text) AS text FROM opinioni ORDER BY created_at DESC LIMIT 200`)
      .catch(() => ({ rows: [] }));

    const questions = result.rows
      .filter(r => r.text)
      .map(r => ({ id: String(r.id), text: r.text }));
    
    res.json({
      success: true,
      data: questions
    });
  } catch (error) {
    console.error('Errore opinioni:', error);
    res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

// Opinioni utente: recupero e salvataggio
const OPINION_ALLOWED_VALUES = new Set(['Favorevole', 'Indeciso', 'Contrario']);

app.get('/api/opinioni/utente', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log('DEBUG opinioni/utente - userId:', userId);

    // 1) Recupera tutte le opinioni dalla tabella opinioni
    const result = await pool
      .query(`SELECT id, COALESCE(titolo, text) AS text FROM opinioni ORDER BY created_at DESC LIMIT 200`)
      .catch(() => ({ rows: [] }));

    const questions = result.rows
      .filter(r => r.text)
      .map(r => ({ id: String(r.id), text: r.text }));

    console.log('DEBUG opinioni/utente - questions count:', questions.length);

    // 2) Assicurati esista tabella risposte
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

    // 3) Recupera tutte le risposte dell'utente
    const userAnswersResult = await pool
      .query(`SELECT opinione_id, valore FROM opinioni_risposte WHERE user_id = $1`, [userId])
      .catch(() => ({ rows: [] }));

    const userAnswers = {};
    for (const r of userAnswersResult.rows) {
      userAnswers[String(r.opinione_id)] = r.valore;
    }

    console.log('DEBUG opinioni/utente - userAnswers:', userAnswers);

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

    // 1) Assicurati esista tabella risposte
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

    // 2) Salva tutte le risposte nella tabella opinioni_risposte
    for (const [opinioneId, valore] of Object.entries(opinions)) {
      if (!OPINION_ALLOWED_VALUES.has(valore)) {
        return res.status(400).json({ success: false, error: `Valore non valido per opinione ${opinioneId}` });
      }
      
      await pool.query(
        `INSERT INTO opinioni_risposte (user_id, opinione_id, valore)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, opinione_id) DO UPDATE SET valore = EXCLUDED.valore, updated_at = NOW()`,
        [userId, String(opinioneId), valore]
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

// Endpoint opinioni proposte (per Gestisci Opinioni)
app.get('/api/opinioni-proposte', verifyToken, async (req, res) => {
  try {
    // Verifica se l'utente è admin
    const admin = await isRequesterAdmin(req.user.userId);
    if (!admin) return res.status(403).json({ success: false, error: 'Non autorizzato' });
    
    // Per ora restituisce un array vuoto (placeholder)
    // In futuro qui si potrebbero recuperare opinioni proposte dagli utenti
    res.json([]);
  } catch (error) {
    console.error('Errore caricamento opinioni proposte:', error);
    res.status(500).json({ success: false, error: 'Errore nel caricamento delle opinioni proposte' });
  }
});

// Endpoint per accettare opinioni proposte
app.post('/api/opinioni-proposte/:id/accetta', verifyToken, async (req, res) => {
  try {
    const admin = await isRequesterAdmin(req.user.userId);
    if (!admin) return res.status(403).json({ success: false, error: 'Non autorizzato' });
    
    const { id } = req.params;
    // Per ora restituisce successo (placeholder)
    // In futuro qui si potrebbe aggiungere l'opinione accettata alla lista ufficiali
    res.json({ success: true, message: 'Opinione accettata' });
  } catch (error) {
    console.error('Errore accettazione opinione:', error);
    res.status(500).json({ success: false, error: 'Errore nell\'accettazione dell\'opinione' });
  }
});

// Endpoint per rifiutare opinioni proposte
app.delete('/api/opinioni-proposte/:id', verifyToken, async (req, res) => {
  try {
    const admin = await isRequesterAdmin(req.user.userId);
    if (!admin) return res.status(403).json({ success: false, error: 'Non autorizzato' });
    
    const { id } = req.params;
    // Per ora restituisce successo (placeholder)
    // In futuro qui si potrebbe rimuovere l'opinione rifiutata
    res.json({ success: true, message: 'Opinione rifiutata' });
  } catch (error) {
    console.error('Errore rifiuto opinione:', error);
    res.status(500).json({ success: false, error: 'Errore nel rifiuto dell\'opinione' });
  }
});

// Debug endpoint per forzare migrazione completa
app.post('/api/debug/force-migration', async (req, res) => {
  try {
    console.log('🔄 Forzatura migrazione completa...');
    
    // Rimuovi il flag di migrazione per forzare una nuova migrazione
    await pool.query('DELETE FROM migration_flags WHERE key = $1', ['merged_utenti_to_users']);
    
    // Esegui la migrazione
    await migrateUtentiToUsersOnce();
    
    res.json({ 
      success: true, 
      message: 'Migrazione forzata completata' 
    });
    
  } catch (error) {
    console.error('❌ Errore migrazione forzata:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Debug endpoint per verificare dati opinioni
app.get('/api/debug/opinioni-data', async (req, res) => {
  try {
    console.log('🔍 DEBUG: Verifica dati opinioni...');
    
    // Conta utenti in entrambe le tabelle
    const usersCount = await pool.query('SELECT COUNT(*) as count FROM users');
    const utentiCount = await pool.query('SELECT COUNT(*) as count FROM utenti');
    
    // Conta opinioni per energia_nucleare in entrambe le tabelle
    const usersOpinions = await pool.query(`
      SELECT energia_nucleare, COUNT(*) as count 
      FROM users 
      WHERE energia_nucleare IS NOT NULL AND energia_nucleare != '' 
      GROUP BY energia_nucleare
    `);
    
    const utentiOpinions = await pool.query(`
      SELECT energia_nucleare, COUNT(*) as count 
      FROM utenti 
      WHERE energia_nucleare IS NOT NULL AND energia_nucleare != '' 
      GROUP BY energia_nucleare
    `);
    
    res.json({
      success: true,
      data: {
        users_count: usersCount.rows[0]?.count || 0,
        utenti_count: utentiCount.rows[0]?.count || 0,
        users_opinions: usersOpinions.rows,
        utenti_opinions: utentiOpinions.rows
      }
    });
    
  } catch (error) {
    console.error('❌ Errore debug opinioni:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Endpoint per creare opinioni esistenti nella tabella opinioni
app.post('/api/debug/create-opinions', async (req, res) => {
  try {
    console.log('🔄 Creazione opinioni esistenti...');
    
    // Assicurati esista tabella opinioni
    await pool.query(`
      CREATE TABLE IF NOT EXISTS opinioni (
        id SERIAL PRIMARY KEY,
        text TEXT NOT NULL,
        titolo TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ Tabella opinioni creata/verificata');
    
    // Lista delle opinioni esistenti
    const existingOpinions = [
      { id: 'energia_nucleare', text: "Sei favorevole all'utilizzo dell'energia nucleare?" },
      { id: 'sperimentazione_animale', text: 'Sei favorevole alla sperimentazione sugli animali?' },
      { id: 'legalizzazione_canapa', text: 'Sei favorevole alla legalizzazione della canapa?' },
      { id: 'caccia', text: 'Sei favorevole alla caccia?' },
      { id: 'cittadina_animale', text: 'Sei favorevole alla cittadinanza animale?' },
      { id: 'eutanasia', text: 'Sei favorevole all\'eutanasia?' },
      { id: 'case_chiuse', text: 'Sei favorevole alle case chiuse?' },
      { id: 'salario_minimo', text: 'Sei favorevole al salario minimo?' },
      { id: 'matrimonio_gay', text: 'Sei favorevole al matrimonio gay?' },
      { id: 'nato', text: 'Sei favorevole alla NATO?' },
      { id: 'omobitransfobia', text: 'Sei favorevole alla legge contro l\'omobitransfobia?' }
    ];
    
    let createdCount = 0;
    
    for (const opinion of existingOpinions) {
      try {
        // Inserisci l'opinione se non esiste già
        const result = await pool.query(`
          INSERT INTO opinioni (id, text)
          VALUES ($1, $2)
          ON CONFLICT (id) DO NOTHING
        `, [opinion.id, opinion.text]);
        
        if (result.rowCount > 0) {
          createdCount++;
          console.log(`✅ Created opinion: ${opinion.id}`);
        } else {
          console.log(`⚠️ Opinion already exists: ${opinion.id}`);
        }
      } catch (error) {
        console.error(`❌ Error creating opinion ${opinion.id}:`, error.message);
      }
    }
    
    console.log(`✅ Created ${createdCount} new opinions`);
    
    res.json({
      success: true,
      message: `Created ${createdCount} new opinions`
    });
    
  } catch (error) {
    console.error('❌ Errore creazione opinioni:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack
    });
  }
});

// Endpoint per testare i dati dell'endpoint sondaggi
app.get('/api/debug/sondaggi-test', async (req, res) => {
  try {
    console.log('🧪 DEBUG: Test endpoint sondaggi chiamato');
    
    // Simula la stessa logica dell'endpoint sondaggi
    const result = await pool
      .query(`SELECT id, COALESCE(titolo, text) AS text FROM opinioni ORDER BY created_at DESC LIMIT 200`)
      .catch(() => ({ rows: [] }));

    const questions = result.rows
      .filter(r => r.text && r.text.trim() !== '')  // Filtra solo quelle con testo valido
      .map(r => ({ id: String(r.id), text: r.text.trim() }));

    console.log('📊 DEBUG: Questions found:', questions);
    
    // Calcola statistiche per ogni opinione
    const stats = {};
    
    for (const question of questions) {
      const questionId = question.id;
      console.log('🔍 DEBUG: Processing question:', questionId);
      
      try {
        const result = await pool.query(`
          SELECT 
            COUNT(CASE WHEN valore = 'Favorevole' THEN 1 END) as favorevole,
            COUNT(CASE WHEN valore = 'Contrario' THEN 1 END) as contrario,
            COUNT(CASE WHEN valore = 'Indeciso' THEN 1 END) as astenuto
          FROM opinioni_risposte 
          WHERE opinione_id = $1
        `, [questionId]);
        
        if (result.rows.length > 0) {
          const row = result.rows[0];
          stats[questionId] = {
            favorevole: parseInt(row.favorevole) || 0,
            contrario: parseInt(row.contrario) || 0,
            astenuto: parseInt(row.astenuto) || 0
          };
          console.log('✅ DEBUG: Stats for', questionId, ':', stats[questionId]);
        } else {
          stats[questionId] = {
            favorevole: 0,
            contrario: 0,
            astenuto: 0
          };
          console.log('⚠️ DEBUG: No stats for', questionId);
        }
      } catch (questionError) {
        console.error('❌ DEBUG: Error processing question', questionId, ':', questionError.message);
        stats[questionId] = {
          favorevole: 0,
          contrario: 0,
          astenuto: 0
        };
      }
    }

    console.log('✅ DEBUG: Final stats object:', stats);
    console.log('✅ DEBUG: Final questions object:', questions);

    res.json({ 
      success: true, 
      stats, 
      questions,
      debug: {
        questionsCount: questions.length,
        statsKeys: Object.keys(stats),
        sampleQuestion: questions[0],
        sampleStats: Object.values(stats)[0]
      }
    });
    
  } catch (error) {
    console.error('❌ Errore test endpoint sondaggi:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack
    });
  }
});

// Endpoint per migrare opinioni esistenti a opinioni_risposte
app.post('/api/debug/migrate-opinions', async (req, res) => {
  try {
    console.log('🔄 Migrazione opinioni esistenti...');
    
    // Assicurati esista tabella opinioni_risposte
    await pool.query(`
      CREATE TABLE IF NOT EXISTS opinioni_risposte (
        user_id VARCHAR(255) NOT NULL,
        opinione_id VARCHAR(255) NOT NULL,
        valore VARCHAR(50) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, opinione_id)
      )
    `);
    
    console.log('✅ Tabella opinioni_risposte creata/verificata');
    
    // Lista delle vecchie opinioni base
    const oldOpinionFields = [
      'energia_nucleare', 'sperimentazione_animale', 'legalizzazione_canapa', 'caccia',
      'cittadina_animale', 'eutanasia', 'case_chiuse', 'salario_minimo', 
      'matrimonio_gay', 'nato', 'omobitransfobia'
    ];
    
    let migratedCount = 0;
    
    // Migra da tabella users
    console.log('🔍 Migrazione da tabella users...');
    for (const field of oldOpinionFields) {
      try {
        console.log(`🔍 Processing field: ${field}`);
        
        const users = await pool.query(`
          SELECT id, ${field} FROM users 
          WHERE ${field} IS NOT NULL AND ${field} != '' AND ${field} IN ('Favorevole', 'Indeciso', 'Contrario')
        `);
        
        console.log(`📊 Found ${users.rows.length} users with ${field} opinion`);
        
        for (const user of users.rows) {
          try {
            await pool.query(`
              INSERT INTO opinioni_risposte (user_id, opinione_id, valore)
              VALUES ($1, $2, $3)
              ON CONFLICT (user_id, opinione_id) DO NOTHING
            `, [user.id, field, user[field]]);
            migratedCount++;
          } catch (insertError) {
            console.error(`❌ Error inserting ${field} for user ${user.id}:`, insertError.message);
          }
        }
      } catch (fieldError) {
        console.error(`❌ Error processing field ${field}:`, fieldError.message);
      }
    }
    
    // Migra da tabella utenti
    console.log('🔍 Migrazione da tabella utenti...');
    for (const field of oldOpinionFields) {
      try {
        console.log(`🔍 Processing field: ${field}`);
        
        const utenti = await pool.query(`
          SELECT id, ${field} FROM utenti 
          WHERE ${field} IS NOT NULL AND ${field} != '' AND ${field} IN ('Favorevole', 'Indeciso', 'Contrario')
        `);
        
        console.log(`📊 Found ${utenti.rows.length} utenti with ${field} opinion`);
        
        for (const utente of utenti.rows) {
          try {
            await pool.query(`
              INSERT INTO opinioni_risposte (user_id, opinione_id, valore)
              VALUES ($1, $2, $3)
              ON CONFLICT (user_id, opinione_id) DO NOTHING
            `, [utente.id, field, utente[field]]);
            migratedCount++;
          } catch (insertError) {
            console.error(`❌ Error inserting ${field} for utente ${utente.id}:`, insertError.message);
          }
        }
      } catch (fieldError) {
        console.error(`❌ Error processing field ${field}:`, fieldError.message);
      }
    }
    
    console.log(`✅ Migrazione completata: ${migratedCount} opinioni migrate`);
    
    res.json({
      success: true,
      message: `Migrazione completata: ${migratedCount} opinioni migrate`
    });
    
  } catch (error) {
    console.error('❌ Errore migrazione opinioni:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack
    });
  }
});

// Endpoint per statistiche sondaggi
app.get('/api/sondaggi/stats', verifyToken, async (req, res) => {
  try {
    console.log('🔍 DEBUG: Inizio endpoint /api/sondaggi/stats');
    
    // Verifica se l'utente è admin
    const admin = await isRequesterAdmin(req.user.userId);
    if (!admin) return res.status(403).json({ success: false, error: 'Non autorizzato' });

    console.log('✅ DEBUG: Utente è admin');

    // 1. Recupera tutte le domande dalla tabella opinioni
    const result = await pool
      .query(`SELECT id, COALESCE(titolo, text) AS text FROM opinioni ORDER BY created_at DESC LIMIT 200`)
      .catch(() => ({ rows: [] }));

    const questions = result.rows
      .filter(r => r.text && r.text.trim() !== '')  // Filtra solo quelle con testo valido
      .map(r => ({ id: String(r.id), text: r.text.trim() }));

    console.log('📊 DEBUG: Questions count:', questions.length);

    // 2. Calcola statistiche per ogni opinione direttamente dalla tabella utenti
    const stats = {};
    
    for (const question of questions) {
      const questionId = question.id;
      console.log('🔍 DEBUG: Processing question:', questionId);
      
      try {
        // Prima controlla il tipo di colonna
        const columnTypeResult = await pool.query(`
          SELECT data_type 
          FROM information_schema.columns 
          WHERE table_name = 'utenti' AND column_name = $1
        `, [questionId]);

        if (columnTypeResult.rows.length === 0) {
          console.log('⚠️ DEBUG: Column', questionId, 'not found in utenti table');
          stats[questionId] = { favorevole: 0, contrario: 0, astenuto: 0 };
          continue;
        }

        const columnType = columnTypeResult.rows[0].data_type;
        console.log('🔍 DEBUG: Column', questionId, 'type:', columnType);

        let statsResult;
        
        if (columnType === 'boolean') {
          // Per colonne boolean: true = Favorevole, false = Contrario, NULL = Astenuto
          statsResult = await pool.query(`
            SELECT 
              COUNT(CASE WHEN ${questionId} = true THEN 1 END) as favorevole,
              COUNT(CASE WHEN ${questionId} = false THEN 1 END) as contrario,
              COUNT(CASE WHEN ${questionId} IS NULL THEN 1 END) as astenuto
            FROM utenti 
            WHERE ${questionId} IS NOT NULL
          `);
        } else {
          // Per colonne text: Favorevole, Contrario, Indeciso
          statsResult = await pool.query(`
            SELECT 
              COUNT(CASE WHEN ${questionId} = 'Favorevole' THEN 1 END) as favorevole,
              COUNT(CASE WHEN ${questionId} = 'Contrario' THEN 1 END) as contrario,
              COUNT(CASE WHEN ${questionId} = 'Indeciso' THEN 1 END) as astenuto
            FROM utenti 
            WHERE ${questionId} IS NOT NULL AND ${questionId} != ''
          `);
        }
        
        if (statsResult.rows.length > 0) {
          const row = statsResult.rows[0];
          stats[questionId] = {
            favorevole: parseInt(row.favorevole) || 0,
            contrario: parseInt(row.contrario) || 0,
            astenuto: parseInt(row.astenuto) || 0
          };
          console.log('✅ DEBUG: Stats for', questionId, ':', stats[questionId]);
        } else {
          stats[questionId] = {
            favorevole: 0,
            contrario: 0,
            astenuto: 0
          };
          console.log('⚠️ DEBUG: No stats for', questionId);
        }
      } catch (questionError) {
        console.error('❌ DEBUG: Error processing question', questionId, ':', questionError.message);
        console.error('❌ DEBUG: Error stack:', questionError.stack);
        // Continua con la prossima domanda invece di fallire completamente
        stats[questionId] = {
          favorevole: 0,
          contrario: 0,
          astenuto: 0
        };
      }
    }

    console.log('✅ DEBUG: Final stats object:', Object.keys(stats));

    res.json({ 
      success: true, 
      stats, 
      questions 
    });
    
  } catch (error) {
    console.error('❌ Errore caricamento statistiche sondaggi:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({ 
      success: false, 
      error: 'Errore nel caricamento delle statistiche',
      details: error.message 
    });
  }
});

// Endpoint per statistiche di una singola opinione
app.get('/api/opinioni/stats/:id', verifyToken, async (req, res) => {
  try {
    console.log('🔍 DEBUG: Inizio endpoint /api/opinioni/stats/:id');
    
    // Verifica se l'utente è admin
    const admin = await isRequesterAdmin(req.user.userId);
    if (!admin) return res.status(403).json({ success: false, error: 'Non autorizzato' });

    const opinionId = req.params.id;
    console.log('✅ DEBUG: Utente è admin, opinionId:', opinionId);

    // 1. Recupera il testo della domanda
    const questionResult = await pool
      .query(`SELECT id, COALESCE(titolo, text) AS text FROM opinioni WHERE id = $1`)
      .catch(() => ({ rows: [] }));

    if (questionResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Opinione non trovata' });
    }

    const questionText = questionResult.rows[0].text;

    // 2. Controlla il tipo di colonna
    const columnTypeResult = await pool.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'utenti' AND column_name = $1
    `, [opinionId]);

    if (columnTypeResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Colonna opinione non trovata' });
    }

    const columnType = columnTypeResult.rows[0].data_type;
    console.log('🔍 DEBUG: Column', opinionId, 'type:', columnType);

    // 3. Calcola statistiche per questa opinione dalla tabella utenti
    let statsResult;
    
    if (columnType === 'boolean') {
      // Per colonne boolean: true = Favorevole, false = Contrario, NULL = Astenuto
      statsResult = await pool.query(`
        SELECT 
          COUNT(CASE WHEN ${opinionId} = true THEN 1 END) as favorevole,
          COUNT(CASE WHEN ${opinionId} = false THEN 1 END) as contrario,
          COUNT(CASE WHEN ${opinionId} IS NULL THEN 1 END) as astenuto
        FROM utenti 
        WHERE ${opinionId} IS NOT NULL
      `);
    } else {
      // Per colonne text: Favorevole, Contrario, Indeciso
      statsResult = await pool.query(`
        SELECT 
          COUNT(CASE WHEN ${opinionId} = 'Favorevole' THEN 1 END) as favorevole,
          COUNT(CASE WHEN ${opinionId} = 'Contrario' THEN 1 END) as contrario,
          COUNT(CASE WHEN ${opinionId} = 'Indeciso' THEN 1 END) as astenuto
        FROM utenti 
        WHERE ${opinionId} IS NOT NULL AND ${opinionId} != ''
      `);
    }

    const stats = {
      favorevole: parseInt(statsResult.rows[0]?.favorevole) || 0,
      contrario: parseInt(statsResult.rows[0]?.contrario) || 0,
      astenuto: parseInt(statsResult.rows[0]?.astenuto) || 0
    };

    console.log('✅ DEBUG: Stats for', opinionId, ':', stats);

    res.json({
      success: true,
      questionText,
      stats
    });

  } catch (error) {
    console.error('❌ Errore caricamento statistiche opinione:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Errore nel caricamento delle statistiche',
      details: error.message
    });
  }
});

// Endpoint per statistiche regionali di un'opinione
app.get('/api/opinioni/stats/:id/regione/:regione', verifyToken, async (req, res) => {
  try {
    console.log('🔍 DEBUG: Inizio endpoint /api/opinioni/stats/:id/regione/:regione');
    
    // Verifica se l'utente è admin
    const admin = await isRequesterAdmin(req.user.userId);
    if (!admin) return res.status(403).json({ success: false, error: 'Non autorizzato' });

    const opinionId = req.params.id;
    const regione = req.params.regione.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    console.log('✅ DEBUG: Utente è admin, opinionId:', opinionId, 'regione:', regione);

    // Controlla il tipo di colonna
    const columnTypeResult = await pool.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'utenti' AND column_name = $1
    `, [opinionId]);

    if (columnTypeResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Colonna opinione non trovata' });
    }

    const columnType = columnTypeResult.rows[0].data_type;
    console.log('🔍 DEBUG: Column', opinionId, 'type:', columnType);

    // Calcola statistiche per questa opinione nella regione specifica
    let statsResult;
    
    if (columnType === 'boolean') {
      // Per colonne boolean: true = Favorevole, false = Contrario, NULL = Astenuto
      statsResult = await pool.query(`
        SELECT 
          COUNT(CASE WHEN ${opinionId} = true THEN 1 END) as favorevole,
          COUNT(CASE WHEN ${opinionId} = false THEN 1 END) as contrario,
          COUNT(CASE WHEN ${opinionId} IS NULL THEN 1 END) as astenuto
        FROM utenti 
        WHERE ${opinionId} IS NOT NULL 
        AND regione = $1
      `, [regione]);
    } else {
      // Per colonne text: Favorevole, Contrario, Indeciso
      statsResult = await pool.query(`
        SELECT 
          COUNT(CASE WHEN ${opinionId} = 'Favorevole' THEN 1 END) as favorevole,
          COUNT(CASE WHEN ${opinionId} = 'Contrario' THEN 1 END) as contrario,
          COUNT(CASE WHEN ${opinionId} = 'Indeciso' THEN 1 END) as astenuto
        FROM utenti 
        WHERE ${opinionId} IS NOT NULL AND ${opinionId} != '' 
        AND regione = $1
      `, [regione]);
    }

    const stats = {
      favorevole: parseInt(statsResult.rows[0]?.favorevole) || 0,
      contrario: parseInt(statsResult.rows[0]?.contrario) || 0,
      astenuto: parseInt(statsResult.rows[0]?.astenuto) || 0
    };

    console.log('✅ DEBUG: Regional stats for', opinionId, 'in', regione, ':', stats);

    res.json({
      success: true,
      regione,
      stats
    });

  } catch (error) {
    console.error('❌ Errore caricamento statistiche regionali:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Errore nel caricamento delle statistiche regionali',
      details: error.message
    });
  }
});

// Endpoint per statistiche di tutte le regioni per un'opinione
app.get('/api/opinioni/stats/:id/tutte-regioni', verifyToken, async (req, res) => {
  try {
    console.log('🔍 DEBUG: Inizio endpoint /api/opinioni/stats/:id/tutte-regioni');
    
    // Verifica se l'utente è admin
    const admin = await isRequesterAdmin(req.user.userId);
    if (!admin) return res.status(403).json({ success: false, error: 'Non autorizzato' });

    const opinionId = req.params.id;
    console.log('✅ DEBUG: Utente è admin, opinionId:', opinionId);

    // Controlla il tipo di colonna
    const columnTypeResult = await pool.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'utenti' AND column_name = $1
    `, [opinionId]);

    if (columnTypeResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Colonna opinione non trovata' });
    }

    const columnType = columnTypeResult.rows[0].data_type;
    console.log('🔍 DEBUG: Column', opinionId, 'type:', columnType);

    // Calcola statistiche per questa opinione in tutte le regioni
    let statsResult;
    
    if (columnType === 'boolean') {
      // Per colonne boolean: true = Favorevole, false = Contrario, NULL = Astenuto
      statsResult = await pool.query(`
        SELECT 
          regione,
          COUNT(CASE WHEN ${opinionId} = true THEN 1 END) as favorevole,
          COUNT(CASE WHEN ${opinionId} = false THEN 1 END) as contrario,
          COUNT(CASE WHEN ${opinionId} IS NULL THEN 1 END) as astenuto
        FROM utenti 
        WHERE ${opinionId} IS NOT NULL 
        AND regione IS NOT NULL AND regione != ''
        GROUP BY regione
        ORDER BY regione
      `);
    } else {
      // Per colonne text: Favorevole, Contrario, Indeciso
      statsResult = await pool.query(`
        SELECT 
          regione,
          COUNT(CASE WHEN ${opinionId} = 'Favorevole' THEN 1 END) as favorevole,
          COUNT(CASE WHEN ${opinionId} = 'Contrario' THEN 1 END) as contrario,
          COUNT(CASE WHEN ${opinionId} = 'Indeciso' THEN 1 END) as astenuto
        FROM utenti 
        WHERE ${opinionId} IS NOT NULL AND ${opinionId} != '' 
        AND regione IS NOT NULL AND regione != ''
        GROUP BY regione
        ORDER BY regione
      `);
    }

    const regionalStats = statsResult.rows.map(row => ({
      regione: row.regione,
      favorevole: parseInt(row.favorevole) || 0,
      contrario: parseInt(row.contrario) || 0,
      astenuto: parseInt(row.astenuto) || 0
    }));

    console.log('✅ DEBUG: All regional stats for', opinionId, ':', regionalStats.length, 'regioni');

    res.json({
      success: true,
      regionalStats
    });

  } catch (error) {
    console.error('❌ Errore caricamento statistiche tutte le regioni:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Errore nel caricamento delle statistiche di tutte le regioni',
      details: error.message
    });
  }
});

// Endpoint di debug per verificare la tabella utenti
app.get('/api/debug/utenti-table', verifyToken, async (req, res) => {
  try {
    console.log('🔍 DEBUG: Inizio endpoint /api/debug/utenti-table');
    
    // Verifica se l'utente è admin
    const admin = await isRequesterAdmin(req.user.userId);
    if (!admin) return res.status(403).json({ success: false, error: 'Non autorizzato' });

    console.log('✅ DEBUG: Utente è admin');

    // 1. Verifica struttura tabella
    console.log('📋 DEBUG: Verifica struttura tabella utenti');
    const structureResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'utenti' 
      ORDER BY ordinal_position
    `);
    
    console.log('Colonne trovate:', structureResult.rows.length);
    const columns = structureResult.rows.map(row => ({
      name: row.column_name,
      type: row.data_type,
      nullable: row.is_nullable
    }));

    // 2. Conta righe totali
    const countResult = await pool.query('SELECT COUNT(*) as total FROM utenti');
    const totalRows = parseInt(countResult.rows[0].total);

    // 3. Verifica colonne opinioni specifiche
    const opinionColumns = [
      'cittadina_animale', 'nato', 'sperimentazione_animale', 'matrimonio_gay',
      'salario_minimo', 'carne_coltivata', 'case_chiuse', 'energia_nucleare',
      'legalizzazione_canapa', 'caccia', 'eutanasia', 'omobitransfobia'
    ];

    console.log('🎯 DEBUG: Verifica colonne opinioni');
    const opinionStats = {};
    
    for (const column of opinionColumns) {
      try {
        // Conta valori non null per questa colonna
        const result = await pool.query(`
          SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN ${column} IS NOT NULL THEN 1 END) as not_null,
            COUNT(CASE WHEN ${column} IS NULL THEN 1 END) as null_count
          FROM utenti
        `);
        
        const row = result.rows[0];
        opinionStats[column] = {
          total: parseInt(row.total),
          notNull: parseInt(row.not_null),
          nullCount: parseInt(row.null_count)
        };
        
        console.log(`  ${column}: ${row.not_null}/${row.total} valori non null`);
        
        // Se ci sono valori non null, mostra alcuni esempi
        if (row.not_null > 0) {
          const sampleResult = await pool.query(`
            SELECT ${column}, COUNT(*) as count
            FROM utenti 
            WHERE ${column} IS NOT NULL 
            GROUP BY ${column} 
            ORDER BY count DESC 
            LIMIT 5
          `);
          
          opinionStats[column].samples = sampleResult.rows.map(sample => ({
            value: sample[column],
            count: parseInt(sample.count)
          }));
          
          console.log(`    - Valori trovati:`, sampleResult.rows);
        }
        
      } catch (error) {
        console.log(`  ${column}: ERRORE - ${error.message}`);
        opinionStats[column] = { error: error.message };
      }
    }

    // 4. Verifica se i dati sono nella tabella users invece
    console.log('🔍 DEBUG: Verifica tabella users');
    const usersStructureResult = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN (${opinionColumns.map(c => `'${c}'`).join(',')})
      ORDER BY column_name
    `);
    
    const usersColumns = usersStructureResult.rows.map(row => ({
      name: row.column_name,
      type: row.data_type
    }));

    const usersOpinionStats = {};
    if (usersColumns.length > 0) {
      console.log('Colonne opinioni trovate in users:', usersColumns.length);
      
      // Conta dati in users per le colonne opinioni
      for (const column of usersColumns.map(c => c.name)) {
        try {
          const result = await pool.query(`
            SELECT 
              COUNT(*) as total,
              COUNT(CASE WHEN ${column} IS NOT NULL THEN 1 END) as not_null
            FROM users
          `);
          
          const row = result.rows[0];
          usersOpinionStats[column] = {
            total: parseInt(row.total),
            notNull: parseInt(row.not_null)
          };
          
          console.log(`  ${column}: ${row.not_null}/${row.total} valori non null`);
        } catch (error) {
          console.log(`  ${column}: ERRORE - ${error.message}`);
          usersOpinionStats[column] = { error: error.message };
        }
      }
    }

    console.log('✅ DEBUG: Debug completato');

    res.json({
      success: true,
      tableStructure: {
        totalColumns: columns.length,
        columns: columns
      },
      totalRows,
      opinionStats,
      usersTable: {
        opinionColumns: usersColumns,
        opinionStats: usersOpinionStats
      }
    });

  } catch (error) {
    console.error('❌ Errore durante debug tabella utenti:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Errore durante debug',
      details: error.message
    });
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

