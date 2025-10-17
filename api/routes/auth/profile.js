const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../../middleware/auth');
const { decompressGender } = require('../../utils/genderUtils');
const { decompressUserLocation } = require('../../utils/locationUtils');

const router = express.Router();

// Costanti
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// GET /api/auth/me - Ottieni profilo utente autenticato
router.get('/me', async (req, res) => {
  try {
    console.log('🔍 GET /api/auth/me - Richiesta profilo utente (route modulare)');
    
    // Verifica token JWT
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Token JWT mancante o malformato');
      return res.status(401).json({
        success: false,
        error: 'Token mancante',
        message: 'Token di autenticazione richiesto'
      });
    }

    const token = authHeader.substring(7);
    console.log('🔑 Token ricevuto:', token.substring(0, 20) + '...');

    // Verifica e decodifica token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
      console.log('✅ Token JWT verificato per utente:', decoded.email);
      console.log('🔍 DEBUG - decoded.userId:', decoded.userId);
      console.log('🔍 DEBUG - typeof decoded.userId:', typeof decoded.userId);
    } catch (jwtError) {
      console.log('❌ Token JWT non valido:', jwtError.message);
      return res.status(401).json({
        success: false,
        error: 'Token non valido',
        message: 'Token di autenticazione scaduto o non valido'
      });
    }

    // Recupera dati utente
    const result = await pool.query(
      'SELECT id, email, nome, cognome, genere, data_nascita, cittadinanza, paese_residenza, regione_residenza, provincia_residenza, comune_residenza, ruolo, grado_elezione, paese_elezione, regione_elezione, provincia_elezione, comune_elezione, grado_candidatura, paese_candidatura, regione_candidatura, provincia_candidatura, comune_candidatura, rappresentante_europeo, rappresentante_camera, rappresentante_senato, rappresentante_regionale, rappresentante_comune, candidato_europeo, candidato_camera, candidato_senato, candidato_regionale, candidato_comune, status, created_at, updated_at, facebook_url, twitter_url, instagram_url, linkedin_url, telegram_url, website_url, twitch_url, youtube_url FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      console.log('❌ Utente non trovato nel database');
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato',
        message: 'Utente non trovato nel database'
      });
    }

    const user = result.rows[0];
    console.log('✅ Profilo utente recuperato:', user.email);

    // Formatta la data di nascita per il frontend (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (user.data_nascita) {
      const data = new Date(user.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }

    console.log('📤 Invio profilo utente completo');

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        nome: user.nome,
        cognome: user.cognome,
        genere: decompressGender(user.genere),
        data_nascita: dataNascitaFormattata,
        cittadinanza: decompressUserLocation(user).cittadinanza,
        paese_residenza: decompressUserLocation(user).paese_residenza,
        regione_residenza: user.regione_residenza,
        provincia_residenza: user.provincia_residenza,
        comune_residenza: user.comune_residenza,
        ruolo: user.ruolo,
        grado_elezione: user.grado_elezione,
        paese_elezione: user.paese_elezione,
        regione_elezione: user.regione_elezione,
        provincia_elezione: user.provincia_elezione,
        comune_elezione: user.comune_elezione,
        grado_candidatura: user.grado_candidatura,
        paese_candidatura: user.paese_candidatura,
        regione_candidatura: user.regione_candidatura,
        provincia_candidatura: user.provincia_candidatura,
        comune_candidatura: user.comune_candidatura,
        rappresentante_europeo: user.rappresentante_europeo,
        rappresentante_camera: user.rappresentante_camera,
        rappresentante_senato: user.rappresentante_senato,
        rappresentante_regionale: user.rappresentante_regionale,
        rappresentante_comune: user.rappresentante_comune,
        candidato_europeo: user.candidato_europeo,
        candidato_camera: user.candidato_camera,
        candidato_senato: user.candidato_senato,
        candidato_regionale: user.candidato_regionale,
        candidato_comune: user.candidato_comune,
        status: user.status,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });

  } catch (error) {
    console.error('💥 Errore durante il recupero profilo:', error);
    console.error('📋 Stack trace completo:', error.stack);
    
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare il profilo utente',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
