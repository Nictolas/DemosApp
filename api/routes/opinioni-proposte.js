const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { getPool } = require('../config/database');

const router = express.Router();

// Usa il pool centralizzato ottimizzato
const pool = getPool();

// Funzione per creare la tabella voti se non esiste
async function ensureVotiTableExists() {
  try {
    // Verifica che DATABASE_URL sia disponibile
    if (!process.env.DATABASE_URL) {
      console.warn('⚠️ DATABASE_URL non disponibile, salto la creazione della tabella voti');
      return;
    }

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS voti_opinioni_proposte (
        id SERIAL PRIMARY KEY,
        utente_id UUID NOT NULL,
        opinione_id VARCHAR(255) NOT NULL,
        data_voto TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(utente_id, opinione_id)
      );
    `;
    
    await pool.query(createTableQuery);
    
    // Crea indici per performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_voti_opinioni_utente_id 
      ON voti_opinioni_proposte(utente_id);
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_voti_opinioni_opinione_id 
      ON voti_opinioni_proposte(opinione_id);
    `);
    
    console.log('✅ Tabella voti_opinioni_proposte verificata/creata');
  } catch (error) {
    console.error('❌ Errore nella creazione tabella voti:', error);
    // Non bloccare l'avvio del server se c'è un errore nella creazione della tabella
  }
}

// Inizializza la tabella all'avvio (ritardata per assicurarsi che il pool sia pronto)
setTimeout(() => {
  ensureVotiTableExists().catch(err => {
    console.error('❌ Errore nell\'inizializzazione tabella voti:', err);
  });
}, 1000); // Attendi 1 secondo per assicurarsi che il pool sia inizializzato

