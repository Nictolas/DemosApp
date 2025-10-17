const express = require('express');
const { pool } = require('../../middleware/auth');
const { verifyToken, requireAdmin } = require('../../middleware/auth');
const { decompressGender } = require('../../utils/genderUtils');

const router = express.Router();

// GET /api/users/search - Cerca utenti per autocompletamento
router.get('/search', verifyToken, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({
        success: true,
        users: []
      });
    }
    
    console.log('🔍 GET /api/users/search - Ricerca utenti per:', q);
    
    const searchQuery = `
      SELECT id, nome, cognome, email
      FROM users 
      WHERE (nome ILIKE $1 OR cognome ILIKE $1 OR CONCAT(nome, ' ', cognome) ILIKE $1)
      AND status IN ('verified', 'active')
      ORDER BY 
        CASE 
          WHEN nome ILIKE $2 THEN 1
          WHEN CONCAT(nome, ' ', cognome) ILIKE $2 THEN 2
          ELSE 3
        END,
        nome, cognome
      LIMIT 10
    `;
    
    const searchTerm = `%${q}%`;
    const exactMatch = `${q}%`;
    
    const result = await pool.query(searchQuery, [searchTerm, exactMatch]);
    
    const users = result.rows.map(user => ({
      id: user.id,
      nome: user.nome,
      cognome: user.cognome,
      email: user.email,
      displayName: `${user.nome} ${user.cognome}`.trim()
    }));
    
    console.log(`✅ Trovati ${users.length} utenti per la ricerca`);
    
    res.json({
      success: true,
      users
    });
    
  } catch (error) {
    console.error('❌ Errore nella ricerca utenti:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile cercare gli utenti'
    });
  }
});

