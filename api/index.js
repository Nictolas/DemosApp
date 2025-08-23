const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'https://www.demos.community'],
  credentials: true
}));
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
  // Per ora saltiamo la verifica JWT per semplificare
  next();
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

// ===== ENDPOINTS PER CAPO DI STATO =====

// GET /api/capo-stato - Ottieni tutti i voti per il capo di stato
app.get('/api/capo-stato', async (req, res) => {
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
app.post('/api/capo-stato/vota', verifyToken, async (req, res) => {
  try {
    const { voti } = req.body;
    const userId = 'user1'; // Per ora hardcoded
    
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
app.post('/api/comunicazioni', verifyToken, async (req, res) => {
  try {
    const { titolo, contenuto, tipo } = req.body;
    const userId = 'user1'; // Per ora hardcoded
    
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

// GET /api/comunicazioni/check-duplicate - Verifica duplicati
app.get('/api/comunicazioni/check-duplicate', verifyToken, async (req, res) => {
  try {
    const { titolo, contenuto } = req.query;
    const userId = 'user1'; // Per ora hardcoded
    
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
    const userId = 'user1'; // Per ora hardcoded
    
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
app.post('/api/eventi', verifyToken, async (req, res) => {
  try {
    const { titolo, descrizione, data, luogo } = req.body;
    const userId = 'user1'; // Per ora hardcoded
    
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

// ===== ENDPOINTS PER RAPPRESENTANTI =====

// GET /api/rappresentanti - Ottieni rappresentanti dell'utente
app.get('/api/rappresentanti', verifyToken, async (req, res) => {
  try {
    const userId = 'user1'; // Per ora hardcoded
    
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

// Avvio server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server API pulito avviato sulla porta ${PORT}`);
  console.log('👑 Capo di Stato endpoint: http://localhost:3001/api/capo-stato');
  console.log('📊 Elezioni endpoint: http://localhost:3001/api/elezioni/prossime');
  console.log('💬 Comunicazioni endpoint: http://localhost:3001/api/comunicazioni');
  console.log('🎉 Eventi endpoint: http://localhost:3001/api/eventi');
});

module.exports = app;