// GET /api/opinioni-proposte/test-voto - Test endpoint per verificare inserimento voto
router.get('/test-voto', async (req, res) => {
  try {
    console.log('🧪 TEST - Test inserimento voto');
    
    // Test inserimento voto di prova
    const testUserId = 'test-user-id';
    const testOpinioneId = 'allevamenti_intensivi';
    
    console.log('🔍 Test parametri:', { testUserId, testOpinioneId });
    
    // Prima assicurati che la tabella esista
    await ensureVotiTableExists();
    
    // Prova inserimento
    const insertQuery = `
      INSERT INTO voti_opinioni_proposte (utente_id, opinione_id)
      VALUES ($1, $2)
      ON CONFLICT (utente_id, opinione_id) DO NOTHING
    `;
    
    const result = await pool.query(insertQuery, [testUserId, testOpinioneId]);
    console.log('📊 Risultato test inserimento:', result);
    
    // Verifica che il voto sia stato inserito
    const checkQuery = `
      SELECT * FROM voti_opinioni_proposte 
      WHERE utente_id = $1 AND opinione_id = $2
    `;
    const checkResult = await pool.query(checkQuery, [testUserId, testOpinioneId]);
    console.log('🔍 Voto inserito:', checkResult.rows);
    
    res.json({
      success: true,
      test_inserted: result.rowCount > 0,
      vote_exists: checkResult.rows.length > 0,
      vote_data: checkResult.rows[0] || null
    });
    
  } catch (error) {
    console.error('❌ Errore nel test voto:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// GET /api/opinioni-proposte/debug - Debug endpoint per verificare database
router.get('/debug', async (req, res) => {
  try {
    console.log('🔍 Debug endpoint opinioni-proposte chiamato');
    
    // Test connessione database
    const testQuery = await pool.query('SELECT NOW() as current_time');
    console.log('✅ Database connesso:', testQuery.rows[0].current_time);
    
    // Test tabella opinioni
    const opinioniCount = await pool.query('SELECT COUNT(*) as count FROM opinioni_domande');
    console.log('✅ Righe in opinioni:', opinioniCount.rows[0].count);
    
    // Test opinioni da approvare
    const daApprovareQuery = `
      SELECT COUNT(*) as count FROM opinioni_domande 
      WHERE 'da approvare' = ANY(gradi_opinione)
    `;
    const daApprovareCount = await pool.query(daApprovareQuery);
    console.log('✅ Righe da approvare:', daApprovareCount.rows[0].count);
    
    // Test tabella voti_opinioni_proposte
    let votiTableExists = false;
    let votiCount = 0;
    try {
      const votiCountQuery = await pool.query('SELECT COUNT(*) as count FROM voti_opinioni_proposte');
      votiTableExists = true;
      votiCount = votiCountQuery.rows[0].count;
      console.log('✅ Righe in voti_opinioni_proposte:', votiCount);
    } catch (error) {
      console.log('⚠️ Tabella voti_opinioni_proposte non esiste:', error.message);
    }
    
    // Test struttura tabella voti se esiste
    let votiStructure = [];
    if (votiTableExists) {
      try {
        const structureQuery = `
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns 
          WHERE table_name = 'voti_opinioni_proposte'
          ORDER BY ordinal_position
        `;
        const structure = await pool.query(structureQuery);
        votiStructure = structure.rows;
        console.log('📋 Struttura tabella voti:', votiStructure);
      } catch (error) {
        console.log('⚠️ Errore nel recuperare struttura tabella voti:', error.message);
      }
    }
    
    res.json({
      success: true,
      database_connected: true,
      opinioni_count: opinioniCount.rows[0].count,
      da_approvare_count: daApprovareCount.rows[0].count,
      voti_table_exists: votiTableExists,
      voti_count: votiCount,
      voti_structure: votiStructure,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Errore nel debug:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/opinioni-proposte/voti-utente - Ottieni voti dell'utente autenticato
router.get('/voti-utente', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    console.log('🔍 GET /api/opinioni-proposte/voti-utente - Voti utente:', userId);
    
    const query = `
      SELECT opinione_id 
      FROM voti_opinioni_proposte 
      WHERE utente_id = $1
    `;
    
    const result = await pool.query(query, [userId]);
    const votiUtente = result.rows.map(row => String(row.opinione_id)); // Assicura che siano stringhe
    
    // Debug: mostra i primi 3 ID voti per verificare il formato
    if (votiUtente.length > 0) {
      console.log('🔍 DEBUG - Prime 3 ID voti utente:', votiUtente.slice(0, 3).map(id => ({ id, idType: typeof id, idLength: id?.length })));
    }
    
    console.log(`✅ Trovati ${votiUtente.length} voti per utente ${userId}`);
    
    res.json({
      success: true,
      data: votiUtente
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare voti utente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare voti utente',
      message: error.message
    });
  }
});

// GET /api/opinioni-proposte - Ottieni opinioni da approvare dalla tabella opinioni
router.get('/', async (req, res) => {
  try {
    console.log('🔍 GET /api/opinioni-proposte - Caricamento opinioni da approvare');

    // Leggi da opinioni_proposte se esiste, altrimenti da opinioni_domande (proposte "da approvare")
    const fromProposte = `
      SELECT o.id, o.text as testo, o.approfondimento, COALESCE(v.voti_count, 0)::int as voti
      FROM opinioni_proposte o
      LEFT JOIN (
        SELECT opinione_id, COUNT(*) as voti_count FROM voti_opinioni_proposte GROUP BY opinione_id
      ) v ON CAST(o.id AS TEXT) = CAST(v.opinione_id AS TEXT)
      ORDER BY o.text`;
    // Supporto sia gradi_opinione che gradi_opinioni (Neon può avere l'uno o l'altro)
    const whereGradi = (col) => `((o.${col}::text LIKE '%da approvare%'))`;
    const queryBaseDomande = (col) => `
      SELECT o.id, o.text as testo, o.approfondimento
      FROM opinioni_domande o
      WHERE ${whereGradi(col)}
      ORDER BY o.text`;
    const queryDomandeWithVoti = (col) => `
      SELECT o.id, o.text as testo, o.approfondimento, COALESCE(v.voti_count, 0)::int as voti
      FROM opinioni_domande o
      LEFT JOIN (
        SELECT opinione_id, COUNT(*) as voti_count FROM voti_opinioni_proposte GROUP BY opinione_id
      ) v ON CAST(o.id AS TEXT) = CAST(v.opinione_id AS TEXT)
      WHERE ${whereGradi(col)}
      ORDER BY o.text`;

    let result;
    try {
      result = await pool.query(fromProposte);
    } catch (err) {
      if (err.code === '42P01' && err.message && err.message.includes('opinioni_proposte')) {
        // Fallback: leggi da opinioni_domande. Prova prima gradi_opinioni (Neon), poi gradi_opinione
        const cols = ['gradi_opinioni', 'gradi_opinione'];
        for (const col of cols) {
          try {
            result = await pool.query(queryDomandeWithVoti(col));
            break;
          } catch (e2) {
            if (e2.code === '42703') continue; // colonna inesistente, prova l'altra
            try {
              result = await pool.query(queryBaseDomande(col));
              result.rows = (result.rows || []).map(r => ({ ...r, voti: 0 }));
              break;
            } catch (e3) {
              if (e3.code === '42703') continue;
              throw e3;
            }
          }
        }
        if (!result) {
          for (const col of cols) {
            try {
              result = await pool.query(queryBaseDomande(col));
              result.rows = (result.rows || []).map(r => ({ ...r, voti: 0 }));
              break;
            } catch (_) { continue; }
          }
        }
        if (!result) throw err;
      } else {
        throw err;
      }
    }
    console.log(`✅ Trovate ${result.rows.length} opinioni da approvare`);
    
    // Debug: mostra i primi 3 ID per verificare il formato
    if (result.rows.length > 0) {
      console.log('🔍 DEBUG - Prime 3 ID opinioni:', result.rows.slice(0, 3).map(r => ({ id: r.id, idType: typeof r.id, idLength: r.id?.length })));
    }
    
    // Mappa i dati per compatibilità con il frontend
    const mappedData = result.rows.map(row => ({
      id: String(row.id), // Assicura che sia sempre una stringa
      testo: row.testo,
      utente_id: null,
      titolo: null,
      descrizione: null,
      categoria: null,
      fonte: 'proposta',
      data_creazione: new Date().toISOString(),
      data_aggiornamento: new Date().toISOString(),
      nome: null,
      cognome: null,
      email: null,
      voti: (typeof row.voti === 'number' ? row.voti : parseInt(row.voti, 10)) || 0
    }));
    
    res.json({
      success: true,
      data: mappedData
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare opinioni da approvare:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare opinioni da approvare',
      message: error.message
    });
  }
});

// POST /api/opinioni-proposte - Crea una nuova opinione proposta nella tabella opinioni
router.post('/', async (req, res) => {
  try {
    console.log('📝 POST /api/opinioni-proposte - Creazione nuova opinione proposta');
    console.log('🔍 Body ricevuto:', req.body);
    console.log('🔍 Headers:', req.headers);
    
    const { testo, titolo, descrizione, categoria } = req.body;
    
    // Estrae userId dal token se presente
    let userId = null;
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace('Bearer ', '');
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId;
      } catch (error) {
        console.log('⚠️ Token non valido, continuo senza userId');
      }
    }
    
    console.log('🔍 Testo estratto:', testo);
    console.log('🔍 User ID:', userId);
    
    if (!testo || !testo.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Testo dell\'opinione obbligatorio'
      });
    }
    
    const testoNormalizzato = testo.trim();
    
    // Usa un advisory lock basato sull'hash del testo per prevenire race conditions
    // PostgreSQL advisory locks sono ideali per questo caso
    // Usa un hash più lungo per evitare collisioni
    const crypto = require('crypto');
    const testoPerHash = testoNormalizzato.toLowerCase().trim();
    const lockId = crypto.createHash('sha256').update(testoPerHash).digest('hex');
    // Converti i primi 15 caratteri hex in un numero per pg_advisory_lock
    // PostgreSQL advisory locks usano bigint, quindi possiamo usare più caratteri
    const lockKey = parseInt(lockId.substring(0, 15), 16) % Number.MAX_SAFE_INTEGER;
    
    console.log('🔒 Lock generato:', {
      testo: testoPerHash,
      lockHash: lockId.substring(0, 15),
      lockKey: lockKey
    });
    
    const client = await pool.connect();
    let lockHeld = false;
    
    try {
      // Prova ad acquisire il lock con timeout di 2 secondi
      // Se il lock non viene acquisito, potrebbe essere un lock "orfano" da una richiesta precedente
      // In tal caso, forziamo il rilascio dopo un breve attesa
      let lockAcquired = await client.query('SELECT pg_try_advisory_lock($1) as acquired', [lockKey]);
      
      if (!lockAcquired.rows[0].acquired) {
        console.log('⚠️ Lock non acquisito immediatamente - potrebbe essere un lock orfano');
        // Attendi un po' e riprova (il lock potrebbe essere rilasciato a breve)
        await new Promise(resolve => setTimeout(resolve, 100));
        lockAcquired = await client.query('SELECT pg_try_advisory_lock($1) as acquired', [lockKey]);
        
        if (!lockAcquired.rows[0].acquired) {
          // Forza il rilascio del lock se è rimasto bloccato troppo a lungo
          // (solo se siamo sicuri che non ci sia una transazione attiva)
          try {
            await client.query('SELECT pg_advisory_unlock($1)', [lockKey]);
            console.log('🔓 Tentativo di forzare rilascio lock orfano');
            await new Promise(resolve => setTimeout(resolve, 50));
            lockAcquired = await client.query('SELECT pg_try_advisory_lock($1) as acquired', [lockKey]);
          } catch (unlockError) {
            // Ignora errori - il lock potrebbe non essere stato acquisito da questa connessione
          }
        }
        
        if (!lockAcquired.rows[0].acquired) {
          client.release();
          console.log('⚠️ Lock non acquisito dopo tentativi - un\'altra richiesta sta già processando questo testo');
          return res.status(409).json({
            success: false,
            error: 'Un\'opinione con questo testo è già in fase di creazione. Riprova tra qualche istante.'
          });
        }
      }
      
      lockHeld = true;
      console.log('🔒 Lock acquisito con successo');
      
      try {
        await client.query('BEGIN');
        
        // Genera ID univoco
        const id = require('crypto').randomUUID();
        console.log('🔍 ID generato per nuova opinione:', id);
        
        const gradiOpinione = ['da approvare'];
        const approfondimento = `## Proposta da approvare\n\n${testo.trim()}`;
        
        // Verifica duplicati: prima in opinioni_proposte, poi in opinioni_domande
        let checkDuplicateQuery = `
          SELECT id FROM opinioni_proposte WHERE LOWER(TRIM(text)) = LOWER(TRIM($1)) FOR UPDATE SKIP LOCKED LIMIT 1
        `;
        try {
          var duplicateCheck = await client.query(checkDuplicateQuery, [testoNormalizzato]);
        } catch (e) {
          if (e.code === '42P01' && e.message && e.message.includes('opinioni_proposte')) {
            checkDuplicateQuery = `
              SELECT id FROM opinioni_domande WHERE LOWER(TRIM(text)) = LOWER(TRIM($1)) AND 'da approvare' = ANY(gradi_opinione) FOR UPDATE SKIP LOCKED LIMIT 1
            `;
            duplicateCheck = await client.query(checkDuplicateQuery, [testoNormalizzato]);
          } else throw e;
        }
        console.log('🔍 Controllo duplicati per testo:', testoNormalizzato);
        console.log('🔍 Lock key utilizzato:', lockKey);
        console.log('🔍 Risultato controllo duplicati:', {
          righeTrovate: duplicateCheck.rows.length,
          duplicati: duplicateCheck.rows
        });
        
        if (duplicateCheck.rows.length > 0) {
          await client.query('ROLLBACK');
          console.log('⚠️ Opinione duplicata trovata:', duplicateCheck.rows[0].id);
          return res.status(409).json({
            success: false,
            error: 'Un\'opinione con questo testo è già stata proposta'
          });
        }
        
        // Inserisce in opinioni_proposte se esiste, altrimenti in opinioni_domande
        const insertQueryProposte = `
          INSERT INTO opinioni_proposte (id, text, approfondimento)
          VALUES ($1, $2, $3)
          RETURNING id, text
        `;
        const insertQueryDomande = `
          INSERT INTO opinioni_domande (id, text, gradi_opinione, approfondimento)
          VALUES ($1, $2, $3::text[], $4)
          RETURNING id, text
        `;
        console.log('🔍 Tentativo inserimento con parametri:', {
          id,
          testo: testoNormalizzato.substring(0, 50) + '...',
          approfondimento: approfondimento.substring(0, 50) + '...'
        });

        let insertResult;
        try {
          insertResult = await client.query(insertQueryProposte, [id, testoNormalizzato, approfondimento]);
        } catch (error) {
          if (error.code === '42P01' && error.message && error.message.includes('opinioni_proposte')) {
            insertResult = await client.query(insertQueryDomande, [id, testoNormalizzato, gradiOpinione, approfondimento]);
          } else if (error.code === '23505') {
            await client.query('ROLLBACK');
            return res.status(409).json({
              success: false,
              error: 'Un\'opinione con questo testo è già stata proposta'
            });
          } else {
            console.error('❌ Errore durante INSERT:', error);
            throw error;
          }
        }
        
        console.log('✅ Insert eseguito. Righe inserite:', insertResult.rowCount);
        console.log('✅ Dati inseriti:', insertResult.rows);
        
        if (insertResult.rows.length === 0) {
          await client.query('ROLLBACK');
          console.log('⚠️ Insert fallito: nessuna riga inserita');
          return res.status(500).json({
            success: false,
            error: 'Errore durante l\'inserimento dell\'opinione'
          });
        }
        
        await client.query('COMMIT');
        console.log('✅ Transazione committata con successo');
        
        // Rilascia il lock subito dopo il commit (prima di altre operazioni)
        await client.query('SELECT pg_advisory_unlock($1)', [lockKey]);
        lockHeld = false; // Marca il lock come rilasciato
        console.log('🔓 Lock rilasciato dopo commit');
        
        // Verifica finale che non ci siano duplicati creati (dovrebbe essere impossibile, ma meglio verificare)
        const checkDuplicateQueryFinal = `
          SELECT id FROM opinioni_domande 
          WHERE LOWER(TRIM(text)) = LOWER(TRIM($1)) 
          AND 'da approvare' = ANY(gradi_opinione)
        `;
        const finalCheck = await client.query(checkDuplicateQueryFinal, [testoNormalizzato]);
        if (finalCheck.rows.length > 1) {
          console.error('❌ ERRORE CRITICO: Trovati duplicati dopo l\'inserimento!', finalCheck.rows);
          // Non blocchiamo, ma loggiamo l'errore
        }
        
        // Se l'utente è autenticato, aggiungi automaticamente il suo voto (fuori dalla transazione principale)
        if (userId) {
          try {
            // Assicurati che la tabella esista
            await ensureVotiTableExists();
            
            const insertVoteQuery = `
              INSERT INTO voti_opinioni_proposte (utente_id, opinione_id)
              VALUES ($1, $2)
              ON CONFLICT (utente_id, opinione_id) DO NOTHING
              RETURNING *
            `;
            const voteResult = await pool.query(insertVoteQuery, [userId, id]);
            console.log(`✅ Voto automatico - Query eseguita per utente ${userId} su opinione ${id}`);
            console.log(`✅ Voto automatico - Righe inserite: ${voteResult.rowCount}`);
            console.log(`✅ Voto automatico - Dati inseriti:`, voteResult.rows);
            
            if (voteResult.rowCount === 0) {
              // Verifica se il voto esiste già
              const checkExisting = await pool.query(
                'SELECT * FROM voti_opinioni_proposte WHERE utente_id = $1 AND opinione_id = $2',
                [userId, id]
              );
              console.log(`⚠️ Voto automatico - Voto già esistente? Righe trovate: ${checkExisting.rows.length}`);
              if (checkExisting.rows.length > 0) {
                console.log(`✅ Voto automatico già presente per utente ${userId} su opinione ${id}`);
              } else {
                console.error(`❌ Voto automatico - Impossibile inserire voto per utente ${userId} su opinione ${id}`);
              }
            } else {
              console.log(`✅ Voto automatico aggiunto con successo per utente ${userId} su opinione ${id}`);
            }
          } catch (error) {
            console.error('❌ Errore nell\'aggiungere voto automatico:', error);
            console.error('❌ Stack trace:', error.stack);
            // Non bloccare l'operazione se il voto non può essere aggiunto
          }
        }
        
        console.log('✅ Opinione proposta creata con successo nella tabella opinioni:', id);
        console.log('📤 Invio risposta al client...');
        
        res.json({
          success: true,
          message: 'Opinione proposta creata con successo',
          data: { id, testo: testoNormalizzato }
        });
        
        console.log('✅ Risposta inviata con successo');
        
        // Rilascia il client dopo aver inviato la risposta
        // (verrà rilasciato anche nel finally, ma meglio essere espliciti)
        
      } catch (error) {
        console.error('❌ Errore durante la transazione:', error);
        console.error('❌ Stack trace:', error.stack);
        console.error('❌ Error code:', error.code);
        console.error('❌ Error detail:', error.detail);
        try {
          await client.query('ROLLBACK');
          console.log('✅ Rollback eseguito');
        } catch (rollbackError) {
          console.error('❌ Errore durante rollback:', rollbackError);
        }
        // Non rilasciare il lock qui - verrà rilasciato nel finally
        throw error;
      }
    } catch (error) {
      console.error('❌ Errore nel blocco try esterno (lock acquisition):', error);
      throw error;
    } finally {
        // Rilascia SEMPRE il lock se è stato acquisito, prima di rilasciare il client
        if (lockHeld) {
          try {
            await client.query('SELECT pg_advisory_unlock($1)', [lockKey]);
            console.log('🔓 Lock rilasciato nel finally');
            lockHeld = false;
          } catch (unlockError) {
            console.error('❌ Errore durante unlock nel finally:', unlockError);
            // Prova a rilasciare comunque il client
          }
        }
        client.release();
        console.log('✅ Client rilasciato nel finally');
      }
    
    
  } catch (error) {
    console.error('❌ Errore nella creazione opinione proposta:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella creazione opinione proposta',
      message: error.message
    });
  }
});

// POST /api/opinioni-proposte/:id/vota - Vota un'opinione proposta
router.post('/:id/vota', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId; // User ID dall'autenticazione JWT
    
    console.log('👍 POST /api/opinioni-proposte/:id/vota - Voto opinione proposta');
    console.log('🔍 ID opinione:', id);
    console.log('🔍 User ID:', userId);
    
    await ensureVotiTableExists();
    let checkResult = await pool.query('SELECT id FROM opinioni_proposte WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      checkResult = await pool.query(
        `SELECT id FROM opinioni_domande WHERE id = $1 AND (gradi_opinione::text LIKE '%da approvare%')`,
        [id]
      );
    }
    if (checkResult.rows.length === 0) {
      console.log('❌ Opinione non trovata o non in stato da approvare');
      return res.status(404).json({
        success: false,
        error: 'Opinione non trovata o non in stato da approvare'
      });
    }
    console.log('✅ Opinione trovata, procedo con il voto...');
    
    // Inserisci il voto nella tabella voti_opinioni_proposte
    const insertVotoQuery = `
      INSERT INTO voti_opinioni_proposte (utente_id, opinione_id)
      VALUES ($1, $2)
      ON CONFLICT (utente_id, opinione_id) DO NOTHING
    `;
    
    console.log('🔍 Inserimento voto con parametri:', { userId, id });
    const insertResult = await pool.query(insertVotoQuery, [userId, id]);
    console.log('📊 Risultato inserimento:', insertResult);
    
    console.log('✅ Voto registrato con successo per opinione:', id);
    
    res.json({
      success: true,
      message: 'Voto registrato con successo'
    });
    
  } catch (error) {
    console.error('❌ Errore nel voto:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Errore nel voto',
      message: error.message,
      details: error.stack
    });
  }
});

