// File: api/middleware/auth.js
const { adminAuth } = require('../firebase-config.cjs');

// Middleware come funzione che ritorna un handler
const authenticateUser = (handler) => async (req, res) => {
  console.log(`[Auth] Ricevuta richiesta per: ${req.url}`);
  
  if (!adminAuth) {
      console.error("[Auth] Firebase Admin non pronto.");
      return res.status(500).send('Servizio di autenticazione non configurato.');
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log("[Auth] Token mancante.");
    return res.status(401).send('Unauthorized: No token provided');
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    req.user = decodedToken;
    console.log(`[Auth] Token valido per UID: ${decodedToken.uid}.`);
    return handler(req, res); // Esegui la funzione vera e propria
  } catch (error) {
    console.error('[Auth] Errore verifica token:', error.code);
    res.status(403).send('Unauthorized: Invalid token');
  }
};

module.exports = { authenticateUser };