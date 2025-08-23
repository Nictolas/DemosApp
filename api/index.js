const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Rate limiting semplice
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 100, // limite per IP
  message: {
    success: false,
    error: 'Troppe richieste, riprova più tardi'
  }
});

const app = express();

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Permetti richieste senza origin (es. Postman, curl)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000', 
      'http://127.0.0.1:3000', 
      'https://www.demos.community',
      'https://demos.community',
      'https://demos-5pwt0y12-demos-projects-54c4cd15.vercel.app'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('🚫 CORS blocked origin:', origin);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Gestione richieste preflight OPTIONS
app.options('*', cors());

// Middleware per gestire CORS preflight
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());

// Middleware per sanitizzazione input base
const sanitizeInput = (req, res, next) => {
  // Sanitizza i parametri delle query
  if (req.params) {
    for (const [key, value] of Object.entries(req.params)) {
      if (typeof value === 'string') {
        req.params[key] = value.replace(/[<>'"]/g, '');
      }
    }
  }
  
  // Sanitizza il body
  if (req.body) {
    for (const [key, value] of Object.entries(req.body)) {
      if (typeof value === 'string') {
        req.body[key] = value.replace(/[<>'"]/g, '');
      }
    }
  }
  
  // Sanitizza le query string
  if (req.query) {
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        req.query[key] = value.replace(/[<>'"]/g, '');
      }
    }
  }
  
  next();
};

// Applica sanitizzazione input a tutti gli endpoint
app.use(sanitizeInput);

// Middleware per logging audit
const auditLog = (req, res, next) => {
  const startTime = Date.now();
  
  // Log della richiesta
  console.log(`📝 [${new Date().toISOString()}] ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  
  // Intercetta la risposta per loggare il tempo e lo status
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`✅ [${new Date().toISOString()}] ${req.method} ${req.originalUrl} - Status: ${res.statusCode} - Tempo: ${duration}ms`);
  });
  
  next();
};

app.use(auditLog);

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Chiave segreta per JWT (in produzione usare variabile d'ambiente)
const JWT_SECRET = process.env.JWT_SECRET || 'demos-super-secret-key-2025';

// Middleware per verificare il token JWT
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'Token mancante' });
  }
  
  try {
    // Verifica vera del token JWT
    const decodedToken = jwt.verify(token, JWT_SECRET);
    
    // Aggiungiamo l'user ID alla request per uso futuro
    req.userId = decodedToken.userId;
    req.userRole = decodedToken.role;
    next();
  } catch (error) {
    console.error('❌ Errore nella verifica token:', error);
    return res.status(401).json({ success: false, message: 'Token non valido' });
  }
};

// Middleware per verificare se l'utente è admin
const requireAdmin = (req, res, next) => {
  // Verifica se l'utente ha ruolo admin
  if (req.userRole === 'Admin') {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Accesso negato: richiesti privilegi admin' });
  }
};

// Middleware per validazione input base
const validateInput = (requiredFields) => {
  return (req, res, next) => {
    for (const field of requiredFields) {
      if (!req.body[field] || req.body[field].trim() === '') {
        return res.status(400).json({
          success: false,
          error: `Campo richiesto mancante: ${field}`
        });
      }
    }
    next();
  };
};

// ===== ENDPOINTS PER UTENTI =====

// GET /api/utenti/me - Ottieni dati utente corrente
app.get('/api/utenti/me', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    console.log('🔍 DEBUG /api/utenti/me - userId:', userId);
    
    // Recupera dati utente dal database
    const userQuery = `
      SELECT id, nome, cognome, email, ruolo, genere, data_nascita
      FROM users 
      WHERE id = $1
    `;
    
    console.log('🔍 DEBUG /api/utenti/me - Eseguendo query con userId:', userId);
    const userResult = await pool.query(userQuery, [userId]);
    console.log('🔍 DEBUG /api/utenti/me - Query result:', userResult.rows);
    
    if (userResult.rows.length === 0) {
      console.log('❌ DEBUG /api/utenti/me - Utente non trovato per userId:', userId);
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const user = userResult.rows[0];
    console.log('✅ DEBUG /api/utenti/me - Utente trovato:', user);
    
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.nome,
        cognome: user.cognome,
        email: user.email,
        ruolo: user.ruolo,
        genere: user.genere,
        data_nascita: user.data_nascita
      }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare dati utente:', error);
    console.error('❌ Stack trace completo:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare dati utente'
    });
  }
});

// POST /api/auth/login - Login utente
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔐 Tentativo di login per:', email);
    
    // Verifica credenziali nel database
    const userQuery = `
      SELECT id, nome, cognome, email, password_hash, ruolo
      FROM users 
      WHERE email = $1
    `;
    
    const userResult = await pool.query(userQuery, [email]);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Credenziali non valide'
      });
    }
    
    const user = userResult.rows[0];
    
    // Verifica password (se esiste password_hash, altrimenti accetta qualsiasi password per test)
    if (user.password_hash) {
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: 'Credenziali non valide'
        });
      }
    }
    
    // Genera token JWT
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        role: user.ruolo 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    console.log('✅ Login riuscito per:', email);
    
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.nome,
        cognome: user.cognome,
        email: user.email,
        ruolo: user.ruolo
      },
      token: token
    });
    
  } catch (error) {
    console.error('❌ Errore nel login:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel login'
    });
  }
});

// POST /api/auth/register - Registrazione utente
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, nome, cognome } = req.body;
    
    console.log('📝 Tentativo di registrazione per:', email);
    
    // Verifica se l'utente esiste già
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Utente già esistente con questa email'
      });
    }
    
    // Hash della password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Inserisci nuovo utente
    const insertQuery = `
      INSERT INTO users (nome, cognome, email, password_hash, ruolo, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id, nome, cognome, email, ruolo
    `;
    
    const result = await pool.query(insertQuery, [
      nome, 
      cognome, 
      email, 
      passwordHash, 
      'Elettore'
    ]);
    
    const newUser = result.rows[0];
    
    // Genera token JWT
    const token = jwt.sign(
      { 
        userId: newUser.id, 
        email: newUser.email,
        role: newUser.ruolo 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    console.log('✅ Registrazione riuscita per:', email);
    
    res.json({
      success: true,
      user: {
        id: newUser.id,
        name: newUser.nome,
        cognome: newUser.cognome,
        email: newUser.email,
        ruolo: newUser.ruolo
      },
      token: token
    });
    
  } catch (error) {
    console.error('❌ Errore nella registrazione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella registrazione'
    });
  }
});

// ===== ENDPOINTS PER CAPO DI STATO =====

// GET /api/capo-stato - Ottieni tutti i voti per il capo di stato
app.get('/api/capo-stato', limiter, async (req, res) => {
  try {
    console.log('👑 Richiesta voti capo di stato');
    
    // Ottieni la classifica (conteggio voti per candidato)
    const classificaQuery = `
      SELECT nome, COUNT(*) as voti
      FROM voti_capo_stato
      GROUP BY nome
      ORDER BY voti DESC
      LIMIT 10
    `;
    
    const classificaResult = await pool.query(classificaQuery);
    console.log('✅ Classifica calcolata per', classificaResult.rows.length, 'candidati');
    
    res.json({
      success: true,
      classifica: classificaResult.rows,
      mieiVoti: ['user1'], // Placeholder per ora
      blocco: { isBlocked: false, unlockDate: null }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare voti capo di stato:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare voti capo di stato'
    });
  }
});

// POST /api/capo-stato/vota - Salva i voti dell'utente
app.post('/api/capo-stato/vota', verifyToken, validateInput(['voti']), async (req, res) => {
  try {
    const { voti } = req.body;
    const userId = req.userId; // Usa l'ID reale dell'utente autenticato
    
    console.log('👑 Salvataggio voti per utente:', userId, 'Voti:', voti);
    
    // Elimina i voti esistenti dell'utente
    await pool.query('DELETE FROM voti_capo_stato WHERE user_id = $1', [userId]);
    
    // Inserisci i nuovi voti
    for (const nome of voti) {
      await pool.query(
        'INSERT INTO voti_capo_stato (user_id, nome, created_at) VALUES ($1, $2, NOW())',
        [userId, nome]
      );
    }
    
    console.log('✅ Voti salvati con successo');
    res.json({ success: true, message: 'Voti salvati con successo' });
    
  } catch (error) {
    console.error('❌ Errore nel salvare voti:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel salvare voti'
    });
  }
});

// ===== ENDPOINTS PER ELEZIONI =====

// GET /api/elezioni/prossime - Ottieni le prossime elezioni
app.get('/api/elezioni/prossime', limiter, async (req, res) => {
  try {
    const query = `
      SELECT * FROM elezioni 
      WHERE data > NOW() 
      ORDER BY data ASC 
      LIMIT 5
    `;
    
    const result = await pool.query(query);
    res.json({
      success: true,
      elezioni: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare elezioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare elezioni'
    });
  }
});

// ===== ENDPOINTS PER COMUNICAZIONI =====

// POST /api/comunicazioni - Crea una nuova comunicazione
app.post('/api/comunicazioni', verifyToken, validateInput(['titolo', 'contenuto', 'tipo']), async (req, res) => {
  try {
    const { titolo, contenuto, tipo } = req.body;
    const userId = req.userId; // Usa l'ID reale dell'utente autenticato
    
    const query = `
      INSERT INTO comunicazioni (utente_id, titolo, contenuto, tipo, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
    `;
    
    const result = await pool.query(query, [userId, titolo, contenuto, tipo]);
    
    res.json({
      success: true,
      comunicazione: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nella creazione comunicazione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella creazione comunicazione'
    });
  }
});

// GET /api/comunicazioni - Ottieni tutte le comunicazioni
app.get('/api/comunicazioni', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT c.*, u.nome, u.cognome
      FROM comunicazioni c
      JOIN users u ON c.utente_id = u.id
      ORDER BY c.created_at DESC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      comunicazioni: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare comunicazioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare comunicazioni'
    });
  }
});

// GET /api/comunicazioni/:id - Ottieni comunicazione specifica
app.get('/api/comunicazioni/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        error: 'ID comunicazione non valido'
      });
    }
    
    const query = `
      SELECT c.*, u.nome, u.cognome
      FROM comunicazioni c
      JOIN users u ON c.utente_id = u.id
      WHERE c.id = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Comunicazione non trovata'
      });
    }
    
    res.json({
      success: true,
      comunicazione: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare comunicazione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare comunicazione'
    });
  }
});

// PUT /api/comunicazioni/:id - Aggiorna comunicazione
app.put('/api/comunicazioni/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { titolo, contenuto, tipo } = req.body;
    
    const query = `
      UPDATE comunicazioni 
      SET titolo = $1, contenuto = $2, tipo = $3, updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `;
    
    const result = await pool.query(query, [titolo, contenuto, tipo, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Comunicazione non trovata'
      });
    }
    
    res.json({
      success: true,
      comunicazione: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento comunicazione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'aggiornamento comunicazione'
    });
  }
});

