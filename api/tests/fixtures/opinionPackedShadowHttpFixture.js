'use strict';

/**
 * TEST-ONLY shadow API. NEVER import from DEMOS server/routes/runtime.
 * It simulates BYTEA opinion storage behind existing Android/web JSON fields
 * using an in-memory Map and fake authentication/consent. No SQL, network
 * persistence, Supabase, RLS, real JWT, or genuine revocation workflow.
 *
 * Business and response comparisons must run against the ACTUAL legacy
 * Express routes in opinionCodecHttpContract.test.js, not this model alone.
 */
const express = require('express');
const {
  createCatalogRegistry, encodeEnvelope, decodeLegacyQuestionRows,
  decodeEnvelope, parseLegacyOpinionPost
} = require('../../utils/opinionCodecEnvelope');

function mountSyntheticPackedOpinionApi(app, { encoding, questions, catalogIds, consents }) {
  if (!['fixed', 'trimmed', 'sparse'].includes(encoding)) {
    throw new RangeError('Shadow encoding must be fixed, trimmed or sparse');
  }
  let registry = createCatalogRegistry([{ version: 1, ids: catalogIds }]);
  const packedByUser = new Map();
  const router = express.Router();

  router.use((req, res, next) => {
    const token = req.get('authorization')?.replace(/^Bearer /, '');
    if (!['account-a', 'account-b'].includes(token)) {
      return res.status(401).json({ success: false, error: 'Autenticazione richiesta' });
    }
    req.syntheticAccount = token;
    next();
  });

  router.get('/opinioni-list', (req, res) => {
    res.set('Cache-Control', 'private, no-store, max-age=0');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.vary('Authorization');
    delete req.headers['if-none-match'];
    delete req.headers['if-modified-since'];

    const { grado } = req.query;
    if (!grado) {
      return res.status(400).json({ success: false, error: 'Grado richiesto',
        message: 'Il parametro grado è obbligatorio' });
    }
    const selected = questions.filter(q => q.gradi_opinione.includes(grado));
    if (!selected.length) {
      return res.json({ success: true, data: [],
        message: 'Nessuna opinione trovata per il grado: ' + grado });
    }

    const stored = packedByUser.get(req.syntheticAccount);
    const decoded = stored
      ? decodeLegacyQuestionRows(registry, stored, selected.map(q => q.id))
      : selected.map(q => ({ id: q.id, userAnswer: null }));
    const answers = new Map(decoded.map(row => [row.id, row.userAnswer]));
    return res.json({
      success: true,
      data: selected.map(q => ({
        id: q.id, text: q.text, grado: q.gradi_opinione,
        userAnswer: answers.get(q.id)
      })),
      grado, total: selected.length
    });
  });

  router.post('/opinioni/salva', (req, res) => {
    if (consents.get(req.syntheticAccount) !== true) {
      return res.status(403).json({ success: false, error: 'Consenso richiesto',
        message: 'Per salvare opinioni politiche è necessario un consenso esplicito attivo.',
        consent_required: true });
    }
    let changes;
    try {
      changes = parseLegacyOpinionPost(req.body, registry);
    } catch {
      // The real route has more nuanced per-field partial errors. The shadow
      // intentionally exercises only valid writes and all-invalid rejection.
      return res.status(400).json({ success: false,
        error: 'Nessuna opinione valida da salvare' });
    }

    const previous = packedByUser.get(req.syntheticAccount);
    const existing = previous ? decodeEnvelope(registry, previous) : {};
    const next = encodeEnvelope(registry, {
      version: registry.latestVersion, encoding,
      answers: { ...existing, ...changes }
    });
    packedByUser.set(req.syntheticAccount, next);
    return res.json({
      success: true,
      message: 'Opinioni salvate con successo',
      savedCount: Object.keys(changes).length,
      errorCount: 0,
      notificationsCreated: 0,
      timestamp: new Date().toISOString()
    });
  });

  // The test-specific prefix is NOT a DEMOS endpoint or product feature.
  app.use('/_synthetic/' + encoding + '/api', router);
  return {
    encoding,
    snapshot(account) { return packedByUser.get(account) ?? null; },
    get catalogVersion() { return registry.latestVersion; },
    promote(ids) {
      const current = registry.versions.map(version => ({
        version, ids: registry.get(version).ids
      }));
      const nextVersion = registry.latestVersion + 1;
      registry = createCatalogRegistry([...current, { version: nextVersion, ids }]);
    },
    erase(account) { packedByUser.delete(account); }
  };
}

module.exports = { mountSyntheticPackedOpinionApi };
