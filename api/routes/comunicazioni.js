const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
require('dotenv').config();

// Usa il pool centralizzato ottimizzato
const pool = getPool();

// Status utente considerati bloccati per invio notifiche push
const BLOCKED_USER_STATUSES = ['banned', 'deleted', 'disabled', '2', '9'];

async function getResolvedFcmTokensForUser(userId) {
  // Sorgente primaria: user_devices (schema nuovo)
  const deviceTokensResult = await pool.query(
    `SELECT DISTINCT d.fcm_token
     FROM user_devices d
     WHERE d.user_id = $1
       AND d.is_active = TRUE
       AND d.fcm_token IS NOT NULL
       AND btrim(d.fcm_token) <> ''`,
    [userId]
  );

  const deviceTokens = deviceTokensResult.rows.map(r => r.fcm_token).filter(Boolean);
  if (deviceTokens.length > 0) {
    return deviceTokens;
  }

  // Fallback legacy: users.fcm_tokens
  const legacyResult = await pool.query(
    `SELECT COALESCE(fcm_tokens, ARRAY[]::text[]) AS fcm_tokens
     FROM users
     WHERE id = $1`,
    [userId]
  );

  if (legacyResult.rows.length === 0) return [];
  const legacyTokens = legacyResult.rows[0].fcm_tokens || [];
  return [...new Set(legacyTokens.filter(t => t && t.trim()))];
}

async function invalidateUserFcmTokens(userId, invalidTokens = []) {
  if (!invalidTokens || invalidTokens.length === 0) return;
  const cleanedInvalid = [...new Set(invalidTokens.filter(t => t && t.trim()))];
  if (cleanedInvalid.length === 0) return;

  // Nuovo storage: disattiva token in user_devices
  try {
    await pool.query(
      `UPDATE user_devices
       SET is_active = FALSE, updated_at = NOW()
       WHERE user_id = $1
         AND fcm_token = ANY($2::text[])`,
      [userId, cleanedInvalid]
    );
  } catch (err) {
    console.warn('⚠️ Impossibile invalidare token in user_devices:', err.message);
  }

  // Legacy storage: rimuovi token da users.fcm_tokens (fallback transitorio)
  const legacyResult = await pool.query(
    `SELECT COALESCE(fcm_tokens, ARRAY[]::text[]) AS fcm_tokens
     FROM users
     WHERE id = $1`,
    [userId]
  );
  if (legacyResult.rows.length === 0) return;
  const currentLegacyTokens = legacyResult.rows[0].fcm_tokens || [];
  const filteredLegacyTokens = currentLegacyTokens.filter(t => !cleanedInvalid.includes(t));
  await pool.query(
    'UPDATE users SET fcm_tokens = $1 WHERE id = $2',
    [filteredLegacyTokens, userId]
  );
}

// NOTE: Le funzioni createNotificheUtente e updateNotificheUtente sono state rimosse
// perché ora si usa la colonna read_by nella tabella comunicazioni per tracciare le notifiche lette
// La tabella notifiche_utente non è più necessaria

// ===== ENDPOINTS PER COMUNICAZIONI =====

// MIDDLEWARE DI DEBUG PER TUTTE LE RICHIESTE A QUESTO ROUTER
router.use((req, res, next) => {
  console.log(`🟡 ROUTER COMUNICAZIONI: ${req.method} ${req.path} - ${req.originalUrl}`);
  if (req.path.includes('send-demos-notification') || req.originalUrl.includes('send-demos-notification')) {
    console.log('🔴 ========== ROUTER MIDDLEWARE: RICHIESTA A COMUNICAZIONI ==========');
    console.log('🔴 Method:', req.method);
    console.log('🔴 Path:', req.path);
    console.log('🔴 Original URL:', req.originalUrl);
    console.log('🔴 Base URL:', req.baseUrl);
    console.log('🔴 Full URL:', req.originalUrl);
  }
  if (req.path.includes('send-user-notification') || req.originalUrl.includes('send-user-notification')) {
    console.log('🟢 ========== ROUTER MIDDLEWARE: RICHIESTA send-user-notification ==========');
    console.log('🟢 Method:', req.method);
    console.log('🟢 Path:', req.path);
    console.log('🟢 Original URL:', req.originalUrl);
    console.log('🟢 Base URL:', req.baseUrl);
    console.log('🟢 Full URL:', req.originalUrl);
    console.log('🟢 Headers Authorization:', req.headers.authorization ? 'Presente' : 'Mancante');
    console.log('🟢 Body:', JSON.stringify(req.body));
  }
  next();
});