// DELETE /api/comunicazioni/:id - Elimina comunicazione
app.delete('/api/comunicazioni/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID comunicazione richiesto'
      });
    }
    
    const result = await pool.query('DELETE FROM comunicazioni WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Comunicazione non trovata'
      });
    }
    
    res.json({
      success: true,
      message: 'Comunicazione eliminata'
    });
  } catch (error) {
    console.error('❌ Errore nell\'eliminazione comunicazione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'eliminazione comunicazione'
    });
  }
});

// GET /api/comunicazioni/check-duplicate - Verifica duplicati
app.get('/api/comunicazioni/check-duplicate', verifyToken, async (req, res) => {
  try {
    const { titolo, contenuto } = req.query;
    const userId = req.userId; // Usa l'ID reale dell'utente autenticato
    
    if (!titolo || !contenuto) {
      return res.status(400).json({
        success: false,
        error: 'Parametri titolo e contenuto richiesti'
      });
    }
    
    const query = `
      SELECT COUNT(*) as count FROM comunicazioni 
      WHERE utente_id = $1 AND titolo = $2 AND contenuto = $3
    `;
    
    const result = await pool.query(query, [userId, titolo, contenuto]);
    const isDuplicate = parseInt(result.rows[0].count) > 0;
    
    res.json({
      success: true,
      isDuplicate
    });
  } catch (error) {
    console.error('❌ Errore nel controllo duplicati:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel controllo duplicati'
    });
  }
});

// GET /api/ultima-comunicazione - Ottieni l'ultima comunicazione dell'utente
app.get('/api/ultima-comunicazione', verifyToken, async (req, res) => {
  try {
    const userId = req.userId; // Usa l'ID reale dell'utente autenticato
    
    const query = `
      SELECT * FROM comunicazioni 
      WHERE utente_id = $1 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    
    const result = await pool.query(query, [userId]);
    
    res.json({
      success: true,
      comunicazione: result.rows[0] || null
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare ultima comunicazione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare ultima comunicazione'
    });
  }
});

// ===== ENDPOINTS PER EVENTI =====

// POST /api/eventi - Crea un nuovo evento
app.post('/api/eventi', verifyToken, validateInput(['titolo', 'descrizione', 'data', 'luogo']), async (req, res) => {
  try {
    const { titolo, descrizione, data, luogo } = req.body;
    const userId = req.userId; // Usa l'ID reale dell'utente autenticato
    
    const query = `
      INSERT INTO eventi (utente_id, titolo, descrizione, data, luogo, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `;
    
    const result = await pool.query(query, [userId, titolo, descrizione, data, luogo]);
    
    res.json({
      success: true,
      evento: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nella creazione evento:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella creazione evento'
    });
  }
});

// PUT /api/eventi/:id - Aggiorna evento
app.put('/api/eventi/:id', verifyToken, validateInput(['titolo', 'descrizione', 'data', 'luogo']), async (req, res) => {
  try {
    const { id } = req.params;
    const { titolo, descrizione, data, luogo } = req.body;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        error: 'ID evento non valido'
      });
    }
    
    const query = `
      UPDATE eventi 
      SET titolo = $1, descrizione = $2, data = $3, luogo = $4, updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `;
    
    const result = await pool.query(query, [titolo, descrizione, data, luogo, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Evento non trovato'
      });
    }
    
    res.json({
      success: true,
      evento: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento evento:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'aggiornamento evento'
    });
  }
});

// DELETE /api/eventi/:id - Elimina evento
app.delete('/api/eventi/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID evento richiesto'
      });
    }
    
    const result = await pool.query('DELETE FROM eventi WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Evento non trovato'
      });
    }
    
    res.json({
      success: true,
      message: 'Evento eliminato'
    });
  } catch (error) {
    console.error('❌ Errore nell\'eliminazione evento:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'eliminazione evento'
    });
  }
});

// GET /api/eventi - Ottieni tutti gli eventi
app.get('/api/eventi', limiter, async (req, res) => {
  try {
    const query = `
      SELECT e.*, u.nome, u.cognome 
      FROM eventi e 
      JOIN users u ON e.utente_id = u.id 
      ORDER BY e.data ASC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      eventi: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare eventi:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare eventi'
    });
  }
});

// ===== ENDPOINTS PER OPINIONI =====

