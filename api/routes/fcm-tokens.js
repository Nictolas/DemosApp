const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
require('dotenv').config();

// Usa il pool centralizzato ottimizzato
const pool = getPool();

function normalizeFcmToken(token) {
  return typeof token === 'string' ? token.trim() : '';
}

function isValidFcmToken(token) {
  const normalizedToken = normalizeFcmToken(token);
  return normalizedToken.length > 100 && !normalizedToken.startsWith('web_');
}

function isMissingLegacyFcmColumn(error) {
  return error?.code === '42703';
}

// SQLSTATE 42703 aborts a PostgreSQL transaction unless the failed
// optional-legacy operation is recovered within a savepoint.
async function withOptionalLegacyColumn(client, sql, params, whenMissing) {
  await client.query('SAVEPOINT fcm_legacy_column');
  try {
    const result = await client.query(sql, params);
    await client.query('RELEASE SAVEPOINT fcm_legacy_column');
    return result;
  } catch (error) {
    if (!isMissingLegacyFcmColumn(error)) throw error;
    await client.query('ROLLBACK TO SAVEPOINT fcm_legacy_column');
    await client.query('RELEASE SAVEPOINT fcm_legacy_column');
    return whenMissing(client);
  }
}

async function getLegacyTokens(client, userId) {
  const result = await withOptionalLegacyColumn(
    client,
    'SELECT COALESCE(fcm_tokens, ARRAY[]::text[]) AS fcm_tokens FROM public.users WHERE id = $1',
    [userId],
    async (connection) => {
      const user = await connection.query('SELECT 1 FROM public.users WHERE id = $1', [userId]);
      return { rows: user.rows.length ? [{ fcm_tokens: [] }] : [] };
    }
  );
  return result.rows.length ? (result.rows[0].fcm_tokens || []) : null;
}

async function updateLegacyTokens(client, userId, tokens) {
  let exists = true;
  await withOptionalLegacyColumn(
    client,
    'UPDATE public.users SET fcm_tokens = $1, updated_at = NOW() WHERE id = $2',
    [tokens, userId],
    async () => { exists = false; }
  );
  return exists;
}

async function upsertUserDeviceToken(client, userId, token) {
  await client.query(
    `INSERT INTO public.user_devices (user_id, fcm_token, is_active, last_seen_at, created_at, updated_at)
     VALUES ($1, $2, TRUE, NOW(), NOW(), NOW())
     ON CONFLICT (fcm_token) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       is_active = TRUE,
       last_seen_at = NOW(),
       updated_at = NOW()`,
    [userId, token]
  );
}

async function deactivateOtherUserDeviceTokens(client, userId, tokenToKeep) {
  await client.query(
    `UPDATE public.user_devices
     SET is_active = FALSE, updated_at = NOW()
     WHERE user_id = $1 AND fcm_token <> $2`,
    [userId, tokenToKeep]
  );
}

async function deactivateUserDeviceToken(client, userId, token) {
  await client.query(
    `UPDATE public.user_devices
     SET is_active = FALSE, updated_at = NOW()
     WHERE user_id = $1 AND btrim(fcm_token) = $2`,
    [userId, token]
  );
}

// Serialize overlapping FCM actions on each account's canonical row.
// Release the database client even if a step or COMMIT fails.
async function withLockedFcmUser(userId, operation) {
  const client = await pool.connect();
  let inTransaction = false;
  try {
    await client.query('BEGIN');
    inTransaction = true;
    const user = await client.query(
      'SELECT id FROM public.users WHERE id = $1 FOR UPDATE',
      [userId]
    );
    if (!user.rows.length) {
      await client.query('ROLLBACK');
      inTransaction = false;
      return null;
    }
    const result = await operation(client);
    await client.query('COMMIT');
    inTransaction = false;
    return result;
  } catch (error) {
    if (inTransaction) {
      try { await client.query('ROLLBACK'); }
      catch { /* Original error is the useful failure; pool owns client health. */ }
    }
    throw error;
  } finally {
    client.release();
  }
}

