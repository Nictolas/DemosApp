const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const {
  isCivicPushEnabled,
  reconcileCivicTopicsForUser,
  unsubscribeCivicTopicsForToken,
} = require('../services/civicPushTopics');
const {
  blockCivicDeliveryFromPool,
  blockCivicDeliveryOnRevocationFailure,
  withCivicPushDeliveryLock,
} = require('../services/civicPushDeliveryGuard');
const {
  onlyTokensNotOwnedByOthers,
  onlyTokensNotRegisteredToOthers,
  upsertCleanupOwnedOrUnassignedToken,
  getActiveCivicUserDeviceTokens,
  getSupersededCivicTokens,
} = require('../services/civicFcmTokenOwnership');
const { runCivicPreferenceSaveAtomic } = require('../services/civicPreferenceAtomicSave');
const {getLegacyTokens,updateLegacyTokens}=require('../services/civicLegacyFcmStorage');
require('dotenv').config();

// Usa il pool centralizzato ottimizzato
const pool = getPool();

// Device ownership and topic membership are one guarded mutation. Returning a
// success HTTP response is permitted only AFTER COMMIT and advisory unlock.
// Firebase cannot participate in the SQL transaction: any unconfirmed outcome
// forces the global civic delivery guard to remain blocked.
async function withAtomicFcmMutation(work) {
  const enabled = isCivicPushEnabled();
  try {
    return await withCivicPushDeliveryLock(pool, db =>
      runCivicPreferenceSaveAtomic(db, () => work(db), { enabled }),
      { enabled });
  } catch {
    if (enabled) {
      // The first connection may have been discarded after an uncertain
      // rollback. Retry the emergency guard after releasing the old lock.
      try {
        await blockCivicDeliveryFromPool(pool);
      } catch {
        console.error('CIVIC_FCM_TOKEN_GUARD_RECOVERY_FAILED');
      }
    }
    throw new Error('CIVIC_FCM_TOKEN_MUTATION_UNCONFIRMED');
  }
}
 
async function unsubscribeCivicTokenOrBlock(token, lockedClient = null) {
  try {
    await unsubscribeCivicTopicsForToken(token);
  } catch {
    // If Firebase fails, do not allow new topic messages until a manual repair.
    if (lockedClient) {
      await blockCivicDeliveryOnRevocationFailure(lockedClient);
    } else {
      await blockCivicDeliveryFromPool(pool);
    }
    throw new Error('CIVIC_TOPIC_SYNC_FAILED');
  }
}


function isValidFcmToken(token) {
  return !!(token && token.trim() && token.length > 100 && !token.startsWith('web_'));
}

async function upsertUserDeviceToken(userId, token, db = pool) {
  await db.query(
    `INSERT INTO user_devices (user_id, fcm_token, is_active, last_seen_at, created_at, updated_at)
     VALUES ($1, $2, TRUE, NOW(), NOW(), NOW())
     ON CONFLICT (fcm_token) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       is_active = TRUE,
       last_seen_at = NOW(),
       updated_at = NOW()`,
    [userId, token]
  );
}

async function deactivateOtherUserDeviceTokens(userId, tokenToKeep, db = pool) {
  await db.query(
    `UPDATE user_devices
     SET is_active = FALSE, updated_at = NOW()
     WHERE user_id = $1
       AND fcm_token <> $2`,
    [userId, tokenToKeep]
  );
}

async function deactivateUserDeviceToken(userId, token, db = pool) {
  await db.query(
    `UPDATE user_devices
     SET is_active = FALSE, updated_at = NOW()
     WHERE user_id = $1 AND fcm_token = $2`,
    [userId, token]
  );
}

