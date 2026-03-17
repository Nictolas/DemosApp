const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool, verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// POST /api/riconoscimenti - Crea o aggiorna una richiesta di riconoscimento per l'utente autenticato
router.post('/', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const {
      tipo_ruolo,
      nome,
      cognome,
      email,
      paese_elezione,
      regione_elezione,
      provincia_elezione,
      comune_elezione,
      grado_elezione,
      paese_candidatura,
      regione_candidatura,
      provincia_candidatura,
      comune_candidatura,
      grado_candidatura
    } = req.body || {};

    if (!tipo_ruolo || !['P', 'C', 'CP'].includes(tipo_ruolo)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo ruolo non valido',
        message: 'Il tipo ruolo deve essere uno tra P, C o CP'
      });
    }

    if (!nome || !cognome || !email) {
      return res.status(400).json({
        success: false,
        error: 'Dati obbligatori mancanti',
        message: 'Nome, cognome ed email sono obbligatori'
      });
    }

    // Se il ruolo include "P", richiede almeno il grado_elezione
    if ((tipo_ruolo === 'P' || tipo_ruolo === 'CP') && !grado_elezione) {
      return res.status(400).json({
        success: false,
        error: 'Dati elezione mancanti',
        message: 'Per Politico o Candidato Politico è richiesto almeno il grado di elezione'
      });
    }

    // Se il ruolo include "C", richiede almeno il grado_candidatura
    if ((tipo_ruolo === 'C' || tipo_ruolo === 'CP') && !grado_candidatura) {
      return res.status(400).json({
        success: false,
        error: 'Dati candidatura mancanti',
        message: 'Per Candidato o Candidato Politico è richiesto almeno il grado di candidatura'
      });
    }

    const id = uuidv4();

    const query = `
      INSERT INTO riconoscimenti (
        id,
        user_id,
        tipo_ruolo,
        nome,
        cognome,
        email,
        paese_elezione,
        regione_elezione,
        provincia_elezione,
        comune_elezione,
        grado_elezione,
        paese_candidatura,
        regione_candidatura,
        provincia_candidatura,
        comune_candidatura,
        grado_candidatura
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16
      )
      ON CONFLICT (user_id) DO UPDATE SET
        tipo_ruolo = EXCLUDED.tipo_ruolo,
        nome = EXCLUDED.nome,
        cognome = EXCLUDED.cognome,
        email = EXCLUDED.email,
        paese_elezione = EXCLUDED.paese_elezione,
        regione_elezione = EXCLUDED.regione_elezione,
        provincia_elezione = EXCLUDED.provincia_elezione,
        comune_elezione = EXCLUDED.comune_elezione,
        grado_elezione = EXCLUDED.grado_elezione,
        paese_candidatura = EXCLUDED.paese_candidatura,
        regione_candidatura = EXCLUDED.regione_candidatura,
        provincia_candidatura = EXCLUDED.provincia_candidatura,
        comune_candidatura = EXCLUDED.comune_candidatura,
        grado_candidatura = EXCLUDED.grado_candidatura,
        created_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;

    const values = [
      id,
      userId,
      tipo_ruolo,
      nome,
      cognome,
      email,
      paese_elezione || null,
      regione_elezione || null,
      provincia_elezione || null,
      comune_elezione || null,
      grado_elezione || null,
      paese_candidatura || null,
      regione_candidatura || null,
      provincia_candidatura || null,
      comune_candidatura || null,
      grado_candidatura || null
    ];

    const result = await pool.query(query, values);

    return res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nel creare richiesta riconoscimento:', error);
    return res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// GET /api/riconoscimenti - Lista tutte le richieste pendenti (solo admin)
router.get('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT 
        r.*,
        u.email AS user_email,
        u.ruolo AS ruolo_corrente
      FROM riconoscimenti r
      JOIN users u ON u.id = r.user_id
      ORDER BY r.created_at DESC
      `
    );

    return res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare le richieste di riconoscimento:', error);
    return res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/riconoscimenti/:id/approve - Approva una richiesta (solo admin)
router.post('/:id/approve', verifyToken, requireAdmin, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    await client.query('BEGIN');

    const riconoscimentoResult = await client.query(
      'SELECT * FROM riconoscimenti WHERE id = $1',
      [id]
    );

    if (riconoscimentoResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Richiesta non trovata'
      });
    }

    const r = riconoscimentoResult.rows[0];
    const nuovoRuolo = r.tipo_ruolo;

    // Prepara i campi da aggiornare sull'utente
    const updateFields = ['ruolo'];
    const updateValues = [nuovoRuolo];

    // Dati di elezione solo se il ruolo include componente Politico
    if (nuovoRuolo === 'P' || nuovoRuolo === 'CP') {
      updateFields.push(
        'paese_elezione',
        'regione_elezione',
        'provincia_elezione',
        'comune_elezione',
        'grado_elezione'
      );
      updateValues.push(
        r.paese_elezione || null,
        r.regione_elezione || null,
        r.provincia_elezione || null,
        r.comune_elezione || null,
        r.grado_elezione || null
      );
    }

    // Dati di candidatura solo se il ruolo include componente Candidato
    if (nuovoRuolo === 'C' || nuovoRuolo === 'CP') {
      updateFields.push(
        'paese_candidatura',
        'regione_candidatura',
        'provincia_candidatura',
        'comune_candidatura',
        'grado_candidatura'
      );
      updateValues.push(
        r.paese_candidatura || null,
        r.regione_candidatura || null,
        r.provincia_candidatura || null,
        r.comune_candidatura || null,
        r.grado_candidatura || null
      );
    }

    const setClause = updateFields
      .map((field, index) => `${field} = $${index + 1}`)
      .join(', ');

    updateValues.push(r.user_id);

    const updateQuery = `
      UPDATE users
      SET ${setClause}, updated_at = NOW()
      WHERE id = $${updateValues.length}
      RETURNING id, ruolo
    `;

    const updateResult = await client.query(updateQuery, updateValues);

    if (updateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }

    // Cancella la richiesta dalla tabella riconoscimenti
    await client.query('DELETE FROM riconoscimenti WHERE id = $1', [id]);

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'Richiesta approvata e ruolo aggiornato',
      data: {
        user_id: updateResult.rows[0].id,
        nuovo_ruolo: updateResult.rows[0].ruolo
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Errore nell\'approvare richiesta di riconoscimento:', error);
    return res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  } finally {
    client.release();
  }
});

// POST /api/riconoscimenti/:id/reject - Rifiuta una richiesta (solo admin)
router.post('/:id/reject', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM riconoscimenti WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Richiesta non trovata'
      });
    }

    return res.json({
      success: true,
      message: 'Richiesta rifiutata e rimossa'
    });
  } catch (error) {
    console.error('❌ Errore nel rifiutare richiesta di riconoscimento:', error);
    return res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;