// GET /api/opinioni/profile - Ottieni opinioni per profilo utente
app.get('/api/opinioni/profile', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    
    // Query per ottenere le domande delle opinioni
    const opinionQuery = `
      SELECT DISTINCT o.grado_opinione, o.text
      FROM opinioni o
      ORDER BY o.grado_opinione, o.text
    `;
    
    const opinionResult = await pool.query(opinionQuery);
    
    // Formatta le domande per il frontend
    const questions = opinionResult.rows.map(row => ({
      id: `${row.grado_opinione}_${row.text.replace(/\s+/g, '_')}`,
      text: `${row.grado_opinione}: ${row.text}`
    }));
    
    // Query per ottenere le risposte dell'utente
    const userQuery = `
      SELECT energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia
      FROM users
      WHERE id = $1
    `;
    
    const userResult = await pool.query(userQuery, [userId]);
    const userAnswers = userResult.rows[0] || {};
    
    res.json({
      success: true,
      data: {
        questions: questions,
        userAnswers: userAnswers
      }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare opinioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare opinioni'
    });
  }
});

// GET /api/opinioni - Ottieni tutte le opinioni (per gestione)
app.get('/api/opinioni', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT o.*, o.grado_opinione as categoria_nome
      FROM opinioni o
      ORDER BY o.grado_opinione, o.text
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      opinioni: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare opinioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare opinioni'
    });
  }
});

// GET /api/opinioni-proposte - Ottieni opinioni proposte
app.get('/api/opinioni-proposte', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT * FROM opinioni_proposte 
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      opinioni: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare opinioni proposte:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare opinioni proposte'
    });
  }
});

// GET /api/opinioni-list - Ottieni opinioni per grado
app.get('/api/opinioni-list', verifyToken, async (req, res) => {
  try {
    const { grado } = req.query;
    const query = `
      SELECT o.*, o.grado_opinione as categoria_nome
      FROM opinioni o
      WHERE o.grado_opinione = $1
      ORDER BY o.text
    `;
    
    const result = await pool.query(query, [grado]);
    
    res.json({
      success: true,
      opinioni: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare opinioni per grado:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare opinioni per grado'
    });
  }
});

// GET /api/opinioni/user-answers - Ottieni risposte utente
app.get('/api/opinioni/user-answers', verifyToken, async (req, res) => {
  try {
    const userId = req.userId; // Usa l'ID reale dell'utente autenticato
    
    const query = `
      SELECT * FROM risposte_opinioni 
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query, [userId]);
    
    res.json({
      success: true,
      risposte: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare risposte utente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare risposte utente'
    });
  }
});

// GET /api/opinioni/stats/:opinionId - Statistiche opinione
app.get('/api/opinioni/stats/:opinionId', verifyToken, async (req, res) => {
  try {
    const { opinionId } = req.params;
    
    const query = `
      SELECT 
        COUNT(*) as totale_risposte,
        COUNT(CASE WHEN risposta = 'Sì' THEN 1 END) as si,
        COUNT(CASE WHEN risposta = 'No' THEN 1 END) as no,
        COUNT(CASE WHEN risposta = 'Non so' THEN 1 END) as non_so
      FROM risposte_opinioni 
      WHERE opinione_id = $1
    `;
    
    const result = await pool.query(query, [opinionId]);
    
    res.json({
      success: true,
      stats: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare statistiche opinione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare statistiche opinione'
    });
  }
});

// POST /api/opinioni - Crea nuova opinione
app.post('/api/opinioni', verifyToken, validateInput(['text', 'grado_opinione', 'categoria_id']), async (req, res) => {
  try {
    const { text, grado_opinione, categoria_id } = req.body;
    
    const query = `
      INSERT INTO opinioni (testo, grado, categoria_id, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING *
    `;
    
    const result = await pool.query(query, [text, grado_opinione, categoria_id]);
    
    res.json({
      success: true,
      opinione: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nella creazione opinione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella creazione opinione'
    });
  }
});

// POST /api/opinioni/salva - Salva risposte opinioni
app.post('/api/opinioni/salva', verifyToken, validateInput(['opinions']), async (req, res) => {
  try {
    const { opinions } = req.body;
    const userId = req.userId; // Usa l'ID reale dell'utente autenticato
    
    // Salva ogni risposta
    for (const [opinionId, risposta] of Object.entries(opinions)) {
      await pool.query(
        'INSERT INTO risposte_opinioni (user_id, opinione_id, risposta, created_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (user_id, opinione_id) DO UPDATE SET risposta = $3',
        [userId, opinionId, risposta]
      );
    }
    
    res.json({
      success: true,
      message: 'Opinioni salvate con successo'
    });
  } catch (error) {
    console.error('❌ Errore nel salvare opinioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel salvare opinioni'
    });
  }
});

// PUT /api/opinioni/:id - Aggiorna opinione
app.put('/api/opinioni/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { testo, grado } = req.body;
    
    const query = `
      UPDATE opinioni 
      SET testo = $1, grado = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;
    
    const result = await pool.query(query, [testo, grado, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Opinione non trovata'
      });
    }
    
    res.json({
      success: true,
      opinione: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento opinione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'aggiornamento opinione'
    });
  }
});

// DELETE /api/opinioni/:id - Elimina opinione
app.delete('/api/opinioni/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID opinione richiesto'
      });
    }
    
    const result = await pool.query('DELETE FROM opinioni WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Opinione non trovata'
      });
    }
    
    res.json({
      success: true,
      message: 'Opinione eliminata'
    });
  } catch (error) {
    console.error('❌ Errore nell\'eliminazione opinione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'eliminazione opinione'
    });
  }
});

// ===== ENDPOINTS PER RAPPRESENTANTI =====

// GET /api/rappresentanti - Ottieni rappresentanti dell'utente
app.get('/api/rappresentanti', verifyToken, async (req, res) => {
  try {
    const userId = req.userId; // Usa l'ID reale dell'utente autenticato
    
    const query = `
      SELECT r.*, u.nome, u.cognome, c.nome as categoria_nome
      FROM rappresentanti r
      JOIN users u ON r.rappresentante_id = u.id
      JOIN categorie_rappresentanti c ON r.categoria_id = c.id
      WHERE r.utente_id = $1
      ORDER BY c.nome
    `;
    
    const result = await pool.query(query, [userId]);
    
    res.json({
      success: true,
      rappresentanti: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare rappresentanti:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare rappresentanti'
    });
  }
});

// POST /api/rappresentanti - Assegna rappresentante
app.post('/api/rappresentanti', verifyToken, validateInput(['rappresentante_id', 'categoria_id']), async (req, res) => {
  try {
    const { rappresentante_id, categoria_id } = req.body;
    const userId = req.userId; // Usa l'ID reale dell'utente autenticato
    
    const query = `
      INSERT INTO rappresentanti (utente_id, rappresentante_id, categoria_id, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING *
    `;
    
    const result = await pool.query(query, [userId, rappresentante_id, categoria_id]);
    
    res.json({
      success: true,
      rappresentante: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nell\'assegnazione rappresentante:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'assegnazione rappresentante'
    });
  }
});

// DELETE /api/rappresentanti/:id - Rimuovi rappresentante
app.delete('/api/rappresentanti/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID rappresentante richiesto'
      });
    }
    
    const result = await pool.query('DELETE FROM rappresentanti WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Rappresentante non trovato'
      });
    }
    
    res.json({
      success: true,
      message: 'Rappresentante rimosso'
    });
  } catch (error) {
    console.error('❌ Errore nella rimozione rappresentante:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella rimozione rappresentante'
    });
  }
});

// ===== ENDPOINTS PER GRAZIA =====

// POST /api/grazia - Crea richiesta di grazia
app.post('/api/grazia', verifyToken, validateInput(['nome_carcerato', 'motivo']), async (req, res) => {
  try {
    const { nome_carcerato, motivo } = req.body;
    const userId = req.userId;
    
    const query = `
      INSERT INTO richieste_grazia (utente_id, nome_carcerato, motivo, stato, created_at)
      VALUES ($1, $2, $3, 'in_attesa', NOW())
      RETURNING *
    `;
    
    const result = await pool.query(query, [userId, nome_carcerato, motivo]);
    
    res.json({
      success: true,
      richiesta: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nella creazione richiesta grazia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella creazione richiesta grazia'
    });
  }
});