// Unsubscribe dei vecchi token PRIMA di revocarli o associarli a un altro account.
async function revokeSupersededCivicTokens(userId, tokenToKeep, legacyTokens, db = pool) {
  if (!isCivicPushEnabled()) return;
  const superseded = await getSupersededCivicTokens(db,userId,tokenToKeep);
  // Legacy users.fcm_tokens may still contain an FCM token reassigned to
  // a different user_devices owner. Never unsubscribe that new user's topic.
  // The tokenToKeep transfer is intentional: its previous owner must be
  // unsubscribed before this user claims it.
  const staleSafeLegacy = await onlyTokensNotOwnedByOthers(
    db, userId, legacyTokens.filter((value) => value !== tokenToKeep));
  const replaced = new Set([
    ...superseded,
    ...staleSafeLegacy,
  ]);
  for (const token of replaced) {
    if (isValidFcmToken(token)) await unsubscribeCivicTokenOrBlock(token, db);
  }
}

// POST /api/fcm-tokens - Salva o aggiorna token FCM per l'utente
router.post('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { token } = req.body;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Utente non autenticato'
      });
    }
    
    if (!isValidFcmToken(token)) {
      return res.status(400).json({
        success: false,
        error: 'Token FCM non valido'
      });
    }
    
    
    // Verifica se la richiesta viene da un dispositivo mobile
    // TOKEN SOLO PER MOBILE: Ignora i token da desktop/browser
    const userAgent = req.headers['user-agent'] || '';
    const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    
    
    // Se non è mobile, ignora il token (non salvarlo)
    if (!isMobile) {
      console.log('[fcm-tokens] dispositivo desktop ignorato');
      return res.json({
        success: true,
        message: 'Token desktop ignorato (solo token mobile vengono salvati)',
        data: {
          userId,
          tokenCount: 0,
          ignored: true,
          reason: 'desktop_device'
        }
      });
    }
    
    const outcome = await withAtomicFcmMutation(async (db) => {
    const legacyState = await getLegacyTokens(userId, db);
    if (legacyState === null) {
      return { status: 404, body: { success: false, error: 'Utente non trovato' } };
    }
    const existingTokens = legacyState.tokens;

    // Filtra i token validi (solo quelli che sono token FCM reali, non device ID fittizi)
    const validExistingTokens = existingTokens.filter(t => 
      isValidFcmToken(t)
    );
    
    // TOKEN SOLO PER MOBILE: Mantieni sempre solo 1 token (il più recente)
    // Quando viene aggiunto un nuovo token mobile, rimuovi tutti i vecchi
    // Questo garantisce che ci sia sempre solo il token mobile più recente
    let updatedTokens;
    if (validExistingTokens.includes(token)) {
      // Token già presente, mantieni solo questo token (rimuovi eventuali altri)
      updatedTokens = [token];
      if (validExistingTokens.length > 1) {
        console.log(`   🧹 Rimossi ${validExistingTokens.length - 1} token extra (manteniamo solo questo token mobile)`);
      } else {
        console.log('   ℹ️ Token già presente, nessuna modifica');
      }
    } else {
      // Nuovo token mobile: rimuovi tutti i vecchi
      updatedTokens = [token]; // Solo il nuovo token, rimuovi tutti i vecchi
      
      if (validExistingTokens.length > 0) {
        console.log(`   🧹 Rimossi ${validExistingTokens.length} token vecchi (manteniamo solo 1 token mobile)`);
      }
      
      console.log(`   ✅ Token mobile aggiunto. Totale token: 1 (solo mobile)`);
      
      // Se abbiamo rimosso token vecchi non validi, loggalo
      const removedInvalidCount = existingTokens.length - validExistingTokens.length;
      if (removedInvalidCount > 0) {
        console.log(`   🧹 Rimossi ${removedInvalidCount} token non validi o duplicati`);
      }
    }
    
    // La sostituzione degli ID dispositivo non deve lasciare topic su account vecchi.
    // In caso di errore Firebase, non cambiamo proprietario al token.
    await revokeSupersededCivicTokens(userId, token, validExistingTokens, db);

    // Salva su storage legacy (transitorio)
    await updateLegacyTokens(userId, updatedTokens, db, legacyState.hasColumn);

    // Salva su nuovo storage (user_devices): mantieni un solo token attivo per utente
    await upsertUserDeviceToken(userId, token, db);
    await deactivateOtherUserDeviceTokens(userId, token, db);

    // Dopo il salvataggio il server legge le preferenze effettive dell'utente.
    await reconcileCivicTopicsForUser(db, userId, { lockedClient: db });

    
    return { status: 200, body: {
      success: true,
      message: 'Token FCM salvato con successo',
      data: {
        userId,
        tokenCount: updatedTokens.length
      }
    } };
    });
    return res.status(outcome.status).json(outcome.body);
  } catch (error) {
    console.error('[fcm-tokens] registrazione non riuscita (dettagli omessi)');
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      details: 'Operazione non completata'
    });
  }
});

