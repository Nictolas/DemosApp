const express = require('express');
const router = express.Router();
const { decompressUserLocation } = require('../utils/locationUtils');
const { getPool } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
require('dotenv').config();

// Usa il pool centralizzato ottimizzato
const pool = getPool();

// ===== ENDPOINTS PER SOSTENITORI =====

// GET /api/sostenitori - Ottieni sostenitori di un utente
router.get('/', verifyToken, async (req, res) => {
  try {
    const { sostenuto_id } = req.query;
    
    if (!sostenuto_id) {
      return res.status(400).json({
        success: false,
        error: 'ID sostenuto richiesto'
      });
    }

    if (String(req.userId) !== String(sostenuto_id) && req.userRole !== 'AD') {
      return res.status(403).json({ success: false, error: 'Accesso negato' });
    }

    // Trova tutti gli utenti che hanno scelto questo utente come rappresentante
    const result = await pool.query(`
      SELECT 
        u.id,
        u.nome,
        u.cognome,
        u.email,
        u.ruolo,
        u.data_nascita,
        u.genere,
        u.regione_residenza,
        u.provincia_residenza,
        u.comune_residenza,
        u.created_at,
        CASE 
          WHEN u.rappresentante_europeo = $1 THEN 'Rappresentante Europeo'
          WHEN u.rappresentante_camera = $1 THEN 'Rappresentante Camera'
          WHEN u.rappresentante_senato = $1 THEN 'Rappresentante Senato'
          WHEN u.rappresentante_regionale = $1 THEN 'Rappresentante Regionale'
          WHEN u.rappresentante_comune = $1 THEN 'Rappresentante Comunale'
        END as supporter_role
      FROM users u
      WHERE (
        u.rappresentante_europeo = $1 OR
        u.rappresentante_camera = $1 OR
        u.rappresentante_senato = $1 OR
        u.rappresentante_regionale = $1 OR
        u.rappresentante_comune = $1
      )
      ORDER BY u.created_at DESC
    `, [sostenuto_id]);

    // Raggruppa i sostenitori per utente e raccoglie i ruoli
    const supportersMap = new Map();
    result.rows.forEach(row => {
      if (!supportersMap.has(row.id)) {
        supportersMap.set(row.id, {
          uid: row.id,
          nome: row.nome,
          cognome: row.cognome,
          email: row.email,
          ruolo: row.ruolo,
          data_nascita: row.data_nascita,
          genere: row.genere,
          regione_residenza: decompressUserLocation({ regione_residenza: row.regione_residenza }).regione_residenza,
          provincia_residenza: decompressUserLocation({ provincia_residenza: row.provincia_residenza }).provincia_residenza,
          comune_residenza: row.comune_residenza,
          data_registrazione: row.created_at,
          supporterRoles: []
        });
      }
      if (row.supporter_role) {
        supportersMap.get(row.id).supporterRoles.push(row.supporter_role);
      }
    });

    const supporters = Array.from(supportersMap.values());

    // Calcola statistiche
    const totalSupporters = supporters.length;
    const genderDistribution = { Uomo: 0, Donna: 0, Altro: 0 };
    const locationDistribution = {};
    let ageSum = 0;
    const ageDistribution = {
      '18-25': 0, '26-35': 0, '36-45': 0, '46-55': 0, '56-65': 0, '65+': 0
    };

    const getAge = (birthDate) => {
      if (!birthDate) return null;
      const today = new Date();
      const birth = new Date(birthDate);
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return age;
    };

    supporters.forEach(supporter => {
      // Distribuzione per genere
      const genere = supporter.genere || supporter.sesso || 'Altro';
      if (genere === 'Maschio' || genere === 'M' || genere === 'uomo') genderDistribution.Uomo++;
      else if (genere === 'Femmina' || genere === 'F' || genere === 'donna') genderDistribution.Donna++;
      else genderDistribution.Altro++;

      // Distribuzione per località
      const location = decompressUserLocation({ regione_residenza: supporter.regione_residenza }).regione_residenza || supporter.regione || 'Non specificato';
      locationDistribution[location] = (locationDistribution[location] || 0) + 1;

      // Distribuzione per età
      const age = getAge(supporter.data_nascita);
      if (age !== null) {
        ageSum += age;
        if (age >= 18 && age <= 25) ageDistribution['18-25']++;
        else if (age >= 26 && age <= 35) ageDistribution['26-35']++;
        else if (age >= 36 && age <= 45) ageDistribution['36-45']++;
        else if (age >= 46 && age <= 55) ageDistribution['46-55']++;
        else if (age >= 56 && age <= 65) ageDistribution['56-65']++;
        else if (age > 65) ageDistribution['65+']++;
      }
    });

    const averageAge = totalSupporters > 0 ? Math.round(ageSum / totalSupporters) : 0;

    res.json({
      success: true,
      supporters: supporters,
      stats: {
        totalSupporters,
        genderDistribution,
        locationDistribution,
        averageAge,
        ageDistribution
      }
    });
  } catch (error) {
    console.error('❌ Errore nel recupero sostenitori:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// GET /api/sostenitori/check - Verifica se un utente sostiene un altro
router.get('/check', verifyToken, async (req, res) => {
  try {
    const { sostenuto_id } = req.query;
    const utente_id = req.userId;
    
    if (!sostenuto_id) {
      return res.status(400).json({
        success: false,
        error: 'ID sostenuto obbligatorio'
      });
    }

    const result = await pool.query(`
      SELECT 
        CASE 
          WHEN rappresentante_europeo = $2 OR
               rappresentante_camera = $2 OR
               rappresentante_senato = $2 OR
               rappresentante_regionale = $2 OR
               rappresentante_comune = $2
          THEN true
          ELSE false
        END as is_sostenitore
      FROM users 
      WHERE id = $1
    `, [utente_id, sostenuto_id]);

    res.json({
      success: true,
      data: {
        isSostenitore: result.rows.length > 0 && result.rows[0].is_sostenitore,
        status: result.rows.length > 0 && result.rows[0].is_sostenitore ? 'a' : null
      }
    });
  } catch (error) {
    console.error('❌ Errore nel controllo sostenitore:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/sostenitori/follow - Vota un attivista (limite di 1 voto)
router.post('/follow', verifyToken, async (req, res) => {
  try {
    const supporter_id = req.userId;
    const { supported_id } = req.body;
    
    if (!supported_id) {
      return res.status(400).json({
        success: false,
        error: 'supported_id obbligatorio'
      });
    }

    // Verifica che entrambi gli utenti esistano
    const usersCheck = await pool.query(`
      SELECT id, ruolo FROM users WHERE id IN ($1, $2)
    `, [supporter_id, supported_id]);

    if (usersCheck.rows.length !== 2) {
      return res.status(404).json({
        success: false,
        error: 'Uno o entrambi gli utenti non esistono'
      });
    }

    // Verifica che l'utente supportato sia un attivista
    const supportedUser = usersCheck.rows.find(u => u.id === supported_id);
    if (supportedUser.ruolo !== 'A' && supportedUser.ruolo !== 'AD') {
      return res.status(400).json({
        success: false,
        error: 'Puoi votare solo per gli attivisti'
      });
    }

    console.log('🗳️ Votazione per attivista - user:', supportedUser);

    // Verifica se l'utente sta già votando questo attivista
    const currentVote = await pool.query(`
      SELECT attivisti FROM users WHERE id = $1
    `, [supporter_id]);

    if (currentVote.rows.length > 0 && currentVote.rows[0].attivisti === supported_id) {
      return res.status(409).json({
        success: false,
        error: 'Stai già votando questo attivista'
      });
    }

    // Aggiorna il voto dell'utente (sostituisce eventuali altri voti) usando l'ID
    const result = await pool.query(`
      UPDATE users 
      SET attivisti = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING id, attivisti, updated_at
    `, [supporter_id, supported_id]);

    console.log('✅ Voto attivista aggiornato:', result.rows[0]);

    res.json({
      success: true,
      message: 'Attivista votato con successo',
      data: {
        user_id: result.rows[0].id,
        attivista_id: result.rows[0].attivisti,
        updated_at: result.rows[0].updated_at
      }
    });

  } catch (error) {
    console.error('❌ Errore nel votare attivista:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// DELETE /api/sostenitori/unfollow - Rimuovi voto attivista
router.delete('/unfollow', verifyToken, async (req, res) => {
  try {
    const supporter_id = req.userId;
    const { supported_id } = req.body;
    
    if (!supported_id) {
      return res.status(400).json({
        success: false,
        error: 'supported_id obbligatorio'
      });
    }

    // Verifica che l'utente stia effettivamente votando questo attivista
    const currentVote = await pool.query(`
      SELECT attivisti FROM users WHERE id = $1
    `, [supporter_id]);

    if (currentVote.rows.length === 0 || currentVote.rows[0].attivisti !== supported_id) {
      return res.status(404).json({
        success: false,
        error: 'Non stai votando questo attivista'
      });
    }

    // Rimuovi il voto
    const result = await pool.query(`
      UPDATE users 
      SET attivisti = NULL, updated_at = NOW()
      WHERE id = $1
      RETURNING id, updated_at
    `, [supporter_id]);

    console.log('✅ Voto attivista rimosso per utente:', result.rows[0].id);

    res.json({
      success: true,
      message: 'Hai rimosso il voto per questo attivista'
    });

  } catch (error) {
    console.error('❌ Errore nel rimuovere voto attivista:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// GET /api/sostenitori/count - Endpoint semplice per conteggio sostenitori
router.get('/count', async (req, res) => {
  try {
    const { sostenuto_id } = req.query;
    
    if (!sostenuto_id) {
      return res.status(400).json({
        success: false,
        error: 'ID sostenuto richiesto'
      });
    }

    console.log('🔍 DEBUG: Conteggio sostenitori per:', sostenuto_id);

    // Conta voti per attivista usando la colonna attivisti
    const attivistaResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM users 
      WHERE attivisti = $1
    `, [sostenuto_id]);

    const attivistaCount = parseInt(attivistaResult.rows[0].count);

    console.log('🔍 DEBUG: Voti attivista:', attivistaCount);

    res.json({
      success: true,
      data: {
        totalSupporters: attivistaCount,
        attivistaSupporters: attivistaCount
      }
    });

  } catch (error) {
    console.error('❌ Errore nel conteggio sostenitori:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// GET /api/sostenitori/following - Ottieni l'attivista votato da un utente
router.get('/following', verifyToken, async (req, res) => {
  try {
    const supporter_id = req.userId;

    console.log('🔍 DEBUG: Recupero attivista votato per utente autenticato:', supporter_id);

    const result = await pool.query(`
      SELECT 
        u.attivisti as supported_id,
        u.updated_at as created_at,
        a.nome,
        a.cognome
      FROM users u
      LEFT JOIN users a ON u.attivisti = a.id
      WHERE u.id = $1 AND u.attivisti IS NOT NULL
    `, [supporter_id]);

    console.log('🔍 DEBUG: Attivista votato trovato:', result.rows.length > 0 ? 'Sì' : 'No');

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('❌ Errore nel recupero attivista votato:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/sostenitori/follow-organizzazione - Vota un'organizzazione (limite di 1 voto)
router.post('/follow-organizzazione', verifyToken, async (req, res) => {
  try {
    const supporter_id = req.userId;
    const { supported_id } = req.body;

    console.log('🗳️ POST /api/sostenitori/follow-organizzazione - Voto organizzazione', { supporter_id, supported_id });

    if (!supported_id) {
      return res.status(400).json({
        success: false,
        error: 'supported_id obbligatorio'
      });
    }

    // Verifica che entrambi gli utenti esistano
    const usersCheck = await pool.query(`
      SELECT id, ruolo FROM users WHERE id IN ($1, $2)
    `, [supporter_id, supported_id]);

    if (usersCheck.rows.length !== 2) {
      return res.status(404).json({
        success: false,
        error: 'Uno o entrambi gli utenti non esistono'
      });
    }

    // Verifica che l'utente supportato sia un'organizzazione
    const supportedUser = usersCheck.rows.find(u => u.id === supported_id);
    if (supportedUser.ruolo !== 'O') {
      return res.status(400).json({
        success: false,
        error: 'Puoi votare solo per le organizzazioni'
      });
    }

    console.log('🗳️ Votazione per organizzazione - user:', supportedUser);

    // Verifica se l'utente sta già votando questa organizzazione
    const currentVote = await pool.query(`
      SELECT organizzazioni FROM users WHERE id = $1
    `, [supporter_id]);

    if (currentVote.rows.length > 0 && currentVote.rows[0].organizzazioni === supported_id) {
      return res.status(409).json({
        success: false,
        error: 'Stai già votando questa organizzazione'
      });
    }

    // Aggiorna il voto dell'utente (sostituisce eventuali altri voti) usando l'ID
    const result = await pool.query(`
      UPDATE users 
      SET organizzazioni = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING id, organizzazioni, updated_at
    `, [supporter_id, supported_id]);

    console.log('✅ Voto organizzazione aggiornato:', result.rows[0]);

    res.json({
      success: true,
      message: 'Organizzazione votata con successo',
      data: {
        user_id: result.rows[0].id,
        organizzazione_id: result.rows[0].organizzazioni,
        updated_at: result.rows[0].updated_at
      }
    });

  } catch (error) {
    console.error('❌ Errore nel votare organizzazione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// DELETE /api/sostenitori/unfollow-organizzazione - Rimuovi voto organizzazione
router.delete('/unfollow-organizzazione', verifyToken, async (req, res) => {
  try {
    const supporter_id = req.userId;
    const { supported_id } = req.body;
    
    if (!supported_id) {
      return res.status(400).json({
        success: false,
        error: 'supported_id obbligatorio'
      });
    }

    // Verifica che l'utente stia effettivamente votando questa organizzazione
    const currentVote = await pool.query(`
      SELECT organizzazioni FROM users WHERE id = $1
    `, [supporter_id]);

    if (currentVote.rows.length === 0 || currentVote.rows[0].organizzazioni !== supported_id) {
      return res.status(404).json({
        success: false,
        error: 'Non stai votando questa organizzazione'
      });
    }

    // Rimuovi il voto
    const result = await pool.query(`
      UPDATE users 
      SET organizzazioni = NULL, updated_at = NOW()
      WHERE id = $1
      RETURNING id, updated_at
    `, [supporter_id]);

    console.log('✅ Voto organizzazione rimosso per utente:', result.rows[0].id);

    res.json({
      success: true,
      message: 'Hai rimosso il voto per questa organizzazione'
    });

  } catch (error) {
    console.error('❌ Errore nel rimuovere voto organizzazione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// GET /api/sostenitori/organizzazione - Ottieni sostenitori di un'organizzazione
router.get('/organizzazione', verifyToken, async (req, res) => {
  try {
    const { sostenuto_id } = req.query;

    if (!sostenuto_id) {
      return res.status(400).json({
        success: false,
        error: 'ID organizzazione richiesto'
      });
    }

    if (String(req.userId) !== String(sostenuto_id) && req.userRole !== 'AD') {
      return res.status(403).json({ success: false, error: 'Accesso negato' });
    }

    const result = await pool.query(`
      SELECT 
        u.id,
        u.nome,
        u.cognome,
        u.email,
        u.ruolo,
        u.data_nascita,
        u.genere,
        u.regione_residenza,
        u.provincia_residenza,
        u.comune_residenza,
        u.created_at
      FROM users u
      WHERE u.organizzazioni = $1
      ORDER BY u.created_at DESC
    `, [sostenuto_id]);

    const supporters = result.rows.map(row => ({
      uid: row.id,
      nome: row.nome,
      cognome: row.cognome,
      email: row.email,
      ruolo: row.ruolo,
      data_nascita: row.data_nascita,
      genere: row.genere,
      regione_residenza: decompressUserLocation({ regione_residenza: row.regione_residenza }).regione_residenza,
      provincia_residenza: decompressUserLocation({ provincia_residenza: row.provincia_residenza }).provincia_residenza,
      comune_residenza: row.comune_residenza,
      data_registrazione: row.created_at
    }));

    const totalSupporters = supporters.length;
    const genderDistribution = { Uomo: 0, Donna: 0, Altro: 0 };
    const locationDistribution = {};

    const getAge = (birthDate) => {
      if (!birthDate) return null;
      const today = new Date();
      const birth = new Date(birthDate);
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return age;
    };

    let ageSum = 0;
    const ageDistribution = {
      '18-25': 0, '26-35': 0, '36-45': 0, '46-55': 0, '56-65': 0, '65+': 0
    };

    supporters.forEach(s => {
      const genere = s.genere || s.sesso || 'Altro';
      if (genere === 'Maschio' || genere === 'M' || genere === 'uomo') genderDistribution.Uomo++;
      else if (genere === 'Femmina' || genere === 'F' || genere === 'donna') genderDistribution.Donna++;
      else genderDistribution.Altro++;

      const location = decompressUserLocation({ regione_residenza: s.regione_residenza }).regione_residenza || s.regione || 'Non specificato';
      locationDistribution[location] = (locationDistribution[location] || 0) + 1;

      const age = getAge(s.data_nascita);
      if (age !== null) {
        ageSum += age;
        if (age >= 18 && age <= 25) ageDistribution['18-25']++;
        else if (age >= 26 && age <= 35) ageDistribution['26-35']++;
        else if (age >= 36 && age <= 45) ageDistribution['36-45']++;
        else if (age >= 46 && age <= 55) ageDistribution['46-55']++;
        else if (age >= 56 && age <= 65) ageDistribution['56-65']++;
        else if (age > 65) ageDistribution['65+']++;
      }
    });

    const averageAge = totalSupporters > 0 ? Math.round(ageSum / totalSupporters) : 0;

    res.json({
      success: true,
      supporters,
      stats: {
        totalSupporters,
        genderDistribution,
        locationDistribution,
        averageAge,
        ageDistribution
      }
    });
  } catch (error) {
    console.error('❌ Errore nel recupero sostenitori organizzazione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// GET /api/sostenitori/totale - Conteggi aggregati per utente
router.get('/totale', async (req, res) => {
  try {
    const { sostenuto_id } = req.query;

    if (!sostenuto_id) {
      return res.status(400).json({
        success: false,
        error: 'ID sostenuto richiesto'
      });
    }

    // Politico: utenti che hanno scelto questo utente come rappresentante a qualunque livello
    const politicoQ = await pool.query(`
      SELECT COUNT(*) AS count
      FROM users
      WHERE $1 IN (
        rappresentante_europeo,
        rappresentante_camera,
        rappresentante_senato,
        rappresentante_regionale,
        rappresentante_comune
      )
    `, [sostenuto_id]);
    const politico = parseInt(politicoQ.rows[0].count);

    // Attivista: voti nella colonna attivisti
    const attivistaQ = await pool.query(`
      SELECT COUNT(*) AS count FROM users WHERE attivisti = $1
    `, [sostenuto_id]);
    const attivista = parseInt(attivistaQ.rows[0].count);

    // Organizzazione: voti nella colonna organizzazioni
    const organizzazioneQ = await pool.query(`
      SELECT COUNT(*) AS count FROM users WHERE organizzazioni = $1
    `, [sostenuto_id]);
    const organizzazione = parseInt(organizzazioneQ.rows[0].count);

    // Candidato: verifica se esiste la colonna 'candidati' e in caso conta, altrimenti 0
    let candidato = 0;
    const candidatesColumn = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'candidati'
      ) AS exists
    `);
    if (candidatesColumn.rows[0] && candidatesColumn.rows[0].exists) {
      const candidatoQ = await pool.query(`
        SELECT COUNT(*) AS count FROM users WHERE candidati = $1
      `, [sostenuto_id]);
      candidato = parseInt(candidatoQ.rows[0].count);
    }

    const totale = politico + candidato + attivista + organizzazione;

    res.json({
      success: true,
      data: { politico, candidato, attivista, organizzazione, totale }
    });
  } catch (error) {
    console.error('❌ Errore nel calcolo totale sostenitori:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;