const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * 🔐 Sistema JWT Sicuro per DemosApp
 * 
 * Funzionalità:
 * - Generazione token sicuri con scadenza
 * - Verifica token con validazione completa
 * - Refresh token per sessioni prolungate
 * - Blacklist per token revocati
 */

// Cache per token revocati (in produzione usare Redis)
const tokenBlacklist = new Set();

class JWTHelper {
  constructor() {
    this.secret = process.env.JWT_SECRET || 'temporary-jwt-secret-for-development-only-change-in-production';
    this.refreshSecret = process.env.JWT_REFRESH_SECRET || this.secret + '_refresh';
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
   * Verifica token di accesso
   */
  verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, this.secret, {
        algorithms: ['HS256'],
        issuer: 'demosapp',
        audience: 'demosapp-users'
      });

      // Controlla se il token è nella blacklist
      if (tokenBlacklist.has(decoded.jti)) {
        throw new Error('Token revocato');
      }

      // Verifica che sia un token di accesso (non accetta oauth_pending)
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
   * Revoca token (aggiunge alla blacklist)
   */
  revokeToken(token) {
    try {
      const decoded = jwt.decode(token);
      if (decoded && decoded.jti) {
        tokenBlacklist.add(decoded.jti);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Errore revoca token:', error);
      return false;
    }
  }

  /**
   * Genera coppia di token (access + refresh)
   */
  generateTokenPair(payload) {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
      expiresIn: 24 * 60 * 60, // 24 ore
      tokenType: 'Bearer'
    };
  }

  /**
   * Pulisce token scaduti dalla blacklist
   */
  cleanupBlacklist() {
    // In produzione, implementare logica per rimuovere token scaduti
    // Per ora manteniamo semplice
    if (tokenBlacklist.size > 10000) {
      tokenBlacklist.clear();
    }
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
  revokeToken: (token) => jwtHelper.revokeToken(token),
  generateTokenPair: (payload) => jwtHelper.generateTokenPair(payload),
  cleanupBlacklist: () => jwtHelper.cleanupBlacklist()
};
