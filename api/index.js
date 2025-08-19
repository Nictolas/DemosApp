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

// Endpoint per ottenere la lista delle opinioni
app.get('/api/opinioni-list', async (req, res) => {
  try {
    console.log('📋 DEBUG: Richiesta lista opinioni');
    
    const result = await pool.query('SELECT * FROM opinioni ORDER BY created_at DESC');
    
    console.log('✅ DEBUG: Trovate', result.rows.length, 'opinioni');
    
    res.json({
      success: true,
      data: result.rows
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare lista opinioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare lista opinioni'
    });
  }
});

// Endpoint per ottenere le opinioni di un utente specifico
app.get('/api/opinioni/utente', verifyToken, async (req, res) => {
  try {
    console.log('👤 DEBUG: Richiesta opinioni utente:', req.user.userId);
    
    if (!req.user.userId) {
      console.error('❌ DEBUG: userId mancante nel token');
      return res.status(400).json({
        success: false,
        error: 'Token non valido: userId mancante'
      });
    }
    
    // 1. Ottieni le domande dalla tabella opinioni
    console.log('📋 DEBUG: Recupero domande dalla tabella opinioni');
    const questionsResult = await pool.query('SELECT * FROM opinioni ORDER BY created_at DESC');
    const questions = questionsResult.rows;
    console.log('✅ DEBUG: Trovate', questions.length, 'domande');
    
    // 2. Ottieni le risposte dell'utente dalla tabella users
    console.log('👤 DEBUG: Recupero risposte utente dalla tabella users');
    let userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.userId]);
    
    if (userResult.rows.length === 0) {
      console.log('🔍 DEBUG: Utente non trovato in users, provo utenti');
      // Se non trova in users, prova in utenti
      userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.userId]);
    }
    
    if (userResult.rows.length === 0) {
      console.log('❌ DEBUG: Utente non trovato in nessuna tabella');
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const userData = userResult.rows[0];
    console.log('✅ DEBUG: Trovati dati utente');
    
    // 3. Prepara le risposte dell'utente
    const userAnswers = {};
    
    // Mappa le colonne boolean alle risposte
    const opinionFields = [
      'energia_nucleare', 'sperimentazione_animale', 'legalizzazione_canapa',
      'caccia', 'cittadina_animale', 'nato', 'matrimonio_gay', 'salario_minimo',
      'carne_coltivata', 'case_chiuse', 'eutanasia', 'omobitransfobia'
    ];
    
    opinionFields.forEach(field => {
      if (userData[field] === true) {
        userAnswers[field] = 'Favorevole';
      } else if (userData[field] === false) {
        userAnswers[field] = 'Contrario';
      } else {
        userAnswers[field] = 'Indeciso'; // null diventa "Indeciso" per leggerezza
      }
    });
    
    console.log('✅ DEBUG: Preparate risposte utente per', Object.keys(userAnswers).length, 'campi');
    
    // 4. Prepara la risposta finale
    const responseData = {
      questions: questions.map(q => ({
        id: q.id,
        text: q.domanda || q.testo || q.text || q.id
      })),
      userAnswers: userAnswers,
      blocco: {
        isBlocked: false, // Per ora sempre false
        unlockDate: null
      }
    };
    
    console.log('✅ DEBUG: Risposta preparata con', responseData.questions.length, 'domande e', Object.keys(responseData.userAnswers).length, 'risposte');
    
    res.json({
      success: true,
      data: responseData
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare opinioni utente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare opinioni utente'
    });
  }
});

// Endpoint per ottenere i rappresentanti
app.get('/api/rappresentanti', verifyToken, async (req, res) => {
  try {
    console.log('🏛️ DEBUG: Richiesta rappresentanti per utente:', req.user.userId);
    
    if (!req.user.userId) {
      console.error('❌ DEBUG: userId mancante nel token');
      return res.status(400).json({
        success: false,
        error: 'Token non valido: userId mancante'
      });
    }
    
    // Per ora restituisce un array vuoto (da implementare la logica completa)
    res.json({
      success: true,
      data: []
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare rappresentanti:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare rappresentanti'
    });
  }
});