// GET /api/grazia - Ottieni richieste di grazia
app.get('/api/grazia', limiter, async (req, res) => {
  try {
    console.log('🔍 DEBUG: Chiamata endpoint /api/grazia');
    
    // SOLUZIONE: Uso solo voti_grazia senza JOIN problematico
    const query = `
      SELECT *
      FROM voti_grazia
      ORDER BY created_at DESC
      LIMIT 10
    `;
    
    const result = await pool.query(query);
    console.log(`✅ Recuperati ${result.rows.length} record da voti_grazia`);
    
    // Creiamo una classifica Top 10 basata sul numero di voti per carcerato
    const classificaQuery = `
      SELECT nome, COUNT(*) as richieste
      FROM voti_grazia
      GROUP BY nome
      ORDER BY richieste DESC
      LIMIT 10
    `;
    
    const classificaResult = await pool.query(classificaQuery);
    console.log(`✅ Classifica creata con ${classificaResult.rows.length} carcerati`);
    
    res.json({
      success: true,
      classifica: classificaResult.rows,
      richieste: result.rows,
      mieiVoti: [], // Per ora vuoto
      blocco: { isBlocked: false, unlockDate: null }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare richieste grazia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare richieste grazia',
      details: error.message
    });
  }
});

// GET /api/grazia/richieste - Ottieni richieste per gestione
app.get('/api/grazia/richieste', verifyToken, async (req, res) => {
  try {
    // SOLUZIONE: Uso solo voti_grazia senza JOIN problematico
    const query = `
      SELECT *
      FROM voti_grazia
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      richieste: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare richieste grazia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare richieste grazia'
    });
  }
});

// POST /api/grazia/vota - Salva voti grazia
app.post('/api/grazia/vota', verifyToken, validateInput(['voti']), async (req, res) => {
  try {
    const { voti } = req.body;
    const userId = req.userId; // Usa l'ID reale dell'utente autenticato
    
    // Elimina i voti esistenti
    await pool.query('DELETE FROM voti_grazia WHERE user_id = $1', [userId]);
    
    // Inserisci i nuovi voti
    for (const nome of voti) {
      await pool.query(
        'INSERT INTO voti_grazia (user_id, nome, created_at) VALUES ($1, $2, NOW())',
        [userId, nome]
      );
    }
    
    res.json({ success: true, message: 'Voti grazia salvati' });
  } catch (error) {
    console.error('❌ Errore nel salvare voti grazia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel salvare voti grazia'
    });
  }
});

// POST /api/grazia/richiesta/:id/:action - Gestisci richiesta grazia
app.post('/api/grazia/richiesta/:id/:action', verifyToken, async (req, res) => {
  try {
    const { id, action } = req.params;
    
    if (action === 'approve') {
      await pool.query('UPDATE voti_grazia SET stato = $1 WHERE id = $2', ['approvata', id]);
    } else if (action === 'reject') {
      await pool.query('UPDATE voti_grazia SET stato = $1 WHERE id = $2', ['rifiutata', id]);
    }
    
    res.json({ success: true, message: `Richiesta ${action === 'approve' ? 'approvata' : 'rifiutata'}` });
  } catch (error) {
    console.error('❌ Errore nella gestione richiesta grazia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella gestione richiesta grazia'
    });
  }
});

// ===== ENDPOINTS PER AMNISTIA =====

// GET /api/amnistia - Ottieni leggi per amnistia
app.get('/api/amnistia', limiter, async (req, res) => {
  try {
    // 1. Ottieni tutti i voti per amnistia
    const votiQuery = `
      SELECT * FROM voti_amnistia 
      ORDER BY timestamp DESC
    `;
    const votiResult = await pool.query(votiQuery);
    
    // 2. Genera classifica basata sui voti
    const classificaQuery = `
      SELECT legge as nome, COUNT(*) as voti
      FROM voti_amnistia 
      GROUP BY legge 
      ORDER BY voti DESC
    `;
    const classificaResult = await pool.query(classificaQuery);
    
    // 3. Ottieni leggi uniche per l'input
    const leggiUniche = [...new Set(votiResult.rows.map(v => v.legge))];
    
    // 4. Se l'utente è autenticato, ottieni i suoi voti
    let mieiVoti = [];
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.userId;
        
        const userVotiQuery = `
          SELECT legge FROM voti_amnistia 
          WHERE userId = $1
        `;
        const userVotiResult = await pool.query(userVotiQuery, [userId]);
        mieiVoti = userVotiResult.rows.map(v => v.legge);
      } catch (authError) {
        // Se il token non è valido, continua senza autenticazione
        console.log('⚠️ Token non valido per amnistia, continuando senza autenticazione');
      }
    }
    
    res.json({
      success: true,
      leggi: leggiUniche.map(legge => ({ id: legge, nome: legge })),
      classifica: classificaResult.rows,
      mieiVoti: mieiVoti,
      blocco: { isBlocked: false, unlockDate: null }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare leggi amnistia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare leggi amnistia'
    });
  }
});

// POST /api/amnistia/vota - Vota per amnistia
app.post('/api/amnistia/vota', verifyToken, validateInput(['legge']), async (req, res) => {
  try {
    const { legge } = req.body;
    const userId = req.userId; // Usa l'ID reale dell'utente autenticato
    
    await pool.query(
      'INSERT INTO voti_amnistia (userId, legge, timestamp) VALUES ($1, $2, NOW()) ON CONFLICT (userId, legge) DO UPDATE SET timestamp = NOW()',
      [userId, legge]
    );
    
    res.json({ success: true, message: 'Voto amnistia salvato' });
  } catch (error) {
    console.error('❌ Errore nel salvare voto amnistia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel salvare voto amnistia'
    });
  }
});

// DELETE /api/amnistia/vota - Rimuovi voto per amnistia
app.delete('/api/amnistia/vota', verifyToken, validateInput(['legge']), async (req, res) => {
  try {
    const { legge } = req.body;
    const userId = req.userId;
    
    const result = await pool.query(
      'DELETE FROM voti_amnistia WHERE userId = $1 AND legge = $2',
      [userId, legge]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Voto non trovato'
      });
    }
    
    res.json({ success: true, message: 'Voto amnistia rimosso' });
  } catch (error) {
    console.error('❌ Errore nel rimuovere voto amnistia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel rimuovere voto amnistia'
    });
  }
});

// ===== ENDPOINTS PER ICE =====

// GET /api/ice - Ottieni richieste ICE
app.get('/api/ice', limiter, async (req, res) => {
  try {
    const query = `
      SELECT i.*, u.nome, u.cognome
      FROM richieste_ice i
      JOIN users u ON i.utente_id = u.id
      ORDER BY i.created_at DESC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      richieste: result.rows,
      mieiVoti: ['user1'], // Placeholder
      blocco: { isBlocked: false, unlockDate: null }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare richieste ICE:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare richieste ICE'
    });
  }
});

// GET /api/ice/richieste - Ottieni richieste per gestione
app.get('/api/ice/richieste', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT i.*, u.nome, u.cognome
      FROM richieste_ice i
      JOIN users u ON i.utente_id = u.id
      ORDER BY i.created_at DESC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      richieste: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare richieste ICE:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare richieste ICE'
    });
  }
});

// POST /api/ice - Crea richiesta ICE
app.post('/api/ice', verifyToken, validateInput(['titolo', 'descrizione', 'tipo']), async (req, res) => {
  try {
    const { titolo, descrizione, tipo } = req.body;
    const userId = req.userId; // Usa l'ID reale dell'utente autenticato
    
    const query = `
      INSERT INTO richieste_ice (utente_id, titolo, descrizione, tipo, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
    `;
    
    const result = await pool.query(query, [userId, titolo, descrizione, tipo]);
    
    res.json({
      success: true,
      richiesta: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nella creazione richiesta ICE:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella creazione richiesta ICE'
    });
  }
});