// POST /api/fcm-tokens - Salva o aggiorna token FCM per l'utente
router.post('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const token = normalizeFcmToken(req.body?.token);

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

    console.log(`📱 Salvataggio token FCM per utente: ${userId}`);

    // Verifica se la richiesta viene da un dispositivo mobile
    // TOKEN SOLO PER MOBILE: Ignora i token da desktop/browser
    const userAgent = req.headers['user-agent'] || '';
    const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

    console.log(`   📱 User-Agent: ${userAgent.substring(0, 100)}...`);
    console.log(`   📱 Dispositivo rilevato: ${isMobile ? 'Mobile ✅' : 'Desktop ❌ (ignorato)'}`);

    // Se non è mobile, ignora il token (non salvarlo)
    if (!isMobile) {
      console.log(`   ⚠️ Token da desktop ignorato. Solo token mobile vengono salvati.`);
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

    const registration = await withLockedFcmUser(userId, async (client) => {
      const existingTokens = await getLegacyTokens(client, userId);
      // Filtra i token validi (solo quelli che sono token FCM reali, non device ID fittizi)
      const validExistingTokens = existingTokens.filter(isValidFcmToken);

      // TOKEN SOLO PER MOBILE: Mantieni sempre solo 1 token (il più recente)
      // Quando viene aggiunto un nuovo token mobile, rimuovi tutti i vecchi
      // Questo garantisce che ci sia sempre solo il token mobile più recente
      let updatedTokens;
      if (validExistingTokens.some(existing => normalizeFcmToken(existing) === token)) {
        // Token già presente, mantieni solo questo token (rimuovi eventuali altri)
        updatedTokens = [token];
        if (validExistingTokens.length > 1) {
          console.log(`   🧹 Rimossi ${validExistingTokens.length - 1} token extra (manteniamo solo questo token mobile)`);
          // Never log raw or partial registration tokens.
        } else {
          console.log('   ℹ️ Token già presente, nessuna modifica');
        }
      } else {
        // Nuovo token mobile: rimuovi tutti i vecchi
        updatedTokens = [token]; // Solo il nuovo token, rimuovi tutti i vecchi

        if (validExistingTokens.length > 0) {
          console.log(`   🧹 Rimossi ${validExistingTokens.length} token vecchi (manteniamo solo 1 token mobile)`);
          // Never log raw or partial registration tokens.
        }

        console.log(`   ✅ Token mobile aggiunto. Totale token: 1 (solo mobile)`);

        // Se abbiamo rimosso token vecchi non validi, loggalo
        const removedInvalidCount = existingTokens.length - validExistingTokens.length;
        if (removedInvalidCount > 0) {
          console.log(`   🧹 Rimossi ${removedInvalidCount} token non validi o duplicati`);
        }
      }

      // Salva su storage legacy (transitorio)
      await updateLegacyTokens(client, userId, updatedTokens);

      // Salva su nuovo storage (user_devices): mantieni un solo token attivo per utente
      await upsertUserDeviceToken(client, userId, token);
      await deactivateOtherUserDeviceTokens(client, userId, token);
      return { tokenCount: updatedTokens.length };
    });
    if (registration === null) {
      return res.status(404).json({ success: false, error: 'Utente non trovato' });
    }

    console.log(`✅ Token FCM salvato con successo per utente ${userId}`);

    res.json({
      success: true,
      message: 'Token FCM salvato con successo',
      data: {
        userId,
        tokenCount: registration.tokenCount
      }
    });
  } catch (error) {
    // Database errors may contain token values: never expose them to
    // clients or application logs.
    console.error('❌ Errore nel salvataggio token FCM:', error?.code || 'internal_error');
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
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

    console.log(`🧹 Pulizia token FCM duplicati per utente: ${userId}`);

    const cleanupResult = await withLockedFcmUser(userId, async (client) => {
      const existingTokens = await getLegacyTokens(client, userId);
      // Filtra i token validi
      const validTokens = existingTokens.filter(isValidFcmToken);

      // Mantieni solo l'ultimo token (più recente)
      const cleanedTokens = validTokens.length > 0
        ? [normalizeFcmToken(validTokens[validTokens.length - 1])]
        : [];

      if (validTokens.length > 1) {
        const removedCount = validTokens.length - 1;
        console.log(`   🧹 Rimossi ${removedCount} token duplicati`);
        // Never log token prefixes during cleanup.
        console.log('   ✅ Mantenuto solo il token più recente');
      } else {
        console.log(`   ℹ️ Nessun token duplicato trovato (${validTokens.length} token presente)`);
      }

      // Salva i token puliti su storage legacy (transitorio)
      await updateLegacyTokens(client, userId, cleanedTokens);

      // Allinea nuovo storage: disattiva tutti i token user, poi attiva solo il più recente (se presente)
      await client.query(
        `UPDATE public.user_devices SET is_active = FALSE, updated_at = NOW() WHERE user_id = $1`,
        [userId]
      );
      if (cleanedTokens.length > 0) {
        await upsertUserDeviceToken(client, userId, cleanedTokens[0]);
      }
      return { tokenCountBefore: validTokens.length, tokenCountAfter: cleanedTokens.length, removedCount: validTokens.length-cleanedTokens.length };
    });
    if (cleanupResult === null) {
      return res.status(404).json({ success: false, error: 'Utente non trovato' });
    }

    res.json({
      success: true,
      message: 'Token FCM puliti con successo',
      data: {
        userId,
        tokenCountBefore: cleanupResult.tokenCountBefore,
        tokenCountAfter: cleanupResult.tokenCountAfter,
        removedCount: cleanupResult.removedCount
      }
    });
  } catch (error) {
    console.error('❌ Errore nella pulizia token FCM:', error?.code || 'internal_error');
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// DELETE /api/fcm-tokens/:token - Rimuovi un token FCM specifico
router.delete('/:token', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const token = normalizeFcmToken(req.params.token);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Utente non autenticato'
      });
    }

    const removal = await withLockedFcmUser(userId, async (client) => {
      const existingTokens = await getLegacyTokens(client, userId);
      // Remove historical legacy copies with outer whitespace too.
      const updatedTokens = existingTokens.filter(t => normalizeFcmToken(t) !== token);

      // Salva i token aggiornati
      await updateLegacyTokens(client, userId, updatedTokens);

      // Nuovo storage: disattiva token specifico
      await deactivateUserDeviceToken(client, userId, token);
      return { removed: true };
    });
    if (removal === null) {
      return res.status(404).json({ success: false, error: 'Utente non trovato' });
    }

    res.json({
      success: true,
      message: 'Token FCM rimosso con successo'
    });
  } catch (error) {
    console.error('❌ Errore nella rimozione token FCM:', error?.code || 'internal_error');
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;