// Endpoint per ottenere tutti gli utenti (Gestisci Utenti)
app.get('/api/utenti', verifyToken, async (req, res) => {
  try {
    console.log('👥 DEBUG: Richiesta lista utenti');
    
    // Verifica che l'utente sia Admin usando la funzione corretta
    const admin = await isRequesterAdmin(req.user.userId);
    if (!admin) {
      console.log('❌ DEBUG: Accesso negato - utente non admin');
      return res.status(403).json({
        success: false,
        error: 'Accesso negato: solo Admin'
      });
    }
    
    // Prima prova a prendere da utenti
    let result = await pool.query('SELECT id, email, nome, cognome, ruolo, status, created_at FROM utenti ORDER BY created_at DESC');
    
    if (result.rows.length === 0) {
      console.log('🔍 DEBUG: Tabella utenti vuota, provo users');
      // Se utenti è vuoto, prova users
      result = await pool.query('SELECT id, email, nome, cognome, ruolo, status, created_at FROM users ORDER BY created_at DESC');
    }
    
    console.log('✅ DEBUG: Trovati', result.rows.length, 'utenti');
    
    res.json({
      success: true,
      data: result.rows
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare lista utenti:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare lista utenti'
    });
  }
});

// Endpoint per ottenere le opinioni ufficiali (Gestisci Opinioni)
app.get('/api/opinioni', verifyToken, async (req, res) => {
  try {
    console.log('📊 DEBUG: Richiesta opinioni ufficiali');
    
    // Verifica che l'utente sia Admin usando la funzione corretta
    const admin = await isRequesterAdmin(req.user.userId);
    if (!admin) {
      console.log('❌ DEBUG: Accesso negato - utente non admin');
      return res.status(403).json({
        success: false,
        error: 'Accesso negato: solo Admin'
      });
    }
    
    const result = await pool.query('SELECT * FROM opinioni ORDER BY created_at DESC');
    
    console.log('✅ DEBUG: Trovate', result.rows.length, 'opinioni ufficiali');
    
    res.json({
      success: true,
      data: result.rows
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare opinioni ufficiali:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare opinioni ufficiali'
    });
  }
});

