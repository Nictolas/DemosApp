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
          
          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #333; margin-top: 0;">Ciao ${userName}!</h2>
            <p style="color: #666; line-height: 1.6;">Hai richiesto il reset della tua password per Demos Community.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                Reset Password
              </a>
            </div>
            
            <p style="color: #666; line-height: 1.6; font-size: 14px;">
              Se non hai richiesto tu questo reset, puoi ignorare questa email. Il link sarà valido per 1 ora.
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px; text-align: center;">
              Questa email è stata inviata automaticamente, non rispondere.
            </p>
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

// Middleware per verificare JWT token
const verifyToken = (req, res, next) => {
  try {
    console.log('🔍 DEBUG: verifyToken chiamato per:', req.method, req.path);
    
    const authHeader = req.headers.authorization;
    console.log('🔍 DEBUG: Authorization header:', authHeader ? 'Presente' : 'Mancante');
    
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Token di accesso richiesto' });
    }

    const token = authHeader.split(' ')[1];
    console.log('🔍 DEBUG: Token estratto (primi 20 char):', token ? token.substring(0, 20) + '...' : 'Mancante');
    
    if (!token) {
      return res.status(401).json({ success: false, error: 'Formato token non valido' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
      req.user = decoded;
      console.log('✅ DEBUG: Token valido, userId:', decoded.userId);
      next();
    } catch (jwtError) {
      console.error('❌ DEBUG: Errore verifica JWT:', jwtError.message);
      return res.status(401).json({ success: false, error: 'Token non valido o scaduto' });
    }
  } catch (error) {
    console.error('❌ DEBUG: Errore generico verifyToken:', error);
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
};

// Funzione per verificare se l'utente è admin
const isRequesterAdmin = async (userId) => {
  try {
    console.log('🔍 DEBUG: Ricerca utente con ID:', userId);
    
    const result = await pool.query('SELECT ruolo FROM users WHERE id = $1', [userId]);
    
    if (result.rows.length === 0) {
      console.log('❌ DEBUG: Utente non trovato');
      return false;
    }
    
    const user = result.rows[0];
    console.log('✅ DEBUG: Utente trovato:', user);
    
    return user.ruolo === 'Admin';
  } catch (error) {
    console.error('❌ DEBUG: Errore verifica admin:', error);
    return false;
  }
};

// Endpoint di autenticazione
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email e password richiesti' });
    }

    // Cerca utente nella tabella users
    const result = await pool.query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Credenziali non valide' });
    }

    const user = result.rows[0];
    
    // Verifica password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, error: 'Credenziali non valide' });
    }

    // Genera JWT token
    const token = jwt.sign(
      { 
        userId: user.id,
        email: user.email 
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: `${user.nome || ''} ${user.cognome || ''}`.trim() || user.email,
        role: user.ruolo || 'Elettore',
        status: user.status
      },
      token
    });

  } catch (error) {
    console.error('Errore login:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, nome, cognome, ruolo } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email e password richiesti' });
    }

    // Verifica se l'utente esiste già
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Un utente con questa email esiste già'
      });
    }
    
    // Hash della password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Crea nuovo utente
    const result = await pool.query(
      `INSERT INTO users (id, email, nome, cognome, password_hash, ruolo, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, nome, cognome, ruolo, status`,
      [
        crypto.randomUUID(),
        email.toLowerCase(),
        nome || '',
        cognome || '',
        passwordHash,
        ruolo || 'Elettore',
        'pending'
      ]
    );
    
    const user = result.rows[0];
    
    // Genera JWT token
    const token = jwt.sign(
      { 
        userId: user.id,
        email: user.email 
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: `${user.nome} ${user.cognome}`.trim(),
        role: user.ruolo,
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
});

app.get('/api/utenti/me', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const result = await pool.query(
      'SELECT id, email, nome, cognome, ruolo, status FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Utente non trovato' });
    }

    const user = result.rows[0];
    
    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: `${user.nome || ''} ${user.cognome || ''}`.trim() || user.email,
        role: user.ruolo,
        status: user.status
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

