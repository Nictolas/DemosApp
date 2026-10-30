const express = require('express');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { requirePoliticalConsent } = require('../middleware/politicalConsent');
const { requireVerifiedCivicIdentity } = require('../middleware/civicIdentity');
const { getPool } = require('../config/database');

const router = express.Router();

// Usa il pool centralizzato ottimizzato
const pool = getPool();

// Lo schema dei voti sulle proposte è gestito esclusivamente tramite migrazione DB.
// La route può soltanto verificarne la presenza e fallisce chiusa se manca.
async function assertVotiTableExists() {
  const result = await pool.query(
    `SELECT to_regclass('public.voti_opinioni_proposte') AS relation_name`
  );
  if (!result.rows[0]?.relation_name) {
    const error = new Error('Migrazione voti_opinioni_proposte non applicata');
    error.code = 'VOTI_OPINIONI_PROPOSTE_SCHEMA_MISSING';
    throw error;
  }
}

// GET /api/opinioni-proposte/test-voto - Diagnostica Admin read-only dello schema voti.
router.get('/test-voto', verifyToken, requireAdmin, async (_req, res) => {
  try {
    await assertVotiTableExists();
    const result = await pool.query(
      `SELECT COUNT(*)::int AS voti_count FROM voti_opinioni_proposte`
    );
    return res.json({
      success: true,
      schema_ready: true,
      voti_count: result.rows[0]?.voti_count || 0
    });
  } catch (error) {
    const status = error.code === 'VOTI_OPINIONI_PROPOSTE_SCHEMA_MISSING' ? 503 : 500;
    return res.status(status).json({
      success: false,
      schema_ready: false,
      error: status === 503 ? 'MIGRAZIONE_RICHIESTA' : 'Errore diagnostica schema voti'
    });
  }
});

// GET /api/opinioni-proposte/debug - Debug endpoint per verificare database
router.get('/debug', verifyToken, requireAdmin, async (req, res) => {
  try {
    
    // Test connessione database
    const testQuery = await pool.query('SELECT NOW() as current_time');
    
    // Test tabella opinioni
    const opinioniCount = {rows:[{count:String(require('../services/opinionCatalog').getAllOpinions().length)}]};
    
    // Test opinioni da approvare
    const daApprovareCount = {rows:[{count:'0'}]}; // Official catalog has no draft questions.
    
    // Test tabella voti_opinioni_proposte
    let votiTableExists = false;
    let votiCount = 0;
    try {
      const votiCountQuery = await pool.query('SELECT COUNT(*) as count FROM voti_opinioni_proposte');
      votiTableExists = true;
      votiCount = votiCountQuery.rows[0].count;
    } catch (error) {
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
      } catch (error) {
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
    console.error('[opinion-proposals] failure');
    res.status(500).json({
      success: false,
      error: 'Errore interno',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/opinioni-proposte/voti-utente - Ottieni voti dell'utente autenticato
router.get('/voti-utente', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    
    const query = `
      SELECT opinione_id 
      FROM voti_opinioni_proposte 
      WHERE utente_id = $1
    `;
    
    const result = await pool.query(query, [userId]);
    const votiUtente = result.rows.map(row => String(row.opinione_id)); // Assicura che siano stringhe
    
    // Debug: mostra i primi 3 ID voti per verificare il formato
    if (votiUtente.length > 0) {
    }
    
    
    res.json({
      success: true,
      data: votiUtente
    });
    
  } catch (error) {
    console.error('[opinion-proposals] failure');
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare voti utente',
      message: 'Operazione non riuscita'
    });
  }
});

// GET /api/opinioni-proposte - Ottieni opinioni da approvare dalla tabella opinioni
router.get('/', async (req, res) => {
  try {

    // Proposte dinamiche: leggere solo opinioni_proposte, mai il catalogo ufficiale.
    const fromProposte = `
      SELECT o.id, o.text as testo, o.approfondimento, COALESCE(v.voti_count, 0)::int as voti
      FROM opinioni_proposte o
      LEFT JOIN (
        SELECT opinione_id, COUNT(*) as voti_count FROM voti_opinioni_proposte GROUP BY opinione_id
      ) v ON CAST(o.id AS TEXT) = CAST(v.opinione_id AS TEXT)
      ORDER BY o.text`;
    // Dynamic proposals are separate from the immutable official catalog.
    // Fail closed if that table is absent; never read drafts from the
    // published catalog's legacy database table.
    const result = await pool.query(fromProposte);
    
    // Chi ha proposto ogni opinione (users.opinione_proposta_id)
    let proposersByOpinionId = {};
    if (result.rows.length > 0) {
      try {
        const ids = result.rows.map(r => String(r.id));
        const propQuery = await pool.query(
          `SELECT opinione_proposta_id, nome, cognome, email FROM users WHERE opinione_proposta_id = ANY($1::text[])`,
          [ids]
        );
        propQuery.rows.forEach((r) => {
          const label = [r.nome, r.cognome].filter(Boolean).join(' ') || r.email || null;
          if (r.opinione_proposta_id) proposersByOpinionId[r.opinione_proposta_id] = label;
        });
      } catch (e) {
        if (e.code !== '42703') console.error('[opinion-proposals] failure');
      }
    }
    
    // Mappa i dati per compatibilità con il frontend
    const mappedData = result.rows.map(row => {
      const idStr = String(row.id);
      return {
        id: idStr,
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
        voti: (typeof row.voti === 'number' ? row.voti : parseInt(row.voti, 10)) || 0,
        proponente: proposersByOpinionId[idStr] || null
      };
    });
    
    // Se l'utente è autenticato, indica se ha già proposto un'opinione (limite 1 per utente)
    let haGiaProposto = false;
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace('Bearer ', '');
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const uid = decoded.userId;
        const r = await pool.query(
          'SELECT opinione_proposta_id FROM users WHERE id = $1',
          [uid]
        );
        haGiaProposto = !!(r.rows[0] && r.rows[0].opinione_proposta_id);
      } catch (e) {
        if (e.code === '42703') { /* colonna opinione_proposta_id non esiste */ }
        // token assente o non valido: ignora
      }
    }

    res.json({
      success: true,
      data: mappedData,
      ha_gia_proposto: haGiaProposto
    });
    
  } catch (error) {
    console.error('[opinion-proposals] failure');
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare opinioni da approvare',
      message: 'Operazione non riuscita'
    });
  }
});