// Endpoint per ottenere le opinioni proposte dagli utenti (Gestisci Opinioni)
app.get('/api/opinioni-proposte', verifyToken, async (req, res) => {
  try {
    console.log('💡 DEBUG: Richiesta opinioni proposte');
    
    // Verifica che l'utente sia Admin usando la funzione corretta
    const admin = await isRequesterAdmin(req.user.userId);
    if (!admin) {
      console.log('❌ DEBUG: Accesso negato - utente non admin');
      return res.status(403).json({
        success: false,
        error: 'Accesso negato: solo Admin'
      });
    }
    
    // Per ora restituisce un array vuoto (da implementare la logica completa)
    res.json({
      success: true,
      data: []
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare opinioni proposte:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare opinioni proposte'
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
    console.log('🔄 DEBUG: Ripristino tabella utenti da Firestore');
    
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
    
    // 2. Prendi tutti i dati da Firestore
    const firestore = admin.firestore();
    const utentiSnapshot = await firestore.collection('utenti').get();
    
    if (utentiSnapshot.empty) {
      throw new Error('Nessun utente trovato in Firestore');
    }
    
    console.log('✅ DEBUG: Trovati', utentiSnapshot.size, 'utenti in Firestore');
    
    // 3. Inserisci ogni utente da Firestore a Neon
    let inseriti = 0;
    let errori = 0;
    
    for (const doc of utentiSnapshot.docs) {
      try {
        const utente = doc.data();
        
        // Prepara i dati per l'inserimento
        const utenteData = {
          id: doc.id,
          email: utente.email || '',
          nome: utente.nome || '',
          cognome: utente.cognome || '',
          password_hash: utente.password_hash || '',
          ruolo: utente.ruolo || 'Elettore',
          status: utente.status || 'pending',
          avatar_config: utente.avatar_config ? JSON.stringify(utente.avatar_config) : null,
          regione: utente.regione || null,
          provincia: utente.provincia || null,
          comune: utente.comune || null,
          data_nascita: utente.data_nascita ? new Date(utente.data_nascita) : null,
          genere: utente.genere || null,
          cittadinanza: utente.cittadinanza || null,
          paese_residenza: utente.paese_residenza || null,
          paese_elezione: utente.paese_elezione || null,
          paese_candidatura: utente.paese_candidatura || null,
          grado_elezione: utente.grado_elezione || null,
          grado_candidatura: utente.grado_candidatura || null,
          energia_nucleare: utente.energia_nucleare || null,
          sperimentazione_animale: utente.sperimentazione_animale || null,
          legalizzazione_canapa: utente.legalizzazione_canapa || null,
          caccia: utente.caccia || null,
          cittadina_animale: utente.cittadina_animale || null,
          nato: utente.nato || null,
          matrimonio_gay: utente.matrimonio_gay || null,
          salario_minimo: utente.salario_minimo || null,
          carne_coltivata: utente.carne_coltivata || null,
          case_chiuse: utente.case_chiuse || null,
          eutanasia: utente.eutanasia || null,
          omobitransfobia: utente.omobitransfobia || null,
          created_at: utente.created_at ? new Date(utente.created_at) : new Date(),
          updated_at: utente.updated_at ? new Date(utente.updated_at) : new Date()
        };
        
        // Inserisci in Neon
        await pool.query(`
          INSERT INTO utenti (
            id, email, nome, cognome, password_hash, ruolo, status, avatar_config,
            regione, provincia, comune, data_nascita, genere, cittadinanza,
            paese_residenza, paese_elezione, paese_candidatura, grado_elezione, grado_candidatura,
            energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia,
            cittadina_animale, nato, matrimonio_gay, salario_minimo, carne_coltivata,
            case_chiuse, eutanasia, omobitransfobia, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33)
          ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email, nome = EXCLUDED.nome, cognome = EXCLUDED.cognome,
            password_hash = EXCLUDED.password_hash, ruolo = EXCLUDED.ruolo, status = EXCLUDED.status,
            avatar_config = EXCLUDED.avatar_config, regione = EXCLUDED.regione, provincia = EXCLUDED.provincia,
            comune = EXCLUDED.comune, data_nascita = EXCLUDED.data_nascita, genere = EXCLUDED.genere,
            cittadinanza = EXCLUDED.cittadinanza, paese_residenza = EXCLUDED.paese_residenza,
            paese_elezione = EXCLUDED.paese_elezione, paese_candidatura = EXCLUDED.paese_candidatura,
            grado_elezione = EXCLUDED.grado_elezione, grado_candidatura = EXCLUDED.grado_candidatura,
            energia_nucleare = EXCLUDED.energia_nucleare, sperimentazione_animale = EXCLUDED.sperimentazione_animale,
            legalizzazione_canapa = EXCLUDED.legalizzazione_canapa, caccia = EXCLUDED.caccia,
            cittadina_animale = EXCLUDED.cittadina_animale, nato = EXCLUDED.nato,
            matrimonio_gay = EXCLUDED.matrimonio_gay, salario_minimo = EXCLUDED.salario_minimo,
            carne_coltivata = EXCLUDED.carne_coltivata, case_chiuse = EXCLUDED.case_chiuse,
            eutanasia = EXCLUDED.eutanasia, omobitransfobia = EXCLUDED.omobitransfobia,
            updated_at = CURRENT_TIMESTAMP
        `, [
          utenteData.id, utenteData.email, utenteData.nome, utenteData.cognome,
          utenteData.password_hash, utenteData.ruolo, utenteData.status, utenteData.avatar_config,
          utenteData.regione, utenteData.provincia, utenteData.comune, utenteData.data_nascita,
          utenteData.genere, utenteData.cittadinanza, utenteData.paese_residenza,
          utenteData.paese_elezione, utenteData.paese_candidatura, utenteData.grado_elezione,
          utenteData.grado_candidatura, utenteData.energia_nucleare, utenteData.sperimentazione_animale,
          utenteData.legalizzazione_canapa, utenteData.caccia, utenteData.cittadina_animale,
          utenteData.nato, utenteData.matrimonio_gay, utenteData.salario_minimo,
          utenteData.carne_coltivata, utenteData.case_chiuse, utenteData.eutanasia,
          utenteData.omobitransfobia, utenteData.created_at, utenteData.updated_at
        ]);
        
        inseriti++;
        
      } catch (error) {
        console.error('❌ Errore inserimento utente', doc.id, ':', error.message);
        errori++;
      }
    }
    
    // 4. Verifica finale
    const utentiCount = await pool.query('SELECT COUNT(*) as total FROM utenti');
    
    console.log('✅ DEBUG: Ripristino completato');

    res.json({
      success: true,
      message: 'Tabella utenti ripristinata da Firestore con successo',
      data: {
        utenti_firestore: utentiSnapshot.size,
        utenti_inseriti: inseriti,
        errori: errori,
        utenti_finali: parseInt(utentiCount.rows[0].total)
      }
    });
    
  } catch (error) {
    console.error('❌ Errore durante ripristino utenti da Firestore:', error);
    res.status(500).json({
      success: false,
      error: 'Errore durante ripristino da Firestore',
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

// Endpoint per ottenere le statistiche dei sondaggi
app.get('/api/sondaggi/stats', async (req, res) => {
  try {
    console.log('📊 DEBUG: Richiesta statistiche sondaggi');
    
    // Query per ottenere statistiche aggregate delle opinioni
    const statsQuery = `
      SELECT 
        'energia_nucleare' as question,
        COUNT(*) as total,
        COUNT(CASE WHEN energia_nucleare = true THEN 1 END) as favorevoli,
        COUNT(CASE WHEN energia_nucleare = false THEN 1 END) as contrari,
        COUNT(CASE WHEN energia_nucleare IS NULL THEN 1 END) as non_risposte
      FROM (
        SELECT energia_nucleare FROM utenti WHERE energia_nucleare IS NOT NULL
        UNION ALL
        SELECT energia_nucleare FROM users WHERE energia_nucleare IS NOT NULL
      ) combined_utenti
      
      UNION ALL
      
      SELECT 
        'sperimentazione_animale' as question,
        COUNT(*) as total,
        COUNT(CASE WHEN sperimentazione_animale = true THEN 1 END) as favorevoli,
        COUNT(CASE WHEN sperimentazione_animale = false THEN 1 END) as contrari,
        COUNT(CASE WHEN sperimentazione_animale IS NULL THEN 1 END) as non_risposte
      FROM (
        SELECT sperimentazione_animale FROM utenti WHERE sperimentazione_animale IS NOT NULL
        UNION ALL
        SELECT sperimentazione_animale FROM users WHERE sperimentazione_animale IS NOT NULL
      ) combined_utenti
      
      UNION ALL
      
      SELECT 
        'legalizzazione_canapa' as question,
        COUNT(*) as total,
        COUNT(CASE WHEN legalizzazione_canapa = true THEN 1 END) as favorevoli,
        COUNT(CASE WHEN legalizzazione_canapa = false THEN 1 END) as contrari,
        COUNT(CASE WHEN legalizzazione_canapa IS NULL THEN 1 END) as non_risposte
      FROM (
        SELECT legalizzazione_canapa FROM utenti WHERE legalizzazione_canapa IS NOT NULL
        UNION ALL
        SELECT legalizzazione_canapa FROM users WHERE legalizzazione_canapa IS NOT NULL
      ) combined_utenti
      
      UNION ALL
      
      SELECT 
        'caccia' as question,
        COUNT(*) as total,
        COUNT(CASE WHEN caccia = true THEN 1 END) as favorevoli,
        COUNT(CASE WHEN caccia = false THEN 1 END) as contrari,
        COUNT(CASE WHEN caccia IS NULL THEN 1 END) as non_risposte
      FROM (
        SELECT caccia FROM utenti WHERE caccia IS NOT NULL
        UNION ALL
        SELECT caccia FROM users WHERE caccia IS NOT NULL
      ) combined_utenti
      
      UNION ALL
      
      SELECT 
        'cittadina_animale' as question,
        COUNT(*) as total,
        COUNT(CASE WHEN cittadina_animale = true THEN 1 END) as favorevoli,
        COUNT(CASE WHEN cittadina_animale = false THEN 1 END) as contrari,
        COUNT(CASE WHEN cittadina_animale IS NULL THEN 1 END) as non_risposte
      FROM (
        SELECT cittadina_animale FROM utenti WHERE cittadina_animale IS NOT NULL
        UNION ALL
        SELECT cittadina_animale FROM users WHERE cittadina_animale IS NOT NULL
      ) combined_utenti
      
      UNION ALL
      
      SELECT 
        'nato' as question,
        COUNT(*) as total,
        COUNT(CASE WHEN nato = true THEN 1 END) as favorevoli,
        COUNT(CASE WHEN nato = false THEN 1 END) as contrari,
        COUNT(CASE WHEN nato IS NULL THEN 1 END) as non_risposte
      FROM (
        SELECT nato FROM utenti WHERE nato IS NOT NULL
        UNION ALL
        SELECT nato FROM users WHERE nato IS NOT NULL
      ) combined_utenti
      
      UNION ALL
      
      SELECT 
        'matrimonio_gay' as question,
        COUNT(*) as total,
        COUNT(CASE WHEN matrimonio_gay = true THEN 1 END) as favorevoli,
        COUNT(CASE WHEN matrimonio_gay = false THEN 1 END) as contrari,
        COUNT(CASE WHEN matrimonio_gay IS NULL THEN 1 END) as non_risposte
      FROM (
        SELECT matrimonio_gay FROM utenti WHERE matrimonio_gay IS NOT NULL
        UNION ALL
        SELECT matrimonio_gay FROM users WHERE matrimonio_gay IS NOT NULL
      ) combined_utenti
      
      UNION ALL
      
      SELECT 
        'salario_minimo' as question,
        COUNT(*) as total,
        COUNT(CASE WHEN salario_minimo = true THEN 1 END) as favorevoli,
        COUNT(CASE WHEN salario_minimo = false THEN 1 END) as contrari,
        COUNT(CASE WHEN salario_minimo IS NULL THEN 1 END) as non_risposte
      FROM (
        SELECT salario_minimo FROM utenti WHERE salario_minimo IS NOT NULL
        UNION ALL
        SELECT salario_minimo FROM users WHERE salario_minimo IS NOT NULL
      ) combined_utenti
      
      UNION ALL
      
      SELECT 
        'carne_coltivata' as question,
        COUNT(*) as total,
        COUNT(CASE WHEN carne_coltivata = true THEN 1 END) as favorevoli,
        COUNT(CASE WHEN carne_coltivata = false THEN 1 END) as contrari,
        COUNT(CASE WHEN carne_coltivata IS NULL THEN 1 END) as non_risposte
      FROM (
        SELECT carne_coltivata FROM utenti WHERE carne_coltivata IS NOT NULL
        UNION ALL
        SELECT carne_coltivata FROM users WHERE carne_coltivata IS NOT NULL
      ) combined_utenti
      
      UNION ALL
      
      SELECT 
        'case_chiuse' as question,
        COUNT(*) as total,
        COUNT(CASE WHEN case_chiuse = true THEN 1 END) as favorevoli,
        COUNT(CASE WHEN case_chiuse = false THEN 1 END) as contrari,
        COUNT(CASE WHEN case_chiuse IS NULL THEN 1 END) as non_risposte
      FROM (
        SELECT case_chiuse FROM utenti WHERE case_chiuse IS NOT NULL
        UNION ALL
        SELECT case_chiuse FROM users WHERE case_chiuse IS NOT NULL
      ) combined_utenti
      
      UNION ALL
      
      SELECT 
        'eutanasia' as question,
        COUNT(*) as total,
        COUNT(CASE WHEN eutanasia = true THEN 1 END) as favorevoli,
        COUNT(CASE WHEN eutanasia = false THEN 1 END) as contrari,
        COUNT(CASE WHEN eutanasia IS NULL THEN 1 END) as non_risposte
      FROM (
        SELECT eutanasia FROM utenti WHERE eutanasia IS NOT NULL
        UNION ALL
        SELECT eutanasia FROM users WHERE eutanasia IS NOT NULL
      ) combined_utenti
      
      UNION ALL
      
      SELECT 
        'omobitransfobia' as question,
        COUNT(*) as total,
        COUNT(CASE WHEN omobitransfobia = true THEN 1 END) as favorevoli,
        COUNT(CASE WHEN omobitransfobia = false THEN 1 END) as contrari,
        COUNT(CASE WHEN omobitransfobia IS NULL THEN 1 END) as non_risposte
      FROM (
        SELECT omobitransfobia FROM utenti WHERE omobitransfobia IS NOT NULL
        UNION ALL
        SELECT omobitransfobia FROM users WHERE omobitransfobia IS NOT NULL
      ) combined_utenti
    `;
    
    const result = await pool.query(statsQuery);
    
    console.log('✅ DEBUG: Statistiche sondaggi calcolate:', result.rows.length, 'domande');
    
    // Formatta i dati per il frontend
    const stats = {};
    const questions = [];
    
    result.rows.forEach(row => {
      stats[row.question] = {
        total: parseInt(row.total) || 0,
        favorevoli: parseInt(row.favorevoli) || 0,
        contrari: parseInt(row.contrari) || 0,
        non_risposte: parseInt(row.non_risposte) || 0
      };
      
      questions.push({
        id: row.question,
        text: getOpinionQuestion(row.question)
      });
    });
    
    res.json({
      success: true,
      data: {
        stats,
        questions
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel calcolare statistiche sondaggi:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel calcolare statistiche sondaggi'
    });
  }
});

// Funzione helper per ottenere il testo della domanda
function getOpinionQuestion(questionId) {
  const questions = {
    'energia_nucleare': 'Energia Nucleare',
    'sperimentazione_animale': 'Sperimentazione Animale',
    'legalizzazione_canapa': 'Legalizzazione Canapa',
    'caccia': 'Caccia',
    'cittadina_animale': 'Cittadinanza Animale',
    'nato': 'NATO',
    'matrimonio_gay': 'Matrimonio Gay',
    'salario_minimo': 'Salario Minimo',
    'carne_coltivata': 'Carne Coltivata',
    'case_chiuse': 'Case Chiuse',
    'eutanasia': 'Eutanasia',
    'omobitransfobia': 'Omobitransfobia'
  };
  
  return questions[questionId] || questionId;
}

// Endpoint per ottenere i voti del governo
app.get('/api/governo/voti', verifyToken, async (req, res) => {
  try {
    console.log('🏛️ DEBUG: Richiesta voti governo per utente:', req.user.userId);
    
    if (!req.user.userId) {
      console.error('❌ DEBUG: userId mancante nel token');
      return res.status(400).json({
        success: false,
        error: 'Token non valido: userId mancante'
      });
    }
    
    // Per ora restituisce un array vuoto (da implementare la logica completa)
    res.json({
      success: true,
      data: []
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare voti governo:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare voti governo'
    });
  }
});

// Endpoint di debug per controllare i dati importati
app.get('/api/debug/check-data', async (req, res) => {
  try {
    console.log('🔍 DEBUG: Controllo dati importati');
    
    // 1. Controlla tabella opinioni
    const opinioniResult = await pool.query('SELECT COUNT(*) as count FROM opinioni');
    const opinioniCount = parseInt(opinioniResult.rows[0].count);
    
    // 2. Controlla tabella users
    const usersResult = await pool.query('SELECT COUNT(*) as count FROM users');
    const usersCount = parseInt(usersResult.rows[0].count);
    
    // 3. Controlla tabella utenti
    const utentiResult = await pool.query('SELECT COUNT(*) as count FROM utenti');
    const utentiCount = parseInt(utentiResult.rows[0].count);
    
    // 4. Controlla se ci sono risposte nelle opinioni
    const opinioniWithData = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN energia_nucleare IS NOT NULL THEN 1 END) as energia_nucleare_responses,
        COUNT(CASE WHEN sperimentazione_animale IS NOT NULL THEN 1 END) as sperimentazione_animale_responses,
        COUNT(CASE WHEN legalizzazione_canapa IS NOT NULL THEN 1 END) as legalizzazione_canapa_responses,
        COUNT(CASE WHEN caccia IS NOT NULL THEN 1 END) as caccia_responses
      FROM users
    `);
    
    const opinioniData = opinioniWithData.rows[0];
    
    console.log('✅ DEBUG: Controllo completato');
    
    res.json({
      success: true,
      data: {
        opinioni: {
          count: opinioniCount,
          status: opinioniCount > 0 ? 'OK' : 'VUOTA'
        },
        users: {
          count: usersCount,
          status: usersCount > 0 ? 'OK' : 'VUOTA',
          opinioni_responses: {
            total_users: parseInt(opinioniData.total_users),
            energia_nucleare: parseInt(opinioniData.energia_nucleare_responses),
            sperimentazione_animale: parseInt(opinioniData.sperimentazione_animale_responses),
            legalizzazione_canapa: parseInt(opinioniData.legalizzazione_canapa_responses),
            caccia: parseInt(opinioniData.caccia_responses)
          }
        },
        utenti: {
          count: utentiCount,
          status: utentiCount > 0 ? 'OK' : 'VUOTA'
        },
        summary: {
          needs_firestore_import: opinioniCount === 0 || usersCount === 0,
          has_opinion_responses: parseInt(opinioniData.energia_nucleare_responses) > 0
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel controllo dati:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel controllo dati',
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