// POST /api/comunicazioni/send-demos-notification - Invia notifica "Notifiche Demos" manualmente
// IMPORTANTE: Questa route deve essere definita PRIMA di router.post('/') per evitare conflitti
router.post('/send-demos-notification', (req, res, next) => {
  console.log('🔵 ========== ROUTE HIT: /send-demos-notification ==========');
  console.log('🔵 Method:', req.method);
  console.log('🔵 Path:', req.path);
  console.log('🔵 Original URL:', req.originalUrl);
  console.log('🔵 Base URL:', req.baseUrl);
  console.log('🔵 Headers Authorization:', req.headers.authorization ? 'Presente' : 'Mancante');
  next();
}, verifyToken, async (req, res) => {
  try {
    console.log('📢 ========== RICEVUTA RICHIESTA INVIO NOTIFICA DEMOS ==========');
    console.log('📢 Timestamp:', new Date().toISOString());
    console.log('📢 User ID:', req.user?.id);
    console.log('📢 Request body:', JSON.stringify(req.body));
    const { titolo, messaggio } = req.body;
    
    console.log('📝 Dati ricevuti:', { titolo, messaggio });
    
    if (!titolo) {
      console.log('❌ Titolo mancante');
      return res.status(400).json({
        success: false,
        error: 'Titolo richiesto'
      });
    }

    const commento = messaggio || titolo;
    console.log('🚀 Avvio invio notifiche...');

    // Prima di inviare, verifica quanti utenti sono idonei
    const checkResult = await pool.query(`
      SELECT 
        COUNT(DISTINCT u.id) as totale_utenti,
        COUNT(DISTINCT CASE WHEN np.demos = true THEN u.id END) as utenti_con_demos_attivo,
        COUNT(DISTINCT CASE WHEN u.fcm_tokens IS NOT NULL AND array_length(u.fcm_tokens, 1) > 0 THEN u.id END) as utenti_con_fcm_tokens,
        COUNT(DISTINCT CASE WHEN np.demos = true AND u.fcm_tokens IS NOT NULL AND array_length(u.fcm_tokens, 1) > 0 THEN u.id END) as utenti_idonei
      FROM users u
      LEFT JOIN notifiche_preferenze np ON u.id = np.user_id
      WHERE (u.status = 'a' OR u.status IS NULL)
    `);

    const stats = checkResult.rows[0];
    console.log('📊 Statistiche utenti:');
    console.log(`   - Totale utenti: ${stats.totale_utenti}`);
    console.log(`   - Utenti con demos=true: ${stats.utenti_con_demos_attivo}`);
    console.log(`   - Utenti con FCM tokens: ${stats.utenti_con_fcm_tokens}`);
    console.log(`   - Utenti idonei (demos=true + FCM tokens): ${stats.utenti_idonei}`);

    // DEBUG: Verifica tutti gli utenti con FCM tokens e le loro preferenze
    const debugAllUsers = await pool.query(`
      SELECT 
        u.id,
        u.email,
        u.status,
        u.fcm_tokens,
        array_length(u.fcm_tokens, 1) as num_tokens,
        np.demos,
        np.user_id as pref_user_id,
        pg_typeof(np.demos) as demos_type,
        CASE 
          WHEN np.demos IS NULL THEN 'NULL'
          WHEN np.demos = true THEN 'true'
          WHEN np.demos = false THEN 'false'
          ELSE 'unknown'
        END as demos_status
      FROM users u
      LEFT JOIN notifiche_preferenze np ON u.id = np.user_id
      WHERE u.fcm_tokens IS NOT NULL 
        AND array_length(u.fcm_tokens, 1) > 0
      ORDER BY u.email
      LIMIT 10
    `);
    
    console.log('🔍 DEBUG: Primi 10 utenti con FCM tokens:');
    debugAllUsers.rows.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email || user.id}:`);
      console.log(`      - Status: ${user.status}`);
      console.log(`      - FCM tokens: ${user.num_tokens}`);
      console.log(`      - demos: ${user.demos} (tipo: ${user.demos_type}, status: ${user.demos_status})`);
      console.log(`      - pref_user_id: ${user.pref_user_id || 'NULL'}`);
    });

    // Invia la notifica a tutti gli utenti con demos: true
    await notifyAllUsers(titolo, commento);

    console.log('✅ Invio notifiche completato');

    res.json({
      success: true,
      message: 'Notifica "Notifiche Demos" inviata con successo',
      data: {
        titolo,
        messaggio: commento,
        destinatari: 'Tutti gli utenti con notifiche Demos attivate',
        statistiche: {
          totale_utenti: parseInt(stats.totale_utenti),
          utenti_con_demos_attivo: parseInt(stats.utenti_con_demos_attivo),
          utenti_con_fcm_tokens: parseInt(stats.utenti_con_fcm_tokens),
          utenti_idonei: parseInt(stats.utenti_idonei)
        }
      }
    });
  } catch (error) {
    console.error('❌ Errore nell\'invio notifica Demos:', error);
    console.error('❌ Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      details: error.message
    });
  }
});

// POST /api/comunicazioni/send-user-notification - Invia notifica push a un utente specifico
// IMPORTANTE: Questa route deve essere definita PRIMA di router.post('/') per evitare conflitti
router.post('/send-user-notification', (req, res, next) => {
  console.log('🔵 ========== ROUTE HIT: /send-user-notification ==========');
  console.log('🔵 Method:', req.method);
  console.log('🔵 Path:', req.path);
  console.log('🔵 Original URL:', req.originalUrl);
  console.log('🔵 Headers Authorization:', req.headers.authorization ? 'Presente' : 'Mancante');
  next();
}, verifyToken, async (req, res) => {
  try {
    console.log('\n\n');
    console.log('🚨🚨🚨 ========== INIZIO INVIO NOTIFICA A UTENTE SPECIFICO ========== 🚨🚨🚨');
    console.log('📢 Timestamp:', new Date().toISOString());
    console.log('📢 User ID richiedente:', req.user?.id);
    
    const { userId, titolo, messaggio } = req.body;
    
    console.log('📢 User ID destinatario:', userId);
    console.log('📢 Titolo:', titolo);
    console.log('📢 Messaggio:', messaggio);
    console.log('📢 Request body completo:', JSON.stringify(req.body));
    console.log('\n');
    
    // Verifica Firebase Admin all'inizio
    const { getFirebaseAdmin } = require('../services/firebaseAdmin');
    const admin = getFirebaseAdmin();
    console.log(`🔥 Firebase Admin disponibile: ${admin ? '✅ Sì' : '❌ No'}`);
    if (!admin) {
      console.error('❌ Firebase Admin non configurato. Impossibile inviare notifiche push.');
      return res.status(500).json({
        success: false,
        error: 'Firebase Admin non configurato. Verifica le variabili d\'ambiente FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.',
        firebase_admin_configurato: false
      });
    }
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'ID utente destinatario richiesto'
      });
    }
    
    if (!titolo) {
      return res.status(400).json({
        success: false,
        error: 'Titolo richiesto'
      });
    }

    // Verifica che l'utente destinatario esista
    const userResult = await pool.query(
      'SELECT id, email, nome, cognome, status FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente destinatario non trovato'
      });
    }

    const destinatario = userResult.rows[0];
    const fcmTokens = await getResolvedFcmTokensForUser(userId);
    
    // Log dettagliato per debug
    console.log(`   📊 Token FCM nel database per ${destinatario.email}:`);
    console.log(`      - Numero token: ${fcmTokens.length}`);
    if (fcmTokens.length > 0) {
      fcmTokens.forEach((token, idx) => {
        console.log(`      - Token ${idx + 1}: ${token.substring(0, 50)}... (lunghezza: ${token.length})`);
      });
    } else {
      console.log(`      - ⚠️ Nessun token FCM trovato nel database`);
    }

    if (fcmTokens.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'L\'utente destinatario non ha token FCM registrati. Non è possibile inviare notifiche push.',
        data: {
          userId: destinatario.id,
          email: destinatario.email,
          nome: destinatario.nome,
          cognome: destinatario.cognome
        }
      });
    }

    console.log(`📤 Invio notifica a ${destinatario.email} (${destinatario.nome} ${destinatario.cognome})`);
    console.log(`   Token FCM disponibili: ${fcmTokens.length}`);
    if (fcmTokens.length > 0) {
      console.log(`   📋 Token disponibili:`);
      fcmTokens.forEach((token, index) => {
        console.log(`      ${index + 1}. ${token.substring(0, 50)}... (lunghezza: ${token.length})`);
      });
    }

    const commento = messaggio || titolo;
    let successCount = 0;
    let failureCount = 0;
    const invalidTokens = [];

    // Usa un tag univoco per questa notifica per evitare duplicati
    const notificationTag = `user-notification-${userId}-${Date.now()}`;
    
    // TOKEN SOLO PER MOBILE: Dovrebbe esserci sempre solo 1 token
    // IMPORTANTE: Usa SEMPRE solo l'ULTIMO token (più recente) per evitare duplicati
    // Se ci sono più token, significa che c'è un token desktop vecchio che deve essere rimosso
    const tokensToSend = fcmTokens.length > 0 ? [fcmTokens[fcmTokens.length - 1]] : [];
    
    console.log(`    🔍 Invio notifica a ${fcmTokens.length} token FCM disponibili nel database (tag: ${notificationTag})...`);
    console.log(`    📊 Strategia: Userò SOLO l'ULTIMO token (${tokensToSend.length} token selezionato)`);
    
    if (fcmTokens.length > 1) {
      console.log(`    ⚠️ ATTENZIONE: Trovati ${fcmTokens.length} token nel database (dovrebbe esserci solo 1 token mobile).`);
      console.log(`    📋 Token che verrà usato (ultimo): ${tokensToSend[0]?.substring(0, 50)}...`);
      console.log(`    📋 Token che verranno IGNORATI (${fcmTokens.length - 1} token):`);
      fcmTokens.slice(0, -1).forEach((token, idx) => {
        console.log(`       - Token ${idx + 1}: ${token.substring(0, 50)}...`);
      });
      console.log(`    💡 Suggerimento: I token extra verranno rimossi automaticamente al prossimo salvataggio token mobile.`);
    } else if (fcmTokens.length === 1) {
      console.log(`    ✅ Token mobile trovato: ${tokensToSend[0].substring(0, 50)}...`);
    } else {
      console.log(`    ⚠️ Nessun token FCM disponibile per l'invio.`);
    }
    
    // Invia notifica al token mobile
    for (let i = 0; i < tokensToSend.length; i++) {
      const token = tokensToSend[i];
      
      if (!token || !token.trim()) {
        console.log(`    ⚠️ Token ${i + 1}/${tokensToSend.length}: vuoto o non valido, saltato`);
        continue;
      }
      
      console.log(`    🔔 Tentativo ${i + 1}/${tokensToSend.length}: invio notifica push a token: ${token.substring(0, 50)}...`);
      
      try {
        const result = await sendPushNotification(
          token,
          titolo,
          commento,
          {
            type: 'user_notification',
            titolo: titolo,
            messaggio: commento,
            userId: userId,
            url: '/notifiche',
            link: 'https://www.demos.community/notifiche',
            notificationTag: notificationTag // Stesso tag per tutti i token
          }
        );
        
        if (result && result.success) {
          successCount++;
          console.log(`    ✅ Notifica inviata con successo a Firebase (token ${i + 1}/${tokensToSend.length})`);
          if (result.messageId) {
            console.log(`    📨 Message ID: ${result.messageId}`);
          }
        } else {
          failureCount++;
          const errorMsg = result?.error || 'Errore sconosciuto';
          console.log(`    ❌ Errore invio notifica (token ${i + 1}/${tokensToSend.length}): ${errorMsg}`);
          if (result?.code) {
            console.log(`    📋 Error code: ${result.code}`);
          }
          if (result?.shouldRemoveToken) {
            invalidTokens.push(token);
            console.log(`    🗑️ Token ${i + 1} marcato per rimozione (non valido o scaduto)`);
          }
        }
      } catch (error) {
        failureCount++;
        console.error(`    ❌ Eccezione durante invio notifica (token ${i + 1}/${tokensToSend.length}):`, error);
        console.error(`    ❌ Error message: ${error.message}`);
        console.error(`    ❌ Error stack: ${error.stack}`);
        // Non rimuovere il token se è un errore di configurazione (es. Firebase Admin non configurato)
        if (error.message && error.message.includes('Firebase Admin')) {
          console.log(`    ⚠️ Errore di configurazione Firebase, token mantenuto`);
        } else {
          invalidTokens.push(token);
          console.log(`    🗑️ Token ${i + 1} marcato per rimozione a causa di eccezione`);
        }
      }
    }
    
    if (successCount === 0 && fcmTokens.length > 0) {
      console.log(`    ⚠️ Nessun token valido trovato tra ${fcmTokens.length} token disponibili`);
    }

    // Rimuovi token non validi dal database
    if (invalidTokens.length > 0) {
      await invalidateUserFcmTokens(userId, invalidTokens);
      console.log(`🧹 Rimossi/invalidati ${invalidTokens.length} token FCM non validi per utente ${userId}`);
    }

    console.log('\n');
    console.log(`📊 ========== RISULTATO INVIO NOTIFICA ==========`);
    console.log(`✅ Notifiche inviate: ${successCount} successi, ${failureCount} fallimenti`);
    console.log(`📋 Token totali disponibili: ${fcmTokens.length}`);
    console.log(`📋 Token mobile usato: ${tokensToSend.length} (dovrebbe essere sempre 1)`);
    console.log(`📋 Token rimossi (non validi): ${invalidTokens.length}`);
    if (fcmTokens.length > 1) {
      console.log(`   ⚠️ ATTENZIONE: ${fcmTokens.length - 1} token extra trovati (dovrebbe esserci solo 1 token mobile)`);
      console.log(`   💡 I token extra verranno rimossi automaticamente al prossimo salvataggio token.`);
    }
    
    // Salva la notifica nella tabella notifiche_demos se almeno una notifica è stata inviata con successo
    if (successCount > 0) {
      try {
        console.log(`💾 Salvataggio notifica in notifiche_demos per utente ${userId}...`);
        const saveResult = await pool.query(`
          INSERT INTO notifiche_demos (
            id, id_utente, titolo, testo, data, data_creazione
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, CURRENT_DATE, NOW()
          ) RETURNING id
        `, [
          userId,
          titolo,
          commento
        ]);
        
        const notificaId = saveResult.rows[0].id;
        console.log(`✅ Notifica salvata in notifiche_demos con ID: ${notificaId}`);
      } catch (saveError) {
        console.error(`❌ Errore nel salvataggio notifica in notifiche_demos:`, saveError);
        console.error(`❌ Error message: ${saveError.message}`);
        console.error(`❌ Error stack: ${saveError.stack}`);
        // Non bloccare la risposta se il salvataggio fallisce
      }
    } else {
      console.log(`⚠️ Notifica non salvata in notifiche_demos (nessuna notifica inviata con successo)`);
    }
    
    console.log(`🚨🚨🚨 ========== FINE INVIO NOTIFICA A UTENTE SPECIFICO ========== 🚨🚨🚨`);
    console.log('\n\n');

    if (successCount === 0) {
      // Verifica se il problema è Firebase Admin non configurato
      const adminCheck = getFirebaseAdmin();
      
      let errorMessage = 'Nessuna notifica inviata. Tutti i tentativi sono falliti.';
      if (!adminCheck) {
        errorMessage = 'Firebase Admin non configurato. Verifica le variabili d\'ambiente FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.';
      }
      
      console.error(`❌ ${errorMessage}`);
      console.error(`❌ Token FCM tentati: ${fcmTokens.length}`);
      console.error(`❌ Successi: ${successCount}, Fallimenti: ${failureCount}`);
      
      return res.status(500).json({
        success: false,
        error: errorMessage,
        data: {
          destinatario: {
            id: destinatario.id,
            email: destinatario.email,
            nome: destinatario.nome,
            cognome: destinatario.cognome
          },
          notifiche_inviate: successCount,
          notifiche_fallite: failureCount,
          token_rimossi: invalidTokens.length,
          firebase_admin_configurato: !!adminCheck
        }
      });
    }

    res.json({
      success: true,
      message: `Notifica inviata con successo a ${destinatario.nome} ${destinatario.cognome}`,
      data: {
        destinatario: {
          id: destinatario.id,
          email: destinatario.email,
          nome: destinatario.nome,
          cognome: destinatario.cognome
        },
        titolo,
        messaggio: commento,
        notifiche_inviate: successCount,
        notifiche_fallite: failureCount,
        token_rimossi: invalidTokens.length
      }
    });
  } catch (error) {
    console.error('❌ Errore nell\'invio notifica a utente specifico:', error);
    console.error('❌ Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      details: error.message
    });
  }
});

