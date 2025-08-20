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

// Endpoint per richiedere reset password
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email richiesta' 
      });
    }

    console.log('🔍 DEBUG: Richiesta reset password per email:', email);

    // Verifica se l'utente esiste
    const userResult = await pool.query(
      'SELECT id, email, nome, cognome FROM users WHERE LOWER(email) = LOWER($1)',
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      // Per sicurezza, non rivelare se l'email esiste o meno
      console.log('⚠️ Tentativo reset password per email non esistente:', email);
      return res.status(200).json({
        success: true,
        message: 'Se l\'email esiste nel nostro database, riceverai un link per il reset della password'
      });
    }

    const user = userResult.rows[0];
    console.log('✅ Utente trovato per reset password:', user.email);

    // Genera token di reset (valido per 1 ora)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 ora

    // Salva il token nel database
    await pool.query(
      'UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3',
      [resetToken, resetTokenExpiry, user.id]
    );

    // Costruisci l'URL di reset
    const resetUrl = `https://www.demos.community/reset-password-confirm?token=${resetToken}`;
    
    // Invia email di reset
    const emailResult = await sendResetPasswordEmail(
      user.email, 
      resetUrl, 
      `${user.nome} ${user.cognome}`.trim() || user.email
    );

    if (emailResult.success) {
      console.log('✅ Email di reset inviata con successo a:', user.email);
      res.status(200).json({
        success: true,
        message: 'Se l\'email esiste nel nostro database, riceverai un link per il reset della password'
      });
    } else {
      console.error('❌ Errore invio email di reset:', emailResult.error);
      res.status(500).json({
        success: false,
        error: 'Errore nell\'invio dell\'email di reset'
      });
    }

  } catch (error) {
    console.error('❌ Errore forgot-password:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// Endpoint per confermare reset password
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        error: 'Token e nuova password richiesti' 
      });
    }

    console.log('🔍 DEBUG: Tentativo reset password con token');

    // Trova l'utente con il token valido
    const userResult = await pool.query(
      'SELECT id, email, reset_token_expiry FROM users WHERE reset_token = $1',
      [token]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Token di reset non valido'
      });
    }

    const user = userResult.rows[0];

    // Verifica se il token è scaduto
    if (new Date() > new Date(user.reset_token_expiry)) {
      return res.status(400).json({
        success: false,
        error: 'Token di reset scaduto'
      });
    }

    // Hash della nuova password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Aggiorna la password e rimuovi il token
    await pool.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expiry = NULL WHERE id = $2',
      [passwordHash, user.id]
    );

    console.log('✅ Password aggiornata con successo per:', user.email);

    res.status(200).json({
      success: true,
      message: 'Password aggiornata con successo'
    });

  } catch (error) {
    console.error('❌ Errore reset-password:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

app.get('/api/utenti/me', verifyToken, async (req, res) => {
  try {
    console.log('🔍 DEBUG: Richiesta /api/utenti/me per userId:', req.user.userId);
    const userId = req.user.userId;
    
    // Cerca direttamente nella tabella users (che ha tutti i campi)
    console.log('🔍 DEBUG: Eseguendo query per userId:', userId);
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    console.log('✅ DEBUG: Risultato query:', result.rows.length, 'righe trovate');

    if (result.rows.length === 0) {
      console.log('❌ DEBUG: Utente non trovato nel database');
      return res.status(404).json({ success: false, error: 'Utente non trovato' });
    }

    const user = result.rows[0];
    
    // Restituisci tutti i campi disponibili dalla tabella users
    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        nome: user.nome || '',
        cognome: user.cognome || '',
        name: `${user.nome || ''} ${user.cognome || ''}`.trim() || user.email,
        role: user.ruolo || user.role,
        status: user.status,
        // Dati personali
        data_nascita: user.data_nascita,
        genere: user.genere,
        cittadinanza: user.cittadinanza,
        // Residenza
        paese_residenza: user.paese_residenza,
        regione_residenza: user.regione_residenza,
        provincia_residenza: user.provincia_residenza,
        comune_residenza: user.comune_residenza,
        // Elezione
        paese_elezione: user.paese_elezione,
        regione_elezione: user.regione_elezione,
        provincia_elezione: user.provincia_elezione,
        comune_elezione: user.comune_elezione,
        grado_elezione: user.grado_elezione,
        // Candidatura
        paese_candidatura: user.paese_candidatura,
        regione_candidatura: user.regione_candidatura,
        provincia_candidatura: user.provincia_candidatura,
        comune_candidatura: user.comune_candidatura,
        grado_candidatura: user.grado_candidatura,
        // Opinioni
        energia_nucleare: user.energia_nucleare,
        sperimentazione_animale: user.sperimentazione_animale,
        legalizzazione_canapa: user.legalizzazione_canapa,
        caccia: user.caccia,
        cittadina_animale: user.cittadina_animale,
        nato: user.nato,
        matrimonio_gay: user.matrimonio_gay,
        salario_minimo: user.salario_minimo,
        carne_coltivata: user.carne_coltivata,
        case_chiuse: user.case_chiuse,
        eutanasia: user.eutanasia,
        omobitransfobia: user.omobitransfobia,
        // Altri campi
        avatar_config: user.avatar_config,
        created_at: user.created_at,
        updated_at: user.updated_at
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
    
    const { grado } = req.query;
    console.log('🔍 DEBUG: Filtro grado richiesto:', grado);
    
    let query = 'SELECT id, text, grado_opinione FROM opinioni';
    let params = [];
    
    if (grado) {
      query += ' WHERE grado_opinione = $1';
      params.push(grado);
    }
    
    query += ' ORDER BY id';
    
    // Ottieni le domande dalla tabella opinioni
    const result = await pool.query(query, params);
    
    console.log('✅ DEBUG: Trovate', result.rows.length, 'opinioni per grado:', grado || 'tutti');
    
    // Formatta le risposte per il frontend
    const formattedOpinions = result.rows.map(row => ({
      id: row.id,
      text: row.text || row.id, // fallback al ID se text è null
      grado_opinione: row.grado_opinione
    }));
    
    res.json({
      success: true,
      data: formattedOpinions
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
    
    // Mappa le colonne text alle risposte
    const opinionFields = [
      'energia_nucleare', 'sperimentazione_animale', 'legalizzazione_canapa',
      'caccia', 'cittadina_animale', 'nato', 'matrimonio_gay', 'salario_minimo',
      'carne_coltivata', 'case_chiuse', 'eutanasia', 'omobitransfobia'
    ];
    
    opinionFields.forEach(field => {
      const value = userData[field];
      if (value === 'Favorevole' || value === 'Contrario' || value === 'Indeciso') {
        userAnswers[field] = value;
      } else {
        // Fallback per valori boolean legacy o null
        if (value === true) {
          userAnswers[field] = 'Favorevole';
        } else if (value === false) {
          userAnswers[field] = 'Contrario';
        } else {
          userAnswers[field] = 'Indeciso';
        }
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

// Endpoint per ottenere le risposte dell'utente alle opinioni
app.get('/api/opinioni/user-answers', verifyToken, async (req, res) => {
  try {
    console.log('👤 DEBUG: Richiesta risposte opinioni utente:', req.user.userId);
    
    if (!req.user.userId) {
      return res.status(400).json({
        success: false,
        error: 'Token non valido: userId mancante'
      });
    }
    
    // Ottieni le risposte dell'utente dalla tabella users
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const userData = userResult.rows[0];
    
    // Mappa le colonne opinioni alle risposte
    const opinionFields = [
      'energia_nucleare', 'sperimentazione_animale', 'legalizzazione_canapa',
      'caccia', 'cittadina_animale', 'nato', 'matrimonio_gay', 'salario_minimo',
      'carne_coltivata', 'case_chiuse', 'eutanasia', 'omobitransfobia'
    ];
    
    const userAnswers = {};
    opinionFields.forEach(field => {
      const value = userData[field];
      if (value === 'Favorevole' || value === 'Contrario' || value === 'Indeciso') {
        userAnswers[field] = value;
      } else if (value === true) {
        userAnswers[field] = 'Favorevole';
      } else if (value === false) {
        userAnswers[field] = 'Contrario';
      } else {
        userAnswers[field] = null; // Nessuna risposta
      }
    });
    
    console.log('✅ DEBUG: Trovate risposte per', Object.keys(userAnswers).filter(k => userAnswers[k]).length, 'opinioni');
    
    res.json({
      success: true,
      data: userAnswers
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare risposte opinioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare risposte opinioni'
    });
  }
});

// Endpoint per il profilo: domande + risposte utente
app.get('/api/opinioni/profile', verifyToken, async (req, res) => {
  try {
    console.log('👤 DEBUG: Richiesta opinioni per profilo:', req.user.userId);
    
    if (!req.user.userId) {
      return res.status(400).json({
        success: false,
        error: 'Token non valido: userId mancante'
      });
    }
    
    // 1. Ottieni le domande dalla tabella opinioni
    const questionsResult = await pool.query('SELECT id, text FROM opinioni WHERE status = \'attiva\' ORDER BY created_at DESC');
    const questions = questionsResult.rows;
    
    // 2. Ottieni le risposte dell'utente dalla tabella users
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const userData = userResult.rows[0];
    
    // 3. Prepara le risposte dell'utente
    const opinionFields = [
      'energia_nucleare', 'sperimentazione_animale', 'legalizzazione_canapa',
      'caccia', 'cittadina_animale', 'nato', 'matrimonio_gay', 'salario_minimo',
      'carne_coltivata', 'case_chiuse', 'eutanasia', 'omobitransfobia'
    ];
    
    const userAnswers = {};
    opinionFields.forEach(field => {
      const value = userData[field];
      if (value === 'Favorevole' || value === 'Contrario' || value === 'Indeciso') {
        userAnswers[field] = value;
      } else if (value === true) {
        userAnswers[field] = 'Favorevole';
      } else if (value === false) {
        userAnswers[field] = 'Contrario';
      } else {
        userAnswers[field] = null;
      }
    });
    
    // 4. Restituisci sia le domande che le risposte
    res.json({
      success: true,
      data: {
        questions: questions.map(q => ({
          id: q.id,
          text: q.text || q.id
        })),
        userAnswers: userAnswers
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare opinioni per profilo:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare opinioni per profilo'
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
    
    // 1. Ottieni i rappresentanti dell'utente corrente
    console.log('🔍 DEBUG: Cercando utente con ID:', req.user.userId);
    const userResult = await pool.query(`
      SELECT 
        id, email, nome, cognome,
        rappresentante_europeo, rappresentante_camera, rappresentante_senato, 
        rappresentante_regionale, rappresentante_comune,
        candidato_europeo, candidato_camera, candidato_senato, 
        candidato_regionale, candidato_comune
      FROM users 
      WHERE id = $1
    `, [req.user.userId]);
    
    if (userResult.rows.length === 0) {
      console.log('❌ DEBUG: Utente non trovato con ID:', req.user.userId);
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const userData = userResult.rows[0];
    console.log('✅ DEBUG: Utente trovato:', { 
      id: userData.id, 
      email: userData.email, 
      nome: userData.nome,
      rappresentanti: {
        europeo: userData.rappresentante_europeo,
        regionale: userData.rappresentante_regionale
      }
    });
    
    // 2. Mappa delle categorie
    const categorie = {
      europeo: 'rappresentante_europeo',
      camera: 'rappresentante_camera', 
      senato: 'rappresentante_senato',
      regionale: 'rappresentante_regionale',
      comune: 'rappresentante_comune'
    };
    
    // 3. Costruisci la risposta
    const rappresentanti = {};
    const idMap = {};
    
    for (const [categoria, campo] of Object.entries(categorie)) {
      const rappresentanteId = userData[campo];
      console.log(`🔍 DEBUG: Categoria ${categoria}:`, rappresentanteId);
      
      if (rappresentanteId) {
        // Ottieni i dati del rappresentante
        const rappresentanteResult = await pool.query(`
          SELECT nome, cognome, avatar_config 
          FROM users 
          WHERE firestore_uid = $1 OR id::text = $1
        `, [rappresentanteId]);
        
        console.log(`🔍 DEBUG: Risultato query rappresentante ${categoria}:`, rappresentanteResult.rows.length, 'righe');
        
        if (rappresentanteResult.rows.length > 0) {
          const rappresentante = rappresentanteResult.rows[0];
          rappresentanti[categoria] = {
            nome: rappresentante.nome || 'Nome non disponibile',
            cognome: rappresentante.cognome || 'Cognome non disponibile',
            avatar_config: rappresentante.avatar_config
          };
          idMap[categoria] = rappresentanteId;
          console.log(`✅ DEBUG: Rappresentante ${categoria} aggiunto:`, rappresentanti[categoria]);
        }
      }
    }
    
    console.log('✅ DEBUG: Rappresentanti trovati:', Object.keys(rappresentanti).length);
    console.log('✅ DEBUG: Rappresentanti finali:', rappresentanti);
    console.log('✅ DEBUG: ID Map finale:', idMap);
    
    res.json({
      success: true,
      data: {
        rappresentanti,
        idMap
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare rappresentanti:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare rappresentanti'
    });
  }
});

// Endpoint per ottenere gli utenti disponibili per la selezione dei rappresentanti
app.get('/api/rappresentanti/disponibili', verifyToken, async (req, res) => {
  try {
    console.log('🔍 DEBUG: Richiesta utenti disponibili per categoria:', req.query.categoria);
    
    const { grado, categoria } = req.query;
    
    if (!categoria) {
      return res.status(400).json({
        success: false,
        error: 'Parametro categoria richiesto'
      });
    }
    
    // 1. Ottieni i dati dell'utente corrente
    const userResult = await pool.query(`
      SELECT 
        id, email, nome, cognome,
        rappresentante_europeo, rappresentante_camera, rappresentante_senato, 
        rappresentante_regionale, rappresentante_comune,
        candidato_europeo, candidato_camera, candidato_senato, 
        candidato_regionale, candidato_comune,
        regione_residenza, comune_residenza
      FROM users 
      WHERE id = $1
    `, [req.user.userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const userData = userResult.rows[0];
    
    // 2. Carica tutti gli utenti disponibili per la categoria specifica
    let candidatiQuery = '';
    let candidatiParams = [];
    
    switch (categoria) {
      case 'europeo':
        candidatiQuery = `
          SELECT 
            id, email, nome, cognome, avatar_config, ruolo, grado_elezione,
            energia_nucleare, sperimentazione_animale, legalizzazione_canapa,
            caccia, cittadina_animale, nato, matrimonio_gay, salario_minimo,
            carne_coltivata, case_chiuse, eutanasia, omobitransfobia
          FROM users 
          WHERE id != $1 
          AND ruolo IN ('Politico', 'Candidato Politico')
          AND grado_elezione = 'Europeo'
          ORDER BY nome, cognome
        `;
        candidatiParams = [req.user.userId];
        break;
        
      case 'camera':
        candidatiQuery = `
          SELECT 
            id, email, nome, cognome, avatar_config, ruolo, grado_elezione,
            energia_nucleare, sperimentazione_animale, legalizzazione_canapa,
            caccia, cittadina_animale, nato, matrimonio_gay, salario_minimo,
            carne_coltivata, case_chiuse, eutanasia, omobitransfobia
          FROM users 
          WHERE id != $1 
          AND ruolo IN ('Politico', 'Candidato Politico')
          AND grado_elezione = 'Camera'
          ORDER BY nome, cognome
        `;
        candidatiParams = [req.user.userId];
        break;
        
      case 'senato':
        candidatiQuery = `
          SELECT 
            id, email, nome, cognome, avatar_config, ruolo, grado_elezione,
            energia_nucleare, sperimentazione_animale, legalizzazione_canapa,
            caccia, cittadina_animale, nato, matrimonio_gay, salario_minimo,
            carne_coltivata, case_chiuse, eutanasia, omobitransfobia
          FROM users 
          WHERE id != $1 
          AND ruolo IN ('Politico', 'Candidato Politico')
          AND grado_elezione = 'Senato'
          ORDER BY nome, cognome
        `;
        candidatiParams = [req.user.userId];
        break;
        
      case 'regione':
        if (!userData.regione_residenza) {
          console.log('⚠️ DEBUG: Utente senza regione_residenza, impossibile filtrare per regione');
          return res.json({
            success: true,
            data: {
              candidati: [],
              utente: userData
            }
          });
        }
        candidatiQuery = `
          SELECT 
            id, email, nome, cognome, avatar_config, ruolo, grado_elezione,
            energia_nucleare, sperimentazione_animale, legalizzazione_canapa,
            caccia, cittadina_animale, nato, matrimonio_gay, salario_minimo,
            carne_coltivata, case_chiuse, eutanasia, omobitransfobia
          FROM users 
          WHERE id != $1 
          AND ruolo IN ('Politico', 'Candidato Politico')
          AND grado_elezione = 'Regionale'
          AND regione_elezione = $2
          ORDER BY nome, cognome
        `;
        candidatiParams = [req.user.userId, userData.regione_residenza];
        break;
        
      case 'comune':
        if (!userData.comune_residenza) {
          console.log('⚠️ DEBUG: Utente senza comune_residenza, impossibile filtrare per comune');
          return res.json({
            success: true,
            data: {
              candidati: [],
              utente: userData
            }
          });
        }
        candidatiQuery = `
          SELECT 
            id, email, nome, cognome, avatar_config, ruolo, grado_elezione,
            energia_nucleare, sperimentazione_animale, legalizzazione_canapa,
            caccia, cittadina_animale, nato, matrimonio_gay, salario_minimo,
            carne_coltivata, case_chiuse, eutanasia, omobitransfobia
          FROM users 
          WHERE id != $1 
          AND ruolo IN ('Politico', 'Candidato Politico')
          AND grado_elezione = 'Comunale'
          AND comune_elezione = $2
          ORDER BY nome, cognome
        `;
        candidatiParams = [req.user.userId, userData.comune_residenza];
        break;
        
      default:
        return res.status(400).json({
          success: false,
          error: 'Categoria non valida'
        });
    }
    
    const candidatiResult = await pool.query(candidatiQuery, candidatiParams);
    console.log('✅ DEBUG: Trovati', candidatiResult.rows.length, 'candidati per categoria', categoria);
    
    // 3. Calcola le opinioni comuni per ogni candidato
    const candidati = candidatiResult.rows.map(candidato => {
      const opinioniComuni = calculateOpinioniComuni(userData, candidato);
      
      return {
        id: candidato.id,
        nome: candidato.nome || 'Nome non disponibile',
        cognome: candidato.cognome || 'Cognome non disponibile',
        email: candidato.email,
        ruolo: candidato.ruolo || 'Cittadino',
        grado_elezione: candidato.grado_elezione || grado || 'Cittadino',
        opinioni_comuni: opinioniComuni,
        avatar_config: candidato.avatar_config,
        energia_nucleare: candidato.energia_nucleare,
        sperimentazione_animale: candidato.sperimentazione_animale,
        legalizzazione_canapa: candidato.legalizzazione_canapa,
        caccia: candidato.caccia,
        cittadina_animale: candidato.cittadina_animale,
        nato: candidato.nato,
        matrimonio_gay: candidato.matrimonio_gay,
        salario_minimo: candidato.salario_minimo,
        carne_coltivata: candidato.carne_coltivata,
        case_chiuse: candidato.case_chiuse,
        eutanasia: candidato.eutanasia,
        omobitransfobia: candidato.omobitransfobia
      };
    });
    
    // 4. Ordina per opinioni comuni (decrescente) e poi per nome
    candidati.sort((a, b) => {
      if (b.opinioni_comuni !== a.opinioni_comuni) {
        return b.opinioni_comuni - a.opinioni_comuni;
        return a.nome.localeCompare(b.nome);
      }
    });
    
    // 5. Prendi solo i primi 20 candidati per performance
    const candidatiLimitati = candidati.slice(0, 20);
    
    console.log('✅ DEBUG: Restituiti', candidatiLimitati.length, 'candidati ordinati');
    
    res.json({
      success: true,
      data: {
        candidati: candidatiLimitati,
        utente: userData
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare candidati:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare candidati',
      details: error.message
    });
  }
});

// Funzione helper per calcolare le opinioni comuni
function calculateOpinioniComuni(user1, user2) {
  const opinioniFields = [
    'energia_nucleare', 'sperimentazione_animale', 'legalizzazione_canapa',
    'caccia', 'cittadina_animale', 'nato', 'matrimonio_gay', 'salario_minimo',
    'carne_coltivata', 'case_chiuse', 'eutanasia', 'omobitransfobia'
  ];
  
  let opinioniComuni = 0;
  
  opinioniFields.forEach(field => {
    if (user1[field] && user2[field] && user1[field] === user2[field]) {
      opinioniComuni++;
    }
  });
  
  return opinioniComuni;
}

// Endpoint di debug per verificare se l'utente è admin
app.get('/api/debug/check-admin', verifyToken, async (req, res) => {
  try {
    console.log('🔍 DEBUG: Verifica admin per utente ID:', req.user.userId);
    
    const admin = await isRequesterAdmin(req.user.userId);
    console.log('🔍 DEBUG: Risultato verifica admin:', admin);
    
    // Ottieni anche i dati dell'utente per debug
    const userResult = await pool.query('SELECT id, email, nome, cognome, ruolo, avatar_config FROM users WHERE id = $1', [req.user.userId]);
    const userData = userResult.rows[0] || null;
    
    res.json({
      success: true,
      data: {
        isAdmin: admin,
        user: userData
      }
    });
  } catch (error) {
    console.error('❌ Errore verifica admin:', error);
    res.status(500).json({
      success: false,
      error: 'Errore verifica admin'
    });
  }
});

// Endpoint per ottenere tutti gli utenti (Gestisci Utenti)
app.get('/api/utenti', verifyToken, async (req, res) => {
  try {
    console.log('👥 DEBUG: Richiesta lista utenti da utente ID:', req.user.userId);
    
    // Verifica che l'utente sia Admin usando la funzione corretta
    const admin = await isRequesterAdmin(req.user.userId);
    console.log('🔍 DEBUG: Risultato verifica admin:', admin);
    
    if (!admin) {
      console.log('❌ DEBUG: Accesso negato - utente non admin');
      return res.status(403).json({
        success: false,
        error: 'Accesso negato: solo Admin'
      });
    }
    
    console.log('✅ DEBUG: Utente è admin, procedo con il caricamento');
    
    // Carica tutti gli utenti dalla tabella users con colonne base sicure
    const result = await pool.query(`
      SELECT * FROM users ORDER BY created_at DESC
    `);
    
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
    
    const result = await pool.query('SELECT * FROM opinioni ORDER BY id');
    
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

// Endpoint per aggiungere una nuova opinione
app.post('/api/opinioni', verifyToken, async (req, res) => {
  try {
    console.log('➕ DEBUG: Richiesta aggiunta opinione');
    
    // Verifica che l'utente sia Admin
    const admin = await isRequesterAdmin(req.user.userId);
    if (!admin) {
      return res.status(403).json({
        success: false,
        error: 'Accesso negato: solo Admin'
      });
    }
    
    const { id, text, grado_opinione } = req.body;
    
    if (!id || !text || !grado_opinione) {
      return res.status(400).json({
        success: false,
        error: 'ID, testo e grado opinione sono richiesti'
      });
    }
    
    // Verifica che il grado sia valido
    const gradiValidi = ['Europeo', 'Nazionale', 'Regionale', 'Comunale'];
    if (!gradiValidi.includes(grado_opinione)) {
      return res.status(400).json({
        success: false,
        error: 'Grado opinione non valido'
      });
    }
    
    // Inserisci la nuova opinione
    const result = await pool.query(`
      INSERT INTO opinioni (id, text, grado_opinione)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [id, text, grado_opinione]);
    
    console.log('✅ DEBUG: Opinione aggiunta:', result.rows[0]);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiungere opinione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'aggiungere opinione'
    });
  }
});

// Endpoint per modificare un'opinione
app.put('/api/opinioni/:id', verifyToken, async (req, res) => {
  try {
    console.log('✏️ DEBUG: Richiesta modifica opinione:', req.params.id);
    
    // Verifica che l'utente sia Admin
    const admin = await isRequesterAdmin(req.user.userId);
    if (!admin) {
      return res.status(403).json({
        success: false,
        error: 'Accesso negato: solo Admin'
      });
    }
    
    const { text, grado_opinione } = req.body;
    const opinionId = req.params.id;
    
    if (!text || !grado_opinione) {
      return res.status(400).json({
        success: false,
        error: 'Testo e grado opinione sono richiesti'
      });
    }
    
    // Verifica che il grado sia valido
    const gradiValidi = ['Europeo', 'Nazionale', 'Regionale', 'Comunale'];
    if (!gradiValidi.includes(grado_opinione)) {
      return res.status(400).json({
        success: false,
        error: 'Grado opinione non valido'
      });
    }
    
    // Aggiorna l'opinione
    const result = await pool.query(`
      UPDATE opinioni 
      SET text = $1, grado_opinione = $2
      WHERE id = $3
      RETURNING *
    `, [text, grado_opinione, opinionId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Opinione non trovata'
      });
    }
    
    console.log('✅ DEBUG: Opinione modificata:', result.rows[0]);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('❌ Errore nella modifica opinione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella modifica opinione'
    });
  }
});

// Endpoint per eliminare un'opinione
app.delete('/api/opinioni/:id', verifyToken, async (req, res) => {
  try {
    console.log('🗑️ DEBUG: Richiesta eliminazione opinione:', req.params.id);
    
    // Verifica che l'utente sia Admin
    const admin = await isRequesterAdmin(req.user.userId);
    if (!admin) {
      return res.status(403).json({
        success: false,
        error: 'Accesso negato: solo Admin'
      });
    }
    
    const opinionId = req.params.id;
    
    // Elimina l'opinione
    const result = await pool.query(`
      DELETE FROM opinioni 
      WHERE id = $1
      RETURNING *
    `, [opinionId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Opinione non trovata'
      });
    }
    
    console.log('✅ DEBUG: Opinione eliminata:', result.rows[0]);
    
    res.json({
      success: true,
      message: 'Opinione eliminata con successo'
    });
    
  } catch (error) {
    console.error('❌ Errore nell\'eliminazione opinione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'eliminazione opinione'
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
    
    // 1. Crea la tabella utenti con la struttura TEXT per le opinioni
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
        energia_nucleare TEXT,
        sperimentazione_animale TEXT,
        legalizzazione_canapa TEXT,
        caccia TEXT,
        cittadina_animale TEXT,
        nato TEXT,
        matrimonio_gay TEXT,
        salario_minimo TEXT,
        carne_coltivata TEXT,
        case_chiuse TEXT,
        eutanasia TEXT,
        omobitransfobia TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ DEBUG: Tabella utenti creata con colonne TEXT');
    
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
        
        // Funzione per convertire i valori delle opinioni
        const convertOpinionValue = (value) => {
          if (value === true) return 'Favorevole';
          if (value === false) return 'Contrario';
          if (value === 'Indeciso' || value === 'indeciso') return 'Indeciso';
          if (value === 'Favorevole' || value === 'favorevole') return 'Favorevole';
          if (value === 'Contrario' || value === 'contrario') return 'Contrario';
          return 'Indeciso'; // Default per valori null/undefined
        };
        
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
          energia_nucleare: convertOpinionValue(utente.energia_nucleare),
          sperimentazione_animale: convertOpinionValue(utente.sperimentazione_animale),
          legalizzazione_canapa: convertOpinionValue(utente.legalizzazione_canapa),
          caccia: convertOpinionValue(utente.caccia),
          cittadina_animale: convertOpinionValue(utente.cittadina_animale),
          nato: convertOpinionValue(utente.nato),
          matrimonio_gay: convertOpinionValue(utente.matrimonio_gay),
          salario_minimo: convertOpinionValue(utente.salario_minimo),
          carne_coltivata: convertOpinionValue(utente.carne_coltivata),
          case_chiuse: convertOpinionValue(utente.case_chiuse),
          eutanasia: convertOpinionValue(utente.eutanasia),
          omobitransfobia: convertOpinionValue(utente.omobitransfobia),
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

// Endpoint di debug per controllare la struttura delle colonne opinioni
app.get('/api/debug/check-columns', async (req, res) => {
  try {
    console.log('🔍 DEBUG: Controllo struttura colonne opinioni');
    
    // Controlla struttura tabella users
    const usersColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN (
        'energia_nucleare', 'sperimentazione_animale', 'legalizzazione_canapa',
        'caccia', 'cittadina_animale', 'nato', 'matrimonio_gay', 'salario_minimo',
        'carne_coltivata', 'case_chiuse', 'eutanasia', 'omobitransfobia'
      )
      ORDER BY column_name
    `);
    
    // Controlla struttura tabella utenti
    const utentiColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'utenti' 
      AND column_name IN (
        'energia_nucleare', 'sperimentazione_animale', 'legalizzazione_canapa',
        'caccia', 'cittadina_animale', 'nato', 'matrimonio_gay', 'salario_minimo',
        'carne_coltivata', 'case_chiuse', 'eutanasia', 'omobitransfobia'
      )
      ORDER BY column_name
    `);
    
    console.log('✅ DEBUG: Controllo struttura completato');
    
    res.json({
      success: true,
      data: {
        users: usersColumns.rows,
        utenti: utentiColumns.rows,
        summary: {
          users_boolean_count: usersColumns.rows.filter(c => c.data_type === 'boolean').length,
          utenti_boolean_count: utentiColumns.rows.filter(c => c.data_type === 'boolean').length,
          needs_text_conversion: usersColumns.rows.some(c => c.data_type === 'boolean') || utentiColumns.rows.some(c => c.data_type === 'boolean')
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel controllo struttura:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel controllo struttura',
      details: error.message
    });
  }
});

// Endpoint per convertire le colonne opinioni da boolean a text
app.post('/api/debug/convert-opinion-columns', async (req, res) => {
  try {
    console.log('🔄 DEBUG: Conversione colonne opinioni da boolean a text');
    
    const opinionFields = [
      'energia_nucleare', 'sperimentazione_animale', 'legalizzazione_canapa',
      'caccia', 'cittadina_animale', 'nato', 'matrimonio_gay', 'salario_minimo',
      'carne_coltivata', 'case_chiuse', 'eutanasia', 'omobitransfobia'
    ];
    
    // 1. Converti tabella users
    console.log('📊 DEBUG: Conversione tabella users');
    for (const field of opinionFields) {
      // Controlla se la colonna è boolean
      const columnCheck = await pool.query(`
        SELECT data_type FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = $1
      `, [field]);
      
      if (columnCheck.rows.length > 0 && columnCheck.rows[0].data_type === 'boolean') {
        console.log(`🔄 DEBUG: Conversione colonna ${field} in users`);
        
        // Aggiungi colonna temporanea
        await pool.query(`ALTER TABLE users ADD COLUMN ${field}_temp TEXT`);
        
        // Copia dati convertiti
        await pool.query(`
          UPDATE users SET ${field}_temp = 
            CASE 
              WHEN ${field} = true THEN 'Favorevole'
              WHEN ${field} = false THEN 'Contrario'
              ELSE 'Indeciso'
            END
        `);
        
        // Rimuovi colonna boolean
        await pool.query(`ALTER TABLE users DROP COLUMN ${field}`);
        
        // Rinomina colonna temporanea
        await pool.query(`ALTER TABLE users RENAME COLUMN ${field}_temp TO ${field}`);
        
        console.log(`✅ DEBUG: Colonna ${field} convertita in users`);
      }
    }
    
    // 2. Converti tabella utenti
    console.log('📊 DEBUG: Conversione tabella utenti');
    for (const field of opinionFields) {
      // Controlla se la colonna è boolean
      const columnCheck = await pool.query(`
        SELECT data_type FROM information_schema.columns 
        WHERE table_name = 'utenti' AND column_name = $1
      `, [field]);
      
      if (columnCheck.rows.length > 0 && columnCheck.rows[0].data_type === 'boolean') {
        console.log(`🔄 DEBUG: Conversione colonna ${field} in utenti`);
        
        // Aggiungi colonna temporanea
        await pool.query(`ALTER TABLE utenti ADD COLUMN ${field}_temp TEXT`);
        
        // Copia dati convertiti
        await pool.query(`
          UPDATE utenti SET ${field}_temp = 
            CASE 
              WHEN ${field} = true THEN 'Favorevole'
              WHEN ${field} = false THEN 'Contrario'
              ELSE 'Indeciso'
            END
        `);
        
        // Rimuovi colonna boolean
        await pool.query(`ALTER TABLE utenti DROP COLUMN ${field}`);
        
        // Rinomina colonna temporanea
        await pool.query(`ALTER TABLE utenti RENAME COLUMN ${field}_temp TO ${field}`);
        
        console.log(`✅ DEBUG: Colonna ${field} convertita in utenti`);
      }
    }
    
    console.log('✅ DEBUG: Conversione completata');
    
    res.json({
      success: true,
      message: 'Colonne opinioni convertite da boolean a text',
      data: {
        converted_fields: opinionFields,
        tables: ['users', 'utenti']
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nella conversione colonne:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella conversione colonne',
      details: error.message
    });
  }
});

// Endpoint per salvare le opinioni dell'utente
app.post('/api/opinioni/salva', verifyToken, async (req, res) => {
  try {
    console.log('💾 DEBUG: Salvataggio opinioni utente:', req.user.userId);
    
    if (!req.user.userId) {
      console.error('❌ DEBUG: userId mancante nel token');
      return res.status(400).json({
        success: false,
        error: 'Token non valido: userId mancante'
      });
    }
    
    const { opinions } = req.body;
    
    if (!opinions || typeof opinions !== 'object') {
      console.error('❌ DEBUG: Dati opinioni non validi');
      return res.status(400).json({
        success: false,
        error: 'Dati opinioni non validi'
      });
    }
    
    console.log('📊 DEBUG: Opinion da salvare:', Object.keys(opinions).length);
    
    // Prepara la query di aggiornamento
    const opinionFields = [
      'energia_nucleare', 'sperimentazione_animale', 'legalizzazione_canapa',
      'caccia', 'cittadina_animale', 'nato', 'matrimonio_gay', 'salario_minimo',
      'carne_coltivata', 'case_chiuse', 'eutanasia', 'omobitransfobia'
    ];
    
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;
    
    opinionFields.forEach(field => {
      if (opinions[field] && ['Favorevole', 'Contrario', 'Indeciso'].includes(opinions[field])) {
        updateFields.push(`${field} = $${paramIndex}`);
        updateValues.push(opinions[field]);
        paramIndex++;
      }
    });
    
    if (updateFields.length === 0) {
      console.error('❌ DEBUG: Nessuna opinione valida da salvare');
      return res.status(400).json({
        success: false,
        error: 'Nessuna opinione valida da salvare'
      });
    }
    
    // Aggiungi userId come ultimo parametro
    updateValues.push(req.user.userId);
    
    // Prima prova a salvare in users
    let result = await pool.query(`
      UPDATE users 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex}
      RETURNING id
    `, updateValues);
    
    if (result.rowCount === 0) {
      console.log('🔍 DEBUG: Utente non trovato in users, provo utenti');
      // Se non trova in users, prova in utenti
      result = await pool.query(`
        UPDATE utenti 
        SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramIndex}
        RETURNING id
      `, updateValues);
    }
    
    if (result.rowCount === 0) {
      console.error('❌ DEBUG: Utente non trovato in nessuna tabella');
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    console.log('✅ DEBUG: Opinion salvate con successo');
    
    res.json({
      success: true,
      message: 'Opinioni salvate con successo',
      data: {
        updated_fields: updateFields.length,
        user_id: req.user.userId
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel salvataggio opinioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel salvataggio opinioni',
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



// Endpoint per aggiornare la tabella users con i dati da Firestore
app.post('/api/debug/update-users-from-firestore', async (req, res) => {
  try {
    console.log('🔄 DEBUG: Aggiornamento tabella users da Firestore');
    
    // 1. Prendi tutti i dati da Firestore
    const firestore = admin.firestore();
    const utentiSnapshot = await firestore.collection('utenti').get();
    
    if (utentiSnapshot.empty) {
      throw new Error('Nessun utente trovato in Firestore');
    }
    
    console.log('✅ DEBUG: Trovati', utentiSnapshot.size, 'utenti in Firestore');
    
    // 2. Aggiorna ogni utente nella tabella users
    let aggiornati = 0;
    let errori = 0;
    
    for (const doc of utentiSnapshot.docs) {
      try {
        const utente = doc.data();
        
        // Funzione per convertire i valori delle opinioni
        const convertOpinionValue = (value) => {
          if (value === true) return 'Favorevole';
          if (value === false) return 'Contrario';
          if (value === 'Indeciso' || value === 'indeciso') return 'Indeciso';
          if (value === 'Favorevole' || value === 'favorevole') return 'Favorevole';
          if (value === 'Contrario' || value === 'contrario') return 'Contrario';
          return 'Indeciso'; // Default per valori null/undefined
        };
        
        // Aggiorna l'utente nella tabella users
        const result = await pool.query(`
          UPDATE users SET
            energia_nucleare = $1,
            sperimentazione_animale = $2,
            legalizzazione_canapa = $3,
            caccia = $4,
            cittadina_animale = $5,
            nato = $6,
            matrimonio_gay = $7,
            salario_minimo = $8,
            carne_coltivata = $9,
            case_chiuse = $10,
            eutanasia = $11,
            omobitransfobia = $12,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $13
        `, [
          convertOpinionValue(utente.energia_nucleare),
          convertOpinionValue(utente.sperimentazione_animale),
          convertOpinionValue(utente.legalizzazione_canapa),
          convertOpinionValue(utente.caccia),
          convertOpinionValue(utente.cittadina_animale),
          convertOpinionValue(utente.nato),
          convertOpinionValue(utente.matrimonio_gay),
          convertOpinionValue(utente.salario_minimo),
          convertOpinionValue(utente.carne_coltivata),
          convertOpinionValue(utente.case_chiuse),
          convertOpinionValue(utente.eutanasia),
          convertOpinionValue(utente.omobitransfobia),
          doc.id
        ]);
        
        if (result.rowCount > 0) {
          aggiornati++;
        }
        
      } catch (error) {
        console.error('❌ Errore aggiornamento utente', doc.id, ':', error.message);
        errori++;
      }
    }
    
    // 3. Verifica finale
    const usersCount = await pool.query('SELECT COUNT(*) as total FROM users');
    
    console.log('✅ DEBUG: Aggiornamento completato');

    res.json({
      success: true,
      message: 'Tabella users aggiornata da Firestore con successo',
      data: {
        utenti_firestore: utentiSnapshot.size,
        utenti_aggiornati: aggiornati,
        errori: errori,
        users_total: parseInt(usersCount.rows[0].total)
      }
    });
    
  } catch (error) {
    console.error('❌ Errore durante aggiornamento users da Firestore:', error);
    res.status(500).json({
      success: false,
      error: 'Errore durante aggiornamento da Firestore',
      details: error.message
    });
  }
});

// Endpoint di debug per confrontare i dati tra tabelle
app.get('/api/debug/compare-data', async (req, res) => {
  try {
    console.log('🔍 DEBUG: Confronto dati tra tabelle');
    
    // 1. Conta utenti in users
    const usersCount = await pool.query('SELECT COUNT(*) as count FROM users');
    const usersWithOpinions = await pool.query(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE energia_nucleare IS NOT NULL 
         OR sperimentazione_animale IS NOT NULL 
         OR legalizzazione_canapa IS NOT NULL
    `);
    
    // 2. Conta utenti in utenti
    const utentiCount = await pool.query('SELECT COUNT(*) as count FROM utenti');
    const utentiWithOpinions = await pool.query(`
      SELECT COUNT(*) as count 
      FROM utenti 
      WHERE energia_nucleare IS NOT NULL 
         OR sperimentazione_animale IS NOT NULL 
         OR legalizzazione_canapa IS NOT NULL
    `);
    
    // 3. Conta utenti con dati geografici in users
    const usersWithGeo = await pool.query(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE regione IS NOT NULL 
         OR provincia IS NOT NULL 
         OR comune IS NOT NULL
    `);
    
    // 4. Conta utenti con dati geografici in utenti
    const utentiWithGeo = await pool.query(`
      SELECT COUNT(*) as count 
      FROM utenti 
      WHERE regione IS NOT NULL 
         OR provincia IS NOT NULL 
         OR comune IS NOT NULL
    `);
    
    // 5. Esempio di dati mancanti
    const missingDataExample = await pool.query(`
      SELECT u.id, u.email, u.regione, u.provincia, u.comune,
             u.energia_nucleare, u.sperimentazione_animale
      FROM utenti u
      LEFT JOIN users us ON u.id = us.id
      WHERE (u.regione IS NOT NULL OR u.energia_nucleare IS NOT NULL)
        AND (us.regione IS NULL AND us.energia_nucleare IS NULL)
      LIMIT 5
    `);
    
    console.log('✅ DEBUG: Confronto completato');
    
    res.json({
      success: true,
      data: {
        users: {
          total: parseInt(usersCount.rows[0].count),
          with_opinions: parseInt(usersWithOpinions.rows[0].count),
          with_geo: parseInt(usersWithGeo.rows[0].count)
        },
        utenti: {
          total: parseInt(utentiCount.rows[0].count),
          with_opinions: parseInt(utentiWithOpinions.rows[0].count),
          with_geo: parseInt(utentiWithGeo.rows[0].count)
        },
        missing_data_example: missingDataExample.rows,
        summary: {
          needs_sync: parseInt(utentiCount.rows[0].count) > parseInt(usersCount.rows[0].count) ||
                     parseInt(utentiWithOpinions.rows[0].count) > parseInt(usersWithOpinions.rows[0].count) ||
                     parseInt(utentiWithGeo.rows[0].count) > parseInt(usersWithGeo.rows[0].count)
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel confronto dati:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel confronto dati',
      details: error.message
    });
  }
});

// Endpoint per sincronizzazione completa della tabella users da Firestore
app.post('/api/debug/sync-users-from-firestore', async (req, res) => {
  try {
    console.log('🔄 DEBUG: Sincronizzazione completa tabella users da Firestore');
    
    // 1. Prendi tutti i dati da Firestore
    const firestore = admin.firestore();
    const utentiSnapshot = await firestore.collection('utenti').get();
    
    if (utentiSnapshot.empty) {
      throw new Error('Nessun utente trovato in Firestore');
    }
    
    console.log('✅ DEBUG: Trovati', utentiSnapshot.size, 'utenti in Firestore');
    
    // 2. Sincronizza ogni utente nella tabella users
    let inseriti = 0;
    let aggiornati = 0;
    let errori = 0;
    
    for (const doc of utentiSnapshot.docs) {
      try {
        const utente = doc.data();
        
        // Funzione per convertire i valori delle opinioni
        const convertOpinionValue = (value) => {
          if (value === true) return 'Favorevole';
          if (value === false) return 'Contrario';
          if (value === 'Indeciso' || value === 'indeciso') return 'Indeciso';
          if (value === 'Favorevole' || value === 'favorevole') return 'Favorevole';
          if (value === 'Contrario' || value === 'contrario') return 'Contrario';
          return 'Indeciso'; // Default per valori null/undefined
        };
        
        // Prepara i dati completi per l'inserimento/aggiornamento
        const userData = {
          id: doc.id,
          name: `${utente.nome || ''} ${utente.cognome || ''}`.trim() || utente.email || 'Utente',
          email: utente.email || '',
          email_verified: utente.email_verified ? new Date(utente.email_verified) : null,
          image: utente.avatar_config ? JSON.stringify(utente.avatar_config) : null,
          created_at: utente.created_at ? new Date(utente.created_at) : new Date(),
          updated_at: utente.updated_at ? new Date(utente.updated_at) : new Date(),
          // Dati aggiuntivi per la nostra app
          nome: utente.nome || '',
          cognome: utente.cognome || '',
          password_hash: utente.password_hash || '',
          ruolo: utente.ruolo || 'Elettore',
          status: utente.status || 'pending',
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
          // Opinioni (convertite)
          energia_nucleare: convertOpinionValue(utente.energia_nucleare),
          sperimentazione_animale: convertOpinionValue(utente.sperimentazione_animale),
          legalizzazione_canapa: convertOpinionValue(utente.legalizzazione_canapa),
          caccia: convertOpinionValue(utente.caccia),
          cittadina_animale: convertOpinionValue(utente.cittadina_animale),
          nato: convertOpinionValue(utente.nato),
          matrimonio_gay: convertOpinionValue(utente.matrimonio_gay),
          salario_minimo: convertOpinionValue(utente.salario_minimo),
          carne_coltivata: convertOpinionValue(utente.carne_coltivata),
          case_chiuse: convertOpinionValue(utente.case_chiuse),
          eutanasia: convertOpinionValue(utente.eutanasia),
          omobitransfobia: convertOpinionValue(utente.omobitransfobia)
        };
        
        // Inserisci o aggiorna in users con UPSERT
        const result = await pool.query(`
          INSERT INTO users (
            id, name, email, email_verified, image, created_at, updated_at,
            nome, cognome, password_hash, ruolo, status, regione, provincia, comune,
            data_nascita, genere, cittadinanza, paese_residenza, paese_elezione,
            paese_candidatura, grado_elezione, grado_candidatura,
            energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia,
            cittadina_animale, nato, matrimonio_gay, salario_minimo, carne_coltivata,
            case_chiuse, eutanasia, omobitransfobia
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name, email = EXCLUDED.email, email_verified = EXCLUDED.email_verified,
            image = EXCLUDED.image, updated_at = CURRENT_TIMESTAMP,
            nome = EXCLUDED.nome, cognome = EXCLUDED.cognome, password_hash = EXCLUDED.password_hash,
            ruolo = EXCLUDED.ruolo, status = EXCLUDED.status, regione = EXCLUDED.regione,
            provincia = EXCLUDED.provincia, comune = EXCLUDED.comune, data_nascita = EXCLUDED.data_nascita,
            genere = EXCLUDED.genere, cittadinanza = EXCLUDED.cittadinanza,
            paese_residenza = EXCLUDED.paese_residenza, paese_elezione = EXCLUDED.paese_elezione,
            paese_candidatura = EXCLUDED.paese_candidatura, grado_elezione = EXCLUDED.grado_elezione,
            grado_candidatura = EXCLUDED.grado_candidatura, energia_nucleare = EXCLUDED.energia_nucleare,
            sperimentazione_animale = EXCLUDED.sperimentazione_animale, legalizzazione_canapa = EXCLUDED.legalizzazione_canapa,
            caccia = EXCLUDED.caccia, cittadina_animale = EXCLUDED.cittadina_animale, nato = EXCLUDED.nato,
            matrimonio_gay = EXCLUDED.matrimonio_gay, salario_minimo = EXCLUDED.salario_minimo,
            carne_coltivata = EXCLUDED.carne_coltivata, case_chiuse = EXCLUDED.case_chiuse,
            eutanasia = EXCLUDED.eutanasia, omobitransfobia = EXCLUDED.omobitransfobia
        `, [
          userData.id, userData.name, userData.email, userData.email_verified,
          userData.image, userData.created_at, userData.updated_at,
          userData.nome, userData.cognome, userData.password_hash, userData.ruolo,
          userData.status, userData.regione, userData.provincia, userData.comune,
          userData.data_nascita, userData.genere, userData.cittadinanza,
          userData.paese_residenza, userData.paese_elezione, userData.paese_candidatura,
          userData.grado_elezione, userData.grado_candidatura, userData.energia_nucleare,
          userData.sperimentazione_animale, userData.legalizzazione_canapa, userData.caccia,
          userData.cittadina_animale, userData.nato, userData.matrimonio_gay,
          userData.salario_minimo, userData.carne_coltivata, userData.case_chiuse,
          userData.eutanasia, userData.omobitransfobia
        ]);
        
        if (result.rowCount > 0) {
          aggiornati++;
        } else {
          inseriti++;
        }
        
      } catch (error) {
        console.error('❌ Errore sincronizzazione utente', doc.id, ':', error.message);
        errori++;
      }
    }
    
    // 3. Verifica finale
    const usersCount = await pool.query('SELECT COUNT(*) as total FROM users');
    const usersWithOpinions = await pool.query(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE energia_nucleare IS NOT NULL 
         OR sperimentazione_animale IS NOT NULL 
         OR legalizzazione_canapa IS NOT NULL
    `);
    
    console.log('✅ DEBUG: Sincronizzazione completata');

    res.json({
      success: true,
      message: 'Tabella users sincronizzata completamente da Firestore',
      data: {
        utenti_firestore: utentiSnapshot.size,
        utenti_inseriti: inseriti,
        utenti_aggiornati: aggiornati,
        errori: errori,
        users_total: parseInt(usersCount.rows[0].total),
        users_with_opinions: parseInt(usersWithOpinions.rows[0].count)
      }
    });
    
  } catch (error) {
    console.error('❌ Errore durante sincronizzazione users da Firestore:', error);
    res.status(500).json({
      success: false,
      error: 'Errore durante sincronizzazione da Firestore',
      details: error.message
    });
  }
});

// Endpoint per convertire le colonne opinioni da boolean a text nella tabella users
app.post('/api/debug/convert-users-columns', async (req, res) => {
  try {
    console.log('🔄 DEBUG: Conversione colonne opinioni da boolean a text nella tabella users');
    
    const opinionFields = [
      'energia_nucleare', 'sperimentazione_animale', 'legalizzazione_canapa',
      'caccia', 'cittadina_animale', 'nato', 'matrimonio_gay', 'salario_minimo',
      'carne_coltivata', 'case_chiuse', 'eutanasia', 'omobitransfobia'
    ];
    
    // Converti tabella users
    console.log('📊 DEBUG: Conversione tabella users');
    for (const field of opinionFields) {
      // Controlla se la colonna è boolean
      const columnCheck = await pool.query(`
        SELECT data_type FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = $1
      `, [field]);
      
      if (columnCheck.rows.length > 0 && columnCheck.rows[0].data_type === 'boolean') {
        console.log(`🔄 DEBUG: Conversione colonna ${field} in users`);
        
        // Aggiungi colonna temporanea
        await pool.query(`ALTER TABLE users ADD COLUMN ${field}_temp TEXT`);
        
        // Copia dati convertiti
        await pool.query(`
          UPDATE users SET ${field}_temp = 
            CASE 
              WHEN ${field} = true THEN 'Favorevole'
              WHEN ${field} = false THEN 'Contrario'
              ELSE 'Indeciso'
            END
        `);
        
        // Rimuovi colonna boolean
        await pool.query(`ALTER TABLE users DROP COLUMN ${field}`);
        
        // Rinomina colonna temporanea
        await pool.query(`ALTER TABLE users RENAME COLUMN ${field}_temp TO ${field}`);
        
        console.log(`✅ DEBUG: Colonna ${field} convertita in users`);
      }
    }
    
    console.log('✅ DEBUG: Conversione completata');
    
    res.json({
      success: true,
      message: 'Colonne opinioni convertite da boolean a text nella tabella users',
      data: {
        converted_fields: opinionFields,
        table: 'users'
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nella conversione colonne users:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella conversione colonne users',
      details: error.message
    });
  }
});

// Endpoint per aggiungere le colonne opinioni mancanti alla tabella users
app.post('/api/debug/add-opinion-columns', async (req, res) => {
  try {
    console.log('🔄 DEBUG: Aggiunta colonne opinioni alla tabella users');
    
    const opinionFields = [
      'energia_nucleare', 'sperimentazione_animale', 'legalizzazione_canapa',
      'caccia', 'cittadina_animale', 'nato', 'matrimonio_gay', 'salario_minimo',
      'carne_coltivata', 'case_chiuse', 'eutanasia', 'omobitransfobia'
    ];
    
    // Controlla quali colonne esistono già
    const existingColumns = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name IN (${opinionFields.map((_, i) => `$${i + 1}`).join(',')})
    `, opinionFields);
    
    const existingColumnNames = existingColumns.rows.map(row => row.column_name);
    const missingColumns = opinionFields.filter(field => !existingColumnNames.includes(field));
    
    console.log('📊 DEBUG: Colonne esistenti:', existingColumnNames);
    console.log('📊 DEBUG: Colonne mancanti:', missingColumns);
    
    // Aggiungi le colonne mancanti
    for (const field of missingColumns) {
      console.log(`🔄 DEBUG: Aggiunta colonna ${field}`);
      await pool.query(`ALTER TABLE users ADD COLUMN ${field} TEXT`);
      console.log(`✅ DEBUG: Colonna ${field} aggiunta`);
    }
    
    // Verifica finale
    const finalColumns = await pool.query(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name IN (${opinionFields.map((_, i) => `$${i + 1}`).join(',')})
      ORDER BY column_name
    `, opinionFields);
    
    console.log('✅ DEBUG: Colonne opinioni aggiunte');
    
    res.json({
      success: true,
      message: 'Colonne opinioni aggiunte alla tabella users',
      data: {
        existing_columns: existingColumnNames,
        added_columns: missingColumns,
        final_columns: finalColumns.rows
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiunta colonne opinioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'aggiunta colonne opinioni',
      details: error.message
    });
  }
});

// Endpoint per verificare la struttura attuale della tabella users
app.get('/api/debug/check-users-structure', async (req, res) => {
  try {
    console.log('🔍 DEBUG: Verifica struttura tabella users');
    
    // 1. Verifica colonne attuali in users
    const usersColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    
    // 2. Verifica dati in users
    const usersCount = await pool.query('SELECT COUNT(*) as total FROM users');
    const usersSample = await pool.query('SELECT * FROM users LIMIT 3');
    
    // 3. Verifica dati in Firestore
    const firestore = admin.firestore();
    const utentiSnapshot = await firestore.collection('utenti').get();
    
    let firestoreSample = [];
    if (!utentiSnapshot.empty) {
      firestoreSample = utentiSnapshot.docs.slice(0, 3).map(doc => ({
        id: doc.id,
        data: doc.data()
      }));
    }
    
    console.log('✅ DEBUG: Verifica struttura completata');
    
    res.json({
      success: true,
      message: 'Struttura tabella users verificata',
      data: {
        users_columns: usersColumns.rows,
        users_count: parseInt(usersCount.rows[0].total),
        users_sample: usersSample.rows,
        firestore_count: utentiSnapshot.size,
        firestore_sample: firestoreSample
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nella verifica struttura:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella verifica struttura',
      details: error.message
    });
  }
});

// Endpoint DEFINITIVO per migrazione completa da Firestore a Neon
app.post('/api/debug/migrate-complete', async (req, res) => {
  try {
    console.log('🚀 DEBUG: MIGRAZIONE DEFINITIVA DA FIRESTORE A NEON');
    
    // 1. DEFINISCO TUTTE LE COLONNE NECESSARIE
    const allColumns = {
      // Colonne base (già esistenti)
      base: ['id', 'name', 'email', 'email_verified', 'image', 'created_at', 'updated_at'],
      
      // Colonne personali
      personal: ['nome', 'cognome', 'password_hash', 'ruolo', 'status'],
      
      // Colonne geografiche
      geographic: ['regione', 'provincia', 'comune', 'regione_residenza', 'provincia_residenza', 'paese_residenza'],
      
      // Colonne personali aggiuntive
      additional: ['data_nascita', 'genere', 'cittadinanza', 'paese_elezione', 'paese_candidatura', 'grado_elezione', 'grado_candidatura'],
      
      // Colonne opinioni
      opinions: [
        'energia_nucleare', 'sperimentazione_animale', 'legalizzazione_canapa',
        'caccia', 'cittadina_animale', 'nato', 'matrimonio_gay', 'salario_minimo',
        'carne_coltivata', 'case_chiuse', 'eutanasia', 'omobitransfobia'
      ]
    };
    
    const allColumnNames = [
      ...allColumns.base,
      ...allColumns.personal,
      ...allColumns.geographic,
      ...allColumns.additional,
      ...allColumns.opinions
    ];
    
    console.log('📊 DEBUG: Colonne totali da gestire:', allColumnNames.length);
    
    // 2. VERIFICA COLONNE ESISTENTI
    const existingColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `);
    
    const existingColumnNames = existingColumns.rows.map(row => row.column_name);
    console.log('📊 DEBUG: Colonne esistenti:', existingColumnNames.length);
    
    // 3. AGGIUNGI COLONNE MANCANTI
    const missingColumns = allColumnNames.filter(col => !existingColumnNames.includes(col));
    console.log('📊 DEBUG: Colonne mancanti:', missingColumns);
    
    for (const column of missingColumns) {
      let columnType = 'TEXT';
      
      // Definisci il tipo corretto per ogni colonna
      if (['id'].includes(column)) columnType = 'UUID';
      else if (['name', 'email', 'nome', 'cognome', 'ruolo', 'status', 'genere', 'cittadinanza'].includes(column)) columnType = 'VARCHAR(255)';
      else if (['password_hash'].includes(column)) columnType = 'TEXT';
      else if (['email_verified', 'created_at', 'updated_at', 'data_nascita'].includes(column)) columnType = 'TIMESTAMP';
      else if (['image', 'avatar_config'].includes(column)) columnType = 'TEXT';
      else if (allColumns.opinions.includes(column)) columnType = 'TEXT';
      else columnType = 'VARCHAR(255)';
      
      console.log(`🔄 DEBUG: Aggiunta colonna ${column} (${columnType})`);
      await pool.query(`ALTER TABLE users ADD COLUMN ${column} ${columnType}`);
    }
    
    // 4. PRENDI TUTTI I DATI DA FIRESTORE
    console.log('🔄 DEBUG: Recupero dati da Firestore...');
    const firestore = admin.firestore();
    const utentiSnapshot = await firestore.collection('utenti').get();
    
    if (utentiSnapshot.empty) {
      throw new Error('Nessun utente trovato in Firestore');
    }
    
    console.log('✅ DEBUG: Trovati', utentiSnapshot.size, 'utenti in Firestore');
    
    // 5. FUNZIONE PER CONVERTIRE VALORI OPINIONI
    const convertOpinionValue = (value) => {
      if (value === true) return 'Favorevole';
      if (value === false) return 'Contrario';
      if (value === 'Indeciso' || value === 'indeciso') return 'Indeciso';
      if (value === 'Favorevole' || value === 'favorevole') return 'Favorevole';
      if (value === 'Contrario' || value === 'contrario') return 'Contrario';
      return 'Indeciso'; // Default per valori null/undefined
    };
    
    // 6. MIGRA TUTTI GLI UTENTI
    let inseriti = 0;
    let aggiornati = 0;
    let errori = 0;
    
    for (const doc of utentiSnapshot.docs) {
      try {
        const utente = doc.data();
        
        // Prepara TUTTI i dati
        const userData = {
          // Colonne base
          id: doc.id,
          name: `${utente.nome || ''} ${utente.cognome || ''}`.trim() || utente.email || 'Utente',
          email: utente.email || '',
          email_verified: utente.email_verified ? new Date(utente.email_verified) : null,
          image: utente.avatar_config ? JSON.stringify(utente.avatar_config) : null,
          created_at: utente.created_at ? new Date(utente.created_at) : new Date(),
          updated_at: utente.updated_at ? new Date(utente.updated_at) : new Date(),
          
          // Dati personali
          nome: utente.nome || '',
          cognome: utente.cognome || '',
          password_hash: utente.password_hash || '',
          ruolo: utente.ruolo || 'Elettore',
          status: utente.status || 'pending',
          
          // Dati geografici
          regione: utente.regione || null,
          provincia: utente.provincia || null,
          comune: utente.comune || null,
          regione_residenza: utente.regione_residenza || utente.regione || null,
          provincia_residenza: utente.provincia_residenza || utente.provincia || null,
          paese_residenza: utente.paese_residenza || null,
          
          // Dati aggiuntivi
          data_nascita: utente.data_nascita ? new Date(utente.data_nascita) : null,
          genere: utente.genere || null,
          cittadinanza: utente.cittadinanza || null,
          paese_elezione: utente.paese_elezione || null,
          paese_candidatura: utente.paese_candidatura || null,
          grado_elezione: utente.grado_elezione || null,
          grado_candidatura: utente.grado_candidatura || null,
          
          // Opinioni (convertite)
          energia_nucleare: convertOpinionValue(utente.energia_nucleare),
          sperimentazione_animale: convertOpinionValue(utente.sperimentazione_animale),
          legalizzazione_canapa: convertOpinionValue(utente.legalizzazione_canapa),
          caccia: convertOpinionValue(utente.caccia),
          cittadina_animale: convertOpinionValue(utente.cittadina_animale),
          nato: convertOpinionValue(utente.nato),
          matrimonio_gay: convertOpinionValue(utente.matrimonio_gay),
          salario_minimo: convertOpinionValue(utente.salario_minimo),
          carne_coltivata: convertOpinionValue(utente.carne_coltivata),
          case_chiuse: convertOpinionValue(utente.case_chiuse),
          eutanasia: convertOpinionValue(utente.eutanasia),
          omobitransfobia: convertOpinionValue(utente.omobitransfobia)
        };
        
        // Crea la query dinamica per l'INSERT
        const columns = Object.keys(userData);
        const values = Object.values(userData);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        
        const insertQuery = `
          INSERT INTO users (${columns.join(', ')})
          VALUES (${placeholders})
          ON CONFLICT (id) DO UPDATE SET
          ${columns.filter(col => col !== 'id').map(col => `${col} = EXCLUDED.${col}`).join(', ')}
        `;
        
        const result = await pool.query(insertQuery, values);
        
        if (result.rowCount > 0) {
          aggiornati++;
        } else {
          inseriti++;
        }
        
      } catch (error) {
        console.error('❌ Errore migrazione utente', doc.id, ':', error.message);
        errori++;
      }
    }
    
    // 7. VERIFICA FINALE
    const finalUsersCount = await pool.query('SELECT COUNT(*) as total FROM users');
    const usersWithOpinions = await pool.query(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE energia_nucleare IS NOT NULL 
         OR sperimentazione_animale IS NOT NULL 
         OR legalizzazione_canapa IS NOT NULL
    `);
    
    const finalColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    
    console.log('✅ DEBUG: MIGRAZIONE DEFINITIVA COMPLETATA');
    
    res.json({
      success: true,
      message: 'MIGRAZIONE DEFINITIVA COMPLETATA - Tutti i dati da Firestore migrati in Neon',
      data: {
        // Statistiche migrazione
        firestore_utenti: utentiSnapshot.size,
        utenti_inseriti: inseriti,
        utenti_aggiornati: aggiornati,
        errori: errori,
        
        // Verifica finale
        users_total: parseInt(finalUsersCount.rows[0].total),
        users_with_opinions: parseInt(usersWithOpinions.rows[0].count),
        
        // Struttura finale
        colonne_totali: finalColumns.rows.length,
        colonne_aggiunte: missingColumns.length,
        
        // Dettagli colonne
        colonne_finali: finalColumns.rows
      }
    });
    
  } catch (error) {
    console.error('❌ Errore durante migrazione definitiva:', error);
    res.status(500).json({
      success: false,
      error: 'Errore durante migrazione definitiva',
      details: error.message
    });
  }
});

// Endpoint per verifica finale della migrazione
app.get('/api/debug/verify-migration', async (req, res) => {
  try {
    console.log('🔍 DEBUG: Verifica finale migrazione');
    
    // 1. Verifica struttura finale
    const finalColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    
    // 2. Verifica dati
    const usersCount = await pool.query('SELECT COUNT(*) as total FROM users');
    const usersWithOpinions = await pool.query(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE energia_nucleare IS NOT NULL 
         OR sperimentazione_animale IS NOT NULL 
         OR legalizzazione_canapa IS NOT NULL
    `);
    
    const usersWithGeographic = await pool.query(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE regione IS NOT NULL 
         OR provincia IS NOT NULL 
         OR comune IS NOT NULL
    `);
    
    // 3. Campione di dati
    const sampleData = await pool.query(`
      SELECT id, name, email, ruolo, regione, energia_nucleare, caccia, nato
      FROM users 
      LIMIT 5
    `);
    
    // 4. Statistiche opinioni
    const opinionStats = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN energia_nucleare IS NOT NULL THEN 1 END) as energia_nucleare_count,
        COUNT(CASE WHEN caccia IS NOT NULL THEN 1 END) as caccia_count,
        COUNT(CASE WHEN nato IS NOT NULL THEN 1 END) as nato_count,
        COUNT(CASE WHEN eutanasia IS NOT NULL THEN 1 END) as eutanasia_count
      FROM users
    `);
    
    console.log('✅ DEBUG: Verifica finale completata');
    
    res.json({
      success: true,
      message: 'Verifica finale migrazione completata',
      data: {
        // Struttura
        colonne_totali: finalColumns.rows.length,
        colonne_presenti: finalColumns.rows.map(row => `${row.column_name} (${row.data_type})`),
        
        // Dati
        users_total: parseInt(usersCount.rows[0].total),
        users_with_opinions: parseInt(usersWithOpinions.rows[0].count),
        users_with_geographic: parseInt(usersWithGeographic.rows[0].count),
        
        // Statistiche opinioni
        opinion_stats: opinionStats.rows[0],
        
        // Campione dati
        sample_data: sampleData.rows
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nella verifica finale:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella verifica finale',
      details: error.message
    });
  }
});

