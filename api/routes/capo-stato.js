const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/auth');
const { cleanName,changeChoice,proposalRanking,sendCooldownError:sendChoiceCooldown } = require('../services/capoStatoCurrentChoice');
const { requirePoliticalConsent } = require('../middleware/politicalConsent');
const { requireVerifiedCivicIdentity } = require('../middleware/civicIdentity');
const { getPool } = require('../config/database');
const { getPreferenceCooldown, assertPreferenceChangeAllowed, recordPreferenceChange, sendCooldownError } = require('../services/preferenceCooldownService');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Usa il pool centralizzato ottimizzato
const pool = getPool();

// I candidati non piu' eleggibili non devono apparire nella classifica ne' ricevere nuovi voti.
// Il confronto normalizzato gestisce anche spazi Unicode come U+202F.
const normalizeCandidateName = (name) =>
  String(name || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const INELIGIBLE_CANDIDATE_NAMES = new Set(['emmabonino']);
const isIneligibleCandidate = (name) => INELIGIBLE_CANDIDATE_NAMES.has(normalizeCandidateName(name));

// ===== ENDPOINTS PER CAPO DI STATO =====

// GET /api/capo-stato - Lista candidati capo di stato con classifica voti
router.get('/', async (req, res) => {
  try {
    // Query per ottenere la classifica dei candidati basata sui voti ricevuti
    const classificaQuery = [
      "SELECT c.nome,COUNT(DISTINCT c.user_id)::int AS voti",
      "FROM capo_stato_scelte c JOIN users u ON u.id=c.user_id AND lower(u.status)='a'",
      "WHERE c.tipo='voto'",
      "GROUP BY c.nome ORDER BY voti DESC,c.nome ASC"
    ].join(" ");

    const classificaResult = await pool.query(classificaQuery);

    console.log('🔍 DEBUG /api/capo-stato - Candidati trovati:', classificaResult.rows.length);

    // Processa la classifica per il frontend
    const classifica = classificaResult.rows
      .filter(candidato => !isIneligibleCandidate(candidato.nome))
      .map(candidato => ({
        nome: candidato.nome,
        voti: parseInt(candidato.voti, 10)
      }));

    // Ottieni i voti dell'utente corrente se autenticato
    let mieiVoti = [];
    let blocco = {
      isBlocked: false,
      unlockDate: null
    };

    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;

        // Controlla il ruolo dell'utente
        const userQuery = `SELECT ruolo FROM users WHERE id = $1`;
        const userResult = await pool.query(userQuery, [userId]);
        const userRole = userResult.rows[0]?.ruolo;

        // Cooldown canonico: la singola preferenza Capo di Stato può cambiare al massimo ogni 24 ore.
        if (userRole !== 'Admin' && userRole !== 'AD') {
          const tableInfoResult = await pool.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'voti_capo_stato'
          `);
          const voteColumns = tableInfoResult.rows.map((row) => row.column_name);
          const cooldownUserColumn = voteColumns.includes('userid') ? 'userid' : 'userId';
          const lastResult = await pool.query(
            `SELECT MAX(changed_at) AS last_changed_at FROM capo_stato_scelte WHERE user_id = $1`,
            [userId]
          );
          const cooldown = await getPreferenceCooldown(pool, {
            userId,
            scope: 'capo-stato:preferenza',
            fallbackChangedAt: lastResult.rows[0]?.last_changed_at || null
          });
          blocco = { isBlocked: cooldown.isBlocked, unlockDate: cooldown.unlockDate };
        }

        // Verifica la struttura della tabella per capire quale colonna usare
        const tableInfoQuery = `
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_name = 'voti_capo_stato'
          ORDER BY ordinal_position
        `;
        const tableInfo = await pool.query(tableInfoQuery);
        const columns = tableInfo.rows.map(r => r.column_name);
        const hasUserId = columns.includes('userId');
        const hasUserid = columns.includes('userid');
        const userIdColumn = hasUserid ? 'userid' : (hasUserId ? 'userId' : 'userid'); // Default a userid

        const userVotiQuery =
          "SELECT nome FROM capo_stato_scelte WHERE user_id=$1 AND tipo='voto'";
        const userVotiResult = await pool.query(userVotiQuery, [userId]);
        mieiVoti = userVotiResult.rows.map(v => v.nome);
      } catch (authError) {
        console.log('⚠️ Token non valido per capo di stato:', authError.message);
      }
    }

    const responseData = {
      success: true,
      classifica,
      mieiVoti,
      blocco
    };

    res.json(responseData);
  } catch (error) {
    console.error('❌ Errore nel recupero candidati capo di stato:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// Endpoint rimosso - duplicato, usa quello alla riga 265

// POST /api/capo-stato/test-vota - endpoint di test disattivato per sicurezza
router.post('/test-vota', (_req, res) => {
  return res.status(410).json({
    success: false,
    error: 'Endpoint di test disattivato. Usa /api/capo-stato/vota.'
  });
});

// POST /api/capo-stato/vota - Endpoint principale per voti (con autenticazione)
router.post('/vota', verifyToken, requireVerifiedCivicIdentity, requirePoliticalConsent, async (req,res) => {
  const voti=req.body?.voti;
  if (!Array.isArray(voti) || voti.length>1) return res.status(400).json({
    success:false,error:"Una sola scelta per Capo di Stato"
  });
  const name=voti.length?cleanName(voti[0]):null;
  if (voti.length && !name) return res.status(400).json({success:false,error:"Nome non valido"});
  if (name && isIneligibleCandidate(name)) return res.status(422).json({success:false,error:"Candidato non eleggibile"});
  try {
    const result=await changeChoice(pool,{
      userId:req.userId||req.user?.id,name,kind:name?"voto":null,
      isAdmin:req.user?.isAdmin===true
    });
    return res.json({success:true,voti:result.kind==="voto"?[result.name]:[]});
  }catch(e) {
    if (sendChoiceCooldown(res,e)) return;
    if ([401,403,409,422].includes(e.status)) return res.status(e.status).json({success:false,error:e.message});
    return res.status(503).json({success:false,error:"Preferenza non disponibile"});
  }
});

router.get('/mia-scelta',verifyToken,async(req,res)=>{
  res.set('Cache-Control','private, no-store');
  try {
    const r=await pool.query(
      "SELECT nome,tipo FROM capo_stato_scelte WHERE user_id=$1",
      [req.userId||req.user?.id]
    );
    const scelta=r.rows[0]||null;
    if (!scelta || scelta.tipo!=="proposta") return res.json({success:true,latest:null});
    const pending=await pool.query(
      "SELECT status FROM subject_proposals WHERE category='capo_stato' "+
      "AND lower(btrim(regexp_replace(normalize(title,NFC),'[[:space:]]+',' ','g'))) = "+
      "lower(btrim(regexp_replace(normalize($1::text,NFC),'[[:space:]]+',' ','g'))) "+
      "ORDER BY created_at DESC LIMIT 1",
      [scelta.nome]
    );
    return res.json({success:true,latest:{status:pending.rows[0]?.status||"none"}});
  } catch (_) {
    return res.status(503).json({success:false,error:"Preferenza non disponibile"});
  }
});

router.post('/proponi', verifyToken, requireVerifiedCivicIdentity, requirePoliticalConsent, async (req,res)=>{
  const name=cleanName(req.body?.nome);
  if (!name) return res.status(400).json({success:false,error:"Nome non valido"});
  if (isIneligibleCandidate(name)) return res.status(422).json({success:false,error:"Candidato non eleggibile"});
  try {
    const result=await changeChoice(pool,{
      userId:req.userId||req.user?.id,name,kind:"proposta",
      isAdmin:req.user?.isAdmin===true
    });
    return res.status(result.changed?201:200).json({
      success:true,status:"pending",nome:result.name
    });
  }catch(e) {
    if (sendChoiceCooldown(res,e)) return;
    if ([401,403,409,422].includes(e.status)) return res.status(e.status).json({success:false,error:e.message});
    return res.status(503).json({success:false,error:"Proposta non disponibile"});
  }
});

router.get('/admin/proposte',verifyToken,requireAdmin,async(_req,res)=>{
  res.set('Cache-Control','private, no-store');
  try {
    const classifica=await proposalRanking(pool);
    return res.json({success:true,classifica});
  }catch(_){
    return res.status(503).json({success:false,error:"Classifica non disponibile"});
  }
});

// POST /api/capo-stato - endpoint legacy disattivato: non accetta più userid dal client
router.post('/', (_req, res) => {
  return res.status(410).json({
    success: false,
    error: 'Endpoint legacy disattivato. Usa /api/capo-stato/vota.'
  });
});

// ===== ENDPOINTS PER CONSENSO CAPO DI STATO =====

// GET /api/capo-stato/consenso - Ottieni i dati di consenso
router.get('/consenso', async (req, res) => {
  try {
    console.log('🔍 DEBUG /api/capo-stato/consenso GET - Richiesta ricevuta');
    console.log('🔍 DEBUG - Headers:', req.headers);

    // Ottieni i voti di consenso dell'utente corrente se autenticato
    let mioConsenso = null;
    let blocco = {
      isBlocked: false,
      unlockDate: null
    };

    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId || decoded.email;

        console.log('🔍 DEBUG - Token decodificato:', decoded);
        console.log('🔍 DEBUG - User ID:', userId);

        // Controlla se l'utente ha già votato per il consenso
        const consensoQuery = `
          SELECT risposta, timestamp
          FROM consenso_capo_stato
          WHERE userid = $1
          ORDER BY timestamp DESC
          LIMIT 1
        `;

        const consensoResult = await pool.query(consensoQuery, [userId]);

        if (consensoResult.rows.length > 0) {
          mioConsenso = {
            risposta: consensoResult.rows[0].risposta,
            timestamp: consensoResult.rows[0].timestamp
          };
        }

        const cooldown = await getPreferenceCooldown(pool, {
          userId,
          scope: 'capo-stato:consenso',
          fallbackChangedAt: consensoResult.rows[0]?.timestamp || null
        });
        blocco = { isBlocked: cooldown.isBlocked, unlockDate: cooldown.unlockDate };
      } catch (error) {
        console.log('🔍 DEBUG - Token non valido per consenso:', error.message);
      }
    }

    // Ottieni le statistiche aggregate dei voti di consenso
    const statsQuery = `
      SELECT
        risposta,
        COUNT(*) as conteggio
      FROM consenso_capo_stato
      GROUP BY risposta
      ORDER BY risposta
    `;

    const statsResult = await pool.query(statsQuery);

    const statistiche = {
      'Sì': 0,
      'Non so': 0,
      'No': 0,
      totale: 0
    };

    statsResult.rows.forEach(row => {
      statistiche[row.risposta] = parseInt(row.conteggio);
      statistiche.totale += parseInt(row.conteggio);
    });

    res.json({
      success: true,
      data: {
        mioConsenso,
        statistiche,
        blocco
      }
    });
  } catch (error) {
    console.error('❌ Errore nel recupero dati consenso:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/capo-stato/consenso - Salva il voto di consenso
router.post('/consenso', verifyToken, requireVerifiedCivicIdentity, requirePoliticalConsent, async (req, res) => {
  try {
    console.log('🔍 DEBUG /api/capo-stato/consenso - Richiesta ricevuta');
    console.log('🔍 DEBUG - Headers:', req.headers);
    console.log('🔍 DEBUG - Body:', req.body);
    console.log('🔍 DEBUG - User:', req.user);

    const { risposta } = req.body;
    const userId = req.user.id;


    if (!risposta || !['Sì', 'Non so', 'No'].includes(risposta)) {
      return res.status(400).json({
        success: false,
        error: 'Risposta non valida. Deve essere "Sì", "Non so" o "No"'
      });
    }

    const currentResult = await pool.query(
      `SELECT risposta, timestamp
       FROM consenso_capo_stato
       WHERE userid = $1
       ORDER BY timestamp DESC
       LIMIT 1`,
      [userId]
    );
    const current = currentResult.rows[0] || null;
    if (current?.risposta === risposta) {
      return res.json({ success: true, message: 'Consenso già aggiornato', data: current });
    }

    await assertPreferenceChangeAllowed(pool, {
      userId,
      scope: 'capo-stato:consenso',
      fallbackChangedAt: current?.timestamp || null,
      isAdmin: Boolean(req.user?.isAdmin)
    });

    // Inizia transazione
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Elimina il voto precedente se esiste
      await client.query(
        'DELETE FROM consenso_capo_stato WHERE userid = $1',
        [userId]
      );

      // Inserisce il nuovo voto
      const votoId = `consenso_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await client.query(
        `INSERT INTO consenso_capo_stato (
          id, userid, risposta, timestamp, created_at, updated_at
        ) VALUES ($1, $2, $3, NOW(), NOW(), NOW())`,
        [votoId, userId, risposta]
      );

      // Conferma la transazione
      await recordPreferenceChange(client, { userId, scope: 'capo-stato:consenso' });

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Voto di consenso salvato con successo',
        data: {
          risposta,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      // Rollback in caso di errore
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    if (sendCooldownError(res, error)) return;
    console.error('❌ Errore nel salvataggio consenso:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