// POST /api/opinioni-proposte - Crea una nuova opinione proposta (max 1 per utente, richiede auth)
router.post('/', verifyToken, requireVerifiedCivicIdentity, requirePoliticalConsent, async (req, res) => {
  try {
    // Pending proposals require their dedicated dynamic table. No fallbacks.
    const proposalTable = await pool.query("SELECT to_regclass('public.opinioni_proposte') IS NOT NULL AS ok");
    if (proposalTable.rows[0]?.ok !== true) {
      return res.status(503).json({success:false,error:'PROPOSALS_TABLE_REQUIRED'});
    }
    const userId = req.userId;
    
    const { testo, titolo, descrizione, categoria } = req.body;
    
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
    
    
    const client = await pool.connect();
    let lockHeld = false;
    
    try {
      // Prova ad acquisire il lock con timeout di 2 secondi
      // Se il lock non viene acquisito, potrebbe essere un lock "orfano" da una richiesta precedente
      // In tal caso, forziamo il rilascio dopo un breve attesa
      let lockAcquired = await client.query('SELECT pg_try_advisory_lock($1) as acquired', [lockKey]);
      
      if (!lockAcquired.rows[0].acquired) {
        // Attendi un po' e riprova (il lock potrebbe essere rilasciato a breve)
        await new Promise(resolve => setTimeout(resolve, 100));
        lockAcquired = await client.query('SELECT pg_try_advisory_lock($1) as acquired', [lockKey]);
        
        if (!lockAcquired.rows[0].acquired) {
          // Forza il rilascio del lock se è rimasto bloccato troppo a lungo
          // (solo se siamo sicuri che non ci sia una transazione attiva)
          try {
            await client.query('SELECT pg_advisory_unlock($1)', [lockKey]);
            await new Promise(resolve => setTimeout(resolve, 50));
            lockAcquired = await client.query('SELECT pg_try_advisory_lock($1) as acquired', [lockKey]);
          } catch (unlockError) {
            // Ignora errori - il lock potrebbe non essere stato acquisito da questa connessione
          }
        }
        
        if (!lockAcquired.rows[0].acquired) {
          client.release();
          return res.status(409).json({
            success: false,
            error: 'Un\'opinione con questo testo è già in fase di creazione. Riprova tra qualche istante.'
          });
        }
      }
      
      lockHeld = true;
      
      try {
        await client.query('BEGIN');

        // Regola canonica: massimo una proposta PENDENTE per utente.
        // Il lock sulla riga utente rende il controllo atomico anche con richieste concorrenti
        // che propongono testi diversi (il lock sul testo, da solo, non basta).
        const proposerState = await client.query(
          'SELECT opinione_proposta_id FROM users WHERE id = $1 FOR UPDATE',
          [userId]
        );
        if (proposerState.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(401).json({ success: false, error: 'Utente non trovato' });
        }
        if (proposerState.rows[0].opinione_proposta_id) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            success: false,
            error: 'PROPOSTA_PENDENTE_ESISTENTE',
            message: 'Hai già una proposta di Opinione pendente. Potrai proporne un’altra quando sarà chiusa.'
          });
        }
        
        // Genera ID univoco
        const id = require('crypto').randomUUID();
        
        const approfondimento = `## Proposta da approvare\n\n${testo.trim()}`;
        
        // All proposals remain dynamic in their dedicated table.
        const checkDuplicateQuery = `SELECT id FROM opinioni_proposte
          WHERE LOWER(TRIM(text)) = LOWER(TRIM($1)) FOR UPDATE SKIP LOCKED LIMIT 1`;
        const duplicateCheck = await client.query(checkDuplicateQuery, [testoNormalizzato]);
        
        if (duplicateCheck.rows.length > 0) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            success: false,
            error: 'Un\'opinione con questo testo è già stata proposta'
          });
        }
        
        const insertQueryProposte = `
          INSERT INTO opinioni_proposte (id, text, approfondimento)
          VALUES ($1, $2, $3)
          RETURNING id, text
        `;

        let insertResult;
        try {
          insertResult = await client.query(insertQueryProposte, [id, testoNormalizzato, approfondimento]);
        } catch (error) {
          if (error.code === '23505') {
            await client.query('ROLLBACK');
            return res.status(409).json({
              success: false,
              error: 'Un\'opinione con questo testo è già stata proposta'
            });
          }
          console.error('[opinion-proposals] failure');
          throw error;
        }
        
        
        if (insertResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(500).json({
            success: false,
            error: 'Errore durante l\'inserimento dell\'opinione'
          });
        }
        
        // Il marker della proposta pendente fa parte della stessa transazione dell'inserimento:
        // non può quindi esistere una proposta creata senza bloccare atomicamente la seconda.
        await client.query(
          'UPDATE users SET opinione_proposta_id = $1 WHERE id = $2',
          [id, userId]
        );

        await client.query('COMMIT');
        
        // Rilascia il lock subito dopo il commit (prima di altre operazioni)
        await client.query('SELECT pg_advisory_unlock($1)', [lockKey]);
        lockHeld = false; // Marca il lock come rilasciato
        
        // Verifica finale che non ci siano duplicati creati (dovrebbe essere impossibile, ma meglio verificare)
        const checkDuplicateQueryFinal = `SELECT id FROM opinioni_proposte WHERE LOWER(TRIM(text)) = LOWER(TRIM($1))`;
        const finalCheck = await client.query(checkDuplicateQueryFinal, [testoNormalizzato]);
        if (finalCheck.rows.length > 1) {
          console.error('[opinion-proposals] failure');
          // Non blocchiamo, ma loggiamo l'errore
        }
        
        // Se l'utente è autenticato, aggiungi automaticamente il suo voto (fuori dalla transazione principale)
        if (userId) {
          try {
            // Assicurati che la tabella esista
            await assertVotiTableExists();
            
            const insertVoteQuery = `
              INSERT INTO voti_opinioni_proposte (utente_id, opinione_id)
              VALUES ($1, $2)
              ON CONFLICT (utente_id, opinione_id) DO NOTHING
              RETURNING *
            `;
            const voteResult = await pool.query(insertVoteQuery, [userId, id]);
            
            if (voteResult.rowCount === 0) {
              // Verifica se il voto esiste già
              const checkExisting = await pool.query(
                'SELECT * FROM voti_opinioni_proposte WHERE utente_id = $1 AND opinione_id = $2',
                [userId, id]
              );
              if (checkExisting.rows.length > 0) {
              } else {
                console.error('[opinion-proposals] failure');
              }
            } else {
            }
          } catch (error) {
            console.error('[opinion-proposals] failure');
            console.error('[opinion-proposals] failure');
            // Non bloccare l'operazione se il voto non può essere aggiunto
          }
        }
        
        
        res.json({
          success: true,
          message: 'Opinione proposta creata con successo',
          data: { id, testo: testoNormalizzato }
        });
        
        
        // Rilascia il client dopo aver inviato la risposta
        // (verrà rilasciato anche nel finally, ma meglio essere espliciti)
        
      } catch (error) {
        console.error('[opinion-proposals] failure');
        console.error('[opinion-proposals] failure');
        console.error('[opinion-proposals] failure');
        console.error('[opinion-proposals] failure');
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('[opinion-proposals] failure');
        }
        // Non rilasciare il lock qui - verrà rilasciato nel finally
        throw error;
      }
    } catch (error) {
      console.error('[opinion-proposals] failure');
      throw error;
    } finally {
        // Rilascia SEMPRE il lock se è stato acquisito, prima di rilasciare il client
        if (lockHeld) {
          try {
            await client.query('SELECT pg_advisory_unlock($1)', [lockKey]);
            lockHeld = false;
          } catch (unlockError) {
            console.error('[opinion-proposals] failure');
            // Prova a rilasciare comunque il client
          }
        }
        client.release();
      }
    
    
  } catch (error) {
    console.error('[opinion-proposals] failure');
    res.status(500).json({
      success: false,
      error: 'Errore nella creazione opinione proposta',
      message: 'Operazione non riuscita'
    });
  }
});