// GET /api/comunicazioni - Lista comunicazioni
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM comunicazioni ORDER BY data_creazione DESC'
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recupero comunicazioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/comunicazioni - Crea o aggiorna comunicazione
router.post('/', async (req, res) => {
  try {
    const {
      titolo,
      voto_dato,
      commento,
      vincitore,
      zona,
      id_utente,
      tipo = 'votazione',
      voti, // Array di voti per "Comunica Voti"
      tipologia, // Per "Informa Cittadini"
      dove, // Per "Informa Cittadini"
      dal_giorno, // Per "Informa Cittadini"
      al_giorno // Per "Informa Cittadini"
    } = req.body;

    // Validazione: per "informa_cittadini" il titolo non è obbligatorio
    if (tipo !== 'informa_cittadini' && (!titolo || !id_utente)) {
      return res.status(400).json({
        success: false,
        error: 'Titolo e ID utente sono obbligatori'
      });
    }

    // Validazione per "informa_cittadini"
    if (tipo === 'informa_cittadini' && (!id_utente || !tipologia || !dove || !dal_giorno || !al_giorno)) {
      return res.status(400).json({
        success: false,
        error: 'ID utente, tipologia, dove, dal_giorno e al_giorno sono obbligatori per Informa Cittadini'
      });
    }

    // Gestione speciale per "Informa Cittadini" - ora gestita da /api/informa-cittadini
    // Questo codice è stato spostato in api/routes/informa-cittadini.js che usa notifiche_comunali
    if (tipo === 'informa_cittadini') {
      return res.status(400).json({
        success: false,
        error: 'Usa l\'endpoint /api/informa-cittadini per questa funzionalità'
      });
    }

    // Gestione speciale per notifiche di Demos - ora gestita da notifyAllUsers che usa notifiche_demos
    if (tipo === 'demos_notification') {
      // Invia notifica a TUTTI gli utenti usando notifiche_demos
      await notifyAllUsers(titolo, commento || '');

      return res.status(201).json({
        success: true,
        message: 'Notifica Demos inviata a tutti gli utenti'
      });
    }

    // Gestione speciale per "Istituzione" - crea più righe (una per voto) con upsert
    if (tipo === 'istituzione' && voti && Array.isArray(voti) && voti.length > 0) {
      // Recupera comune_residenza dell'utente operante (Istituzione)
      const utenteOperanteResult = await pool.query(
        'SELECT comune_residenza FROM users WHERE id = $1',
        [id_utente]
      );
      
      if (utenteOperanteResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Utente operante non trovato'
        });
      }
      
      const comuneResidenzaOperante = utenteOperanteResult.rows[0].comune_residenza;
      
      if (!comuneResidenzaOperante) {
        return res.status(400).json({
          success: false,
          error: 'Comune residenza dell\'utente operante non trovato. Imposta il comune residenza nel tuo profilo.'
        });
      }

      const comunicazioni = [];
      const { getFirebaseAdmin } = require('../services/firebaseAdmin');
      const admin = getFirebaseAdmin();

      for (const voto of voti) {
        if (!voto.nome || !voto.voto) continue;

        // Cerca l'utente per nome completo (deve essere "Nome Cognome")
        const utenteResult = await pool.query(
          `SELECT id, nome, cognome, ruolo FROM users 
           WHERE CONCAT(nome, ' ', cognome) = $1
           LIMIT 1`,
          [voto.nome.trim()]
        );

        if (utenteResult.rows.length === 0) {
          console.log(`⚠️ Consigliere comunale non trovato per: ${voto.nome}`);
          return res.status(400).json({
            success: false,
            error: `Consigliere comunale "${voto.nome}" non trovato. Assicurati di selezionare un consigliere dalla lista suggerita.`
          });
        }

        const utentePolitico = utenteResult.rows[0];
        const nomeCompletoPolitico = `${utentePolitico.nome} ${utentePolitico.cognome}`;
        const testo = `Il voto di ${nomeCompletoPolitico}: ${voto.voto}`;
        const titoloCompleto = `${titolo} - ${nomeCompletoPolitico}`;

        // Upsert: se esiste già una riga con stesso comune_residenza e politico, la sovrascrive
        const existingResult = await pool.query(
          `SELECT id FROM notifiche_voti_comuni 
           WHERE comune_residenza = $1 AND politico = $2`,
          [comuneResidenzaOperante, nomeCompletoPolitico]
        );

        let result;
        if (existingResult.rows.length > 0) {
          // Aggiorna riga esistente
          result = await pool.query(
            `UPDATE notifiche_voti_comuni SET
              id_utente = $1,
              titolo = $2,
              testo = $3,
              voto = $4,
              data = CURRENT_DATE,
              data_creazione = CURRENT_TIMESTAMP,
              likes = 0,
              dislikes = 0
            WHERE comune_residenza = $5 AND politico = $6
            RETURNING *`,
            [utentePolitico.id, titoloCompleto, testo, voto.voto, comuneResidenzaOperante, nomeCompletoPolitico]
          );
          console.log(`🔄 Aggiornata riga esistente per ${nomeCompletoPolitico} nel comune ${comuneResidenzaOperante}`);
        } else {
          // Inserisci nuova riga
          result = await pool.query(
            `INSERT INTO notifiche_voti_comuni (
              id, id_utente, titolo, testo, voto, comune_residenza, politico, likes, dislikes, data, data_creazione
            ) VALUES (
              gen_random_uuid(), $1, $2, $3, $4, $5, $6, 0, 0, CURRENT_DATE, CURRENT_TIMESTAMP
            ) RETURNING *`,
            [utentePolitico.id, titoloCompleto, testo, voto.voto, comuneResidenzaOperante, nomeCompletoPolitico]
          );
          console.log(`✅ Inserita nuova riga per ${nomeCompletoPolitico} nel comune ${comuneResidenzaOperante}`);
        }

        comunicazioni.push(result.rows[0]);

        // Trova gli utenti che hanno questo rappresentante come rappresentante_comune
        // Gestisce sia UUID che TEXT per rappresentante_comune
        const rappresentanteComuneType = await pool.query(`
          SELECT data_type, udt_name
          FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'rappresentante_comune'
        `);
        
        const isUUID = rappresentanteComuneType.rows.length > 0 && 
                       (rappresentanteComuneType.rows[0].udt_name === 'uuid' || 
                        rappresentanteComuneType.rows[0].data_type === 'uuid');
        
        // Usa la preferenza specifica per consigliere_comunale
        const utentiConRappresentante = isUUID
          ? await pool.query(
              `SELECT u.id, u.email, u.nome, u.cognome,
                      COALESCE(tokens.tokens, ARRAY[]::text[]) as fcm_tokens,
                      COALESCE(np.consigliere_comunale, false) as consigliere_comunale
               FROM users u
               LEFT JOIN notifiche_preferenze np ON u.id = np.user_id
               LEFT JOIN LATERAL (
                 SELECT ARRAY(
                   SELECT DISTINCT tok
                   FROM (
                     SELECT d.fcm_token as tok
                     FROM user_devices d
                     WHERE d.user_id = u.id
                       AND d.is_active = TRUE
                       AND d.fcm_token IS NOT NULL
                       AND btrim(d.fcm_token) <> ''
                     UNION
                     SELECT unnest(COALESCE(u.fcm_tokens, ARRAY[]::text[])) as tok
                   ) merged
                   WHERE tok IS NOT NULL AND btrim(tok) <> ''
                 ) as tokens
               ) tokens ON TRUE
               WHERE u.rappresentante_comune = $1::uuid
                 AND (u.status IS NULL OR COALESCE(u.status::text, '') <> ALL($2::text[]))
                 AND array_length(COALESCE(tokens.tokens, ARRAY[]::text[]), 1) > 0
                 AND (np.consigliere_comunale = true OR np.consigliere_comunale IS NULL)`,
              [utentePolitico.id, BLOCKED_USER_STATUSES]
            )
          : await pool.query(
              `SELECT u.id, u.email, u.nome, u.cognome,
                      COALESCE(tokens.tokens, ARRAY[]::text[]) as fcm_tokens,
                      COALESCE(np.consigliere_comunale, false) as consigliere_comunale
               FROM users u
               LEFT JOIN notifiche_preferenze np ON u.id = np.user_id
               LEFT JOIN LATERAL (
                 SELECT ARRAY(
                   SELECT DISTINCT tok
                   FROM (
                     SELECT d.fcm_token as tok
                     FROM user_devices d
                     WHERE d.user_id = u.id
                       AND d.is_active = TRUE
                       AND d.fcm_token IS NOT NULL
                       AND btrim(d.fcm_token) <> ''
                     UNION
                     SELECT unnest(COALESCE(u.fcm_tokens, ARRAY[]::text[])) as tok
                   ) merged
                   WHERE tok IS NOT NULL AND btrim(tok) <> ''
                 ) as tokens
               ) tokens ON TRUE
               WHERE u.rappresentante_comune::text = $1::text
                 AND (u.status IS NULL OR COALESCE(u.status::text, '') <> ALL($2::text[]))
                 AND array_length(COALESCE(tokens.tokens, ARRAY[]::text[]), 1) > 0
                 AND (np.consigliere_comunale = true OR np.consigliere_comunale IS NULL)`,
              [utentePolitico.id, BLOCKED_USER_STATUSES]
            );

        console.log(`📢 Trovati ${utentiConRappresentante.rows.length} utenti con rappresentante_comune = ${utentePolitico.id}`);

        // Invia notifica push solo agli utenti che hanno questo rappresentante
        if (admin && utentiConRappresentante.rows.length > 0) {
          const pushTitle = `Voto del tuo rappresentante: ${utentePolitico.nome} ${utentePolitico.cognome}`;
          const pushBody = `${titolo}: ${voto.voto}`;

          for (const utenteDestinatario of utentiConRappresentante.rows) {
            const fcmTokens = utenteDestinatario.fcm_tokens || [];
            
            for (const token of fcmTokens) {
              if (token && token.trim()) {
                try {
                  await sendPushNotification(
                    token,
                    pushTitle,
                    pushBody,
                    {
                      type: 'istituzione',
                      comunicazione_id: result.rows[0].id,
                      rappresentante_id: utentePolitico.id,
                      titolo: titolo,
                      voto: voto.voto,
                      url: '/comunica',
                      link: 'https://www.demos.community/comunica'
                    }
                  );
                } catch (error) {
                  console.error(`❌ Errore invio notifica a ${utenteDestinatario.email}:`, error);
                }
              }
            }
          }
        }
      }

      return res.status(201).json({
        success: true,
        data: comunicazioni,
        message: `${comunicazioni.length} voti istituzionali salvati con successo`
      });
    }

    // Per comunicazioni che devono essere sovrascritte (votazione, comunicazione)
    // Controlla se esiste già una comunicazione per questo utente con lo stesso tipo
    const tipiSovrascrivibili = ['votazione', 'comunicazione'];
    const existingComunicazione = tipiSovrascrivibili.includes(tipo) 
      ? await pool.query(
          'SELECT id FROM comunicazioni WHERE id_utente = $1 AND tipo = $2 ORDER BY data_creazione DESC LIMIT 1',
          [id_utente, tipo]
        )
      : { rows: [] };

    const testo = `Voto: ${voto_dato || 'Non specificato'}${commento ? ` - Commento: ${commento}` : ''}`;

    if (existingComunicazione.rows.length > 0) {
      // Aggiorna comunicazione esistente
      const comunicazioneId = existingComunicazione.rows[0].id;
      
      // Reset like/dislike
      await pool.query(
        'DELETE FROM reazioni WHERE comunicazione_id = $1',
        [comunicazioneId]
      );

      const result = await pool.query(
        `UPDATE comunicazioni SET 
          titolo = $1, 
          testo = $2, 
          voto_dato = $3, 
          vincitore = $4, 
          commento = $5,
          data_creazione = NOW(),
          likes = 0,
          dislikes = 0,
        WHERE id = $6 
        RETURNING *`,
        [titolo, testo, voto_dato, vincitore, commento || '', comunicazioneId]
      );

      // Invia notifica ai sostenitori
      await notifySostenitori(id_utente, titolo, result.rows[0]);

      // Reset read_by per renderla non letta per tutti (sovrascrittura)
      const readByTypeCheck = await pool.query(`
        SELECT udt_name 
        FROM information_schema.columns 
        WHERE table_name = 'comunicazioni' 
        AND column_name = 'read_by'
      `);
      const isUUIDArray = readByTypeCheck.rows.length > 0 && readByTypeCheck.rows[0].udt_name?.includes('uuid');
      const readByInit = isUUIDArray ? 'ARRAY[]::UUID[]' : 'ARRAY[]::VARCHAR[]';
      
      await pool.query(`
        UPDATE comunicazioni 
        SET read_by = ${readByInit}
        WHERE id = $1
      `, [comunicazioneId]);

      res.status(200).json({
        success: true,
        data: result.rows[0],
        message: 'Comunicazione aggiornata con successo'
      });
    } else {
      // Crea nuova comunicazione
      const result = await pool.query(
        `INSERT INTO comunicazioni (
          id, id_utente, titolo, testo, zona, voto_dato, vincitore, commento,
          data_creazione, likes, dislikes, punti_trasparenza, tipo
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), 0, 0, 3, $8
        ) RETURNING *`,
        [id_utente, titolo, testo, zona || 'Generale', voto_dato, vincitore, commento || '', tipo]
      );

      // Invia notifica ai sostenitori
      await notifySostenitori(id_utente, titolo, result.rows[0]);

      res.status(201).json({
        success: true,
        data: result.rows[0]
      });
    }
  } catch (error) {
    console.error('❌ Errore nella creazione/aggiornamento comunicazione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// Funzione per notificare i sostenitori
async function notifySostenitori(utenteId, titolo, comunicazione) {
  try {
    // Recupera i sostenitori dell'utente
    const sostenitoriResult = await pool.query(
      'SELECT utente_id FROM sostenitori WHERE sostenuto_id = $1',
      [utenteId]
    );

    if (sostenitoriResult.rows.length === 0) return;

    // NOTE: Le notifiche ai sostenitori ora vengono gestite tramite la tabella comunicazioni
    // con la colonna read_by. La tabella notifiche_utente non è più utilizzata.
    // Le comunicazioni create/aggiornate sono visibili a tutti gli utenti tramite GET /api/notifiche
    console.log(`✅ Comunicazione disponibile per ${sostenitoriResult.rows.length} sostenitori`);
  } catch (error) {
    console.error('❌ Errore nell\'invio notifiche ai sostenitori:', error);
  }
}

// Funzione helper per inviare push notification usando Firebase Admin SDK
async function sendPushNotification(fcmToken, title, body, data = {}) {
  try {
    if (!fcmToken || !fcmToken.trim()) {
      return { success: false, error: 'Token FCM non valido' };
    }

    // Inizializza Firebase Admin se non già fatto
    const { getFirebaseAdmin } = require('../services/firebaseAdmin');
    const admin = getFirebaseAdmin();
    
    if (!admin) {
      console.warn('⚠️ Firebase Admin non disponibile. Notifica push non inviata.');
      return { success: false, error: 'Firebase Admin non configurato' };
    }
    
    // Verifica che admin.messaging() sia disponibile
    try {
      const messaging = admin.messaging();
      if (!messaging) {
        console.error('❌ admin.messaging() non disponibile');
        return { success: false, error: 'Firebase Admin messaging non disponibile' };
      }
      console.log('✅ admin.messaging() verificato e disponibile');
    } catch (messagingError) {
      console.error('❌ Errore nell\'accesso a admin.messaging():', messagingError.message);
      return { success: false, error: `Errore Firebase messaging: ${messagingError.message}` };
    }

    // Prepara il messaggio FCM
    const message = {
      token: fcmToken,
      notification: {
        title: title,
        body: body
      },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK', // Per compatibilità mobile
        type: data.type || 'demos_notification'
      },
      webpush: {
        headers: {
          'Urgency': 'high'
        },
        notification: {
          icon: '/icona.png',
          badge: '/icona.png',
          tag: data.notificationTag || 'demos-notification', // Usa il tag passato per evitare duplicati
          requireInteraction: true,
          data: {
            url: data.url || '/comunica',
            link: data.link || 'https://www.demos.community/comunica'
          },
          actions: [
            {
              action: 'open',
              title: 'Apri'
            },
            {
              action: 'close',
              title: 'Chiudi'
            }
          ]
        },
        fcmOptions: {
          link: data.link || data.url || 'https://www.demos.community/comunica'
        }
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'demos_notifications'
        }
      },
      apns: {
        headers: {
          'apns-priority': '10'
        },
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    // Invia la notifica push
    console.log(`📤 Invio notifica push a Firebase...`);
    console.log(`   Token: ${fcmToken.substring(0, 30)}...`);
    console.log(`   Titolo: ${title}`);
    console.log(`   Body: ${body}`);
    console.log(`   Data:`, JSON.stringify(data));
    
    try {
      console.log(`🔧 Verifica admin.messaging() disponibile...`);
      const messaging = admin.messaging();
      console.log(`✅ admin.messaging() disponibile`);
      
      console.log(`📤 Chiamata a messaging.send()...`);
      const response = await messaging.send(message);
      console.log(`✅ Push notification inviata con successo a Firebase. Message ID: ${response}`);
      console.log(`   Firebase ha accettato la notifica e la invierà al dispositivo`);
      
      return { success: true, messageId: response };
    } catch (sendError) {
      console.error(`❌ Errore durante l'invio a Firebase:`);
      console.error(`   Error name: ${sendError.name || 'N/A'}`);
      console.error(`   Error message: ${sendError.message}`);
      console.error(`   Error code: ${sendError.code || 'N/A'}`);
      console.error(`   Error stack: ${sendError.stack ? sendError.stack.substring(0, 500) : 'N/A'}`);
      console.error(`   Token: ${fcmToken?.substring(0, 30)}...`);
      
      // Log dettagliato per errori comuni
      if (sendError.code) {
        console.error(`   📋 Error code specifico: ${sendError.code}`);
        if (sendError.code.includes('invalid')) {
          console.error(`   ⚠️ Errore di validazione - verifica il formato del token o del messaggio`);
        }
        if (sendError.code.includes('permission') || sendError.code.includes('auth')) {
          console.error(`   ⚠️ Errore di autenticazione/autorizzazione - verifica le credenziali Firebase`);
        }
        if (sendError.code.includes('quota') || sendError.code.includes('limit')) {
          console.error(`   ⚠️ Errore di quota/limite - verifica i limiti del progetto Firebase`);
        }
      }
      
      // Gestisci errori specifici di FCM
      if (sendError.code === 'messaging/invalid-registration-token' || 
          sendError.code === 'messaging/registration-token-not-registered') {
        console.warn(`⚠️ Token FCM non valido o non registrato - verrà rimosso dal database`);
        return { success: false, error: 'Token non valido', shouldRemoveToken: true, code: sendError.code };
      }
      
      // Rilancia l'errore per essere gestito dal catch esterno
      throw sendError;
    }
  } catch (error) {
    // Gestisci altri errori
    console.error('❌ Errore invio push notification:', error.message);
    console.error('❌ Error code:', error.code || 'N/A');
    console.error('❌ Token:', fcmToken?.substring(0, 30) || 'N/A');
    
    if (error.code === 'messaging/invalid-registration-token' || 
        error.code === 'messaging/registration-token-not-registered') {
      return { success: false, error: 'Token non valido', shouldRemoveToken: true, code: error.code };
    }
    
    return { success: false, error: error.message, code: error.code };
  }
}

// Funzione per notificare tutti gli utenti (per notifiche Demos)
async function notifyAllUsers(titolo, commento) {
  try {
    // Usa un id_utente valido (non può essere NULL)
    // Prendi il primo utente attivo come mittente sistema
    const systemUserResult = await pool.query(`
      SELECT id FROM users WHERE status = 'a' LIMIT 1
    `);
    const systemUserId = systemUserResult.rows.length > 0 ? systemUserResult.rows[0].id : null;
    
    if (!systemUserId) {
      throw new Error('Nessun utente attivo trovato per creare la comunicazione');
    }
    
    // Controlla se esiste già una notifica Demos e la sovrascrivi
    const existingDemosNotification = await pool.query(`
      SELECT id FROM notifiche_demos ORDER BY data DESC NULLS LAST LIMIT 1
    `);
    
    let comunicazioneId;
    
    if (existingDemosNotification.rows.length > 0) {
      // Aggiorna comunicazione esistente (sovrascrittura)
      comunicazioneId = existingDemosNotification.rows[0].id;
      
      // Reset reazioni
      await pool.query('DELETE FROM reazioni WHERE comunicazione_id = $1', [comunicazioneId]);
      
      // Aggiorna la comunicazione in notifiche_demos
      const comunicazioneResult = await pool.query(`
        UPDATE notifiche_demos SET
          id_utente = $1,
          titolo = $2,
          testo = $3,
          data = CURRENT_DATE
        WHERE id = $4
        RETURNING id
      `, [
        systemUserId,
        `Notifica Demos: ${titolo}`,
        commento || titolo,
        comunicazioneId
      ]);
      
      console.log(`✅ Notifica Demos aggiornata (sovrascritta) con ID: ${comunicazioneId}`);
    } else {
      // Crea nuova comunicazione solo se non esiste
      const comunicazioneResult = await pool.query(`
        INSERT INTO notifiche_demos (
          id, id_utente, titolo, testo, data
        ) VALUES (
          gen_random_uuid(), $3, $1, $2, CURRENT_DATE
        ) RETURNING id
      `, [
        `Notifica Demos: ${titolo}`,
        commento || titolo,
        systemUserId
      ]);

      comunicazioneId = comunicazioneResult.rows[0].id;
      console.log(`✅ Notifica Demos creata con ID: ${comunicazioneId}`);
    }

    // Prima verifica quanti utenti hanno FCM tokens
    const utentiConFCMResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM users u
      LEFT JOIN LATERAL (
        SELECT ARRAY(
          SELECT DISTINCT tok
          FROM (
            SELECT d.fcm_token as tok
            FROM user_devices d
            WHERE d.user_id = u.id
              AND d.is_active = TRUE
              AND d.fcm_token IS NOT NULL
              AND btrim(d.fcm_token) <> ''
            UNION
            SELECT unnest(COALESCE(u.fcm_tokens, ARRAY[]::text[])) as tok
          ) merged
          WHERE tok IS NOT NULL AND btrim(tok) <> ''
        ) as tokens
      ) tokens ON TRUE
      WHERE (u.status IS NULL OR COALESCE(u.status::text, '') <> ALL($1::text[]))
        AND array_length(COALESCE(tokens.tokens, ARRAY[]::text[]), 1) > 0
    `, [BLOCKED_USER_STATUSES]);
    console.log(`📊 Utenti con FCM tokens: ${utentiConFCMResult.rows[0].count}`);

    // Verifica quanti utenti hanno preferenze
    const utentiConPreferenzeResult = await pool.query(`
      SELECT 
        COUNT(*) as totale,
        COUNT(CASE WHEN np.demos = true THEN 1 END) as demos_true,
        COUNT(CASE WHEN np.demos = false THEN 1 END) as demos_false,
        COUNT(CASE WHEN np.demos IS NULL THEN 1 END) as demos_null
      FROM users u
      LEFT JOIN notifiche_preferenze np ON u.id = np.user_id
      WHERE (u.status IS NULL OR COALESCE(u.status::text, '') <> ALL($1::text[]))
    `, [BLOCKED_USER_STATUSES]);
    const prefStats = utentiConPreferenzeResult.rows[0];
    console.log(`📊 Statistiche preferenze Demos:`);
    console.log(`   - Totale utenti con preferenze: ${prefStats.totale}`);
    console.log(`   - demos = true: ${prefStats.demos_true}`);
    console.log(`   - demos = false: ${prefStats.demos_false}`);
    console.log(`   - demos = NULL: ${prefStats.demos_null}`);

    // Recupera solo gli utenti che hanno attivato "Notifiche Demos" e hanno FCM tokens
    // Prova prima senza filtro status per vedere se è quello il problema
    console.log('🔍 Eseguendo query per utenti con demos=true e FCM tokens...');
    const utentiConPushResult = await pool.query(`
      SELECT u.id, u.email, u.nome, u.cognome,
             COALESCE(tokens.tokens, ARRAY[]::text[]) as fcm_tokens,
             np.demos as demos,
             u.status,
             pg_typeof(np.demos) as demos_type
      FROM users u
      INNER JOIN notifiche_preferenze np ON u.id = np.user_id
      LEFT JOIN LATERAL (
        SELECT ARRAY(
          SELECT DISTINCT tok
          FROM (
            SELECT d.fcm_token as tok
            FROM user_devices d
            WHERE d.user_id = u.id
              AND d.is_active = TRUE
              AND d.fcm_token IS NOT NULL
              AND btrim(d.fcm_token) <> ''
            UNION
            SELECT unnest(COALESCE(u.fcm_tokens, ARRAY[]::text[])) as tok
          ) merged
          WHERE tok IS NOT NULL AND btrim(tok) <> ''
        ) as tokens
      ) tokens ON TRUE
      WHERE np.demos = true
        AND (u.status IS NULL OR COALESCE(u.status::text, '') <> ALL($1::text[]))
        AND array_length(COALESCE(tokens.tokens, ARRAY[]::text[]), 1) > 0
    `, [BLOCKED_USER_STATUSES]);
    
    console.log(`🔍 Query senza filtro status: trovati ${utentiConPushResult.rows.length} utenti`);
    
    // Se non trova utenti, prova anche con LEFT JOIN e COALESCE
    if (utentiConPushResult.rows.length === 0) {
      console.log('⚠️ Nessun utente trovato con INNER JOIN, provo con LEFT JOIN...');
      const utentiConPushResult2 = await pool.query(`
        SELECT u.id, u.email, u.nome, u.cognome,
               COALESCE(tokens.tokens, ARRAY[]::text[]) as fcm_tokens,
               np.demos as demos,
               u.status,
               pg_typeof(np.demos) as demos_type
        FROM users u
        LEFT JOIN notifiche_preferenze np ON u.id = np.user_id
        LEFT JOIN LATERAL (
          SELECT ARRAY(
            SELECT DISTINCT tok
            FROM (
              SELECT d.fcm_token as tok
              FROM user_devices d
              WHERE d.user_id = u.id
                AND d.is_active = TRUE
                AND d.fcm_token IS NOT NULL
                AND btrim(d.fcm_token) <> ''
              UNION
              SELECT unnest(COALESCE(u.fcm_tokens, ARRAY[]::text[])) as tok
            ) merged
            WHERE tok IS NOT NULL AND btrim(tok) <> ''
          ) as tokens
        ) tokens ON TRUE
        WHERE COALESCE(np.demos, false) = true
          AND (u.status IS NULL OR COALESCE(u.status::text, '') <> ALL($1::text[]))
          AND array_length(COALESCE(tokens.tokens, ARRAY[]::text[]), 1) > 0
      `, [BLOCKED_USER_STATUSES]);
      
      console.log(`🔍 Query con LEFT JOIN e COALESCE: trovati ${utentiConPushResult2.rows.length} utenti`);
      
      if (utentiConPushResult2.rows.length > 0) {
        utentiConPushResult.rows = utentiConPushResult2.rows;
      }
    }
    
    // Se ancora non trova, prova una query ancora più semplice
    if (utentiConPushResult.rows.length === 0) {
      console.log('⚠️ Ancora nessun utente trovato, provo query semplificata...');
      const utentiConPushResult3 = await pool.query(`
        SELECT u.id, u.email, u.nome, u.cognome,
               COALESCE(tokens.tokens, ARRAY[]::text[]) as fcm_tokens,
               np.demos as demos,
               u.status
        FROM users u
        INNER JOIN notifiche_preferenze np ON u.id = np.user_id
        LEFT JOIN LATERAL (
          SELECT ARRAY(
            SELECT DISTINCT tok
            FROM (
              SELECT d.fcm_token as tok
              FROM user_devices d
              WHERE d.user_id = u.id
                AND d.is_active = TRUE
                AND d.fcm_token IS NOT NULL
                AND btrim(d.fcm_token) <> ''
              UNION
              SELECT unnest(COALESCE(u.fcm_tokens, ARRAY[]::text[])) as tok
            ) merged
            WHERE tok IS NOT NULL AND btrim(tok) <> ''
          ) as tokens
        ) tokens ON TRUE
        WHERE np.demos IS TRUE
          AND (u.status IS NULL OR COALESCE(u.status::text, '') <> ALL($1::text[]))
          AND array_length(COALESCE(tokens.tokens, ARRAY[]::text[]), 1) > 0
      `, [BLOCKED_USER_STATUSES]);
      
      console.log(`🔍 Query semplificata: trovati ${utentiConPushResult3.rows.length} utenti`);
      
      if (utentiConPushResult3.rows.length > 0) {
        utentiConPushResult.rows = utentiConPushResult3.rows;
      }
    }

    console.log(`🔍 Utenti trovati con demos: true e FCM tokens: ${utentiConPushResult.rows.length}`);
    
    // Debug: verifica utenti specifici con FCM ma senza demos=true
    const debugUtentiResult = await pool.query(`
      SELECT u.id, u.email, u.fcm_tokens, np.demos, 
             array_length(u.fcm_tokens, 1) as num_tokens
      FROM users u
      LEFT JOIN notifiche_preferenze np ON u.id = np.user_id
      WHERE (u.status IS NULL OR COALESCE(u.status::text, '') <> ALL($1::text[]))
        AND u.fcm_tokens IS NOT NULL 
        AND array_length(u.fcm_tokens, 1) > 0
      LIMIT 5
    `, [BLOCKED_USER_STATUSES]);
    console.log(`🔍 Esempi utenti con FCM tokens (primi 5):`);
    debugUtentiResult.rows.forEach((utente, index) => {
      console.log(`   ${index + 1}. ${utente.email || utente.id}: demos=${utente.demos} (${typeof utente.demos}), tokens=${utente.num_tokens}`);
    });
    
    // Log dettagliato per debug
    if (utentiConPushResult.rows.length > 0) {
      console.log('📋 Dettagli utenti che riceveranno la notifica:');
      utentiConPushResult.rows.forEach((utente, index) => {
        console.log(`   ${index + 1}. ${utente.email || utente.id} - Token FCM: ${utente.fcm_tokens?.length || 0} token(s)`);
        if (utente.fcm_tokens && utente.fcm_tokens.length > 0) {
          utente.fcm_tokens.forEach((token, tokenIndex) => {
            console.log(`      Token ${tokenIndex + 1}: ${token.substring(0, 30)}...`);
          });
        }
      });
    }
    
    if (utentiConPushResult.rows.length === 0) {
      console.log('ℹ️ Nessun utente con push notifications attive per Demos');
      console.log('💡 Verifica che gli utenti abbiano:');
      console.log('   1. notifiche_preferenze.demos = true');
      console.log('   2. fcm_tokens non vuoto');
      
      // Query di debug per vedere quanti utenti hanno FCM tokens ma non demos=true
      const debugResult = await pool.query(`
        SELECT 
          COUNT(DISTINCT u.id) as utenti_con_fcm_senza_demos,
          COUNT(DISTINCT CASE WHEN np.demos IS NULL THEN u.id END) as utenti_senza_preferenze,
          COUNT(DISTINCT CASE WHEN np.demos = false THEN u.id END) as utenti_con_demos_false
        FROM users u
        LEFT JOIN notifiche_preferenze np ON u.id = np.user_id
        WHERE (u.status IS NULL OR COALESCE(u.status::text, '') <> ALL($1::text[]))
          AND u.fcm_tokens IS NOT NULL 
          AND array_length(u.fcm_tokens, 1) > 0
          AND (np.demos IS NULL OR np.demos = false)
      `, [BLOCKED_USER_STATUSES]);
      
      const debug = debugResult.rows[0];
      console.log('🔍 Debug utenti con FCM ma senza demos=true:');
      console.log(`   - Utenti con FCM ma demos non attivo: ${debug.utenti_con_fcm_senza_demos}`);
      console.log(`   - Utenti senza record preferenze: ${debug.utenti_senza_preferenze}`);
      console.log(`   - Utenti con demos=false: ${debug.utenti_con_demos_false}`);
      
      return;
    }

    // Invia push notifications solo agli utenti con preferenza attiva
    const pushTitle = `Notifica Demos: ${titolo}`;
    const pushBody = commento || titolo;
    let pushSuccessCount = 0;
    let pushFailureCount = 0;

    const invalidTokens = []; // Raccogli token non validi da rimuovere
    
    console.log(`📤 Invio push notifications a ${utentiConPushResult.rows.length} utenti...`);
    console.log(`📋 Dettagli utenti che riceveranno la notifica:`);
    utentiConPushResult.rows.forEach((utente, index) => {
      console.log(`   ${index + 1}. ${utente.email || utente.id}:`);
      console.log(`      - Token FCM: ${utente.fcm_tokens?.length || 0} token(s)`);
      if (utente.fcm_tokens && utente.fcm_tokens.length > 0) {
        utente.fcm_tokens.forEach((token, tokenIndex) => {
          console.log(`         Token ${tokenIndex + 1}: ${token.substring(0, 50)}...`);
        });
      }
    });
    
    for (const utente of utentiConPushResult.rows) {
      const fcmTokens = utente.fcm_tokens || [];
      const validTokens = [];
      
      console.log(`  📱 Utente ${utente.email || utente.id}: ${fcmTokens.length} token(s) FCM`);
      
      // Invia push notification a tutti i token FCM dell'utente
      for (const token of fcmTokens) {
        if (token && token.trim()) {
          console.log(`    🔔 Invio notifica push a token: ${token.substring(0, 50)}...`);
          
          const result = await sendPushNotification(
            token,
            pushTitle,
            pushBody,
            {
              type: 'demos_notification',
              titolo: titolo,
              messaggio: commento,
              url: '/comunica',
              link: 'https://www.demos.community/comunica'
            }
          );
          
            if (result.success) {
            pushSuccessCount++;
            validTokens.push(token); // Mantieni solo i token validi
            console.log(`    ✅ Notifica inviata con successo a Firebase`);
            if (result.messageId) {
              console.log(`    📨 Message ID: ${result.messageId}`);
            }
          } else {
            pushFailureCount++;
            console.log(`    ❌ Errore invio notifica: ${result.error}`);
            if (result.code) {
              console.log(`    📋 Error code: ${result.code}`);
            }
            // Se il token non è valido, segnalo per rimozione
            if (result.shouldRemoveToken) {
              invalidTokens.push({ userId: utente.id, token });
              console.log(`    🗑️ Token marcato per rimozione (non valido o scaduto)`);
            } else {
              validTokens.push(token); // Mantieni il token se l'errore è temporaneo
              console.log(`    ⚠️ Errore temporaneo, token mantenuto`);
            }
          }
        }
      }
      
      // Rimuovi token non validi dal database
      if (invalidTokens.length > 0 && validTokens.length !== fcmTokens.length) {
        try {
          await invalidateUserFcmTokens(utente.id, invalidTokens.map(t => t.token));
          console.log(`🧹 Rimossi ${fcmTokens.length - validTokens.length} token FCM non validi per utente ${utente.id}`);
        } catch (error) {
          console.error(`❌ Errore nella rimozione token FCM per utente ${utente.id}:`, error);
        }
      }
    }

    console.log(`✅ Push notifications Demos inviate: ${pushSuccessCount} successi, ${pushFailureCount} fallimenti a ${utentiConPushResult.rows.length} utenti`);
  } catch (error) {
    console.error('❌ Errore nell\'invio notifiche Demos:', error);
  }
}

// GET /api/comunicazioni/debug-firebase-admin - Debug per verificare lo stato di Firebase Admin
router.get('/debug-firebase-admin', verifyToken, async (req, res) => {
  try {
    console.log('🔍 ========== DEBUG FIREBASE ADMIN ==========');
    
    const { getFirebaseAdmin, initializeFirebaseAdmin, isInitialized } = require('../services/firebaseAdmin');
    
    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: {
        FIREBASE_PROJECT_ID: {
          presente: !!process.env.FIREBASE_PROJECT_ID,
          configurato: !!process.env.FIREBASE_PROJECT_ID
        },
        FIREBASE_CLIENT_EMAIL: {
          presente: !!process.env.FIREBASE_CLIENT_EMAIL,
          configurato: !!process.env.FIREBASE_CLIENT_EMAIL,
          formato_corretto: process.env.FIREBASE_CLIENT_EMAIL ? process.env.FIREBASE_CLIENT_EMAIL.includes('@') && process.env.FIREBASE_CLIENT_EMAIL.includes('firebase-adminsdk') : false
        },
        FIREBASE_PRIVATE_KEY: {
          presente: !!process.env.FIREBASE_PRIVATE_KEY,
          configurato: !!process.env.FIREBASE_PRIVATE_KEY,
          contiene_begin: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.includes('BEGIN PRIVATE KEY') : false,
          contiene_end: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.includes('END PRIVATE KEY') : false,
          contiene_backslash_n: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.includes('\\n') : false,
          lunghezza_attesa: 'Una chiave privata RSA completa dovrebbe essere ~1600-1700 caratteri. Se è molto più corta, potrebbe essere troncata.',
          sembra_completa: process.env.FIREBASE_PRIVATE_KEY ? (process.env.FIREBASE_PRIVATE_KEY.length > 1000) : false
        }
      },
      stato_inizializzazione: {
        isInitialized: isInitialized(),
        admin_disponibile: null,
        messaging_disponibile: null,
        errore: null,
        test_invio: null,
        dettagli_parsing: null
      }
    };
    
    console.log('🔍 Variabili d\'ambiente:', JSON.stringify(debugInfo.environment, null, 2));
    
    // Verifica corrispondenza tra variabili d'ambiente
    const envCheck = {
      project_id_match: process.env.FIREBASE_PROJECT_ID === 'demos-finale',
      client_email_format: process.env.FIREBASE_CLIENT_EMAIL ? 
        process.env.FIREBASE_CLIENT_EMAIL.includes('firebase-adminsdk') && 
        process.env.FIREBASE_CLIENT_EMAIL.includes('@demos-finale.iam.gserviceaccount.com') : false,
      client_email_matches: process.env.FIREBASE_CLIENT_EMAIL === 'firebase-adminsdk-fbsvc@demos-finale.iam.gserviceaccount.com'
    };
    
    debugInfo.verifica_corrispondenza = envCheck;
    
    // Verifica tempo del server (importante per invalid_grant)
    const serverTime = new Date();
    const serverTimeISO = serverTime.toISOString();
    const serverTimeUTC = serverTime.getTime();
    const nowUTC = Date.now();
    const timeDiff = Math.abs(serverTimeUTC - nowUTC);
    const timeDiffSeconds = Math.floor(timeDiff / 1000);
    
    debugInfo.tempo_server = {
      timestamp: serverTimeISO,
      timestamp_utc: serverTimeUTC,
      differenza_secondi: timeDiffSeconds,
      sincronizzato: timeDiffSeconds < 60, // Considera sincronizzato se differenza < 60 secondi
      avviso: timeDiffSeconds >= 60 ? 'Il tempo del server potrebbe non essere sincronizzato. Questo può causare errori invalid_grant.' : null
    };
    
    if (timeDiffSeconds >= 60) {
      console.warn(`⚠️ Possibile problema di sincronizzazione tempo: differenza di ${timeDiffSeconds} secondi`);
    }
    
    // Raccogli informazioni sul parsing della chiave privata
    let parsingDetails = null;
    if (process.env.FIREBASE_PRIVATE_KEY) {
      const rawKey = process.env.FIREBASE_PRIVATE_KEY;
      let cleanedKey = rawKey.trim();
      
      // Rimuovi virgolette se presenti
      if ((cleanedKey.startsWith('"') && cleanedKey.endsWith('"')) || 
          (cleanedKey.startsWith("'") && cleanedKey.endsWith("'"))) {
        cleanedKey = cleanedKey.slice(1, -1);
      }
      
      // Converti \n
      const beforeReplace = cleanedKey;
      cleanedKey = cleanedKey.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n');
      
      parsingDetails = {
        lunghezza_raw: rawKey.length,
        lunghezza_dopo_trim: rawKey.trim().length,
        lunghezza_dopo_pulizia: cleanedKey.length,
        aveva_virgolette: (rawKey.startsWith('"') && rawKey.endsWith('"')) || (rawKey.startsWith("'") && rawKey.endsWith("'")),
        aveva_backslash_n: rawKey.includes('\\n'),
        aveva_doppio_backslash_n: rawKey.includes('\\\\n'),
        newline_reali_dopo_parsing: (cleanedKey.match(/\n/g) || []).length,
        inizia_correttamente: cleanedKey.trim().startsWith('<REDACTED_PRIVATE_KEY>'),
        contiene_begin: cleanedKey.includes('BEGIN PRIVATE KEY'),
        contiene_end: cleanedKey.includes('END PRIVATE KEY'),
        sembra_completa: cleanedKey.length > 1000
      };
      
      debugInfo.stato_inizializzazione.dettagli_parsing = parsingDetails;
    }
    
    // Prova a inizializzare Firebase Admin
    try {
      console.log('🔍 Tentativo di inizializzazione Firebase Admin...');
      console.log('🔍 Chiamata a initializeFirebaseAdmin()...');
      const admin = initializeFirebaseAdmin();
      console.log('🔍 Risultato initializeFirebaseAdmin():', admin ? 'Admin disponibile' : 'Admin null');
      debugInfo.stato_inizializzazione.admin_disponibile = !!admin;
      
      if (admin) {
        console.log('✅ Firebase Admin inizializzato con successo');
        debugInfo.stato_inizializzazione.admin_disponibile = true;
        // Verifica che admin.messaging() sia disponibile
        try {
          const messaging = admin.messaging();
          console.log('✅ admin.messaging() disponibile');
          debugInfo.stato_inizializzazione.messaging_disponibile = true;
          
          // Test reale: prova a inviare una notifica di test (se l'utente ha un token FCM)
          try {
            const userId = req.user?.id;
            if (userId) {
              const resolvedTokens = await getResolvedFcmTokensForUser(userId);
              if (resolvedTokens.length > 0) {
                const testToken = resolvedTokens[0];
                console.log('🧪 Test invio notifica reale a token:', testToken.substring(0, 30) + '...');
                
                const testMessage = {
                  token: testToken,
                  notification: {
                    title: 'Test Diagnostica',
                    body: 'Notifica di test dalla diagnostica Firebase Admin'
                  },
                  data: {
                    type: 'diagnostic_test',
                    timestamp: new Date().toISOString()
                  }
                };
                
                try {
                  const testResponse = await messaging.send(testMessage);
                  console.log('✅ Test invio notifica riuscito. Message ID:', testResponse);
                  debugInfo.stato_inizializzazione.test_invio = {
                    successo: true,
                    message_id: testResponse,
                    messaggio: 'Notifica di test inviata con successo'
                  };
                } catch (testError) {
                  console.error('❌ Test invio notifica fallito:', testError.message);
                  debugInfo.stato_inizializzazione.test_invio = {
                    successo: false,
                    errore: testError.message,
                    codice: testError.code || 'N/A',
                    messaggio: `Errore durante test invio: ${testError.message}`
                  };
                }
              } else {
                console.log('ℹ️ Utente corrente non ha token FCM per test reale');
                debugInfo.stato_inizializzazione.test_invio = {
                  successo: null,
                  messaggio: 'Utente corrente non ha token FCM registrati per il test'
                };
              }
            }
          } catch (testError) {
            console.error('❌ Errore durante preparazione test invio:', testError.message);
            debugInfo.stato_inizializzazione.test_invio = {
              successo: false,
              errore: testError.message,
              messaggio: `Errore durante preparazione test: ${testError.message}`
            };
          }
        } catch (messagingError) {
          console.error('❌ admin.messaging() non disponibile:', messagingError.message);
          debugInfo.stato_inizializzazione.messaging_disponibile = false;
          debugInfo.stato_inizializzazione.errore = {
            message: `Messaging non disponibile: ${messagingError.message}`,
            code: messagingError.code || 'N/A'
          };
        }
      } else {
        console.log('❌ Firebase Admin non inizializzato - initializeFirebaseAdmin() ha restituito null');
        debugInfo.stato_inizializzazione.admin_disponibile = false;
        debugInfo.stato_inizializzazione.errore = {
          message: 'initializeFirebaseAdmin() ha restituito null. Verifica i log del server per dettagli.',
          code: 'INIT_FAILED'
        };
      }
    } catch (error) {
      console.error('❌ Errore durante inizializzazione:', error);
      console.error('❌ Error name:', error.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error code:', error.code);
      console.error('❌ Error stack:', error.stack);
      debugInfo.stato_inizializzazione.admin_disponibile = false;
      debugInfo.stato_inizializzazione.errore = {
        message: error.message,
        code: error.code || 'N/A',
        name: error.name || 'N/A',
        stack: error.stack ? error.stack.substring(0, 1000) : 'N/A'
      };
    }
    
    res.json({
      success: true,
      data: debugInfo
    });
  } catch (error) {
    console.error('❌ Errore nel debug Firebase Admin:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      details: error.message
    });
  }
});

// GET /api/comunicazioni/debug-notifiche-demos - Debug per verificare lo stato delle notifiche Demos
router.get('/debug-notifiche-demos', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Verifica lo stato dell'utente corrente con query più dettagliate
    const userResult = await pool.query(`
      SELECT 
        u.id,
        u.email,
        u.nome,
        u.cognome,
        u.status,
        COALESCE(tokens.tokens, ARRAY[]::text[]) AS fcm_tokens,
        array_length(COALESCE(tokens.tokens, ARRAY[]::text[]), 1) as num_tokens,
        np.demos as demos_preferenza,
        pg_typeof(np.demos) as demos_type,
        np.user_id as pref_user_id,
        CASE 
          WHEN np.demos IS NULL THEN 'NULL'
          WHEN np.demos = true THEN 'true'
          WHEN np.demos = false THEN 'false'
          ELSE 'unknown'
        END as demos_status,
        CASE 
          WHEN array_length(COALESCE(tokens.tokens, ARRAY[]::text[]), 1) > 0 THEN true 
          ELSE false 
        END as ha_fcm_tokens,
        CASE 
          WHEN np.demos = true AND array_length(COALESCE(tokens.tokens, ARRAY[]::text[]), 1) > 0 THEN true 
          ELSE false 
        END as ricevera_notifiche
      FROM users u
      LEFT JOIN notifiche_preferenze np ON u.id = np.user_id
      LEFT JOIN LATERAL (
        SELECT ARRAY(
          SELECT DISTINCT tok
          FROM (
            SELECT d.fcm_token as tok
            FROM user_devices d
            WHERE d.user_id = u.id
              AND d.is_active = TRUE
              AND d.fcm_token IS NOT NULL
              AND btrim(d.fcm_token) <> ''
            UNION
            SELECT unnest(COALESCE(u.fcm_tokens, ARRAY[]::text[])) as tok
          ) merged
          WHERE tok IS NOT NULL AND btrim(tok) <> ''
        ) as tokens
      ) tokens ON TRUE
      WHERE u.id = $1
    `, [userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const user = userResult.rows[0];
    const fcmTokens = user.fcm_tokens || [];
    
    // Query aggiuntiva per vedere tutti gli utenti con FCM e demos
    const allUsersResult = await pool.query(`
      SELECT 
        COUNT(*) as totale_utenti_fcm,
        COUNT(CASE WHEN np.demos = true THEN 1 END) as utenti_demos_true,
        COUNT(CASE WHEN np.demos = false THEN 1 END) as utenti_demos_false,
        COUNT(CASE WHEN np.demos IS NULL THEN 1 END) as utenti_demos_null
      FROM users u
      LEFT JOIN notifiche_preferenze np ON u.id = np.user_id
      LEFT JOIN LATERAL (
        SELECT ARRAY(
          SELECT DISTINCT tok
          FROM (
            SELECT d.fcm_token as tok
            FROM user_devices d
            WHERE d.user_id = u.id
              AND d.is_active = TRUE
              AND d.fcm_token IS NOT NULL
              AND btrim(d.fcm_token) <> ''
            UNION
            SELECT unnest(COALESCE(u.fcm_tokens, ARRAY[]::text[])) as tok
          ) merged
          WHERE tok IS NOT NULL AND btrim(tok) <> ''
        ) as tokens
      ) tokens ON TRUE
      WHERE array_length(COALESCE(tokens.tokens, ARRAY[]::text[]), 1) > 0
    `);
    
    res.json({
      success: true,
      data: {
        utente: {
          id: user.id,
          email: user.email,
          nome: user.nome,
          cognome: user.cognome,
          status: user.status
        },
        preferenze: {
          demos_attivo: user.demos_preferenza === true,
          demos_value: user.demos_preferenza,
          demos_type: user.demos_type,
          demos_status: user.demos_status,
          pref_user_id: user.pref_user_id,
          ha_fcm_tokens: user.ha_fcm_tokens,
          numero_token_fcm: fcmTokens.length,
          ricevera_notifiche: user.ricevera_notifiche
        },
        token_fcm: fcmTokens.length > 0 ? fcmTokens.map(t => ({
          preview: t ? `${t.substring(0, 30)}...` : null,
          length: t ? t.length : 0
        })) : [],
        statistiche_globali: allUsersResult.rows[0]
      }
    });
  } catch (error) {
    console.error('❌ Errore nel debug notifiche Demos:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      details: error.message
    });
  }
});

// GET /api/ultima-comunicazione - Ultima comunicazione dell'utente
router.get('/ultima-comunicazione', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'ID utente richiesto'
      });
    }
    
    // Prima verifica se l'utente esiste nella tabella users
    const userCheck = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [user_id]
    );
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    // Cerca comunicazioni per questo utente in notifiche_voti_comuni
    const result = await pool.query(
      `SELECT 
        c.*,
        COALESCE(SUM(CASE WHEN r.tipo = 'like' THEN 1 ELSE 0 END), 0) as likes,
        COALESCE(SUM(CASE WHEN r.tipo = 'dislike' THEN 1 ELSE 0 END), 0) as dislikes,
        COALESCE(c.data, c.data_creazione) as data_creazione
      FROM notifiche_voti_comuni c
      LEFT JOIN reazioni r ON c.id::text = r.comunicazione_id
      WHERE c.id_utente = $1::uuid
      GROUP BY c.id
      ORDER BY COALESCE(c.data, c.data_creazione) DESC
      LIMIT 1`,
      [user_id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Nessuna comunicazione trovata per questo utente'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nel recupero ultima comunicazione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
