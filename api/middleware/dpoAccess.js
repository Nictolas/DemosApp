'use strict';
const { pool } = require('./auth');
const { isDpoGrantAllowed } = require('../utils/dpoAuthorization');

/**
 * Must follow verifyToken. Recheck authorization against the DB every time:
 * auth subject caching must not delay revocation of sensitive DPO access.
 * No administrative capability, shared token, or legacy role grants access.
 */
async function requireDpo(req, res, next) {
  if (!req.user?.id) {
    return res.status(401).json({ success: false, error: 'Autenticazione richiesta' });
  }

  if (req.user.isAdmin === true) {
    return res.status(403).json({ success: false, error: 'Ruolo DPO separato da Admin' });
  }

  try {
    const result = await pool.query(
      "SELECT is_dpo, is_admin, status FROM public.users WHERE id = $1 LIMIT 1",
      [req.user.id]
    );

    if (!isDpoGrantAllowed(result.rows?.[0])) {
      return res.status(403).json({ success: false, error: 'Accesso DPO non autorizzato' });
    }

    return next();
  } catch (_) {
    // Includes migration missing / database failure: never allow access.
    console.error('DPO authorization unavailable');
    return res.status(503).json({ success: false, error: 'Verifica permessi DPO non disponibile' });
  }
}

module.exports = { requireDpo };