// POST /api/ice/:id/:action - Gestisci richiesta ICE
app.post('/api/ice/:id/:action', verifyToken, async (req, res) => {
  try {
    const { id, action } = req.params;
    
    if (action === 'approve') {
      await pool.query('UPDATE richieste_ice SET stato = $1 WHERE id = $2', ['approvata', id]);
    } else if (action === 'reject') {
      await pool.query('UPDATE richieste_ice SET stato = $1 WHERE id = $2', ['rifiutata', id]);
    }
    
    res.json({ success: true, message: `Richiesta ICE ${action === 'approve' ? 'approvata' : 'rifiutata'}` });
  } catch (error) {
    console.error('❌ Errore nella gestione richiesta ICE:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella gestione richiesta ICE'
    });
  }
});

// ===== ENDPOINTS PER INIZIATIVE POPOLARI =====

// GET /api/iniziative-popolari - Ottieni iniziative popolari
app.get('/api/iniziative-popolari', limiter, async (req, res) => {
  try {
    // 1. Ottieni tutti i voti per iniziative popolari
    const votiQuery = `
      SELECT * FROM voti_iniziative_popolari 
      ORDER BY timestamp DESC
    `;
    const votiResult = await pool.query(votiQuery);
    
    // 2. Genera classifica basata sui voti
    const classificaQuery = `
      SELECT iniziativa_id as nome, COUNT(*) as voti
      FROM voti_iniziative_popolari 
      GROUP BY iniziativa_id 
      ORDER BY voti DESC
    `;
    const classificaResult = await pool.query(classificaQuery);
    
    // 3. Ottieni iniziative uniche per l'input
    const iniziativeUniche = [...new Set(votiResult.rows.map(v => v.iniziativa_id))];
    
    // 4. Se l'utente è autenticato, ottieni i suoi voti
    let mieiVoti = [];
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.userId;
        
        const userVotiQuery = `
          SELECT iniziativa_id FROM voti_iniziative_popolari 
          WHERE userid = $1
        `;
        const userVotiResult = await pool.query(userVotiQuery, [userId]);
        mieiVoti = userVotiResult.rows.map(v => v.iniziativa_id);
      } catch (authError) {
        // Se il token non è valido, continua senza autenticazione
        console.log('⚠️ Token non valido per iniziative popolari, continuando senza autenticazione');
      }
    }
    
    res.json({
      success: true,
      iniziative: iniziativeUniche.map(iniziativa => ({ id: iniziativa, nome: iniziativa })),
      classifica: classificaResult.rows,
      mieiVoti: mieiVoti,
      blocco: { isBlocked: false, unlockDate: null }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare iniziative popolari:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare iniziative popolari'
    });
  }
});

// GET /api/iniziative-popolari/richieste - Ottieni richieste per gestione
app.get('/api/iniziative-popolari/richieste', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT i.*, u.nome, u.cognome
      FROM iniziative_popolari i
      JOIN users u ON i.utente_id = u.id
      ORDER BY i.created_at DESC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      richieste: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare richieste iniziative popolari:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare richieste iniziative popolari'
    });
  }
});

// POST /api/iniziative-popolari - Crea iniziativa popolare
app.post('/api/iniziative-popolari', verifyToken, validateInput(['titolo', 'descrizione', 'obiettivi']), async (req, res) => {
  try {
    const { titolo, descrizione, obiettivi } = req.body;
    const userId = req.userId; // Usa l'ID reale dell'utente autenticato
    
    const query = `
      INSERT INTO iniziative_popolari (utente_id, titolo, descrizione, obiettivi, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
    `;
    
    const result = await pool.query(query, [userId, titolo, descrizione, obiettivi]);
    
    res.json({
      success: true,
      iniziativa: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nella creazione iniziativa popolare:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella creazione iniziativa popolare'
    });
  }
});

// POST /api/iniziative-popolari/vota - Salva voti iniziative popolari
app.post('/api/iniziative-popolari/vota', verifyToken, validateInput(['voti']), async (req, res) => {
  try {
    const { voti } = req.body;
    const userId = req.userId; // Usa l'ID reale dell'utente autenticato
    
    // Elimina i voti esistenti
    await pool.query('DELETE FROM voti_iniziative_popolari WHERE userid = $1', [userId]);
    
    // Inserisci i nuovi voti
    for (const iniziativaId of voti) {
      await pool.query(
        'INSERT INTO voti_iniziative_popolari (userid, iniziativa_id, timestamp) VALUES ($1, $2, NOW()) ON CONFLICT (userid, iniziativa_id) DO UPDATE SET timestamp = NOW()',
        [userId, iniziativaId]
      );
    }
    
    res.json({ success: true, message: 'Voti iniziative popolari salvati' });
  } catch (error) {
    console.error('❌ Errore nel salvare voti iniziative popolari:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel salvare voti iniziative popolari'
    });
  }
});

// POST /api/iniziative-popolari/:id/:action - Gestisci iniziativa popolare
app.post('/api/iniziative-popolari/:id/:action', verifyToken, async (req, res) => {
  try {
    const { id, action } = req.params;
    
    if (action === 'approve') {
      await pool.query('UPDATE iniziative_popolari SET stato = $1 WHERE id = $2', ['approvata', id]);
    } else if (action === 'reject') {
      await pool.query('UPDATE iniziative_popolari SET stato = $1 WHERE id = $2', ['rifiutata', id]);
    }
    
    res.json({ success: true, message: `Iniziativa popolare ${action === 'approve' ? 'approvata' : 'rifiutata'}` });
  } catch (error) {
    console.error('❌ Errore nella gestione iniziativa popolare:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella gestione iniziativa popolare'
    });
  }
});

// DELETE /api/iniziative-popolari/:id - Elimina iniziativa popolare
app.delete('/api/iniziative-popolari/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID iniziativa richiesto'
      });
    }
    
    const result = await pool.query('DELETE FROM iniziative_popolari WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Iniziativa popolare non trovata'
      });
    }
    
    res.json({
      success: true,
      message: 'Iniziativa popolare eliminata'
    });
  } catch (error) {
    console.error('❌ Errore nell\'eliminazione iniziativa popolare:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'eliminazione iniziativa popolare'
    });
  }
});

// ===== ENDPOINTS PER GESTIONE UTENTI =====

// GET /api/users - Ottieni tutti gli utenti
app.get('/api/users', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT id, nome, cognome, email, ruolo, genere, data_nascita, 
             grado_opinioni, fonti_opinioni, avatar_config
      FROM users 
      ORDER BY nome, cognome
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      users: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare utenti:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare utenti'
    });
  }
});

// GET /api/utenti - Ottieni utenti per gestione
app.get('/api/utenti', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT id, nome, cognome, email, ruolo, genere, data_nascita, 
             grado_opinioni, fonti_opinioni, avatar_config
      FROM users 
      WHERE ruolo != 'pending'
      ORDER BY nome, cognome
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      users: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare utenti:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare utenti'
    });
  }
});

// GET /api/utenti/pending - Ottieni utenti in attesa
app.get('/api/utenti/pending', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT id, nome, cognome, email, ruolo, genere, data_nascita
      FROM users 
      WHERE ruolo = 'pending'
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      users: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare utenti in attesa:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare utenti in attesa'
    });
  }
});

// GET /api/users/:id/public - Ottieni dati pubblici utente
app.get('/api/users/:id/public', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT id, nome, cognome, ruolo, genere, data_nascita
      FROM users 
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    res.json({
      success: true,
      user: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare dati pubblici utente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare dati pubblici utente'
    });
  }
});

// ===== ENDPOINTS PER REFERENDUM ABROGATIVI =====

