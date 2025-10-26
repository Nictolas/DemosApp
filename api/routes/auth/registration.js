const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../../middleware/auth');
const { validateInput, validateEmail } = require('../../middleware/validation');
const { authAuditMiddleware } = require('../../middleware/auditMiddleware');
const { registrationLimiter } = require('../../middleware/rateLimiting');
const { validationRules, sanitizeInput } = require('../../middleware/inputValidation');
const ValidationService = require('../../services/validationService');
const { compressGender } = require('../../utils/genderUtils');
const { compressUserLocation } = require('../../utils/locationUtils');

const router = express.Router();

// Costanti
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const SALT_ROUNDS = 10;

// Importazione condizionale del servizio email
let emailService;
try {
  emailService = require('../../services/emailService');
} catch (error) {
  console.log('⚠️ Servizio email non disponibile:', error.message);
  emailService = {
    sendVerificationEmail: async () => ({ success: false, error: 'Servizio email non disponibile' })
  };
}

// POST /api/auth/register - Registrazione nuovo utente
router.post('/register', 
  registrationLimiter, 
  validateInput(['email', 'password', 'privacy_policy_consent', 'terms_of_service_consent', 'cookie_policy_consent']), 
  sanitizeInput(['nome', 'cognome', 'cittadinanza']),
  authAuditMiddleware, 
  async (req, res) => {
  try {
    console.log('✅ DEBUG: Richiesta /api/auth/register ricevuta!');
    console.log('✅ DEBUG: Headers:', req.headers);
    console.log('✅ DEBUG: Body:', req.body);
    
    // Validazione avanzata con ValidationService
    const validationRules = {
      email: { type: 'email', required: true },
      password: { type: 'password', required: true },
      nome: { required: false }, // Opzionale nella fase iniziale
      cognome: { required: false }, // Opzionale nella fase iniziale
      data_nascita: { type: 'dataNascita', required: false }
    };
    
    const validation = await ValidationService.validateAndSanitizeInput(req.body, validationRules);
    
    if (!validation.isValid) {
      // Log tentativo di validazione fallito
      await ValidationService.logValidationFailure(
        req.ip,
        req.get('User-Agent'),
        '/api/auth/register',
        validation.errors,
        req.body
      );
      
      return res.status(400).json({
        success: false,
        error: 'Dati di input non validi',
        details: validation.errors
      });
    }
    
    const { email, password, nome, cognome, privacy_policy_consent, terms_of_service_consent, cookie_policy_consent } = validation.sanitizedInput;
    
    // Se nome e cognome non sono presenti, usa valori di default temporanei
    const finalNome = nome || 'Temporaneo';
    const finalCognome = cognome || 'Utente';
    
    // Estrai tutti i dati dal body
    const { 
      paese_residenza, 
      regione_residenza, 
      provincia_residenza, 
      comune_residenza,
      data_nascita,
      genere,
      cittadinanza,
      ruolo,
      grado_elezione,
      paese_elezione,
      regione_elezione,
      provincia_elezione,
      comune_elezione,
      grado_candidatura,
      paese_candidatura,
      regione_candidatura,
      provincia_candidatura,
      comune_candidatura
    } = req.body;
    
    // Converti la data dal formato DD/MM/YYYY a YYYY-MM-DD per PostgreSQL
    let formattedDataNascita = null;
    if (data_nascita) {
      try {
        // Se la data è nel formato DD/MM/YYYY, convertila
        if (data_nascita.includes('/')) {
          const [day, month, year] = data_nascita.split('/');
          formattedDataNascita = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          console.log('📅 Data convertita:', data_nascita, '→', formattedDataNascita);
        } else {
          // Se è già nel formato corretto, usala così
          formattedDataNascita = data_nascita;
        }
      } catch (error) {
        console.error('❌ Errore nella conversione data:', error);
        formattedDataNascita = null;
      }
    }
    
    // Normalizza i gradi di elezione e candidatura (prima lettera maiuscola)
    const normalizeGrado = (grado) => {
      if (!grado || typeof grado !== 'string') return null;
      return grado.charAt(0).toUpperCase() + grado.slice(1).toLowerCase();
    };
    
    const normalizedGradoElezione = normalizeGrado(grado_elezione);
    const normalizedGradoCandidatura = normalizeGrado(grado_candidatura);
    
    console.log('🔧 Grado elezione normalizzato:', grado_elezione, '→', normalizedGradoElezione);
    console.log('🔧 Grado candidatura normalizzato:', grado_candidatura, '→', normalizedGradoCandidatura);
    
    console.log('📝 Tentativo registrazione per:', email);
    console.log('📊 Dati ricevuti:', JSON.stringify(req.body, null, 2));
    
    // Verifica consensi obbligatori
    if (!privacy_policy_consent || !terms_of_service_consent || !cookie_policy_consent) {
      return res.status(400).json({
        success: false,
        error: 'È necessario accettare tutti i consensi obbligatori per procedere con la registrazione'
      });
    }
    
    // L'unicità dell'email viene già verificata dal frontend tramite /api/check-email
    
    
    // Hash della password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    
    // Genera token di verifica email (valido per 24 ore)
    const verificationToken = jwt.sign(
      { 
        email: email.toLowerCase(),
        type: 'email_verification'
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Debug: verifica i parametri che verranno passati alla query
    console.log('🔍 DEBUG - Valori originali:', {
      genere: genere,
      cittadinanza: cittadinanza,
      paese_residenza: paese_residenza,
      provincia_residenza: provincia_residenza,
      paese_elezione: paese_elezione,
      provincia_elezione: provincia_elezione,
      paese_candidatura: paese_candidatura,
      provincia_candidatura: provincia_candidatura,
      ruolo: ruolo
    });
    
    const compressedGenere = compressGender(genere);
    const compressedCittadinanza = compressUserLocation({ cittadinanza }).cittadinanza;
    const compressedPaeseResidenza = compressUserLocation({ paese_residenza }).paese_residenza;
    const compressedProvinciaResidenza = compressUserLocation({ provincia_residenza }).provincia_residenza;
    const compressedPaeseElezione = compressUserLocation({ paese_elezione }).paese_elezione;
    const compressedProvinciaElezione = compressUserLocation({ provincia_elezione }).provincia_elezione;
    const compressedPaeseCandidatura = compressUserLocation({ paese_candidatura }).paese_candidatura;
    const compressedProvinciaCandidatura = compressUserLocation({ provincia_candidatura }).provincia_candidatura;
    
    // Compressione ruolo
    const ruoloMapping = {
      'Elettore': 'E',
      'Politico': 'P',
      'Candidato': 'C',
      'Candidato Politico': 'CP',
      'Attivista': 'A',
      'Admin': 'AD'
    };
    const compressedRuolo = ruoloMapping[ruolo] || 'E'; // Default a 'Elettore'
    
    console.log('🔍 DEBUG - Valori compressi:', {
      genere: compressedGenere,
      cittadinanza: compressedCittadinanza,
      paese_residenza: compressedPaeseResidenza,
      provincia_residenza: compressedProvinciaResidenza,
      paese_elezione: compressedPaeseElezione,
      provincia_elezione: compressedProvinciaElezione,
      paese_candidatura: compressedPaeseCandidatura,
      provincia_candidatura: compressedProvinciaCandidatura,
      ruolo: compressedRuolo
    });
    
    const queryParams = [
      finalNome, 
      finalCognome, 
      email.toLowerCase(), 
      passwordHash, 
      compressedRuolo,
      'p',
      verificationToken,
      compressedGenere || null,
      formattedDataNascita, // Usa la data convertita
      compressedCittadinanza || null,
      compressedPaeseResidenza || null,
      regione_residenza || null,
      compressedProvinciaResidenza || null,
      comune_residenza || null,
      normalizedGradoElezione,
      compressedPaeseElezione || null,
      regione_elezione || null,
      compressedProvinciaElezione || null,
      comune_elezione || null,
      normalizedGradoCandidatura,
      compressedPaeseCandidatura || null,
      regione_candidatura || null,
      compressedProvinciaCandidatura || null,
      comune_candidatura || null,
      privacy_policy_consent || false,
      terms_of_service_consent || false,
      cookie_policy_consent || false,
      new Date().toISOString()
    ];
    
    console.log('🔍 Parametri query:', queryParams.length);
    console.log('🔍 Parametri:', queryParams);
    
    // Inserisci nuovo utente con status "pending"
    const insertQuery = `
      INSERT INTO users (nome, cognome, email, password_hash, ruolo, status, email_verification_token, 
                        genere, data_nascita, cittadinanza, paese_residenza, regione_residenza, provincia_residenza, comune_residenza,
                        grado_elezione, paese_elezione, regione_elezione, provincia_elezione, comune_elezione,
                        grado_candidatura, paese_candidatura, regione_candidatura, provincia_candidatura, comune_candidatura,
                        privacy_policy_consent, terms_of_service_consent, cookie_policy_consent, consent_timestamp, 
                        created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, NOW())
      RETURNING id, nome, cognome, email, ruolo, status
    `;
    
    console.log('🚀 Esecuzione query INSERT...');
    console.log('🔍 Query SQL:', insertQuery);
    console.log('🔍 Parametri count:', queryParams.length);
    
    let result;
    try {
      result = await pool.query(insertQuery, queryParams);
      console.log('✅ Query INSERT completata con successo');
      console.log('📊 Risultato query:', result.rows);
    } catch (queryError) {
      console.error('❌ Errore nella query INSERT:', queryError);
      console.error('❌ Stack trace query:', queryError.stack);
      throw queryError;
    }
    
    const newUser = result.rows[0];
    
    // Invia email di verifica
    try {
      const verificationUrl = `${process.env.FRONTEND_URL || 'https://www.demos.community'}/conferma-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;
      await emailService.sendVerificationEmail(email, verificationToken, verificationUrl);
      
      console.log('✅ Email di verifica inviata per:', email);
      
      res.json({
        success: true,
        message: 'Registrazione completata! Controlla la tua email per confermare l\'account.',
        user: {
          id: newUser.id,
          name: newUser.nome,
          cognome: newUser.cognome,
          email: newUser.email,
          ruolo: newUser.ruolo,
          status: newUser.status
        },
        requiresVerification: true
      });
      
    } catch (emailError) {
      console.error('❌ Errore nell\'invio email di verifica:', emailError);
      
      // Se l'email non può essere inviata, elimina l'utente e restituisci errore
      await pool.query('DELETE FROM users WHERE id = $1', [newUser.id]);
      
      res.status(500).json({
        success: false,
        error: 'Errore nell\'invio email di verifica. Riprova più tardi.'
      });
    }
    
    } catch (error) {
      console.error('❌ Errore nella registrazione:', error);
      console.error('❌ Stack trace:', error.stack);
      
      // Gestione specifica per errori di constraint di unicità
      if (error.code === '23505') {
        if (error.constraint === 'users_email_key') {
          return res.status(400).json({
            success: false,
            error: 'Email già registrata',
            message: 'Un account con questa email esiste già. Prova ad accedere o usa un\'altra email.'
          });
        }
      }
      
      res.status(500).json({
        success: false,
        error: 'Errore nella registrazione',
        message: error.message
      });
    }
});

module.exports = router;
