const rateLimit = require('express-rate-limit');

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const FIFTEEN_MINUTES_SECONDS = 15 * 60;

const WEBAUTHN_RATE_LIMITS = Object.freeze({
  STATUS_MAX: 120,
  CHALLENGE_MAX: 60,
  VERIFY_MAX: 30,
});

function skipLocalhostInDevelopment(req) {
  const isLocalhost =
    req.ip === '::1' ||
    req.ip === '127.0.0.1' ||
    req.ip === '::ffff:127.0.0.1';
  const isDevelopment =
    process.env.NODE_ENV === 'development' ||
    process.env.NODE_ENV === 'dev';

  return isLocalhost && isDevelopment;
}

function createLimiter(max, label) {
  return rateLimit({
    windowMs: FIFTEEN_MINUTES_MS,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skip: skipLocalhostInDevelopment,
    handler: (req, res) => {
      console.log(
        `🚨 WEBAUTHN RATE LIMIT: ${label} - ${req.method} ${req.originalUrl}`,
      );
      return res.status(429).json({
        success: false,
        error: 'Troppe richieste passkey',
        code: 'PASSKEY_RATE_LIMITED',
        message: 'Hai effettuato troppe richieste passkey. Riprova tra qualche minuto.',
        retryAfter: FIFTEEN_MINUTES_SECONDS,
      });
    },
  });
}

const webauthnStatusLimiter = createLimiter(
  WEBAUTHN_RATE_LIMITS.STATUS_MAX,
  'status',
);
const webauthnChallengeLimiter = createLimiter(
  WEBAUTHN_RATE_LIMITS.CHALLENGE_MAX,
  'challenge',
);
const webauthnVerifyLimiter = createLimiter(
  WEBAUTHN_RATE_LIMITS.VERIFY_MAX,
  'verify',
);

module.exports = {
  WEBAUTHN_RATE_LIMITS,
  webauthnStatusLimiter,
  webauthnChallengeLimiter,
  webauthnVerifyLimiter,
};