// Endpoint per gestire utenti (admin)
app.get('/api/utenti', verifyToken, async (req, res) => {
  try {
    // Verifica se l'utente è admin
    const admin = await isRequesterAdmin(req.user.userId);
    if (!admin) return res.status(403).json({ success: false, error: 'Non autorizzato' });

    // Recupera tutti gli utenti dalla tabella users
    const result = await pool.query(`
      SELECT id, email, nome, cognome, ruolo, status, created_at
      FROM users 
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Errore recupero utenti:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// Endpoint per utenti in attesa di approvazione
app.get('/api/utenti/pending', verifyToken, async (req, res) => {
  try {
    // Verifica se l'utente è admin
    const admin = await isRequesterAdmin(req.user.userId);
    if (!admin) return res.status(403).json({ success: false, error: 'Non autorizzato' });

    // Recupera utenti in attesa dalla tabella users
    const result = await pool.query(`
      SELECT id, email, nome, cognome, ruolo, status, created_at
      FROM users 
      WHERE status = 'pending'
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Errore recupero utenti in attesa:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// Endpoint per approvare utente
app.post('/api/utenti/approve', verifyToken, async (req, res) => {
  try {
    const admin = await isRequesterAdmin(req.user.userId);
    if (!admin) return res.status(403).json({ success: false, error: 'Non autorizzato' });
    
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ success: false, error: 'userId mancante' });
    
    await pool.query("UPDATE users SET status = 'active' WHERE id = $1", [userId]);
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Errore approve:', error);
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

// Endpoint per rifiutare utente
app.post('/api/utenti/reject', verifyToken, async (req, res) => {
  try {
    const admin = await isRequesterAdmin(req.user.userId);
    if (!admin) return res.status(403).json({ success: false, error: 'Non autorizzato' });
    
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ success: false, error: 'userId mancante' });
    
    await pool.query("UPDATE users SET status = 'rejected' WHERE id = $1", [userId]);
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Errore reject:', error);
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

// Endpoint per eliminare utente
app.delete('/api/utenti/:id', verifyToken, async (req, res) => {
  try {
    const admin = await isRequesterAdmin(req.user.userId);
    if (!admin) return res.status(403).json({ success: false, error: 'Non autorizzato' });
    
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, error: 'ID mancante' });
    
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Errore delete utente:', error);
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

// Endpoint per migrazione completa da utenti a users
app.post('/api/debug/migrate-utenti-to-users', async (req, res) => {
  try {
    console.log('🔄 DEBUG: Inizio migrazione completa da utenti a users');
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      console.log('✅ DEBUG: Transazione iniziata');
      
      // 1. Verifica struttura tabella utenti
      console.log('📋 DEBUG: Verifica struttura tabella utenti');
      const utentiStructure = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'utenti' 
        ORDER BY ordinal_position
      `);
      
      console.log('📊 DEBUG: Colonne trovate in utenti:', utentiStructure.rows.length);
      
      // 2. Verifica struttura tabella users
      console.log('📋 DEBUG: Verifica struttura tabella users');
      const usersStructure = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        ORDER BY ordinal_position
      `);
      
      console.log('📊 DEBUG: Colonne trovate in users:', usersStructure.rows.length);
      
      // 3. Conta righe in entrambe le tabelle
      const utentiCount = await client.query('SELECT COUNT(*) as total FROM utenti');
      const usersCount = await client.query('SELECT COUNT(*) as total FROM users');
      
      console.log('📊 DEBUG: Righe in utenti:', utentiCount.rows[0].total);
      console.log('📊 DEBUG: Righe in users:', usersCount.rows[0].total);
      
      // 4. Migra dati da utenti a users (solo se non esistono già)
      console.log('🔄 DEBUG: Migrazione dati da utenti a users');
      
      // Per ogni colonna in utenti, aggiorna users se mancante
      for (const utentiCol of utentiStructure.rows) {
        const columnName = utentiCol.column_name;
        const columnType = utentiCol.data_type;
        
        // Verifica se la colonna esiste in users
        const columnExists = usersStructure.rows.find(u => u.column_name === columnName);
        
        if (!columnExists) {
          console.log(`🔧 DEBUG: Aggiungo colonna ${columnName} (${columnType}) a users`);
          
          // Aggiungi colonna a users
          await client.query(`ALTER TABLE users ADD COLUMN ${columnName} ${columnType}`);
        }
      }
      
      // 5. Copia dati da utenti a users (solo per email non esistenti)
      console.log('🔄 DEBUG: Copia dati da utenti a users');
      
      const insertResult = await client.query(`
        INSERT INTO users (id, email, nome, cognome, ruolo, status, 
                          energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia,
                          cittadina_animale, nato, matrimonio_gay, salario_minimo, 
                          carne_coltivata, case_chiuse, eutanasia, omobitransfobia,
                          password_hash, avatar_config, regione, provincia, comune)
        SELECT 
          COALESCE(t.id, gen_random_uuid()) as id,
          t.email,
          t.nome,
          t.cognome,
          COALESCE(t.ruolo, 'Elettore') as ruolo,
          COALESCE(t.status, 'pending') as status,
          t.energia_nucleare,
          t.sperimentazione_animale,
          t.legalizzazione_canapa,
          t.caccia,
          t.cittadina_animale,
          t.nato,
          t.matrimonio_gay,
          t.salario_minimo,
          t.carne_coltivata,
          t.case_chiuse,
          t.eutanasia,
          t.omobitransfobia,
          t.password_hash,
          t.avatar_config,
          t.regione,
          t.provincia,
          t.comune
        FROM utenti t
        LEFT JOIN users u ON LOWER(u.email) = LOWER(t.email)
        WHERE u.email IS NULL
      `);
      
      console.log('✅ DEBUG: Inserite nuove righe:', insertResult.rowCount);
      
      // 6. Aggiorna dati esistenti in users con quelli di utenti
      console.log('🔄 DEBUG: Aggiorna dati esistenti in users');
      
      const updateResult = await client.query(`
        UPDATE users u
        SET 
          nome = COALESCE(u.nome, t.nome),
          cognome = COALESCE(u.cognome, t.cognome),
          ruolo = COALESCE(u.ruolo, t.ruolo, 'Elettore'),
          status = COALESCE(u.status, t.status, 'pending'),
          energia_nucleare = COALESCE(u.energia_nucleare, t.energia_nucleare),
          sperimentazione_animale = COALESCE(u.sperimentazione_animale, t.sperimentazione_animale),
          legalizzazione_canapa = COALESCE(u.legalizzazione_canapa, t.legalizzazione_canapa),
          caccia = COALESCE(u.caccia, t.caccia),
          cittadina_animale = COALESCE(u.cittadina_animale, t.cittadina_animale),
          nato = COALESCE(u.nato, t.nato),
          matrimonio_gay = COALESCE(u.matrimonio_gay, t.matrimonio_gay),
          salario_minimo = COALESCE(u.salario_minimo, t.salario_minimo),
          carne_coltivata = COALESCE(u.carne_coltivata, t.carne_coltivata),
          case_chiuse = COALESCE(u.case_chiuse, t.case_chiuse),
          eutanasia = COALESCE(u.eutanasia, t.eutanasia),
          omobitransfobia = COALESCE(u.omobitransfobia, t.omobitransfobia),
          password_hash = COALESCE(u.password_hash, t.password_hash),
          avatar_config = COALESCE(u.avatar_config, t.avatar_config),
          regione = COALESCE(u.regione, t.regione),
          provincia = COALESCE(u.provincia, t.provincia),
          comune = COALESCE(u.comune, t.comune)
        FROM utenti t
        WHERE LOWER(u.email) = LOWER(t.email)
      `);
      
      console.log('✅ DEBUG: Aggiornate righe esistenti:', updateResult.rowCount);
      
      // 7. Verifica finale
      const finalUsersCount = await client.query('SELECT COUNT(*) as total FROM users');
      console.log('📊 DEBUG: Righe finali in users:', finalUsersCount.rows[0].total);
      
      // 8. Elimina tabella utenti
      console.log('🗑️ DEBUG: Eliminazione tabella utenti');
      await client.query('DROP TABLE IF EXISTS utenti CASCADE');
      console.log('✅ DEBUG: Tabella utenti eliminata');
      
      await client.query('COMMIT');
      console.log('✅ DEBUG: Transazione completata con successo');
      
      res.json({
        success: true,
        message: 'Migrazione completata con successo',
        data: {
          utenti_originali: parseInt(utentiCount.rows[0].total),
          users_finali: parseInt(finalUsersCount.rows[0].total),
          nuove_righe: insertResult.rowCount,
          righe_aggiornate: updateResult.rowCount,
          tabella_utenti_eliminata: true
        }
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ DEBUG: Errore durante migrazione, rollback eseguito:', error);
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ Errore durante migrazione completa:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Errore durante migrazione',
      details: error.message
    });
  }
});

// Endpoint per ripristinare la tabella utenti
app.post('/api/debug/restore-utenti', async (req, res) => {
  try {
    console.log('🔄 DEBUG: Ripristino tabella utenti');
    
    // 1. Crea la tabella utenti con la struttura originale
    await pool.query(`
      CREATE TABLE IF NOT EXISTS utenti (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        nome VARCHAR(255),
        cognome VARCHAR(255),
        password_hash VARCHAR(255),
        ruolo VARCHAR(100) DEFAULT 'Elettore',
        status VARCHAR(100) DEFAULT 'pending',
        avatar_config TEXT,
        regione VARCHAR(255),
        provincia VARCHAR(255),
        comune VARCHAR(255),
        data_nascita DATE,
        genere VARCHAR(50),
        cittadinanza VARCHAR(255),
        paese_residenza VARCHAR(255),
        paese_elezione VARCHAR(255),
        paese_candidatura VARCHAR(255),
        grado_elezione VARCHAR(100),
        grado_candidatura VARCHAR(100),
        energia_nucleare BOOLEAN,
        sperimentazione_animale BOOLEAN,
        legalizzazione_canapa BOOLEAN,
        caccia BOOLEAN,
        cittadina_animale BOOLEAN,
        nato BOOLEAN,
        matrimonio_gay BOOLEAN,
        salario_minimo BOOLEAN,
        carne_coltivata BOOLEAN,
        case_chiuse BOOLEAN,
        eutanasia BOOLEAN,
        omobitransfobia BOOLEAN,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ DEBUG: Tabella utenti creata');
    
    // 2. Copia tutti i dati da users a utenti
    const copyResult = await pool.query(`
      INSERT INTO utenti (
        id, email, nome, cognome, password_hash, ruolo, status, avatar_config,
        regione, provincia, comune, data_nascita, genere, cittadinanza,
        paese_residenza, paese_elezione, paese_candidatura, grado_elezione, grado_candidatura,
        energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia,
        cittadina_animale, nato, matrimonio_gay, salario_minimo, carne_coltivata,
        case_chiuse, eutanasia, omobitransfobia, created_at, updated_at
      )
      SELECT 
        id, email, nome, cognome, password_hash, ruolo, status, avatar_config,
        regione, provincia, comune, data_nascita, genere, cittadinanza,
        paese_residenza, paese_elezione, paese_candidatura, grado_elezione, grado_candidatura,
        energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia,
        cittadina_animale, nato, matrimonio_gay, salario_minimo, carne_coltivata,
        case_chiuse, eutanasia, omobitransfobia, created_at, updated_at
      FROM users
    `);
    
    console.log('✅ DEBUG: Dati copiati da users a utenti:', copyResult.rowCount);
    
    // 3. Verifica finale
    const utentiCount = await pool.query('SELECT COUNT(*) as total FROM utenti');
    const usersCount = await pool.query('SELECT COUNT(*) as total FROM users');
    
    console.log('✅ DEBUG: Ripristino completato');

    res.json({
      success: true,
      message: 'Tabella utenti ripristinata con successo',
      data: {
        utenti_ripristinati: parseInt(utentiCount.rows[0].total),
        users_total: parseInt(usersCount.rows[0].total),
        dati_copiati: copyResult.rowCount
      }
    });
    
  } catch (error) {
    console.error('❌ Errore durante ripristino utenti:', error);
    res.status(500).json({
      success: false,
      error: 'Errore durante ripristino',
      details: error.message
    });
  }
});

// Endpoint di debug semplificato per verificare lo stato dopo migrazione
app.get('/api/debug/status', async (req, res) => {
  try {
    console.log('🔍 DEBUG: Verifica stato dopo migrazione');
    
    // 1. Verifica tabella users
    const usersCount = await pool.query('SELECT COUNT(*) as total FROM users');
    const usersTotal = parseInt(usersCount.rows[0].total);
    
    // 2. Verifica utenti per status
    const pendingCount = await pool.query("SELECT COUNT(*) as total FROM users WHERE status = 'pending'");
    const activeCount = await pool.query("SELECT COUNT(*) as total FROM users WHERE status = 'active'");
    const rejectedCount = await pool.query("SELECT COUNT(*) as total FROM users WHERE status = 'rejected'");
    
    // 3. Verifica alcune opinioni
    const opinionStats = await pool.query(`
      SELECT 
        COUNT(CASE WHEN energia_nucleare = true THEN 1 END) as energia_favorevole,
        COUNT(CASE WHEN energia_nucleare = false THEN 1 END) as energia_contrario,
        COUNT(CASE WHEN energia_nucleare IS NULL THEN 1 END) as energia_astenuto
      FROM users
    `);
    
    console.log('✅ DEBUG: Status verificato');

    res.json({
      success: true,
      message: 'Status dopo migrazione',
      data: {
        users: {
          total: usersTotal,
          pending: parseInt(pendingCount.rows[0].total),
          active: parseInt(activeCount.rows[0].total),
          rejected: parseInt(rejectedCount.rowsCount)
        },
        opinioni: {
          energia_nucleare: {
            favorevole: parseInt(opinionStats.rows[0].energia_favorevole),
            contrario: parseInt(opinionStats.rows[0].energia_contrario),
            astenuto: parseInt(opinionStats.rows[0].energia_astenuto)
          }
        }
      }
    });

  } catch (error) {
    console.error('❌ Errore durante verifica status:', error);
    res.status(500).json({
      success: false,
      error: 'Errore durante verifica',
      details: error.message
    });
  }
});

// Endpoint per migrazione semplificata da utenti a users
app.post('/api/debug/migrate-simple', async (req, res) => {
  try {
    console.log('🔄 DEBUG: Inizio migrazione semplificata');
    
    // 1. Conta righe in entrambe le tabelle
    const utentiCount = await pool.query('SELECT COUNT(*) as total FROM utenti');
    const usersCount = await pool.query('SELECT COUNT(*) as total FROM users');
    
    console.log('📊 DEBUG: Righe in utenti:', utentiCount.rows[0].total);
    console.log('📊 DEBUG: Righe in users:', usersCount.rows[0].total);
    
    // 2. Copia dati semplici (solo email e opinioni base)
    const copyResult = await pool.query(`
      INSERT INTO users (id, email, nome, cognome, ruolo, status,
                        energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia)
      SELECT 
        gen_random_uuid() as id,
        email,
        COALESCE(nome, 'Utente') as nome,
        COALESCE(cognome, 'Anonimo') as cognome,
        COALESCE(ruolo, 'Elettore') as ruolo,
        COALESCE(status, 'pending') as status,
        energia_nucleare,
        sperimentazione_animale,
        legalizzazione_canapa,
        caccia
      FROM utenti
      WHERE email NOT IN (SELECT email FROM users)
    `);
    
    console.log('✅ DEBUG: Copiate nuove righe:', copyResult.rowCount);
    
    // 3. Aggiorna opinioni esistenti
    const updateResult = await pool.query(`
      UPDATE users u
      SET 
        energia_nucleare = t.energia_nucleare,
        sperimentazione_animale = t.sperimentazione_animale,
        legalizzazione_canapa = t.legalizzazione_canapa,
        caccia = t.caccia
      FROM utenti t
      WHERE LOWER(u.email) = LOWER(t.email)
    `);
    
    console.log('✅ DEBUG: Aggiornate righe esistenti:', updateResult.rowCount);
    
    // 4. Verifica finale
    const finalUsersCount = await pool.query('SELECT COUNT(*) as total FROM users');
    
    // 5. Elimina tabella utenti
    await pool.query('DROP TABLE IF EXISTS utenti CASCADE');
    console.log('✅ DEBUG: Tabella utenti eliminata');
    
    res.json({
      success: true,
      message: 'Migrazione semplificata completata',
      data: {
        utenti_originali: parseInt(utentiCount.rows[0].total),
        users_finali: parseInt(finalUsersCount.rows[0].total),
        nuove_righe: copyResult.rowCount,
        righe_aggiornate: updateResult.rowCount
      }
    });
    
  } catch (error) {
    console.error('❌ Errore durante migrazione semplificata:', error);
    res.status(500).json({
      success: false,
      error: 'Errore durante migrazione',
      details: error.message
    });
  }
});

// Endpoint di debug per verificare la tabella utenti
app.get('/api/debug/utenti-table', async (req, res) => {
  try {
    console.log('🔍 DEBUG: Inizio endpoint /api/debug/utenti-table (pubblico)');
    
    // 1. Verifica tabella utenti in Neon
    console.log('📊 DEBUG: Verifica tabella utenti in Neon');
    const utentiCount = await pool.query('SELECT COUNT(*) as total FROM utenti');
    const utentiTotal = parseInt(utentiCount.rows[0].total);
    
    // 2. Verifica tabella users in Neon
    console.log('📊 DEBUG: Verifica tabella users in Neon');
    const usersCount = await pool.query('SELECT COUNT(*) as total FROM users');
    const usersTotal = parseInt(usersCount.rows[0].total);
    
    // 3. Verifica colonne opinioni in utenti
    console.log('🎯 DEBUG: Verifica colonne opinioni in utenti');
    const opinionColumns = [
      'cittadina_animale', 'nato', 'sperimentazione_animale', 'matrimonio_gay',
      'salario_minimo', 'carne_coltivata', 'case_chiuse', 'energia_nucleare',
      'legalizzazione_canapa', 'caccia', 'eutanasia', 'omobitransfobia'
    ];
    
    const utentiOpinions = {};
    for (const column of opinionColumns) {
      try {
        const result = await pool.query(`
          SELECT 
            COUNT(CASE WHEN ${column} = true THEN 1 END) as favorevole,
            COUNT(CASE WHEN ${column} = false THEN 1 END) as contrario,
            COUNT(CASE WHEN ${column} IS NULL THEN 1 END) as astenuto
          FROM utenti
        `);
        
        const row = result.rows[0];
        utentiOpinions[column] = {
          favorevole: parseInt(row.favorevole) || 0,
          contrario: parseInt(row.contrario) || 0,
          astenuto: parseInt(row.astenuto) || 0
        };
      } catch (error) {
        utentiOpinions[column] = { error: error.message };
      }
    }
    
    // 4. Verifica colonne opinioni in users
    console.log('🎯 DEBUG: Verifica colonne opinioni in users');
    const usersOpinions = {};
    for (const column of opinionColumns) {
      try {
        const result = await pool.query(`
          SELECT 
            COUNT(CASE WHEN ${column} = true THEN 1 END) as favorevole,
            COUNT(CASE WHEN ${column} = false THEN 1 END) as contrario,
            COUNT(CASE WHEN ${column} IS NULL THEN 1 END) as astenuto
          FROM users
        `);
        
        const row = result.rows[0];
        usersOpinions[column] = {
          favorevole: parseInt(row.favorevole) || 0,
          contrario: parseInt(row.contrario) || 0,
          astenuto: parseInt(row.astenuto) || 0
        };
      } catch (error) {
        usersOpinions[column] = { error: error.message };
      }
    }
    
    // 5. Verifica connessione Firestore
    console.log('🔥 DEBUG: Verifica connessione Firestore');
    let firestoreStatus = 'Non configurato';
    let firestoreData = null;
    
    try {
      // Verifica se le variabili Firestore sono configurate
      if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
        firestoreStatus = 'Configurato';
        
        // Per ora non facciamo query dirette a Firestore
        // ma verifichiamo che le credenziali siano presenti
        firestoreData = {
          projectId: process.env.FIREBASE_PROJECT_ID,
          hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
          hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL
        };
      }
    } catch (error) {
      firestoreStatus = `Errore: ${error.message}`;
    }

    console.log('✅ DEBUG: Debug completato');

    res.json({
      success: true,
      neon: {
        utenti: {
          total: utentiTotal,
          opinioni: utentiOpinions
        },
        users: {
          total: usersTotal,
          opinioni: usersOpinions
        }
      },
      firestore: {
        status: firestoreStatus,
        config: firestoreData
      },
      message: 'Debug completo - verifica entrambe le tabelle e Firestore'
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

