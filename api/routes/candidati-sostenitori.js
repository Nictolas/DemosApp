const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { verifyToken } = require('../middleware/auth');
const { decompressProvince } = require('../utils/provinceUtils');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// GET /api/candidati/sostenitori - Ottieni sostenitori candidati di un utente
router.get('/sostenitori', verifyToken, async (req, res) => {
  try {
    const { sostenuto_id } = req.query;
    
    if (!sostenuto_id) {
      return res.status(400).json({
        success: false,
        error: 'ID sostenuto richiesto'
      });
    }

    if (String(req.userId) !== String(sostenuto_id) && !req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Accesso negato'
      });
    }

    // Trova tutti gli utenti che hanno scelto questo utente come candidato
    const result = await pool.query(`
      SELECT 
        id,
        nome,
        cognome,
        email,
        ruolo,
        data_nascita,
        genere,
        regione_residenza,
        provincia_residenza,
        comune_residenza,
        created_at,
        CASE 
          WHEN candidato_europeo = $1 THEN 'Candidato Europeo'
          WHEN candidato_camera = $1 THEN 'Candidato Camera'
          WHEN candidato_senato = $1 THEN 'Candidato Senato'
          WHEN candidato_regionale = $1 THEN 'Candidato Regionale'
          WHEN candidato_comune = $1 THEN 'Candidato Comunale'
        END as supporter_role
      FROM users
      WHERE (
        candidato_europeo = $1 OR
        candidato_camera = $1 OR
        candidato_senato = $1 OR
        candidato_regionale = $1 OR
        candidato_comune = $1
      )
      ORDER BY created_at DESC
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
    const provinceDistribution = {};
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

      // Distribuzione per provincia (decompressa)
      const provinceCode = supporter.provincia_residenza;
      const province = provinceCode ? decompressProvince(provinceCode) || provinceCode : 'Non specificato';
      provinceDistribution[province] = (provinceDistribution[province] || 0) + 1;

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
      supporters: req.user?.isAdmin ? supporters : [],
      stats: {
        totalSupporters,
        genderDistribution,
        locationDistribution,
        provinceDistribution,
        averageAge,
        ageDistribution
      }
    });
  } catch (error) {
    console.error('❌ Errore nel recupero sostenitori candidati:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
