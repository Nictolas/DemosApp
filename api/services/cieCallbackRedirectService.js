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

module.exports = {
  getTrustedFrontendBaseUrl,
  buildCieCallbackRedirect
};