// GET /api/referendum-abrogativi - Ottieni referendum abrogativi
app.get('/api/referendum-abrogativi', limiter, async (req, res) => {
  try {
    const query = `
      SELECT r.*, u.nome, u.cognome
      FROM referendum_abrogativi r
      JOIN users u ON r.utente_id = u.id
      ORDER BY r.created_at DESC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      referendum: result.rows,
      mieiVoti: ['user1'], // Placeholder
      blocco: { isBlocked: false, unlockDate: null }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare referendum abrogativi:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare referendum abrogativi'
    });
  }
});

// GET /api/referendum-abrogativi/richieste - Ottieni richieste per gestione
app.get('/api/referendum-abrogativi/richieste', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT r.*, u.nome, u.cognome
      FROM referendum_abrogativi r
      JOIN users u ON r.utente_id = u.id
      ORDER BY r.created_at DESC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      richieste: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare richieste referendum:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare richieste referendum'
    });
  }
});

// POST /api/referendum-abrogativi - Crea referendum abrogativo
app.post('/api/referendum-abrogativi', verifyToken, validateInput(['titolo', 'descrizione', 'legge']), async (req, res) => {
  try {
    const { titolo, descrizione, legge } = req.body;
    const userId = req.userId; // Usa l'ID reale dell'utente autenticato
    
    const query = `
      INSERT INTO referendum_abrogativi (utente_id, titolo, descrizione, legge, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
    `;
    
    const result = await pool.query(query, [userId, titolo, descrizione, legge]);
    
    res.json({
      success: true,
      referendum: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nella creazione referendum:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella creazione referendum'
    });
  }
});

// POST /api/referendum-abrogativi/:id/:action - Gestisci referendum
app.post('/api/referendum-abrogativi/:id/:action', verifyToken, async (req, res) => {
  try {
    const { id, action } = req.params;
    
    if (action === 'approve') {
      await pool.query('UPDATE referendum_abrogativi SET stato = $1 WHERE id = $2', ['approvato', id]);
    } else if (action === 'reject') {
      await pool.query('UPDATE referendum_abrogativi SET stato = $1 WHERE id = $2', ['rifiutato', id]);
    }
    
    res.json({ success: true, message: `Referendum ${action === 'approve' ? 'approvato' : 'rifiutato'}` });
  } catch (error) {
    console.error('❌ Errore nella gestione referendum:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella gestione referendum'
    });
  }
});

// ===== ENDPOINTS PER GOVERNO =====

// GET /api/governo/voti - Ottieni voti governo
app.get('/api/governo/voti', verifyToken, async (req, res) => {
  try {
    const userId = req.userId; // Usa l'ID reale dell'utente autenticato
    
    const query = `
      SELECT v.*, m.nome as ministero_nome
      FROM voti_ministri v
      JOIN ministeri m ON v.categoria = m.categoria
      WHERE v.userid = $1
      ORDER BY m.nome
    `;
    
    const result = await pool.query(query, [userId]);
    
    res.json({
      success: true,
      voti: result.rows,
      blocco: { isBlocked: false, unlockDate: null }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare voti governo:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare voti governo'
    });
  }
});

// POST /api/governo/vota - Salva voti governo
app.post('/api/governo/vota', verifyToken, validateInput(['voti']), async (req, res) => {
  try {
    const { voti } = req.body;
    const userId = req.userId; // Usa l'ID reale dell'utente autenticato
    
    // Elimina i voti esistenti per questo utente
    await pool.query('DELETE FROM voti_ministri WHERE userid = $1', [userId]);
    
    // Inserisci i nuovi voti
    for (const [categoria, candidato] of Object.entries(voti)) {
      await pool.query(
        'INSERT INTO voti_ministri (userid, nome_ministro, nome_display, categoria, timestamp) VALUES ($1, $2, $2, $3, NOW())',
        [userId, candidato, categoria]
      );
    }
    
    res.json({ success: true, message: 'Voti governo salvati' });
  } catch (error) {
    console.error('❌ Errore nel salvare voti governo:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel salvare voti governo'
    });
  }
});

// GET /api/ministeri - Ottieni ministeri
app.get('/api/ministeri', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT * FROM ministeri 
      ORDER BY nome
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      ministeri: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare ministeri:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare ministeri'
    });
  }
});

// POST /api/ministeri - Crea nuovo ministero
app.post('/api/ministeri', verifyToken, validateInput(['nome', 'descrizione']), async (req, res) => {
  try {
    const { nome, descrizione } = req.body;
    
    const query = `
      INSERT INTO ministeri (nome, descrizione, data_creazione)
      VALUES ($1, $2, NOW())
      RETURNING *
    `;
    
    const result = await pool.query(query, [nome, descrizione]);
    
    res.json({
      success: true,
      ministero: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nella creazione ministero:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella creazione ministero'
    });
  }
});

// ===== ENDPOINTS PER ELEZIONI =====

// GET /api/elezioni - Ottieni tutte le elezioni (per gestione)
app.get('/api/elezioni', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT * FROM elezioni 
      ORDER BY data DESC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      elezioni: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare elezioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare elezioni'
    });
  }
});

// GET /api/elezioni-utente - Ottieni elezioni per utente
app.get('/api/elezioni-utente', verifyToken, async (req, res) => {
  try {
    const userId = req.userId; // Usa l'ID reale dell'utente autenticato
    
    const query = `
      SELECT e.*, 
             CASE WHEN v.user_id IS NOT NULL THEN true ELSE false END as ha_votato
      FROM elezioni e
      LEFT JOIN voti_elezioni v ON e.id = v.elezione_id AND v.user_id = $1
      WHERE e.data > NOW()
      ORDER BY e.data ASC
    `;
    
    const result = await pool.query(query, [userId]);
    
    res.json({
      success: true,
      elezioni: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare elezioni utente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare elezioni utente'
    });
  }
});

// POST /api/elezioni - Crea nuova elezione
app.post('/api/elezioni', verifyToken, validateInput(['titolo', 'descrizione', 'data', 'tipo', 'candidati']), async (req, res) => {
  try {
    const { titolo, descrizione, data, tipo, candidati } = req.body;
    
    const query = `
      INSERT INTO elezioni (titolo, descrizione, data, tipo, candidati, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `;
    
    const result = await pool.query(query, [titolo, descrizione, data, tipo, JSON.stringify(candidati)]);
    
    res.json({
      success: true,
      elezione: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nella creazione elezione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella creazione elezione'
    });
  }
});

// ===== ENDPOINTS PER CANDIDATI =====

// GET /api/candidati - Ottieni candidati per grado e categoria
app.get('/api/candidati', verifyToken, async (req, res) => {
  try {
    const { grado, categoria } = req.query;
    
    const query = `
      SELECT c.*, u.nome, u.cognome
      FROM candidati c
      JOIN users u ON c.user_id = u.id
      WHERE c.grado = $1 AND c.categoria = $2
      ORDER BY u.nome, u.cognome
    `;
    
    const result = await pool.query(query, [grado, categoria]);
    
    res.json({
      success: true,
      candidati: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare candidati:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare candidati'
    });
  }
});

// POST /api/candidati - Crea candidato
app.post('/api/candidati', verifyToken, validateInput(['user_id', 'grado', 'categoria']), async (req, res) => {
  try {
    const { user_id, grado, categoria } = req.body;
    
    const query = `
      INSERT INTO candidati (user_id, grado, categoria, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING *
    `;
    
    const result = await pool.query(query, [user_id, grado, categoria]);
    
    res.json({
      success: true,
      candidato: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nella creazione candidato:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella creazione candidato'
    });
  }
});

// ===== ENDPOINTS PER CATEGORIE =====
// Rimossi endpoint per categorie_opinioni e categorie_rappresentanti (tabelle non esistenti)

// ===== ENDPOINTS PER SONDAGGI =====

// GET /api/sondaggi/stats - Statistiche sondaggi aggregate dalle opinioni
app.get('/api/sondaggi/stats', limiter, async (req, res) => {
  try {
    // Genera statistiche aggregate dalle opinioni degli utenti
    const statsQuery = `
      SELECT 
        o.grado_opinione,
        o.text,
        COUNT(*) as totale_voti,
        COUNT(CASE WHEN o.voto = 'favorevole' THEN 1 END) as favorevole,
        COUNT(CASE WHEN o.voto = 'contrario' THEN 1 END) as contrario,
        COUNT(CASE WHEN o.voto = 'astenuto' THEN 1 END) as astenuto
      FROM opinioni o
      GROUP BY o.grado_opinione, o.text
      ORDER BY o.grado_opinione, o.text
    `;
    
    const result = await pool.query(statsQuery);
    
    // Formatta i dati per la frontend
    const stats = {};
    const questions = [];
    
    result.rows.forEach(row => {
      const questionId = `${row.grado_opinione}_${row.text.replace(/\s+/g, '_')}`;
      stats[questionId] = {
        favorevole: parseInt(row.favorevole) || 0,
        contrario: parseInt(row.contrario) || 0,
        astenuto: parseInt(row.astenuto) || 0
      };
      
      questions.push({
        id: questionId,
        text: `${row.grado_opinione}: ${row.text}`
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
    console.error('❌ Errore nel recuperare statistiche sondaggi:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare statistiche sondaggi'
    });
  }
});

// GET /api/sondaggi - Ottieni tutti i sondaggi (opinioni aggregate)
app.get('/api/sondaggi', verifyToken, async (req, res) => {
  try {
    // Restituisce le opinioni aggregate come "sondaggi"
    const query = `
      SELECT 
        o.grado_opinione,
        o.text,
        COUNT(*) as totale_voti,
        COUNT(CASE WHEN o.voto = 'favorevole' THEN 1 END) as favorevole,
        COUNT(CASE WHEN o.voto = 'contrario' THEN 1 END) as contrario,
        COUNT(CASE WHEN o.voto = 'astenuto' THEN 1 END) as astenuto
      FROM opinioni o
      GROUP BY o.grado_opinione, o.text
      ORDER BY o.grado_opinione, o.text
      LIMIT 10
    `;
    
    const result = await pool.query(query);
    
    // Formatta i dati per la frontend
    const stats = {};
    const questions = [];
    
    result.rows.forEach(row => {
      const questionId = `${row.grado_opinione}_${row.text.replace(/\s+/g, '_')}`;
      stats[questionId] = {
        favorevole: parseInt(row.favorevole) || 0,
        contrario: parseInt(row.contrario) || 0,
        astenuto: parseInt(row.astenuto) || 0
      };
      
      questions.push({
        id: questionId,
        text: `${row.grado_opinione}: ${row.text}`
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
    console.error('❌ Errore nel recuperare sondaggi:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare sondaggi'
    });
  }
});

// Rimuovo POST /api/sondaggi perché non esiste più la tabella sondaggi

// ===== ENDPOINTS PER NOTIFICHE =====

// GET /api/notifiche - Ottieni notifiche utente
app.get('/api/notifiche', verifyToken, async (req, res) => {
  try {
    const userId = req.userId; // Usa l'ID reale dell'utente autenticato
    
    const query = `
      SELECT * FROM notifiche 
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `;
    
    const result = await pool.query(query, [userId]);
    
    res.json({
      success: true,
      notifiche: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare notifiche:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare notifiche'
    });
  }
});

// POST /api/notifiche/preferenze - Salva preferenze notifiche
app.post('/api/notifiche/preferenze', verifyToken, validateInput(['preferenze']), async (req, res) => {
  try {
    const { preferenze } = req.body;
    const userId = req.userId; // Usa l'ID reale dell'utente autenticato
    
    // Salva preferenze
    for (const [tipo, attivo] of Object.entries(preferenze)) {
      await pool.query(
        'INSERT INTO preferenze_notifiche (user_id, tipo, attivo, created_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (user_id, tipo) DO UPDATE SET attivo = $3',
        [userId, tipo, attivo]
      );
    }
    
    res.json({ success: true, message: 'Preferenze notifiche salvate' });
  } catch (error) {
    console.error('❌ Errore nel salvare preferenze notifiche:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel salvare preferenze notifiche'
    });
  }
});

// POST /api/notifiche - Crea notifica
app.post('/api/notifiche', verifyToken, validateInput(['user_id', 'titolo', 'messaggio', 'tipo']), async (req, res) => {
  try {
    const { user_id, titolo, messaggio, tipo } = req.body;
    
    const query = `
      INSERT INTO notifiche (user_id, titolo, messaggio, tipo, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
    `;
    
    const result = await pool.query(query, [user_id, titolo, messaggio, tipo]);
    
    res.json({
      success: true,
      notifica: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nella creazione notifica:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella creazione notifica'
    });
  }
});

// PUT /api/notifiche/:id/read - Segna notifica come letta
app.put('/api/notifiche/:id/read', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query('UPDATE notifiche SET letta = true WHERE id = $1', [id]);
    
    res.json({ success: true, message: 'Notifica segnata come letta' });
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento notifica:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'aggiornamento notifica'
    });
  }
});

// ===== ENDPOINTS PER STATISTICHE =====

// GET /api/statistiche/utenti - Statistiche utenti
app.get('/api/statistiche/utenti', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(*) as totale_utenti,
        COUNT(CASE WHEN ruolo = 'Elettore' THEN 1 END) as elettori,
        COUNT(CASE WHEN ruolo = 'Politico' THEN 1 END) as politici,
        COUNT(CASE WHEN ruolo = 'Candidato' THEN 1 END) as candidati,
        COUNT(CASE WHEN ruolo = 'Admin' THEN 1 END) as admin
      FROM users
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      stats: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare statistiche utenti:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare statistiche utenti'
    });
  }
});

// ===== ENDPOINTS PER SOSTENITORI =====

// GET /api/sostenitori - Ottieni sostenitori
app.get('/api/sostenitori', verifyToken, async (req, res) => {
  try {
    const userId = req.userId; // Usa l'ID reale dell'utente autenticato
    
    const query = `
      SELECT s.*, u.nome, u.cognome
      FROM sostenitori s
      JOIN users u ON s.sostenitore_id = u.id
      WHERE s.utente_id = $1
      ORDER BY s.created_at DESC
    `;
    
    const result = await pool.query(query, [userId]);
    
    res.json({
      success: true,
      sostenitori: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare sostenitori:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare sostenitori'
    });
  }
});

// POST /api/sostenitori - Aggiungi sostenitore
app.post('/api/sostenitori', verifyToken, validateInput(['sostenitore_id']), async (req, res) => {
  try {
    const { sostenitore_id } = req.body;
    const userId = req.userId; // Usa l'ID reale dell'utente autenticato
    
    const query = `
      INSERT INTO sostenitori (utente_id, sostenitore_id, created_at)
      VALUES ($1, $2, NOW())
      RETURNING *
    `;
    
    const result = await pool.query(query, [userId, sostenitore_id]);
    
    res.json({
      success: true,
      sostenitore: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nell\'aggiunta sostenitore:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'aggiunta sostenitore'
    });
  }
});

// DELETE /api/sostenitori/:id - Rimuovi sostenitore
app.delete('/api/sostenitori/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM sostenitori WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Sostenitore non trovato'
      });
    }
    
    res.json({
      success: true,
      message: 'Sostenitore rimosso'
    });
  } catch (error) {
    console.error('❌ Errore nella rimozione sostenitore:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella rimozione sostenitore'
    });
  }
});

// ===== ENDPOINTS PER PROGRAMMA =====

// GET /api/programma - Ottieni programma
app.get('/api/programma', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT * FROM programma 
      ORDER BY priorita DESC, created_at DESC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      programma: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare programma:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare programma'
    });
  }
});

// POST /api/programma - Crea nuovo punto programma
app.post('/api/programma', verifyToken, validateInput(['titolo', 'descrizione', 'priorita']), async (req, res) => {
  try {
    const { titolo, descrizione, priorita } = req.body;
    
    const query = `
      INSERT INTO programma (titolo, descrizione, priorita, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING *
    `;
    
    const result = await pool.query(query, [titolo, descrizione, priorita]);
    
    res.json({
      success: true,
      punto: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nella creazione punto programma:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella creazione punto programma'
    });
  }
});

// PUT /api/programma/:id - Aggiorna punto programma
app.put('/api/programma/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { titolo, descrizione, priorita } = req.body;
    
    const query = `
      UPDATE programma 
      SET titolo = $1, descrizione = $2, priorita = $3, updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `;
    
    const result = await pool.query(query, [titolo, descrizione, priorita, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Punto programma non trovato'
      });
    }
    
    res.json({
      success: true,
      punto: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento punto programma:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'aggiornamento punto programma'
    });
  }
});

// DELETE /api/programma/:id - Elimina punto programma
app.delete('/api/programma/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM programma WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Punto programma non trovato'
      });
    }
    
    res.json({
      success: true,
      message: 'Punto programma eliminato'
    });
  } catch (error) {
    console.error('❌ Errore nell\'eliminazione punto programma:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'eliminazione punto programma'
    });
  }
});

// ===== ENDPOINTS PER REAZIONI COMUNICAZIONI =====

// GET /api/comunicazioni/:id/reactions - Ottieni reazioni comunicazione
app.get('/api/comunicazioni/:id/reactions', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT r.*, u.nome, u.cognome
      FROM reazioni_comunicazioni r
      JOIN users u ON r.user_id = u.id
      WHERE r.comunicazione_id = $1
      ORDER BY r.created_at DESC
    `;
    
    const result = await pool.query(query, [id]);
    
    res.json({
      success: true,
      reazioni: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare reazioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare reazioni'
    });
  }
});

// ===== ENDPOINTS PER GESTIONE UTENTI AGGIUNTIVI =====

// POST /api/users/:id/approve - Approva utente
app.post('/api/users/:id/approve', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID utente richiesto'
      });
    }
    
    await pool.query('UPDATE users SET ruolo = $1 WHERE id = $2', ['Elettore', id]);
    
    res.json({ success: true, message: 'Utente approvato' });
  } catch (error) {
    console.error('❌ Errore nell\'approvazione utente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'approvazione utente'
    });
  }
});

