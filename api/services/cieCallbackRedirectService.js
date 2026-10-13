function getTrustedFrontendBaseUrl() {
  const raw = process.env.FRONTEND_URL;
  if (!raw) throw new Error('FRONTEND_URL non configurato');

  let url;
  try {
    url = new URL(raw);
  } catch (_error) {
    throw new Error('FRONTEND_URL non valido');
  }

  if (url.protocol !== 'https:') {
    throw new Error('FRONTEND_URL deve usare HTTPS per callback CIE reale');
  }

  return url;
}

function buildCieCallbackRedirect(outcome) {
  if (!['success', 'error', 'already-linked', 'account-already-verified'].includes(outcome)) {
    throw new Error('Esito callback CIE non valido');
  }

  const url = getTrustedFrontendBaseUrl();
  url.pathname = '/impostazioni';
  url.search = '';
  url.hash = '';
  url.searchParams.set('cie', outcome);

  return url.toString();
}

function buildRegistrationCieCallbackRedirect(outcome, ticket = null) {
  if (!['success', 'error', 'already-linked', 'account-already-verified'].includes(outcome)) {
    throw new Error('Esito callback CIE registrazione non valido');
  }
  if (outcome === 'success' && (typeof ticket !== 'string' || ticket.length < 32)) {
    throw new Error('Ticket registrazione mancante');
  }

  const url = getTrustedFrontendBaseUrl();
  url.pathname = '/registrazione-crea-passkey';
  url.search = '';

  const fragment = new URLSearchParams({ cie: outcome });
  if (ticket) fragment.set('ticket', ticket);
  // The one-time ticket stays in the URL fragment: it is not sent in HTTP requests or referrers.
  url.hash = fragment.toString();

  return url.toString();
}

module.exports = {
  getTrustedFrontendBaseUrl,
  buildCieCallbackRedirect,
  buildRegistrationCieCallbackRedirect
};
