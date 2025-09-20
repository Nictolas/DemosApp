const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ===== ENDPOINTS PER SOSTENITORI =====

// GET /api/sostenitori - Ottieni sostenitori di un utente
router.get('/', async (req, res) => {
  try {
    const { sostenuto_id } = req.query;
    
    if (!sostenuto_id) {
      return res.status(400).json({
        success: false,
        error: 'ID sostenuto richiesto'
      });
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
          regione_residenza: row.regione_residenza,
          provincia_residenza: row.provincia_residenza,
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
      const location = supporter.regione_residenza || supporter.regione || 'Non specificato';
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
router.get('/check', async (req, res) => {
  try {
    const { utente_id, sostenuto_id } = req.query;
    
    if (!utente_id || !sostenuto_id) {
      return res.status(400).json({
        success: false,
        error: 'ID utente e ID sostenuto sono obbligatori'
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
        status: result.rows.length > 0 && result.rows[0].is_sostenitore ? 'active' : null
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

module.exports = router;