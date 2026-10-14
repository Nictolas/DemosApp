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
  const cookies = parseCookieHeader(req?.headers?.cookie);
  const cookieToken = cookies[REFRESH_TOKEN_COOKIE_NAME];

  if (cookieToken && typeof cookieToken === 'string') {
    return { refreshToken: cookieToken, source: 'cookie' };
  }

  const bodyToken = req?.body?.refreshToken;
  if (bodyToken && typeof bodyToken === 'string') {
    return { refreshToken: bodyToken, source: 'body' };
  }

  return { refreshToken: null, source: null };
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
  getRefreshTokenCookieOptions,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
};
