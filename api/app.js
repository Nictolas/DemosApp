const express = require('express');
const rateLimit = require('express-rate-limit');
const { corsMiddleware, corsPreflight } = require('./middleware/cors');

// Inizializzazione app Express
const app = express();

// Configurazione middleware di base
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configurazione CORS
app.use(corsMiddleware);
app.use(corsPreflight);

// Rate limiting per prevenire abusi
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 100, // limite di 100 richieste per finestra
  message: {
    success: false,
    error: 'Troppe richieste, riprova più tardi'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Applica rate limiting a tutte le route
app.use(limiter);

// Importazione delle route modulari
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const rappresentantiRoutes = require('./routes/rappresentanti');
const opinioniRoutes = require('./routes/opinioni');
const elezioniRoutes = require('./routes/elezioni');
const sondaggiRoutes = require('./routes/sondaggi');
const graziaRoutes = require('./routes/grazia');
const amnistiaRoutes = require('./routes/amnistia');
const iceRoutes = require('./routes/ice');
const referendumRoutes = require('./routes/referendum');

// Router nuovi creati
const capoStatoRoutes = require('./routes/capo-stato');
const comunicazioniRoutes = require('./routes/comunicazioni');
const eventiRoutes = require('./routes/eventi');
const iniziativePopolariRoutes = require('./routes/iniziative-popolari');
const notificheRoutes = require('./routes/notifiche');
const statisticheRoutes = require('./routes/statistiche');
const sostenitoriRoutes = require('./routes/sostenitori');
const programmaRoutes = require('./routes/programma');
const reazioniComunicazioniRoutes = require('./routes/reazioni-comunicazioni');
const gestioneUtentiAggiuntiviRoutes = require('./routes/gestione-utenti-aggiuntivi');
const verificaRuoliRoutes = require('./routes/verifica-ruoli');
const governoRoutes = require('./routes/governo');
const candidatiRoutes = require('./routes/candidati');
const categorieRoutes = require('./routes/categorie');

// Registrazione delle route modulari
console.log('🔧 Registrazione route modulari...');
app.use('/api/utenti', userRoutes);
console.log('✅ Route /api/utenti registrata');
app.use('/api/users', userRoutes); // Compatibilità con frontend esistente
console.log('✅ Route /api/users registrata');
app.use('/api/rappresentanti', rappresentantiRoutes);
console.log('✅ Route /api/rappresentanti registrata');
app.use('/api/opinioni', opinioniRoutes);
console.log('✅ Route /api/opinioni registrata - Endpoint disponibili:', opinioniRoutes.stack?.map(r => r.route?.path).filter(Boolean));
app.use('/api/elezioni', elezioniRoutes);
console.log('✅ Route /api/elezioni registrata');
app.use('/api/sondaggi', sondaggiRoutes);
console.log('✅ Route /api/sondaggi registrata');
app.use('/api/grazia', graziaRoutes);
console.log('✅ Route /api/grazia registrata');
app.use('/api/amnistia', amnistiaRoutes);
console.log('✅ Route /api/amnistia registrata');
app.use('/api/ice', iceRoutes);
console.log('✅ Route /api/ice registrata');
app.use('/api/referendum', referendumRoutes);
console.log('✅ Route /api/referendum registrata');

// Registrazione delle nuove route
console.log('🔧 Registrazione nuove route...');
app.use('/api/capo-stato', capoStatoRoutes);
console.log('✅ Route /api/capo-stato registrata');
app.use('/api/comunicazioni', comunicazioniRoutes);
console.log('✅ Route /api/comunicazioni registrata');
app.use('/api/eventi', eventiRoutes);
console.log('✅ Route /api/eventi registrata');
app.use('/api/iniziative-popolari', iniziativePopolariRoutes);
console.log('✅ Route /api/iniziative-popolari registrata');
app.use('/api/notifiche', notificheRoutes);
console.log('✅ Route /api/notifiche registrata');
app.use('/api/statistiche', statisticheRoutes);
console.log('✅ Route /api/statistiche registrata');
app.use('/api/sostenitori', sostenitoriRoutes);
console.log('✅ Route /api/sostenitori registrata');
app.use('/api/programma', programmaRoutes);
console.log('✅ Route /api/programma registrata');
app.use('/api/reazioni-comunicazioni', reazioniComunicazioniRoutes);
console.log('✅ Route /api/reazioni-comunicazioni registrata');
app.use('/api/gestione-utenti-aggiuntivi', gestioneUtentiAggiuntiviRoutes);
console.log('✅ Route /api/gestione-utenti-aggiuntivi registrata');
app.use('/api/verifica-ruoli', verificaRuoliRoutes);
console.log('✅ Route /api/verifica-ruoli registrata');
app.use('/api/governo', governoRoutes);
console.log('✅ Route /api/governo registrata');
app.use('/api/candidati', candidatiRoutes);
console.log('✅ Route /api/candidati registrata');
app.use('/api/categorie', categorieRoutes);
console.log('✅ Route /api/categorie registrata');

// Registrazione delle route di autenticazione (DOPO gli endpoint personalizzati)
console.log('🔧 Registrazione route di autenticazione...');
app.use('/api/auth', authRoutes);
console.log('✅ Route /api/auth registrata - Endpoint disponibili:', authRoutes.stack?.map(r => r.route?.path).filter(Boolean));

// Route di base e health check
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Demos Community API',
    version: '2.0.0',
    status: 'Operativa',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'API operativa',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Endpoint per testare la connessione al database
app.get('/api/test-db', async (req, res) => {
  try {
    console.log('🧪 Test connessione database...');
    console.log('🌍 Ambiente:', process.env.NODE_ENV);
    console.log('🔗 DATABASE_URL presente:', !!process.env.DATABASE_URL);
    
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({
        success: false,
        error: 'DATABASE_URL mancante',
        message: 'Variabile d\'ambiente non configurata'
      });
    }

    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    // Test connessione
    const client = await pool.connect();
    console.log('✅ Connessione database riuscita!');
    
    // Test query semplice
    const result = await client.query('SELECT NOW() as current_time');
    console.log('📊 Query test riuscita:', result.rows[0]);
    
    client.release();
    await pool.end();

    res.json({
      success: true,
      message: 'Connessione database OK',
      timestamp: new Date().toISOString(),
      dbTime: result.rows[0].current_time,
      environment: process.env.NODE_ENV
    });

  } catch (error) {
    console.error('💥 Errore test database:', error);
    res.status(500).json({
      success: false,
      error: 'Errore connessione database',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Endpoint /api/auth/me spostato nelle route modulari per CORS corretto

// Endpoint diretto per opinioni-list (compatibilità frontend)
app.get('/api/opinioni-list', async (req, res) => {
  try {
    console.log('🔍 GET /api/opinioni-list - Richiesta diretta (compatibilità frontend)');
    
    // Reindirizza alla route modulare
    const opinioniRoutes = require('./routes/opinioni');
    const router = opinioniRoutes;
    
    // Crea una richiesta mock per il router
    const mockReq = {
      ...req,
      url: '/opinioni-list' + req.url.replace('/api/opinioni-list', '')
    };
    
    // Usa il router modulare
    router.handle(mockReq, res);
    
  } catch (error) {
    console.error('💥 Errore endpoint diretto opinioni-list:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile processare la richiesta opinioni'
    });
  }
});

// Endpoint per controllare se un'email esiste già
app.post('/api/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email richiesta',
        message: 'Il campo email è obbligatorio'
      });
    }

    console.log('🔍 Controllo email nel database:', email);
    console.log('🌍 Ambiente:', process.env.NODE_ENV);
    console.log('🔗 DATABASE_URL presente:', !!process.env.DATABASE_URL);

    // Importa la configurazione del database
    const { Pool } = require('pg');
    
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL mancante!');
      return res.status(500).json({
        success: false,
        error: 'Configurazione database mancante',
        message: 'Variabile DATABASE_URL non configurata'
      });
    }

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    console.log('🔌 Pool database creato, tentativo connessione...');

    // Test connessione
    const client = await pool.connect();
    console.log('✅ Connessione database riuscita!');
    client.release();

    // Controlla se l'email esiste nella tabella users
    const result = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    const exists = result.rows.length > 0;
    console.log('📊 Email trovata nel database:', exists, 'Righe:', result.rows.length);

    // Chiudi la connessione
    await pool.end();

    const response = { exists };
    console.log('📤 Invio risposta:', response);
    res.json(response);

  } catch (error) {
    console.error('💥 Errore durante il controllo email:', error);
    console.error('📋 Stack trace completo:', error.stack);
    
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile verificare l\'email',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Endpoint di registrazione utente
app.post('/api/register', async (req, res) => {
  try {
    console.log('🚀 REGISTRAZIONE INIZIATA - Ricevuta richiesta POST /api/register');
    console.log('📋 Headers ricevuti:', req.headers);
    console.log('📦 Body ricevuto:', JSON.stringify(req.body, null, 2));
    
    const { email, password, nome, cognome, genere, data_nascita, cittadinanza, paese_residenza, regione_residenza, provincia_residenza, comune_residenza, ruolo, grado_elezione, paese_elezione, regione_elezione, provincia_elezione, comune_elezione, grado_candidatura, paese_candidatura, regione_candidatura, provincia_candidatura, comune_candidatura } = req.body;

    // Validazione campi obbligatori
    if (!email || !password || !nome || !cognome) {
      console.log('❌ Validazione fallita - campi obbligatori mancanti');
      return res.status(400).json({
        success: false,
        error: 'Campi obbligatori mancanti',
        message: 'Email, password, nome e cognome sono obbligatori'
      });
    }

    console.log('✅ Validazione campi obbligatori superata');
    console.log('📝 REGISTRAZIONE - Tentativo registrazione per:', email);
    console.log('📋 Dati ricevuti:', { email, nome, cognome, genere, data_nascita, cittadinanza, ruolo });

    // Importa la configurazione del database
    console.log('📚 Importazione moduli...');
    const { Pool } = require('pg');
    const bcrypt = require('bcryptjs');
    
    console.log('🔍 Verifica variabili d\'ambiente...');
    console.log('🌍 NODE_ENV:', process.env.NODE_ENV);
    console.log('🔗 DATABASE_URL presente:', !!process.env.DATABASE_URL);
    console.log('🔑 JWT_SECRET presente:', !!process.env.JWT_SECRET);
    
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL mancante!');
      return res.status(500).json({
        success: false,
        error: 'Configurazione database mancante',
        message: 'Variabile DATABASE_URL non configurata'
      });
    }

    console.log('✅ DATABASE_URL configurata, creazione pool...');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    console.log('🔌 Pool database creato, tentativo connessione...');

    // Test connessione
    const client = await pool.connect();
    console.log('✅ Connessione database riuscita!');
    client.release();

    // Hash della password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    console.log('🔐 Password hashata con successo');

    // Converti la data di nascita dal formato DD/MM/YYYY a YYYY-MM-DD
    let dataNascitaConvertita = null;
    if (data_nascita && data_nascita.trim() !== '') {
      try {
        console.log('📅 Tentativo conversione data:', data_nascita);
        
        // Verifica formato DD/MM/YYYY
        const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
        const match = data_nascita.match(dateRegex);
        
        if (match) {
          const [, giorno, mese, anno] = match;
          
          // Validazione valori
          const giornoNum = parseInt(giorno);
          const meseNum = parseInt(mese);
          const annoNum = parseInt(anno);
          
          if (giornoNum >= 1 && giornoNum <= 31 && 
              meseNum >= 1 && meseNum <= 12 && 
              annoNum >= 1900 && annoNum <= 2100) {
            
            dataNascitaConvertita = `${annoNum}-${meseNum.toString().padStart(2, '0')}-${giornoNum.toString().padStart(2, '0')}`;
            console.log('✅ Data di nascita convertita con successo:', data_nascita, '→', dataNascitaConvertita);
          } else {
            console.warn('⚠️ Valori data fuori range:', { giorno: giornoNum, mese: meseNum, anno: annoNum });
          }
        } else {
          console.warn('⚠️ Formato data non valido (atteso DD/MM/YYYY):', data_nascita);
        }
      } catch (error) {
        console.error('❌ Errore critico conversione data:', error);
        console.error('📋 Stack trace conversione:', error.stack);
      }
    }
    
    // Log finale per debugging
    console.log('📅 Data finale per database:', dataNascitaConvertita || 'NULL (nessuna data)');

    // Inserisci l'utente nella tabella users
    const insertQuery = `
      INSERT INTO users (
        email, password_hash, nome, cognome, genere, data_nascita, cittadinanza,
        paese_residenza, regione_residenza, provincia_residenza, comune_residenza,
        ruolo, grado_elezione, paese_elezione, regione_elezione, provincia_elezione, comune_elezione,
        grado_candidatura, paese_candidatura, regione_candidatura, provincia_candidatura, comune_candidatura,
        status, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
      ) RETURNING id, email, nome, cognome
    `;

    const insertValues = [
      email.toLowerCase(), passwordHash, nome, cognome, genere || null, dataNascitaConvertita, cittadinanza || null,
      paese_residenza || null, regione_residenza || null, provincia_residenza || null, comune_residenza || null,
      ruolo || 'elettore', grado_elezione || null, paese_elezione || null, regione_elezione || null, provincia_elezione || null, comune_elezione || null,
      grado_candidatura || null, paese_candidatura || null, regione_candidatura || null, provincia_candidatura || null, comune_candidatura || null,
      'pending', new Date(), new Date()
    ];

    console.log('📝 Eseguendo query di inserimento...');
    const result = await pool.query(insertQuery, insertValues);
    
    if (result.rows.length === 0) {
      throw new Error('Inserimento utente fallito');
    }

    const newUser = result.rows[0];
    console.log('✅ Utente registrato con successo:', newUser.email, 'ID:', newUser.id);

    // Chiudi la connessione
    await pool.end();

    // Genera token JWT
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    
    const token = jwt.sign(
      { 
        userId: newUser.id,
        email: newUser.email,
        ruolo: newUser.ruolo || 'elettore'
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('🎫 Token JWT generato per utente:', newUser.email);

    res.json({
      success: true,
      message: 'Utente registrato con successo',
      user: {
        id: newUser.id,
        email: newUser.email,
        nome: newUser.nome,
        cognome: newUser.cognome,
        ruolo: newUser.ruolo || 'elettore'
      },
      token: token
    });

  } catch (error) {
    console.error('💥 Errore durante la registrazione:', error);
    console.error('📋 Stack trace completo:', error.stack);
    
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile completare la registrazione',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Endpoint per verificare la struttura della tabella users
app.get('/api/check-table-structure', async (req, res) => {
  try {
    console.log('🔍 Verificando struttura tabella users...');
    
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({
        success: false,
        error: 'DATABASE_URL mancante',
        message: 'Variabile d\'ambiente non configurata'
      });
    }

    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // 1. Verifica esistenza tabella
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      await pool.end();
      return res.status(404).json({
        success: false,
        error: 'Tabella non trovata',
        message: 'La tabella "users" non esiste nel database'
      });
    }

    // 2. Ottieni struttura completa della tabella
    const structure = await pool.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position;
    `);

    // 3. Verifica campi specifici per la registrazione
    const requiredFields = [
      'email', 'password_hash', 'nome', 'cognome', 'genere', 
      'data_nascita', 'cittadinanza', 'paese_residenza', 
      'regione_residenza', 'provincia_residenza', 'comune_residenza',
      'ruolo', 'grado_elezione', 'paese_elezione', 'regione_elezione',
      'provincia_elezione', 'comune_elezione', 'grado_candidatura',
      'paese_candidatura', 'regione_candidatura', 'provincia_candidatura',
      'comune_candidatura', 'status', 'created_at', 'updated_at'
    ];

    const existingColumns = structure.rows.map(row => row.column_name);
    const missingFields = requiredFields.filter(field => !existingColumns.includes(field));
    const extraFields = existingColumns.filter(col => !requiredFields.includes(col));

    await pool.end();

    res.json({
      success: true,
      message: 'Struttura tabella verificata',
      tableExists: true,
      totalColumns: structure.rows.length,
      structure: structure.rows,
      requiredFields: {
        total: requiredFields.length,
        existing: requiredFields.filter(field => existingColumns.includes(field)),
        missing: missingFields
      },
      extraFields: extraFields,
      criticalFields: {
        data_nascita: structure.rows.find(row => row.column_name === 'data_nascita')?.data_type || 'MISSING',
        created_at: structure.rows.find(row => row.column_name === 'created_at')?.data_type || 'MISSING',
        updated_at: structure.rows.find(row => row.column_name === 'updated_at')?.data_type || 'MISSING'
      }
    });

  } catch (error) {
    console.error('💥 Errore durante la verifica struttura:', error);
    res.status(500).json({
      success: false,
      error: 'Errore durante la verifica',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Endpoint di test per Resend
app.post('/api/test-resend-email', async (req, res) => {
  try {
    const { testResend } = require('./services/emailService');
    const result = await testResend();
    res.json(result);
  } catch (error) {
    console.error('❌ Errore nel test Resend:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel test Resend',
      message: error.message
    });
  }
});

// Gestione errori 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint non trovato',
    message: `La route ${req.originalUrl} non esiste`
  });
});

// Middleware per gestire errori globali
app.use((error, req, res, next) => {
  console.error('❌ Errore globale:', error);
  
  res.status(error.status || 500).json({
    success: false,
    error: 'Errore interno del server',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Si è verificato un errore interno'
  });
});

module.exports = app;
