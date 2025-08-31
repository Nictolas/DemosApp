const express = require('express');
const { pool } = require('../../middleware/auth');
const { verifyToken, requireAdmin } = require('../../middleware/auth');

const router = express.Router();

// GET /api/users/ - Lista tutti gli utenti (solo admin)
router.get('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    console.log('🔍 GET /api/users/ - Lista utenti richiesta da admin');
    
    const { page = 1, limit = 50, search, status, ruolo } = req.query;
    const offset = (page - 1) * limit;
    
    // Costruisci query base
    let whereClause = '';
    let queryParams = [];
    let paramIndex = 1;
    
    if (search) {
      whereClause += `WHERE (nome ILIKE $${paramIndex} OR cognome ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }
    
    if (status) {
      if (whereClause) {
        whereClause += ` AND status = $${paramIndex}`;
      } else {
        whereClause = `WHERE status = $${paramIndex}`;
      }
      queryParams.push(status);
      paramIndex++;
    }
    
    if (ruolo) {
      if (whereClause) {
        whereClause += ` AND ruolo = $${paramIndex}`;
      } else {
        whereClause = `WHERE ruolo = $${paramIndex}`;
      }
      queryParams.push(ruolo);
      paramIndex++;
    }
    
    // Query per contare il totale
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM users 
      ${whereClause}
    `;
    
    const countResult = await pool.query(countQuery, queryParams);
    const totalUsers = parseInt(countResult.rows[0].total);
    
    // Query per gli utenti con paginazione
    const usersQuery = `
      SELECT id, nome, cognome, email, ruolo, status, created_at, updated_at
      FROM users 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const usersResult = await pool.query(usersQuery, [...queryParams, limit, offset]);
    
    console.log(`✅ Lista utenti recuperata: ${usersResult.rows.length} su ${totalUsers} totali`);
    
    res.json({
      success: true,
      users: usersResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalUsers,
        pages: Math.ceil(totalUsers / limit)
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recupero lista utenti:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// GET /api/users/pending - Lista utenti in attesa di approvazione (solo admin)
router.get('/pending', verifyToken, requireAdmin, async (req, res) => {
  try {
    console.log('⏳ GET /api/users/pending - Lista utenti in attesa richiesta da admin');
    
    const result = await pool.query(`
      SELECT id, nome, cognome, email, ruolo, created_at
      FROM users 
      WHERE status = 'pending'
      ORDER BY created_at ASC
    `);
    
    console.log(`✅ Utenti in attesa recuperati: ${result.rows.length}`);
    
    res.json({
      success: true,
      pendingUsers: result.rows,
      count: result.rows.length
    });
    
  } catch (error) {
    console.error('❌ Errore nel recupero utenti in attesa:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
