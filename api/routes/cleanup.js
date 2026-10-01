const express = require('express');
const { getPool } = require('../config/database');

const router = express.Router();

// Endpoint per eliminare utenti temporanei
router.post('/delete-temporary-users', async (req, res) => {
  try {
    console.log('🧹 Pulizia utenti temporanei...');
    
    const pool = getPool();

    // Trova tutti gli utenti con nome "Temporaneo" e cognome "Utente"
    const result = await pool.query(
      'SELECT id, email, nome, cognome, created_at FROM users WHERE nome = $1 AND cognome = $2',
      ['Temporaneo', 'Utente']
    );
    
    console.log(`📊 Trovati ${result.rows.length} utenti temporanei:`);
    result.rows.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.created_at})`);
    });
    
    if (result.rows.length > 0) {
      // Elimina tutti gli utenti temporanei
      const deleteResult = await pool.query(
        'DELETE FROM users WHERE nome = $1 AND cognome = $2',
        ['Temporaneo', 'Utente']
      );
      
      console.log(`🗑️  Eliminati ${deleteResult.rowCount} utenti temporanei`);
      
      res.json({
        success: true,
        message: `Eliminati ${deleteResult.rowCount} utenti temporanei`,
        deletedUsers: result.rows
      });
    } else {
      res.json({
        success: true,
        message: 'Nessun utente temporaneo trovato'
      });
    }
    
  } catch (error) {
    console.error('❌ Errore eliminazione utenti temporanei:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: error.message
    });
  }
});

// Endpoint temporaneo per eliminare utenti di test
router.post('/delete-test-user', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email richiesta',
        message: 'Il campo email è obbligatorio'
      });
    }

    console.log(`🧹 Eliminazione utente di test: ${email}`);

    const pool = getPool();

    // Prima controlla se l'utente esiste
    const checkResult = await pool.query('SELECT id, email, created_at FROM users WHERE email = $1', [email]);
    
    if (checkResult.rows.length > 0) {
      const user = checkResult.rows[0];
      console.log(`📧 Utente trovato:`, user);
      
      // Elimina l'utente
      const deleteResult = await pool.query('DELETE FROM users WHERE email = $1', [email]);
      console.log(`🗑️  Utente eliminato: ${deleteResult.rowCount} righe`);
      
      // Verifica che sia stato eliminato
      const verifyResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      console.log(`✅ Verifica eliminazione: ${verifyResult.rows.length} righe trovate`);
      
      
      res.json({
        success: true,
        message: `Utente ${email} eliminato con successo`,
        deletedRows: deleteResult.rowCount
      });
      
    } else {
      res.json({
        success: true,
        message: `Utente ${email} non trovato nel database`
      });
    }
    
  } catch (error) {
    console.error('❌ Errore eliminazione utente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: error.message
    });
  }
});

module.exports = router;
