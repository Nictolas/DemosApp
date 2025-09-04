const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../../middleware/auth');
const { validateInput, validateEmail } = require('../../middleware/validation');

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
router.post('/register', validateInput(['email', 'password', 'nome', 'cognome']), validateEmail, async (req, res) => {
  try {
    console.log('✅ DEBUG: Richiesta /api/auth/register ricevuta!');
    console.log('✅ DEBUG: Headers:', req.headers);
    console.log('✅ DEBUG: Body:', req.body);
    
    const { email, password, nome, cognome, codice_fiscale } = req.body;
    
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
    
    console.log('📝 Tentativo registrazione per:', email);
    console.log('📊 Dati ricevuti:', JSON.stringify(req.body, null, 2));
    
    // Verifica se l'email è già registrata
    const existingUserQuery = 'SELECT id FROM users WHERE email = $1';
    const existingUserResult = await pool.query(existingUserQuery, [email.toLowerCase()]);
    
    if (existingUserResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Email già registrata',
        message: 'Un account con questa email esiste già'
      });
    }
    
    // Verifica se il codice fiscale è già registrato (se fornito)
    if (codice_fiscale) {
      const existingCfQuery = 'SELECT id FROM users WHERE codice_fiscale = $1';
      const existingCfResult = await pool.query(existingCfQuery, [codice_fiscale.toUpperCase()]);
      
      if (existingCfResult.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Codice fiscale già registrato',
          message: 'Un account con questo codice fiscale esiste già'
        });
      }
    }
    
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
    const queryParams = [
      nome, 
      cognome, 
      email.toLowerCase(), 
      passwordHash, 
      ruolo || 'Elettore',
      codice_fiscale ? codice_fiscale.toUpperCase() : null,
      'pending',
      verificationToken,
      genere || null,
      data_nascita || null,
      cittadinanza || null,
      paese_residenza || null,
      regione_residenza || null,
      provincia_residenza || null,
      comune_residenza || null,
      grado_elezione || null,
      paese_elezione || null,
      regione_elezione || null,
      provincia_elezione || null,
      comune_elezione || null,
      grado_candidatura || null,
      paese_candidatura || null,
      regione_candidatura || null,
      provincia_candidatura || null,
      comune_candidatura || null
    ];
    
    console.log('🔍 Parametri query:', queryParams.length);
    console.log('🔍 Parametri:', queryParams);
    
    // Inserisci nuovo utente con status "pending"
    const insertQuery = `
      INSERT INTO users (nome, cognome, email, password_hash, ruolo, codice_fiscale, status, email_verification_token, 
                        genere, data_nascita, cittadinanza, paese_residenza, regione_residenza, provincia_residenza, comune_residenza,
                        grado_elezione, paese_elezione, regione_elezione, provincia_elezione, comune_elezione,
                        grado_candidatura, paese_candidatura, regione_candidatura, provincia_candidatura, comune_candidatura, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, NOW())
      RETURNING id, nome, cognome, email, ruolo, codice_fiscale, status
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
      const verificationUrl = `${process.env.FRONTEND_URL || 'https://www.demos.community'}/verify-email?token=${verificationToken}`;
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
          codice_fiscale: newUser.codice_fiscale,
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
    res.status(500).json({
      success: false,
      error: 'Errore nella registrazione',
      message: error.message
    });
  }
});

module.exports = router;