// POST /api/opinioni-proposte/:id/vota - Vota un'opinione proposta
router.post('/:id/vota', verifyToken, requireVerifiedCivicIdentity, requirePoliticalConsent, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId; // User ID dall'autenticazione JWT
    
    
    await assertVotiTableExists();
    let checkResult = await pool.query('SELECT id FROM opinioni_proposte WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Opinione non trovata o non in stato da approvare'
      });
    }
    
    // Inserisci il voto nella tabella voti_opinioni_proposte
    const insertVotoQuery = `
      INSERT INTO voti_opinioni_proposte (utente_id, opinione_id)
      VALUES ($1, $2)
      ON CONFLICT (utente_id, opinione_id) DO NOTHING
    `;
    
    const insertResult = await pool.query(insertVotoQuery, [userId, id]);
    
    
    res.json({
      success: true,
      message: 'Voto registrato con successo'
    });
    
  } catch (error) {
    console.error('[opinion-proposals] failure');
    console.error('[opinion-proposals] failure');
    res.status(500).json({
      success: false,
      error: 'Errore nel voto',
      message: 'Operazione non riuscita'
    });
  }
});

// DELETE /api/opinioni-proposte/:id/vota - Rimuovi voto da un'opinione proposta
router.delete('/:id/vota', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId; // User ID dall'autenticazione JWT
    
    
    await assertVotiTableExists();
    let checkResult = await pool.query('SELECT id FROM opinioni_proposte WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Opinione non trovata o non in stato da approvare'
      });
    }
    
    // Normalizza l'ID per assicurarsi che sia una stringa
    const opinioneIdNormalizzato = String(id).trim();
    
    // Elimina il voto direttamente: nessuna lettura diagnostica di voti personali.
    // Rimuovi il voto dalla tabella voti_opinioni_proposte
    // Prova prima con l'ID normalizzato, poi con l'ID originale se non funziona
    const deleteVotoQuery = `
      DELETE FROM voti_opinioni_proposte 
      WHERE utente_id = $1 AND opinione_id = $2
    `;
    
    let result = await pool.query(deleteVotoQuery, [userId, opinioneIdNormalizzato]);
    
    // Se non trova nulla, prova con l'ID originale (senza normalizzazione)
    if (result.rowCount === 0 && id !== opinioneIdNormalizzato) {
      result = await pool.query(deleteVotoQuery, [userId, id]);
    }
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Voto non trovato. Potrebbe essere che il voto non sia stato salvato correttamente quando hai proposto l\'opinione. Riprova dopo aver ricaricato la pagina.'
      });
    }
    
    
    res.json({
      success: true,
      message: 'Voto rimosso con successo'
    });
    
  } catch (error) {
    console.error('[opinion-proposals] failure');
    console.error('[opinion-proposals] failure');
    res.status(500).json({
      success: false,
      error: 'Errore nella rimozione voto',
      message: 'Operazione non riuscita'
    });
  }
});

