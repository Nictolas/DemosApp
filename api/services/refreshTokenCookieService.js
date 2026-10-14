const REFRESH_TOKEN_COOKIE_NAME = 'demos_refresh';
const REFRESH_TOKEN_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function parseCookieHeader(cookieHeader) {
  if (!cookieHeader || typeof cookieHeader !== 'string') return {};

  return cookieHeader.split(';').reduce((cookies, part) => {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex <= 0) return cookies;

    const name = part.slice(0, separatorIndex).trim();
    const rawValue = part.slice(separatorIndex + 1).trim();
    if (!name) return cookies;

    try {
      cookies[name] = decodeURIComponent(rawValue);
    } catch (_) {
      cookies[name] = rawValue;
    }
    return cookies;
  }, {});
}

function getRefreshTokenFromRequest(req) {
  // Fase di migrazione: se un client legacy/mobile invia ancora il token nel body,
  // quello resta autorevole. Evita che un vecchio cookie browser sopravvissuto a un
  // nuovo login possa oscurare un refresh token più recente. Al cutover web il body
  // verrà rimosso e il cookie diventerà automaticamente l'unica sorgente.
  const bodyToken = req?.body?.refreshToken;
  if (bodyToken && typeof bodyToken === 'string') {
    return { refreshToken: bodyToken, source: 'body' };
  }

  const cookies = parseCookieHeader(req?.headers?.cookie);
  const cookieToken = cookies[REFRESH_TOKEN_COOKIE_NAME];
  if (cookieToken && typeof cookieToken === 'string') {
    return { refreshToken: cookieToken, source: 'cookie' };
  }

  return { refreshToken: null, source: null };
}

function normalizeOrigin(value) {
  if (!value || typeof value !== 'string' || value === 'null') return null;
  try {
    return new URL(value).origin;
  } catch (_) {
    return null;
  }
}

function getTrustedRefreshCookieOrigins() {
  const origins = new Set([
    'https://www.demos.community',
    'https://demos.community',
  ]);

  const configuredFrontend = normalizeOrigin(process.env.FRONTEND_URL);
  if (configuredFrontend) origins.add(configuredFrontend);

  if (process.env.NODE_ENV !== 'production') {
    origins.add('http://localhost:3000');
    origins.add('http://localhost:5173');
    origins.add('http://127.0.0.1:3000');
    origins.add('http://127.0.0.1:5173');
  }

  return origins;
}

function isTrustedRefreshCookieRequest(req) {
  const rawOrigin = typeof req?.get === 'function'
    ? req.get('Origin')
    : req?.headers?.origin;
  const origin = normalizeOrigin(rawOrigin);
  if (!origin) return false;
  return getTrustedRefreshCookieOrigins().has(origin);
}

function getRefreshTokenCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE_MS,
  };
}

function setRefreshTokenCookie(res, refreshToken) {
  if (!res || typeof res.cookie !== 'function') {
    throw new Error('Response Express non valida per impostare il refresh cookie');
  }
  if (!refreshToken || typeof refreshToken !== 'string') {
    throw new Error('Refresh token non valido per cookie');
  }

  res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, getRefreshTokenCookieOptions());
}

function clearRefreshTokenCookie(res) {
  if (!res || typeof res.clearCookie !== 'function') return;

  const options = getRefreshTokenCookieOptions();
  delete options.maxAge;
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, options);
}

module.exports = {
  REFRESH_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_MAX_AGE_MS,
  parseCookieHeader,
  getRefreshTokenFromRequest,
  normalizeOrigin,
  getTrustedRefreshCookieOrigins,
  isTrustedRefreshCookieRequest,
  getRefreshTokenCookieOptions,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
};
