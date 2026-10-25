const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { requirePoliticalConsent } = require('../middleware/politicalConsent');
const { requireVerifiedCivicIdentity } = require('../middleware/civicIdentity');
const { validateInput } = require('../middleware/validation');
const { pool } = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const referendumVoteRoutes = require('./referendum-vote');
const { getPoliticalConsentState } = require('../services/politicalConsentService');

const router = express.Router();

// F12-36 — voto Sì/No/Non voterei sui referendum realmente convocati.
// È distinto dalla vecchia classifica di priorità, che resta ritirata.
router.use('/vote-real', referendumVoteRoutes);

// ===== FUNZIONE PER GENERARE EMOJI AUTOMATICHE =====
/**
 * Genera un'emoji automatica basata sul contenuto del referendum
 */
function getEmojiAutomaticaReferendum(referendum) {
  const testo = `${referendum.nome || ''} ${referendum.titolo || ''} ${referendum.descrizione || ''} ${referendum.quesito || ''}`.toLowerCase();
  
  const emojiMap = [
    { keywords: ['educazione', 'scuola', 'istruzione'], emoji: '📚' },
    { keywords: ['ambiente', 'clima', 'energia'], emoji: '🌱' },
    { keywords: ['sanità', 'salute', 'ospedale'], emoji: '🏥' },
    { keywords: ['diritti', 'uguaglianza', 'discriminazione'], emoji: '🤝' },
    { keywords: ['lavoro', 'economia', 'iva', 'tasse'], emoji: '💼' },
    { keywords: ['giustizia', 'legge', 'penale', 'abrogativo'], emoji: '⚖️' },
    { keywords: ['cultura', 'arte'], emoji: '🎭' },
    { keywords: ['trasporti', 'mobilità'], emoji: '🚗' },
    { keywords: ['tecnologia', 'digitale'], emoji: '💻' },
    { keywords: ['famiglia', 'bambini'], emoji: '👨‍👩‍👧‍👦' },
    { keywords: ['animali'], emoji: '🐕' },
    { keywords: ['sport'], emoji: '⚽' },
    { keywords: ['cibo', 'agricoltura'], emoji: '🌾' },
    { keywords: ['casa', 'abitazione'], emoji: '🏠' },
    { keywords: ['sicurezza', 'polizia'], emoji: '🛡️' },
    { keywords: ['democrazia', 'politica', 'elezioni', 'voto', 'referendum'], emoji: '🗳️' }
  ];
  
  for (const mapping of emojiMap) {
    if (mapping.keywords.some(keyword => testo.includes(keyword))) {
      return mapping.emoji;
    }
  }
  
  return '🗳️';
}

// GET /api/referendum-abrogativi - Ottieni referendum abrogativi (endpoint root)
router.get('/', async (req, res) => {
  try {
    // 1. Ottieni referendum abrogativi accettati con JOIN per i nomi
    const referendumQuery = `
      SELECT DISTINCT r.id, r.nome, r.data_inizio, r.data_fine, r.status, r.quorum, r.firestore_id_backup
      FROM referendum_abrogativi r
      WHERE (r.status = 'A' OR r.status = 'a' OR r.status = 'P' OR r.status = 'p')
      ORDER BY r.nome
    `;
    const referendumResult = await pool.query(referendumQuery);

    // 2. Genera classifica basata sui voti con nomi reali (includendo anche quelli con zero voti)
    const classificaQuery = `
      SELECT r.nome, COALESCE(COUNT(v.referendum_id), 0) as voti
      FROM referendum_abrogativi r
      LEFT JOIN voti_referendum_abrogativi v ON v.referendum_id = r.firestore_id_backup
      WHERE (r.status = 'A' OR r.status = 'a' OR r.status = 'P' OR r.status = 'p')
      GROUP BY r.id, r.nome
      ORDER BY voti DESC
    `;
    const classificaResult = await pool.query(classificaQuery);

    // 3. Combina i risultati e aggiungi emoji
    const referendum = referendumResult.rows.map(r => {
      const referendumData = {
        id: r.id,
        nome: r.nome,
        data_inizio: r.data_inizio,
        data_fine: r.data_fine,
        status: r.status,
        quorum: r.quorum,
        firestore_id_backup: r.firestore_id_backup,
        voti: classificaResult.rows.find(c => c.nome === r.nome)?.voti || 0
      };
      referendumData.emoji = getEmojiAutomaticaReferendum(referendumData);
      return referendumData;
    });

    const classificaConEmoji = classificaResult.rows.map(row => {
      const referendumCorrispondente = referendum.find(r => r.nome === row.nome);
      return {
        ...row,
        emoji: referendumCorrispondente?.emoji || getEmojiAutomaticaReferendum({ nome: row.nome })
      };
    });
    
    res.json({
      success: true,
      referendum: referendum,
      classifica: classificaConEmoji,
      mieiVoti: []
    });
  } catch (error) {
    console.error('Errore nel recupero dei referendum abrogativi:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare i referendum abrogativi'
    });
  }
});

