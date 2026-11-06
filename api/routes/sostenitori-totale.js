const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { verifyToken } = require('../middleware/auth');
const { decompressProvince } = require('../utils/provinceUtils');
const { resolvePoliticalOffice } = require('../services/politicalJurisdictionRegistryService');
const { isPoliticalOfficeVisible } = require('../services/politicalSelectionService');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// GET /api/sostenitori/totale - Ottieni sostenitori totali di un utente (senza duplicati)
router.get('/totale', verifyToken, async (req, res) => {
  try {
    const { sostenuto_id } = req.query;
    
    console.log('🔍 DEBUG: sostenitori-totale chiamato con sostenuto_id:', sostenuto_id);
    
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

    // Canonical provincial representative preferences are included in the
    // combined total only after explicit release GO. DISTINCT guarantees one
    // supporter even if the same voter also chose a regional representative.
    const provincialEnabled = isPoliticalOfficeVisible(resolvePoliticalOffice('it.provincial.trento'));
    const provincialCTE = provincialEnabled ? `
      WITH provincial_supporters AS (
        SELECT DISTINCT ps.user_id
        FROM political_selections ps
        JOIN users voter ON voter.id = ps.user_id
        LEFT JOIN user_consents uc ON uc.user_id = voter.id
        WHERE ps.selected_user_id = $1
          AND ps.selection_kind = 'representative'
          AND voter.status = 'a'
          AND COALESCE(uc.political_opinions_consent, voter.political_opinions_consent, false) IS TRUE
          AND ps.political_office_id IN ('it.provincial.trento', 'it.provincial.bolzano')
      )` : '';
    const provincialJoin = provincialEnabled
      ? 'LEFT JOIN provincial_supporters provincial ON provincial.user_id = u.id'
      : '';
    const provincialRole = provincialEnabled
      ? "WHEN provincial.user_id IS NOT NULL THEN 'Rappresentante Provinciale'"
      : '';
    const provincialCondition = provincialEnabled
      ? 'OR provincial.user_id IS NOT NULL'
      : '';

    const result = await pool.query(`
      ${provincialCTE}
      SELECT
        u.id, u.nome, u.cognome, u.email, u.ruolo,
        u.data_nascita, u.genere, u.regione_residenza,
        u.provincia_residenza, u.comune_residenza, u.created_at,
        CASE
          WHEN u.candidato_europeo = $1 THEN 'Candidato Europeo'
          WHEN u.candidato_camera = $1 THEN 'Candidato Camera'
          WHEN u.candidato_senato = $1 THEN 'Candidato Senato'
          WHEN u.candidato_regionale = $1 THEN 'Candidato Regionale'
          WHEN u.candidato_comune = $1 THEN 'Candidato Comunale'
          WHEN u.rappresentante_europeo = $1 THEN 'Rappresentante Europeo'
          WHEN u.rappresentante_camera = $1 THEN 'Rappresentante Camera'
          WHEN u.rappresentante_senato = $1 THEN 'Rappresentante Senato'
          WHEN u.rappresentante_regionale = $1 THEN 'Rappresentante Regionale'
          WHEN u.rappresentante_comune = $1 THEN 'Rappresentante Comunale'
          WHEN u.attivisti = $1 THEN 'Attivista'
          WHEN u.organizzazioni = $1 THEN 'Organizzazione'
          ${provincialRole}
        END AS supporter_role
      FROM users u
      ${provincialJoin}
      WHERE (
        u.candidato_europeo = $1 OR
        u.candidato_camera = $1 OR
        u.candidato_senato = $1 OR
        u.candidato_regionale = $1 OR
        u.candidato_comune = $1 OR
        u.rappresentante_europeo = $1 OR
        u.rappresentante_camera = $1 OR
        u.rappresentante_senato = $1 OR
        u.rappresentante_regionale = $1 OR
        u.rappresentante_comune = $1 OR
        u.attivisti = $1 OR
        u.organizzazioni = $1
        ${provincialCondition}
      )
      ORDER BY u.created_at DESC
    `, [sostenuto_id]);

    console.log('🔍 DEBUG: Trovati sostenitori totali:', result.rows.length);

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
    console.error('❌ Errore nel recupero sostenitori totali:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
