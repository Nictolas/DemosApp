const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
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
  origin: [
    'http://localhost:3000', 
    'http://127.0.0.1:3000', 
    'https://www.demos.community',
    'https://demos.community'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Gestione richieste preflight OPTIONS
app.options('*', cors());

app.use(express.json());

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Middleware per verificare il token JWT
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'Token mancante' });
  }
  
  try {
    // Per ora estraiamo l'user ID dal token (in futuro sarà JWT.decode)
    // Simuliamo l'estrazione dell'user ID dal token
    const decodedToken = { userId: 'user1' }; // Placeholder per JWT.decode(token)
    
    // Aggiungiamo l'user ID alla request per uso futuro
    req.userId = decodedToken.userId;
    next();
  } catch (error) {
    console.error('❌ Errore nella verifica token:', error);
    return res.status(401).json({ success: false, message: 'Token non valido' });
  }
};

// Middleware per verificare se l'utente è admin
const requireAdmin = (req, res, next) => {
  // Per ora controlliamo se l'utente è admin (in futuro sarà dal database)
  if (req.userId === 'admin1') {
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
    // Per ora restituiamo un utente mock per test
    res.json({
      success: true,
      user: {
        id: 'user1',
        nome: 'Utente',
        cognome: 'Test',
        email: 'test@example.com',
        ruolo: 'Elettore'
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

// POST /api/auth/login - Login utente
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔐 Tentativo di login per:', email);
    
    // Per ora restituiamo un utente mock per test
    // In futuro qui andrà la vera autenticazione con Neon
    res.json({
      success: true,
      user: {
        id: 'user1',
        nome: 'Utente',
        cognome: 'Test',
        email: email,
        ruolo: 'Elettore'
      },
      token: 'mock-jwt-token-123'
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
    
    // Per ora restituiamo un utente mock per test
    res.json({
      success: true,
      user: {
        id: 'user1',
        nome: nome,
        cognome: cognome,
        email: email,
        ruolo: 'Elettore'
      },
      token: 'mock-jwt-token-123'
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
app.get('/api/elezioni/prossime', async (req, res) => {
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
app.put('/api/eventi/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { titolo, descrizione, data, luogo } = req.body;
    
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
app.delete('/api/eventi/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
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
app.get('/api/eventi', async (req, res) => {
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
    const query = `
      SELECT o.*, c.nome as categoria_nome
      FROM opinioni o
      JOIN categorie_opinioni c ON o.categoria_id = c.id
      ORDER BY c.nome, o.grado DESC
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

// GET /api/opinioni - Ottieni tutte le opinioni (per gestione)
app.get('/api/opinioni', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT o.*, c.nome as categoria_nome
      FROM opinioni o
      JOIN categorie_opinioni c ON o.categoria_id = c.id
      ORDER BY c.nome, o.grado DESC
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
      SELECT o.*, c.nome as categoria_nome
      FROM opinioni o
      JOIN categorie_opinioni c ON o.categoria_id = c.id
      WHERE o.grado = $1
      ORDER BY c.nome
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
app.delete('/api/opinioni/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
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
app.delete('/api/rappresentanti/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
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

// GET /api/grazia - Ottieni richieste di grazia
app.get('/api/grazia', async (req, res) => {
  try {
    const query = `
      SELECT g.*, u.nome, u.cognome
      FROM richieste_grazia g
      JOIN users u ON g.utente_id = u.id
      ORDER BY g.created_at DESC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      classifica: result.rows,
      mieiVoti: ['user1'], // Placeholder
      blocco: { isBlocked: false, unlockDate: null }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare richieste grazia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare richieste grazia'
    });
  }
});

// GET /api/grazia/richieste - Ottieni richieste per gestione
app.get('/api/grazia/richieste', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT g.*, u.nome, u.cognome
      FROM richieste_grazia g
      JOIN users u ON g.utente_id = u.id
      ORDER BY g.created_at DESC
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
app.post('/api/grazia/vota', verifyToken, async (req, res) => {
  try {
    const { voti } = req.body;
    const userId = 'user1'; // Per ora hardcoded
    
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
      await pool.query('UPDATE richieste_grazia SET stato = $1 WHERE id = $2', ['approvata', id]);
    } else if (action === 'reject') {
      await pool.query('UPDATE richieste_grazia SET stato = $1 WHERE id = $2', ['rifiutata', id]);
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
app.get('/api/amnistia', async (req, res) => {
  try {
    const query = `
      SELECT * FROM leggi_amnistia 
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      leggi: result.rows,
      mieiVoti: ['user1'], // Placeholder
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
app.post('/api/amnistia/vota', verifyToken, async (req, res) => {
  try {
    const { legge } = req.body;
    const userId = 'user1'; // Per ora hardcoded
    
    await pool.query(
      'INSERT INTO voti_amnistia (user_id, legge, created_at) VALUES ($1, $2, NOW()) ON CONFLICT (user_id, legge) DO UPDATE SET created_at = NOW()',
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

// ===== ENDPOINTS PER ICE =====

// GET /api/ice - Ottieni richieste ICE
app.get('/api/ice', async (req, res) => {
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
app.get('/api/iniziative-popolari', async (req, res) => {
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
      iniziative: result.rows,
      mieiVoti: ['user1'], // Placeholder
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
app.post('/api/iniziative-popolari', verifyToken, async (req, res) => {
  try {
    const { titolo, descrizione, obiettivi } = req.body;
    const userId = 'user1'; // Per ora hardcoded
    
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
app.get('/api/referendum-abrogativi', async (req, res) => {
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
app.post('/api/referendum-abrogativi', verifyToken, async (req, res) => {
  try {
    const { titolo, descrizione, legge } = req.body;
    const userId = 'user1'; // Per ora hardcoded
    
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
    const userId = 'user1'; // Per ora hardcoded
    
    const query = `
      SELECT v.*, m.nome as ministero_nome
      FROM voti_governo v
      JOIN ministeri m ON v.ministero_id = m.id
      WHERE v.user_id = $1
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
app.post('/api/governo/vota', verifyToken, async (req, res) => {
  try {
    const { voti } = req.body;
    const userId = 'user1'; // Per ora hardcoded
    
    // Elimina i voti esistenti
    await pool.query('DELETE FROM voti_governo WHERE user_id = $1', [userId]);
    
    // Inserisci i nuovi voti
    for (const [ministeroId, candidato] of Object.entries(voti)) {
      await pool.query(
        'INSERT INTO voti_governo (user_id, ministero_id, candidato, created_at) VALUES ($1, $2, $3, NOW())',
        [userId, ministeroId, candidato]
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
app.post('/api/ministeri', verifyToken, async (req, res) => {
  try {
    const { nome, descrizione } = req.body;
    
    const query = `
      INSERT INTO ministeri (nome, descrizione, created_at)
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
    const userId = 'user1'; // Per ora hardcoded
    
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
app.post('/api/elezioni', verifyToken, async (req, res) => {
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
app.post('/api/candidati', verifyToken, async (req, res) => {
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

// GET /api/categorie-opinioni - Ottieni categorie opinioni
app.get('/api/categorie-opinioni', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT * FROM categorie_opinioni 
      ORDER BY nome
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      categorie: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare categorie opinioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare categorie opinioni'
    });
  }
});

// GET /api/categorie-rappresentanti - Ottieni categorie rappresentanti
app.get('/api/categorie-rappresentanti', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT * FROM categorie_rappresentanti 
      ORDER BY nome
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      categorie: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare categorie rappresentanti:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare categorie rappresentanti'
    });
  }
});

// ===== ENDPOINTS PER SONDAGGI =====

// GET /api/sondaggi/stats - Statistiche sondaggi
app.get('/api/sondaggi/stats', async (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(*) as totale_sondaggi,
        COUNT(CASE WHEN stato = 'attivo' THEN 1 END) as sondaggi_attivi,
        COUNT(CASE WHEN stato = 'chiuso' THEN 1 END) as sondaggi_chiusi
      FROM sondaggi
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      stats: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare statistiche sondaggi:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare statistiche sondaggi'
    });
  }
});

// GET /api/sondaggi - Ottieni tutti i sondaggi
app.get('/api/sondaggi', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT * FROM sondaggi 
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      sondaggi: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare sondaggi:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare sondaggi'
    });
  }
});

// POST /api/sondaggi - Crea nuovo sondaggio
app.post('/api/sondaggi', verifyToken, async (req, res) => {
  try {
    const { titolo, descrizione, domande, scadenza } = req.body;
    
    const query = `
      INSERT INTO sondaggi (titolo, descrizione, domande, scadenza, stato, created_at)
      VALUES ($1, $2, $3, $4, 'attivo', NOW())
      RETURNING *
    `;
    
    const result = await pool.query(query, [titolo, descrizione, JSON.stringify(domande), scadenza]);
    
    res.json({
      success: true,
      sondaggio: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nella creazione sondaggio:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella creazione sondaggio'
    });
  }
});

// ===== ENDPOINTS PER NOTIFICHE =====

// GET /api/notifiche - Ottieni notifiche utente
app.get('/api/notifiche', verifyToken, async (req, res) => {
  try {
    const userId = 'user1'; // Per ora hardcoded
    
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
app.post('/api/notifiche/preferenze', verifyToken, async (req, res) => {
  try {
    const { preferenze } = req.body;
    const userId = 'user1'; // Per ora hardcoded
    
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
app.post('/api/notifiche', verifyToken, async (req, res) => {
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
    const userId = 'user1'; // Per ora hardcoded
    
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
app.post('/api/sostenitori', verifyToken, async (req, res) => {
  try {
    const { sostenitore_id } = req.body;
    const userId = 'user1'; // Per ora hardcoded
    
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
app.post('/api/programma', verifyToken, async (req, res) => {
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

// GET /api/auth/me - Ottieni informazioni utente corrente
app.get('/api/auth/me', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    
    // Per ora restituiamo un utente mock per test
    // In futuro qui andrà la query al database
    const isAdmin = userId === 'admin1';
    
    res.json({
      success: true,
      user: {
        id: userId,
        nome: isAdmin ? 'Admin' : 'Utente',
        cognome: 'Test',
        email: 'test@example.com',
        ruolo: isAdmin ? 'Admin' : 'Elettore',
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
  console.log(`🚀 Server API SECURED avviato sulla porta ${PORT}`);
  console.log('🔒 Middleware di sicurezza attivo');
  console.log('👑 Capo di Stato endpoint: http://localhost:3001/api/capo-stato');
  console.log('📊 Elezioni endpoint: http://localhost:3001/api/elezioni/prossime');
  console.log('💬 Comunicazioni endpoint: http://localhost:3001/api/comunicazioni');
  console.log('🎉 Eventi endpoint: http://localhost:3001/api/eventi');
  console.log('🏥 Health check: http://localhost:3001/api/health');
  console.log('⚠️  ATTENZIONE: JWT ancora mock - implementare vera autenticazione in produzione!');
});

module.exports = app;