// GET /api/referendum/abrogativi - Ottieni referendum abrogativi (endpoint specifico)
router.get('/abrogativi', async (req, res) => {
  try {
    const referendumQuery = `
      SELECT DISTINCT r.id, r.nome, r.data_inizio, r.data_fine, r.status, r.quorum, r.firestore_id_backup
      FROM referendum_abrogativi r
      WHERE (r.status = 'A' OR r.status = 'a' OR r.status = 'P' OR r.status = 'p')
      ORDER BY r.nome
    `;
    const referendumResult = await pool.query(referendumQuery);

    const classificaQuery = `
      SELECT r.nome, COUNT(*) as voti
      FROM voti_referendum_abrogativi v
      INNER JOIN referendum_abrogativi r ON v.referendum_id = r.firestore_id_backup
      GROUP BY r.id, r.nome
      ORDER BY voti DESC
    `;
    const classificaResult = await pool.query(classificaQuery);

    let mieiVoti = [];
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;

        const userVotiQuery = `
          SELECT v.referendum_id
          FROM voti_referendum_abrogativi v
          WHERE v.userid = $1
        `;
        const userVotiResult = await pool.query(userVotiQuery, [userId]);
        mieiVoti = userVotiResult.rows.map(v => v.referendum_id);
      } catch (authError) {
        console.log('⚠️ Token non valido per referendum abrogativi:', authError.message);
      }
    }

    const referendumConEmoji = referendumResult.rows.map(row => {
      const referendumData = {
        ...row,
        id: row.firestore_id_backup || row.id
      };
      referendumData.emoji = getEmojiAutomaticaReferendum(referendumData);
      return referendumData;
    });
    
    const classificaConEmoji = classificaResult.rows.map(row => {
      const referendumCorrispondente = referendumConEmoji.find(r => r.nome === row.nome);
      return {
        ...row,
        emoji: referendumCorrispondente?.emoji || getEmojiAutomaticaReferendum({ nome: row.nome })
      };
    });
    
    res.json({
      success: true,
      referendum: referendumConEmoji,
      classifica: classificaConEmoji,
      mieiVoti: mieiVoti,
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
router.get('/abrogativi/richieste', verifyToken, async (req, res) => {
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
router.post('/abrogativi', verifyToken, validateInput(['titolo', 'descrizione', 'legge']), async (req, res) => {
  try {
    const { titolo, descrizione, legge } = req.body;
    const userId = req.userId;
    
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
router.post('/abrogativi/:id/:action', verifyToken, async (req, res) => {
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

// POST /api/referendum-abrogativi/vota - Salva preferenze referendum abrogativo
router.post('/abrogativi/vota', verifyToken, requireVerifiedCivicIdentity, requirePoliticalConsent, async (req, res) => {
  const { voti } = req.body || {};
  if (!Array.isArray(voti)) {
    return res.status(400).json({ success: false, error: 'Elenco preferenze non valido' });
  }

  const userId = req.userId;
  let client;
  let transactionStarted = false;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    transactionStarted = true;

    // The revocation transaction updates this same users row before erasing
    // votes. Acquire the lock BEFORE checking consent or replacing choices.
    const lockedUser = await client.query(
      'SELECT id FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );
    if (lockedUser.rows.length === 0) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(404).json({ success: false, error: 'Utente non trovato' });
    }

    // A separate SELECT after the lock observes a concurrent committed
    // revocation under READ COMMITTED (a combined SELECT could be stale).
    const consentState = await getPoliticalConsentState(client, userId);
    if (!consentState.granted) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(403).json({
        success: false,
        error: 'Consenso richiesto',
        code: 'POLITICAL_CONSENT_REQUIRED',
        consent_required: true
      });
    }

    await client.query('DELETE FROM voti_referendum_abrogativi WHERE userid = $1', [userId]);
    for (const referendumId of voti) {
      await client.query(
        'INSERT INTO voti_referendum_abrogativi (userid, referendum_id) VALUES ($1, $2) ON CONFLICT (userid, referendum_id) DO NOTHING',
        [userId, referendumId]
      );
    }

    await client.query('COMMIT');
    transactionStarted = false;
    res.json({ success: true, message: 'Preferenze salvate con successo' });
  } catch (error) {
    if (transactionStarted) {
      try { await client.query('ROLLBACK'); } catch (rollbackError) {
        console.error('Errore rollback preferenze referendum:', rollbackError);
      }
    }
    console.error('❌ Errore nel salvare preferenze referendum:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel salvare le preferenze'
    });
  } finally {
    if (client) client.release();
  }
});

// DELETE /api/referendum-abrogativi/vota - Rimuovi voto referendum abrogativo
router.delete('/abrogativi/vota', verifyToken, async (req, res) => {
  try {
    const { referendumId } = req.body;
    const userId = req.userId;

    const result = await pool.query(
      'DELETE FROM voti_referendum_abrogativi WHERE userid = $1 AND referendum_id = $2',
      [userId, referendumId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Voto non trovato'
      });
    }

    res.json({ success: true, message: 'Voto rimosso con successo' });
  } catch (error) {
    console.error('❌ Errore nel rimuovere voto referendum:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel rimuovere il voto'
    });
  }
});

module.exports = router;
