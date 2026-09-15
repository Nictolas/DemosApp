const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * 🔐 Sistema JWT Sicuro per DemosApp
 *
 * Funzionalità:
 * - Generazione token sicuri con scadenza
 * - Verifica token con validazione completa
 * - Refresh token per sessioni prolungate
 * - Session ID condiviso tra access e refresh token
 *
 * La revoca distribuita degli access token è gestita da accessRevocationService.
 */

const MIN_JWT_SECRET_LENGTH = 32;
const isProduction = process.env.NODE_ENV === 'production';

const resolveJwtSecret = (name) => {
  const value = process.env[name];

  if (value && value.length >= MIN_JWT_SECRET_LENGTH) {
    return value;
  }

  if (isProduction) {
    const reason = value
      ? `deve contenere almeno ${MIN_JWT_SECRET_LENGTH} caratteri`
      : 'non è definita';
    throw new Error(`${name} ${reason}. Avvio interrotto per evitare token JWT insicuri.`);
  }

  // In sviluppo non usiamo mai fallback prevedibili: genera un segreto effimero.
  console.warn(`⚠️ ${name} assente o troppo corta: genero un segreto effimero solo per sviluppo.`);
  return crypto.randomBytes(48).toString('base64url');
};

class JWTHelper {
  constructor() {
    this.secret = resolveJwtSecret('JWT_SECRET');
    this.refreshSecret = resolveJwtSecret('JWT_REFRESH_SECRET');

    if (this.secret === this.refreshSecret) {
      throw new Error('JWT_SECRET e JWT_REFRESH_SECRET devono essere diverse.');
    }
  }

  /**
   * Genera token di accesso
   */
  generateAccessToken(payload) {
    const tokenPayload = {
      ...payload,
      type: 'access',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 ore
      jti: crypto.randomUUID() // JWT ID unico
    };

    return jwt.sign(tokenPayload, this.secret, {
      algorithm: 'HS256',
      issuer: 'demosapp',
      audience: 'demosapp-users'
    });
  }

  /**
   * Genera refresh token
   */
  generateRefreshToken(payload) {
    const tokenPayload = {
      ...payload,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 giorni
      jti: crypto.randomUUID()
    };

    return jwt.sign(tokenPayload, this.refreshSecret, {
      algorithm: 'HS256',
      issuer: 'demosapp',
      audience: 'demosapp-users'
    });
  }

  /**
   * Genera token "pending" per registrazione OAuth non completata.
   * Usato quando l'utente fa login con Google/Apple per la prima volta: non creiamo
   * la riga in users finché non completa il wizard. Scadenza 1 ora.
   */
  generateOAuthPendingToken(payload) {
    const tokenPayload = {
      ...payload,
      type: 'oauth_pending',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 ora
      jti: crypto.randomUUID()
    };

    return jwt.sign(tokenPayload, this.secret, {
      algorithm: 'HS256',
      issuer: 'demosapp',
      audience: 'demosapp-users'
    });
  }

  /**
   * Verifica token pending OAuth (stesso secret, accetta solo type === 'oauth_pending').
   */
  verifyOAuthPendingToken(token) {
    try {
      const decoded = jwt.verify(token, this.secret, {
        algorithms: ['HS256'],
        issuer: 'demosapp',
        audience: 'demosapp-users'
      });

      if (decoded.type !== 'oauth_pending') {
        throw new Error('Tipo di token non valido');
      }

      return decoded;
    } catch (error) {
      throw new Error(`Token pending non valido: ${error.message}`);
    }
  }

  /**
   * Verifica firma, issuer, audience, scadenza e tipo del token di accesso.
   * La revoca distribuita della sessione viene controllata dal middleware globale.
   */
  verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, this.secret, {
        algorithms: ['HS256'],
        issuer: 'demosapp',
        audience: 'demosapp-users'
      });

      if (decoded.type !== 'access') {
        throw new Error('Tipo di token non valido');
      }

      return decoded;
    } catch (error) {
      throw new Error(`Token non valido: ${error.message}`);
    }
  }

  /**
   * Verifica refresh token
   */
  verifyRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, this.refreshSecret, {
        algorithms: ['HS256'],
        issuer: 'demosapp',
        audience: 'demosapp-users'
      });

      if (decoded.type !== 'refresh') {
        throw new Error('Tipo di token non valido');
      }

      return decoded;
    } catch (error) {
      throw new Error(`Refresh token non valido: ${error.message}`);
    }
  }

  /**
   * Genera coppia di token (access + refresh) legati alla stessa sessione.
   */
  generateTokenPair(payload) {
    const sessionId = payload?.sid || crypto.randomUUID();
    const sessionPayload = {
      ...payload,
      sid: sessionId,
    };

    return {
      accessToken: this.generateAccessToken(sessionPayload),
      refreshToken: this.generateRefreshToken(sessionPayload),
      expiresIn: 24 * 60 * 60, // 24 ore
      tokenType: 'Bearer'
    };
  }
}

// Istanza singleton
const jwtHelper = new JWTHelper();

module.exports = {
  jwtHelper,
  generateAccessToken: (payload) => jwtHelper.generateAccessToken(payload),
  generateRefreshToken: (payload) => jwtHelper.generateRefreshToken(payload),
  generateOAuthPendingToken: (payload) => jwtHelper.generateOAuthPendingToken(payload),
  verifyAccessToken: (token) => jwtHelper.verifyAccessToken(token),
  verifyOAuthPendingToken: (token) => jwtHelper.verifyOAuthPendingToken(token),
  verifyRefreshToken: (token) => jwtHelper.verifyRefreshToken(token),
  generateTokenPair: (payload) => jwtHelper.generateTokenPair(payload)
};