// DELETE /api/opinioni-proposte/:id - Cancella un'opinione proposta (solo admin)
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    // Only dynamic proposals may be rejected/deleted, not official questions.
    const proposalTable = await pool.query("SELECT to_regclass('public.opinioni_proposte') IS NOT NULL AS ok");
    if (proposalTable.rows[0]?.ok !== true) {
      return res.status(503).json({success:false,error:'PROPOSALS_TABLE_REQUIRED'});
    }
    const { id } = req.params;
    
    
    const checkResult = await pool.query('SELECT id FROM opinioni_proposte WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Opinione non trovata o non in stato da approvare'
      });
    }
    // Rimuovi tutti i voti (incluso quello del proponente)
    await pool.query('DELETE FROM voti_opinioni_proposte WHERE opinione_id = $1', [id]);
    // Libera la "proposta" dell'utente che l'aveva proposta (così può proporne un'altra)
    try {
      await pool.query(
        'UPDATE users SET opinione_proposta_id = NULL WHERE opinione_proposta_id = $1',
        [id]
      );
    } catch (e) {
      if (e.code !== '42703') console.error('[opinion-proposals] failure');
    }
    const deleteResult = await pool.query('DELETE FROM opinioni_proposte WHERE id = $1', [id]);
    
    
    res.json({
      success: true,
      message: 'Opinione cancellata con successo'
    });
    
  } catch (error) {
    console.error('[opinion-proposals] failure');
    console.error('[opinion-proposals] failure');
    res.status(500).json({
      success: false,
      error: 'Errore nella cancellazione opinione',
      message: 'Operazione non riuscita'
    });
  }
});

module.exports = router;