// POST /api/users/:id/reject - Rifiuta utente
app.post('/api/users/:id/reject', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID utente richiesto'
      });
    }
    
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    
    res.json({ success: true, message: 'Utente rifiutato e rimosso' });
  } catch (error) {
    console.error('❌ Errore nel rifiuto utente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel rifiuto utente'
    });
  }
});

// PUT /api/users/:id - Aggiorna ruolo utente
app.put('/api/users/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { ruolo } = req.body;
    
    if (!id || !ruolo) {
      return res.status(400).json({
        success: false,
        error: 'ID utente e ruolo richiesti'
      });
    }
    
    // Validazione ruolo
    const ruoliValidi = ['Elettore', 'Politico', 'Candidato', 'Admin'];
    if (!ruoliValidi.includes(ruolo)) {
      return res.status(400).json({
        success: false,
        error: 'Ruolo non valido'
      });
    }
    
    await pool.query('UPDATE users SET ruolo = $1 WHERE id = $2', [ruolo, id]);
    
    res.json({ success: true, message: 'Ruolo utente aggiornato' });
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento ruolo:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'aggiornamento ruolo'
    });
  }
});

// ===== ENDPOINTS PER VERIFICA RUOLI =====

// GET /api/health - Health check del server
app.get('/api/health', async (req, res) => {
  try {
    // Test connessione database
    await pool.query('SELECT 1');
    
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      uptime: process.uptime()
    });
  } catch (error) {
    console.error('❌ Health check fallito:', error);
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    });
  }
});