// POST /api/fcm-tokens/cleanup - Rimuovi token duplicati, mantieni solo l'ultimo (mobile)
router.post('/cleanup', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Utente non autenticato'
      });
    }
    
    
    const outcome = await withAtomicFcmMutation(async (db) => {
    const legacyState = await getLegacyTokens(userId, db);
    if (legacyState === null) {
      return { status: 404, body: { success: false, error: 'Utente non trovato' } };
    }
    const existingTokens = legacyState.tokens;

    if (!legacyState.hasColumn) {
      // Do not interpret a retired users.fcm_tokens column as having zero
      // registered devices. Canonical user_devices must be left intact.
      return { status: 200, body: {
        success: true, message: 'Nessuna pulizia necessaria',
        data: { userId, skipped: true }
      } };
    }

    // Filtra i token validi
    const validTokens = existingTokens.filter(t => 
      isValidFcmToken(t)
    );
    
    // Legacy data is not proof of current ownership. A token may have moved
    // to another account and remained in this old user's array. Reject both
    // active and inactive foreign registrations before choosing the survivor.
    const eligibleTokens = await onlyTokensNotRegisteredToOthers(db, userId, validTokens);
    // The canonical active device is authoritative even when the legacy
    // array is empty or stale. Otherwise cleanup could unsubscribe and
    // deactivate a correctly registered device, silently losing consent.
    const activeCanonical = await getActiveCivicUserDeviceTokens(db, userId);
    const canonicalSurvivor = activeCanonical.find(isValidFcmToken);
    const survivor = canonicalSurvivor ||
      (eligibleTokens.length ? eligibleTokens[eligibleTokens.length - 1] : null);
    const cleanedTokens = survivor ? [survivor] : [];
    const legacyRemovedCount = validTokens.filter(
      token => !cleanedTokens.includes(token)).length;
    
    if (validTokens.length > 1) {
      const removedCount = validTokens.length - 1;
      console.log(`   🧹 Rimossi ${removedCount} token duplicati`);
    } else {
      console.log(`   ℹ️ Nessun token duplicato trovato (${validTokens.length} token presente)`);
    }
    
    if (isCivicPushEnabled()) {
      const removed = new Set([
        ...validTokens.filter(token => !cleanedTokens.includes(token)),
        ...activeCanonical.filter(token => !cleanedTokens.includes(token))
      ]);
      // Old legacy records are not reliable evidence of any device owner's
      // permissions, including INACTIVE devices belonging to others.
      const revocable = await onlyTokensNotRegisteredToOthers(db, userId, [...removed]);
      for (const previous of revocable) {
        if (isValidFcmToken(previous)) await unsubscribeCivicTokenOrBlock(previous, db);
      }
    }

    // Salva i token puliti su storage legacy (transitorio)
    await updateLegacyTokens(userId, cleanedTokens, db, legacyState.hasColumn);

    // Allinea nuovo storage: disattiva tutti i token user, poi attiva solo il più recente (se presente)
    await db.query(
      `UPDATE user_devices SET is_active = FALSE, updated_at = NOW() WHERE user_id = $1`,
      [userId]
    );
    if (cleanedTokens.length > 0) {
      await upsertCleanupOwnedOrUnassignedToken(db, userId, cleanedTokens[0]);
    }
    await reconcileCivicTopicsForUser(db, userId, { lockedClient: db });

    return { status: 200, body: {
      success: true,
      message: 'Token FCM puliti con successo',
      data: {
        userId,
        tokenCountBefore: validTokens.length,
        tokenCountAfter: cleanedTokens.length,
        removedCount: legacyRemovedCount
      }
    } };
    });
    return res.status(outcome.status).json(outcome.body);
  } catch (error) {
    console.error('[fcm-tokens] pulizia non riuscita (dettagli omessi)');
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      details: 'Operazione non completata'
    });
  }
});

