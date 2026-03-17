const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../../middleware/auth');
const { validateInput, validateEmail } = require('../../middleware/validation');
const { authAuditMiddleware } = require('../../middleware/auditMiddleware');
// Rate limiter rimosso - abbiamo già altre protezioni (lock, validazione, ecc.)
// const { registrationLimiter } = require('../../middleware/rateLimiting');
const { validationRules, sanitizeInput } = require('../../middleware/inputValidation');
const ValidationService = require('../../services/validationService');
const { compressGender } = require('../../utils/genderUtils');
const { compressUserLocation } = require('../../utils/locationUtils');

const router = express.Router();

// Costanti
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const SALT_ROUNDS = 10;

// Lock rimosso - causa più problemi che benefici
// Abbiamo già altre protezioni: controllo email, constraint database, validazione

// Servizio email non più utilizzato: nessuna verifica via email in fase di registrazione

// POST /api/auth/register - Registrazione nuovo utente
router.post('/register', 
  // registrationLimiter rimosso - abbiamo già altre protezioni
  validateInput(['email', 'password', 'privacy_policy_consent', 'terms_of_service_consent', 'political_opinions_consent']), 
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
    
    const { email, password, nome, cognome, privacy_policy_consent, terms_of_service_consent, political_opinions_consent } = validation.sanitizedInput;
    
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
      // NOTE: fcmToken non viene più gestito qui, ma tramite useSyncFcmToken nel frontend
    } = req.body;
    
    // Debug: verifica cosa arriva dal frontend
    console.log('🔍 DEBUG - Dati ricevuti dal frontend:', {
      genere: genere,
      cittadinanza: cittadinanza,
      paese_residenza: paese_residenza,
      regione_residenza: regione_residenza,
      provincia_residenza: provincia_residenza,
      comune_residenza: comune_residenza
    });
    
    // GDPR: accettiamo solo anno (YYYY) o data completa; salviamo come YYYY-01-01 per i cittadini
    let formattedDataNascita = null;
    if (data_nascita) {
      try {
        const str = String(data_nascita).trim();
        if (/^\d{4}$/.test(str)) {
          formattedDataNascita = `${str}-01-01`;
        } else if (str.includes('/')) {
          const [day, month, year] = str.split('/');
          formattedDataNascita = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
          formattedDataNascita = str;
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
    if (!privacy_policy_consent || !terms_of_service_consent || !political_opinions_consent) {
      return res.status(400).json({
        success: false,
        error: 'È necessario accettare tutti i consensi obbligatori per procedere con la registrazione'
      });
    }
    
    // Normalizza email per i controlli
    const normalizedEmail = email.toLowerCase().trim();
    
    try {
      // Verifica preventiva se l'email esiste già (per evitare errori di constraint)
      // Questo controllo avviene DOPO il lock, quindi è thread-safe
      try {
        const existingUser = await pool.query(
          'SELECT id, email, status, email_verification_token FROM users WHERE LOWER(TRIM(email)) = $1',
          [normalizedEmail]
        );
        
        if (existingUser.rows.length > 0) {
          const user = existingUser.rows[0];
          const isEmailVerified = !user.email_verification_token || user.status === 'a';
          
          console.log('⚠️ Email già esistente:', {
            email: normalizedEmail,
            userId: user.id,
            status: user.status,
            hasVerificationToken: !!user.email_verification_token,
            isEmailVerified: isEmailVerified,
            existingEmail: user.email
          });
          
          // Se l'utente è in stato "pending" e l'email non è verificata, elimina l'account vecchio
          // e permette la nuova registrazione
          if (user.status === 'p' && !isEmailVerified) {
            console.log('🔄 Account pending non verificato trovato, eliminando e permettendo nuova registrazione...');
            try {
              await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
              console.log('✅ Account pending eliminato, procedendo con nuova registrazione');
            } catch (deleteError) {
              console.error('❌ Errore nell\'eliminazione account pending:', deleteError);
              // Continua comunque, il constraint del database gestirà il caso
            }
          } else {
            // Account attivo o verificato: blocca la registrazione
            console.log('🚫 Account esistente attivo/verificato, blocco registrazione');
            return res.status(400).json({
              success: false,
              error: 'Email già registrata',
              message: 'Un account con questa email esiste già. Prova ad accedere o usa un\'altra email.'
            });
          }
        }
      } catch (checkError) {
        console.error('❌ Errore nel controllo email esistente:', checkError);
        // Continua comunque, il constraint del database catturerà l'errore
      }
    
    // Hash della password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    
    // Debug: verifica i parametri che verranno passati alla query
    console.log('🔍 DEBUG - Valori originali:', {
      genere: genere,
      cittadinanza: cittadinanza,
      paese_residenza: paese_residenza,
      regione_residenza: regione_residenza,
      provincia_residenza: provincia_residenza,
      paese_elezione: paese_elezione,
      regione_elezione: regione_elezione,
      provincia_elezione: provincia_elezione,
      paese_candidatura: paese_candidatura,
      regione_candidatura: regione_candidatura,
      provincia_candidatura: provincia_candidatura,
      ruolo: ruolo
    });
    
    const compressedGenere = compressGender(genere);
    const compressedCittadinanza = compressUserLocation({ cittadinanza }).cittadinanza;
    const compressedPaeseResidenza = compressUserLocation({ paese_residenza }).paese_residenza;
    const compressedRegioneResidenza = compressUserLocation({ regione_residenza }).regione_residenza;
    const compressedProvinciaResidenza = compressUserLocation({ provincia_residenza }).provincia_residenza;
    const compressedPaeseElezione = compressUserLocation({ paese_elezione }).paese_elezione;
    const compressedRegioneElezione = compressUserLocation({ regione_elezione }).regione_elezione;
    const compressedProvinciaElezione = compressUserLocation({ provincia_elezione }).provincia_elezione;
    const compressedPaeseCandidatura = compressUserLocation({ paese_candidatura }).paese_candidatura;
    const compressedRegioneCandidatura = compressUserLocation({ regione_candidatura }).regione_candidatura;
    const compressedProvinciaCandidatura = compressUserLocation({ provincia_candidatura }).provincia_candidatura;
    
    // Compressione ruolo - tutti i nuovi utenti sono automaticamente "Elettore"
    const ruoloMapping = {
      'Elettore': 'E',
      'Politico': 'P',
      'Candidato': 'C',
      'Candidato Politico': 'CP',
      'Attivista': 'A',
      'Istituzione': 'I',
      'Admin': 'AD'
    };
    // Se il ruolo non è fornito o è vuoto, imposta automaticamente "Elettore"
    const ruoloToUse = ruolo || 'Elettore';
    const compressedRuolo = ruoloMapping[ruoloToUse] || 'E'; // Default sempre a 'Elettore'
    
    console.log('🔍 DEBUG - Valori originali ricevuti:', {
      genere: genere,
      cittadinanza: cittadinanza,
      paese_residenza: paese_residenza
    });
    
    console.log('🔍 DEBUG - Valori compressi:', {
      genere: compressedGenere,
      cittadinanza: compressedCittadinanza,
      paese_residenza: compressedPaeseResidenza,
      regione_residenza: compressedRegioneResidenza,
      provincia_residenza: compressedProvinciaResidenza,
      paese_elezione: compressedPaeseElezione,
      regione_elezione: compressedRegioneElezione,
      provincia_elezione: compressedProvinciaElezione,
      paese_candidatura: compressedPaeseCandidatura,
      regione_candidatura: compressedRegioneCandidatura,
      provincia_candidatura: compressedProvinciaCandidatura,
      ruolo: compressedRuolo
    });
    
    // Debug finale prima della query
    console.log('🔍 DEBUG - Valori che verranno inseriti nel database:', {
      genere: compressedGenere,
      cittadinanza: compressedCittadinanza,
      paese_residenza: compressedPaeseResidenza,
      regione_residenza: compressedRegioneResidenza,
      provincia_residenza: compressedProvinciaResidenza
    });
    
    const queryParams = [
      finalNome, 
      finalCognome, 
      email.toLowerCase(), 
      passwordHash, 
      compressedRuolo,
      'a', // account subito attivo, senza verifica email
      null, // email_verification_token non più utilizzato
      compressedGenere || null,
      formattedDataNascita, // Usa la data convertita
      compressedCittadinanza || null,
      compressedPaeseResidenza || null,
      compressedRegioneResidenza || null,
      compressedProvinciaResidenza || null,
      comune_residenza || null,
      normalizedGradoElezione,
      compressedPaeseElezione || null,
      compressedRegioneElezione || null,
      compressedProvinciaElezione || null,
      comune_elezione || null,
      normalizedGradoCandidatura,
      compressedPaeseCandidatura || null,
      compressedRegioneCandidatura || null,
      compressedProvinciaCandidatura || null,
      comune_candidatura || null,
      privacy_policy_consent || false,
      terms_of_service_consent || false,
      new Date().toISOString(),
      political_opinions_consent || false,
      political_opinions_consent ? new Date().toISOString() : null,
      political_opinions_consent ? (req.ip || req.connection.remoteAddress) : null,
      political_opinions_consent ? req.get('User-Agent') : null
    ];
    
    console.log('🔍 Parametri query:', queryParams.length);
    console.log('🔍 Parametri:', queryParams);
    
    // Inserisci nuovo utente con status "attivo"
    const insertQuery = `
      INSERT INTO users (nome, cognome, email, password_hash, ruolo, status, email_verification_token, 
                        genere, data_nascita, cittadinanza, paese_residenza, regione_residenza, provincia_residenza, comune_residenza,
                        grado_elezione, paese_elezione, regione_elezione, provincia_elezione, comune_elezione,
                        grado_candidatura, paese_candidatura, regione_candidatura, provincia_candidatura, comune_candidatura,
                        privacy_policy_consent, terms_of_service_consent, consent_timestamp,
                        political_opinions_consent, political_opinions_consent_timestamp, 
                        political_opinions_consent_ip_address, political_opinions_consent_user_agent,
                        created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, NOW())
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
    
    // NOTE: Il token FCM viene gestito automaticamente da useSyncFcmToken nel frontend
    // tramite l'endpoint /api/fcm-tokens dopo il login, quindi non serve gestirlo qui
    
    // Nessuna email di verifica: account subito attivo
    res.json({
      success: true,
      message: 'Registrazione completata! Il tuo account è già attivo.',
      user: {
        id: newUser.id,
        name: newUser.nome,
        cognome: newUser.cognome,
        email: newUser.email,
        ruolo: newUser.ruolo,
        status: newUser.status
      },
      requiresVerification: false
    });
    
    } catch (error) {
      console.error('❌ Errore nella registrazione:', error);
      console.error('❌ Stack trace:', error.stack);
      
      // Il lock verrà rilasciato nel finally
      
      // Se c'è un errore di constraint di unicità, significa che il controllo iniziale non ha funzionato
      // (non dovrebbe mai succedere con il lock, ma gestiamolo come errore generico)
      if (error.code === '23505' && error.constraint === 'users_email_key') {
        console.error('⚠️ Errore constraint email - il controllo iniziale non ha funzionato correttamente');
        return res.status(400).json({
          success: false,
          error: 'Email già registrata',
          message: 'Un account con questa email esiste già. Prova ad accedere o usa un\'altra email.'
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Errore nella registrazione',
        message: error.message
      });
    } finally {
      // Lock rimosso - non più necessario
    }
  } catch (outerError) {
    // Gestione errori generali non catturati dal try interno
    console.error('❌ Errore generale nella registrazione:', outerError);
    res.status(500).json({
      success: false,
      error: 'Errore nella registrazione',
      message: outerError.message || 'Si è verificato un errore imprevisto'
    });
  }
});

module.exports = router;