// DELETE /api/opinioni-proposte/:id/vota - Rimuovi voto da un'opinione proposta
router.delete('/:id/vota', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId; // User ID dall'autenticazione JWT
    
    console.log('👎 DELETE /api/opinioni-proposte/:id/vota - Rimozione voto');
    console.log('🔍 ID opinione:', id);
    console.log('🔍 User ID:', userId);
    
    await ensureVotiTableExists();
    let checkResult = await pool.query('SELECT id FROM opinioni_proposte WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      checkResult = await pool.query(
        `SELECT id FROM opinioni_domande WHERE id = $1 AND (gradi_opinione::text LIKE '%da approvare%')`,
        [id]
      );
    }
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Opinione non trovata o non in stato da approvare'
      });
    }
    console.log('✅ Opinione trovata, procedo con la rimozione del voto...');
    
    // Assicurati che la tabella esista
    await ensureVotiTableExists();
    
    // Normalizza l'ID per assicurarsi che sia una stringa
    const opinioneIdNormalizzato = String(id).trim();
    
    // Debug: verifica se il voto esiste prima di eliminarlo
    const checkVotoQuery = `
      SELECT * FROM voti_opinioni_proposte 
      WHERE utente_id = $1 AND opinione_id = $2
    `;
    const checkVoto = await pool.query(checkVotoQuery, [userId, opinioneIdNormalizzato]);
    console.log('🔍 Voti trovati per questa opinione:', checkVoto.rows.length);
    console.log('🔍 Dettagli voto:', checkVoto.rows);
    console.log('🔍 Parametri ricerca:', { userId, opinioneId: opinioneIdNormalizzato, userIdType: typeof userId, idType: typeof opinioneIdNormalizzato });
    
    // Debug aggiuntivo: verifica tutti i voti dell'utente per vedere se l'ID esiste con un formato diverso
    const allUserVotes = await pool.query(
      'SELECT opinione_id, utente_id FROM voti_opinioni_proposte WHERE utente_id = $1',
      [userId]
    );
    console.log('🔍 Tutti i voti dell\'utente (per confronto):', allUserVotes.rows.map(r => ({ 
      opinione_id: r.opinione_id, 
      opinione_id_type: typeof r.opinione_id,
      opinione_id_length: r.opinione_id?.length,
      matches: String(r.opinione_id) === String(opinioneIdNormalizzato)
    })));
    
    // Rimuovi il voto dalla tabella voti_opinioni_proposte
    // Prova prima con l'ID normalizzato, poi con l'ID originale se non funziona
    const deleteVotoQuery = `
      DELETE FROM voti_opinioni_proposte 
      WHERE utente_id = $1 AND opinione_id = $2
    `;
    
    console.log('🔍 Rimozione voto con query:', deleteVotoQuery);
    console.log('🔍 Parametri:', [userId, opinioneIdNormalizzato]);
    let result = await pool.query(deleteVotoQuery, [userId, opinioneIdNormalizzato]);
    console.log('📊 Righe rimosse (con ID normalizzato):', result.rowCount);
    
    // Se non trova nulla, prova con l'ID originale (senza normalizzazione)
    if (result.rowCount === 0 && id !== opinioneIdNormalizzato) {
      console.log('🔍 Tentativo con ID originale (non normalizzato):', id);
      result = await pool.query(deleteVotoQuery, [userId, id]);
      console.log('📊 Righe rimosse (con ID originale):', result.rowCount);
    }
    
    if (result.rowCount === 0) {
      console.log('❌ Voto non trovato con nessun formato di ID');
      console.log('🔍 ID tentati:', { normalizzato: opinioneIdNormalizzato, originale: id });
      return res.status(404).json({
        success: false,
        error: 'Voto non trovato. Potrebbe essere che il voto non sia stato salvato correttamente quando hai proposto l\'opinione. Riprova dopo aver ricaricato la pagina.'
      });
    }
    
    console.log('✅ Voto rimosso con successo per opinione:', id);
    
    res.json({
      success: true,
      message: 'Voto rimosso con successo'
    });
    
  } catch (error) {
    console.error('❌ Errore nella rimozione voto:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Errore nella rimozione voto',
      message: error.message,
      details: error.stack
    });
  }
});