// DELETE /api/fcm-tokens/session - Logout web e native: revoca l'unico device
// attivo del modello attuale, senza conoscere il token lato client.
router.delete('/session', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Non autenticato' });

    const outcome = await withAtomicFcmMutation(async (db) => {
    const registered = await db.query(
      'SELECT fcm_token FROM user_devices WHERE user_id = $1 AND is_active = TRUE',
      [userId]
    );
    const legacyState = await getLegacyTokens(userId, db);
    if (legacyState === null) return { status: 404, body: { success: false, error: 'Utente non trovato' } };
    const legacy = legacyState.tokens;

    if (isCivicPushEnabled()) {
      const revocable = await onlyTokensNotOwnedByOthers(
        db, userId, [...registered.rows.map(r => r.fcm_token), ...legacy]);
      for (const token of revocable) {
        if (isValidFcmToken(token)) await unsubscribeCivicTokenOrBlock(token, db);
      }
    }
    await db.query(
      'UPDATE user_devices SET is_active = FALSE, updated_at = NOW() WHERE user_id = $1',
      [userId]
    );
    await updateLegacyTokens(userId, [], db, legacyState.hasColumn);
    return { status: 200, body: { success: true } };
    });
    return res.status(outcome.status).json(outcome.body);
  } catch {
    res.status(503).json({ success: false, error: 'Impossibile completare la revoca del dispositivo' });
  }
});

// DELETE /api/fcm-tokens/:token - Rimuovi un token FCM specifico
router.delete('/:token', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { token } = req.params;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Utente non autenticato'
      });
    }
    
    const outcome = await withAtomicFcmMutation(async (db) => {
    const legacyState = await getLegacyTokens(userId, db);
    if (legacyState === null) {
      return { status: 404, body: { success: false, error: 'Utente non trovato' } };
    }
    const existingTokens = legacyState.tokens;

    // Mai agire su topic di un token che non appartiene all'utente autenticato.
    const device = await db.query(
      'SELECT 1 FROM user_devices WHERE user_id = $1 AND fcm_token = $2 AND is_active = TRUE',
      [userId, token]
    );
    const isOwned = existingTokens.includes(token) || device.rows.length > 0;
    if (isCivicPushEnabled() && isOwned && isValidFcmToken(token)) {
      const revocable = await onlyTokensNotOwnedByOthers(db, userId, [token]);
      if (revocable.includes(token)) await unsubscribeCivicTokenOrBlock(token, db);
    }

    // Rimuovi il token
    const updatedTokens = existingTokens.filter(t => t !== token);
    
    // Salva i token aggiornati
    await updateLegacyTokens(userId, updatedTokens, db, legacyState.hasColumn);

    // Nuovo storage: disattiva token specifico
    await deactivateUserDeviceToken(userId, token, db);
    
    return { status: 200, body: {
      success: true,
      message: 'Token FCM rimosso con successo'
    } };
    });
    return res.status(outcome.status).json(outcome.body);
  } catch (error) {
    console.error('[fcm-tokens] revoca non riuscita (dettagli omessi)');
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;