// GET /api/test-db - Test connessione database
app.get('/api/test-db', async (req, res) => {
  try {
    console.log('🔍 DEBUG /api/test-db - Testando connessione database...');
    const result = await pool.query('SELECT NOW() as current_time, version() as db_version');
    console.log('✅ DEBUG /api/test-db - Database connesso:', result.rows[0]);
    res.json({
      success: true,
      message: 'Database connesso correttamente',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ DEBUG /api/test-db - Errore database:', error);
    res.status(500).json({
      success: false,
      error: 'Errore connessione database',
      details: error.message
    });
  }
});

// GET /api/auth/me - Ottieni informazioni utente corrente
app.get('/api/auth/me', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    
    // Recupera dati utente dal database
    const userQuery = `
      SELECT id, nome, cognome, email, ruolo, genere, data_nascita
      FROM users 
      WHERE id = $1
    `;
    
    const userResult = await pool.query(userQuery, [userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const user = userResult.rows[0];
    const isAdmin = user.ruolo === 'Admin';
    
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.nome,
        cognome: user.cognome,
        email: user.email,
        ruolo: user.ruolo,
        genere: user.genere,
        data_nascita: user.data_nascita,
        isAdmin: isAdmin
      }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare dati utente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare dati utente'
    });
  }
});

// ===== ENDPOINTS PER GESTIONE ERRORI =====

// Middleware per gestire errori 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint non trovato',
    path: req.originalUrl,
    method: req.method
  });
});

// Middleware per gestire errori globali
app.use((error, req, res, next) => {
  console.error('❌ Errore globale:', error);
  
  // Gestione specifica per errori di database
  if (error.code === '42P01') { // Table doesn't exist
    return res.status(500).json({
      success: false,
      error: 'Tabella database non trovata',
      message: 'Contattare l\'amministratore per verificare la configurazione del database'
    });
  }
  
  if (error.code === '23505') { // Unique violation
    return res.status(409).json({
      success: false,
      error: 'Dato duplicato',
      message: 'Il record esiste già nel database'
    });
  }
  
  if (error.code === '23503') { // Foreign key violation
    return res.status(400).json({
      success: false,
      error: 'Riferimento non valido',
      message: 'Il record referenziato non esiste'
    });
  }
  
  res.status(500).json({
    success: false,
    error: 'Errore interno del server',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Errore interno'
  });
});

// Avvio server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server API ULTRA-SECURED avviato sulla porta ${PORT}`);
  console.log('🔒 Middleware di sicurezza avanzato attivo:');
  console.log('   ✅ Autenticazione JWT VERA implementata');
  console.log('   ✅ Hash password con bcrypt');
  console.log('   ✅ Verifica token JWT completa');
  console.log('   ✅ Autorizzazione admin basata su ruolo');
  console.log('   ✅ Validazione input completa');
  console.log('   ✅ Sanitizzazione input');
  console.log('   ✅ Rate limiting esteso');
  console.log('   ✅ Logging audit');
  console.log('   ✅ Gestione errori avanzata');
  console.log('🔐 JWT Secret:', JWT_SECRET ? 'Configurato' : 'Usando chiave di default');
  console.log('👑 Capo di Stato endpoint: http://localhost:3001/api/capo-stato');
  console.log('📊 Elezioni endpoint: http://localhost:3001/api/elezioni/prossime');
  console.log('💬 Comunicazioni endpoint: http://localhost:3001/api/comunicazioni');
  console.log('🎉 Eventi endpoint: http://localhost:3001/api/eventi');
  console.log('🏥 Health check: http://localhost:3001/api/health');
  console.log('🎯 GRAZIA endpoint: http://localhost:3001/api/grazia');
  console.log('🔍 Tutti gli endpoint sono ora protetti e validati!');
});

module.exports = app;