// GET /api/users/ - Lista tutti gli utenti (solo admin)
router.get('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    console.log('🔍 GET /api/users/ - Lista utenti richiesta da admin');
    
    const { page = 1, limit, search, status, ruolo } = req.query;
    const limitValue = limit ? parseInt(limit) : null; // Se non specificato, restituisce tutti gli utenti
    const offset = limitValue ? (page - 1) * limitValue : 0;
    
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
    let usersQuery = `
      SELECT id, name, nome, cognome, email, ruolo, status, created_at, updated_at,
             grado_elezione, grado_candidatura, avatar_config, genere, cittadinanza,
             regione_residenza, comune_residenza
      FROM users 
      ${whereClause}
      ORDER BY created_at DESC
    `;
    
    let queryParamsWithPagination = [...queryParams];
    
    if (limitValue) {
      usersQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      queryParamsWithPagination.push(limitValue, offset);
    }
    
    const usersResult = await pool.query(usersQuery, queryParamsWithPagination);
    
    console.log(`✅ Lista utenti recuperata: ${usersResult.rows.length} su ${totalUsers} totali`);
    
    res.json({
      success: true,
      users: usersResult.rows,
      pagination: {
        page: parseInt(page),
        limit: limitValue || totalUsers,
        total: totalUsers,
        pages: limitValue ? Math.ceil(totalUsers / limitValue) : 1
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
      SELECT id, nome, cognome, email, ruolo, created_at, avatar_config
      FROM users 
      WHERE (status = 'P' OR status = 'p')
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

// GET /api/users/:userId - Ottieni un utente specifico (solo admin)
router.get('/:userId', verifyToken, requireAdmin, async (req, res) => {
  try {
    console.log('🔍 GET /api/users/:userId - Richiesta utente specifico');
    
    const { userId } = req.params;
    console.log('🔍 DEBUG - userId ricevuto:', userId);
    
    // Verifica che userId sia valido (UUID o numero)
    if (!userId || (isNaN(parseInt(userId)) && !userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i))) {
      console.log('❌ DEBUG - userId non valido:', userId);
      return res.status(400).json({
        success: false,
        message: 'ID utente non valido'
      });
    }
    
    console.log('✅ DEBUG - userId valido, procedo con la query');
    
    // Query per ottenere l'utente specifico
    console.log('🔍 DEBUG - Eseguendo query per userId:', userId);
    const result = await pool.query(`
      SELECT id, name, nome, cognome, email, ruolo, status, created_at, updated_at,
             genere, data_nascita, cittadinanza, paese_residenza, regione_residenza,
             provincia_residenza, comune_residenza, avatar_config, grado_elezione, grado_candidatura,
             paese_elezione, regione_elezione, provincia_elezione, comune_elezione,
             paese_candidatura, regione_candidatura, provincia_candidatura, comune_candidatura,
             facebook_url, twitter_url, instagram_url, linkedin_url, telegram_url, website_url, twitch_url, youtube_url
      FROM users 
      WHERE id = $1
    `, [userId]);
    
    console.log('🔍 DEBUG - Query completata, righe trovate:', result.rows.length);
    
    if (result.rows.length === 0) {
      console.log('❌ DEBUG - Utente non trovato per userId:', userId);
      return res.status(404).json({
        success: false,
        message: 'Utente non trovato'
      });
    }
    
    const user = result.rows[0];
    
    console.log('✅ Utente trovato:', user.email);
    console.log('🔍 DEBUG - Dati utente completi:', {
      id: user.id,
      nome: user.nome,
      cognome: user.cognome,
      email: user.email,
      genere: user.genere,
      ruolo: user.ruolo,
      data_nascita: user.data_nascita,
      cittadinanza: user.cittadinanza
    });
    
    // Formatta la data di nascita per il frontend (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (user.data_nascita) {
      const data = new Date(user.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }
    
    const responseData = {
      success: true,
      user: {
        ...user,
        data_nascita: dataNascitaFormattata
      }
    };
    
    console.log('🔍 DEBUG - Dati di risposta:', {
      success: responseData.success,
      user: {
        id: responseData.user.id,
        nome: responseData.user.nome,
        cognome: responseData.user.cognome,
        email: responseData.user.email,
        genere: decompressGender(responseData.user.genere),
        ruolo: responseData.user.ruolo,
        data_nascita: responseData.user.data_nascita,
        cittadinanza: responseData.user.cittadinanza
      }
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Errore nel recupero utente specifico:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Errore interno del server',
      error: error.message
    });
  }
});

// PUT /api/users/:userId - Aggiorna utente specifico (solo admin)
router.put('/:userId', verifyToken, requireAdmin, async (req, res) => {
  try {
    console.log('✏️ PUT /api/users/:userId - Aggiornamento utente da admin');
    
    const { userId } = req.params;
    const updateData = req.body;
    
    console.log('🔍 DEBUG - userId:', userId);
    console.log('🔍 DEBUG - updateData:', updateData);
    
    // Lista dei campi consentiti per l'aggiornamento
    const allowedFields = [
      'nome', 'cognome', 'genere', 'data_nascita', 'cittadinanza', 'ruolo',
      'paese_residenza', 'regione_residenza', 'provincia_residenza', 'comune_residenza',
      'paese_elezione', 'regione_elezione', 'provincia_elezione', 'comune_elezione',
      'grado_elezione', 'paese_candidatura', 'regione_candidatura', 'provincia_candidatura',
      'comune_candidatura', 'grado_candidatura', 'avatar_config',
      'facebook_url', 'twitter_url', 'instagram_url', 'linkedin_url', 'telegram_url', 'website_url', 'twitch_url', 'youtube_url'
    ];
    
    // Normalizza i gradi di elezione e candidatura (prima lettera maiuscola)
    const normalizeGrado = (grado) => {
      if (!grado || typeof grado !== 'string') return grado;
      return grado.charAt(0).toUpperCase() + grado.slice(1).toLowerCase();
    };
    
    // Filtra solo i campi consentiti e normalizza i gradi
    const filteredData = {};
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key) && updateData[key] !== undefined) {
        if (key === 'grado_elezione' || key === 'grado_candidatura') {
          filteredData[key] = normalizeGrado(updateData[key]);
          console.log(`🔧 Grado ${key} normalizzato:`, updateData[key], '→', filteredData[key]);
        } else {
          filteredData[key] = updateData[key];
        }
      }
    });
    
    if (Object.keys(filteredData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nessun campo valido da aggiornare'
      });
    }
    
    // Costruisci la query di aggiornamento dinamicamente
    const setClause = Object.keys(filteredData).map((key, index) => `${key} = $${index + 1}`).join(', ');
    const values = Object.values(filteredData);
    const query = `UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = $${values.length + 1} RETURNING *`;
    
    const result = await pool.query(query, [...values, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const updatedUser = result.rows[0];
    console.log('✅ Utente aggiornato:', updatedUser.email);
    
    // Formatta la data di nascita per la risposta (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (updatedUser.data_nascita) {
      const data = new Date(updatedUser.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }
    
    res.json({
      success: true,
      message: 'Utente aggiornato con successo',
      user: {
        ...updatedUser,
        data_nascita: dataNascitaFormattata
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento utente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