// DELETE /api/opinioni-proposte/:id - Cancella un'opinione proposta (solo admin)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    
    console.log('🗑️ DELETE /api/opinioni-proposte/:id - Cancellazione opinione proposta');
    console.log('🔍 ID opinione:', id);
    console.log('🔍 User ID:', userId);
    
    // Verifica che l'utente sia admin
    const userQuery = await pool.query(
      'SELECT ruolo FROM users WHERE id = $1',
      [userId]
    );
    
    if (userQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const userRole = userQuery.rows[0].ruolo;
    if (userRole !== 'AD') {
      return res.status(403).json({
        success: false,
        error: 'Solo gli amministratori possono cancellare opinioni'
      });
    }
    
    // Verifica esistenza e cancella da opinioni_proposte o opinioni_domande
    let checkResult = await pool.query('SELECT id FROM opinioni_proposte WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      checkResult = await pool.query(
        `SELECT id FROM opinioni_domande WHERE id = $1 AND (gradi_opinione::text LIKE '%da approvare%')`,
        [id]
      );
    }
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Opinione non trovata o non in stato da approvare'
      });
    }
    await pool.query('DELETE FROM voti_opinioni_proposte WHERE opinione_id = $1', [id]);
    let deleteResult = await pool.query('DELETE FROM opinioni_proposte WHERE id = $1', [id]);
    if (deleteResult.rowCount === 0) {
      deleteResult = await pool.query('DELETE FROM opinioni_domande WHERE id = $1', [id]);
    }
    
    console.log('✅ Opinione cancellata con successo:', id);
    
    res.json({
      success: true,
      message: 'Opinione cancellata con successo'
    });
    
  } catch (error) {
    console.error('❌ Errore nella cancellazione opinione:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Errore nella cancellazione opinione',
      message: error.message,
      details: error.stack
    });
  }
});

module.exports = router;