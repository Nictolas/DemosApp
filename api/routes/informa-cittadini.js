const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');

// Usa il pool centralizzato
const pool = getPool();

// POST /api/informa-cittadini - crea un nuovo avviso
router.post('/', async (req, res) => {
  try {
    const { id_utente, tipologia, dove, dal_giorno, al_giorno, zona } = req.body;

    if (!id_utente || !tipologia || !dove || !dal_giorno || !al_giorno) {
      return res.status(400).json({
        success: false,
        error: 'id_utente, tipologia, dove, dal_giorno e al_giorno sono obbligatori'
      });
    }

    const titolo = `${tipologia} - ${dove}`;
    const testo = `Tipologia: ${tipologia}\nDove: ${dove}\nDal: ${dal_giorno}\nAl: ${al_giorno}`;

    const result = await pool.query(
      `INSERT INTO informa_cittadini (
        id, id_utente, tipologia, dove, dal_giorno, al_giorno, zona, data_creazione
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW()
      ) RETURNING *`,
      [id_utente, tipologia, dove, dal_giorno, al_giorno, zona || 'Generale']
    );

    return res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Comunicazione \"Informa Cittadini\" creata con successo',
      titolo,
      testo
    });
  } catch (error) {
    console.error('❌ Errore nella creazione di Informa Cittadini:', error);
    return res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;


