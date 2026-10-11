'use strict';

const { E2E_ACTIVIST_USER_ID, E2E_ADMIN_USER_ID } = require('./stagingMigrate');

async function expectStatus(response, expected, label) {
  if (response.status !== expected) {
    let details = '';
    try { details = JSON.stringify(await response.json()); } catch (_) {}
    throw new Error(`${label}: expected ${expected}, got ${response.status}${details ? ` ${details}` : ''}`);
  }
  return response;
}

async function runStagingMutationSelfTest({
  env = process.env,
  port = process.env.PORT || 3001,
  fetchImpl = global.fetch,
  tokenFactory,
  logger = console,
} = {}) {
  if (env.DEMOS_STAGING_MUTATION_E2E !== 'true') return { mode: 'disabled', passed: 0, total: 6 };
  if (env.NODE_ENV !== 'staging') throw new Error('DEMOS_STAGING_MUTATION_E2E is allowed only with NODE_ENV=staging');
  if (typeof fetchImpl !== 'function') throw new Error('fetch is required for staging mutation E2E');

  const makeToken = tokenFactory || ((payload) => require('../utils/jwt').generateAccessToken(payload));
  const activistToken = makeToken({ userId: E2E_ACTIVIST_USER_ID });
  const adminToken = makeToken({ userId: E2E_ADMIN_USER_ID });
  const baseUrl = `http://127.0.0.1:${port}`;
  const auth = (token) => ({ Authorization: `Bearer ${token}`, 'content-type': 'application/json' });
  const marker = `DEMOS-STAGING-E2E-${Date.now()}`;
  let eventId = null;
  let passed = 0;

  try {
    let response = await fetchImpl(`${baseUrl}/api/eventi`, {
      method: 'POST', headers: auth(activistToken),
      body: JSON.stringify({ nome_evento: marker, tipologia_evento: 'Altro', paese_evento: 'Italia', regione_evento: 'Toscana', provincia_evento: 'Pisa', comune_evento: 'Pisa', giorno_inizio: '2027-01-15', orario_inizio: '18:00' }),
      signal: AbortSignal.timeout(8000),
    });
    await expectStatus(response, 202, 'candidate event create');
    let body = await response.json();
    eventId = body?.data?.id;
    if (!eventId || body?.approval?.status !== 'PENDING') throw new Error('candidate event create did not return PENDING event');
    logger.log(`[staging-mutation-e2e] create -> PENDING PASS (${eventId})`); passed += 1;

    response = await fetchImpl(`${baseUrl}/api/eventi/${eventId}`, { signal: AbortSignal.timeout(8000) });
    await expectStatus(response, 404, 'pending event public visibility');
    logger.log('[staging-mutation-e2e] pending hidden publicly PASS'); passed += 1;

    response = await fetchImpl(`${baseUrl}/api/eventi/admin/pending`, { headers: auth(adminToken), signal: AbortSignal.timeout(8000) });
    await expectStatus(response, 200, 'admin pending queue');
    body = await response.json();
    if (!Array.isArray(body?.data) || !body.data.some((item) => String(item.id) === String(eventId) && item.approval_status === 'PENDING')) throw new Error('event missing from admin pending queue');
    logger.log('[staging-mutation-e2e] admin pending queue PASS'); passed += 1;

    response = await fetchImpl(`${baseUrl}/api/eventi/${eventId}/approve`, { method: 'POST', headers: auth(adminToken), signal: AbortSignal.timeout(8000) });
    await expectStatus(response, 200, 'admin approval');
    body = await response.json();
    if (body?.data?.approval_status !== 'APPROVED') throw new Error('admin approval did not persist APPROVED');
    logger.log('[staging-mutation-e2e] admin approve PASS'); passed += 1;

    response = await fetchImpl(`${baseUrl}/api/eventi/${eventId}`, { signal: AbortSignal.timeout(8000) });
    await expectStatus(response, 200, 'approved event public visibility');
    body = await response.json();
    if (body?.data?.approval_status !== 'APPROVED') throw new Error('approved event is not publicly APPROVED');
    logger.log('[staging-mutation-e2e] approved visible publicly PASS'); passed += 1;

    response = await fetchImpl(`${baseUrl}/api/eventi/${eventId}`, { method: 'DELETE', headers: auth(adminToken), signal: AbortSignal.timeout(8000) });
    await expectStatus(response, 200, 'event cleanup');
    response = await fetchImpl(`${baseUrl}/api/eventi/${eventId}`, { signal: AbortSignal.timeout(8000) });
    await expectStatus(response, 404, 'event cleanup verification');
    eventId = null;
    logger.log('[staging-mutation-e2e] cleanup verified PASS'); passed += 1;

    logger.log(`[staging-mutation-e2e] PASS ${passed}/6`);
    return { mode: 'mutation-e2e', passed, total: 6 };
  } finally {
    if (eventId) {
      try {
        const cleanupResponse = await fetchImpl(`${baseUrl}/api/eventi/${eventId}`, { method: 'DELETE', headers: auth(adminToken), signal: AbortSignal.timeout(8000) });
        if (![200, 404].includes(cleanupResponse.status)) throw new Error(`cleanup returned HTTP ${cleanupResponse.status}`);
        const verification = await fetchImpl(`${baseUrl}/api/eventi/${eventId}`, { signal: AbortSignal.timeout(8000) });
        await expectStatus(verification, 404, 'fallback cleanup verification');
      } catch (error) {
        logger.error(`[staging-mutation-e2e] cleanup FAILED for event ${eventId}: ${error.message}`);
        throw error;
      }
    }
  }
}

module.exports = { runStagingMutationSelfTest };
