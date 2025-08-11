// File: api/middleware/auth.js
const admin = require('firebase-admin');

// Funzione di inizializzazione
function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) return;
  
  try {
    console.log("Inizializzo Firebase Admin...");
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    console.log("Firebase Admin inizializzato.");
  } catch (error) {
    console.error('ERRORE Inizializzazione Firebase Admin:', error);
  }
}

// Esegui subito
initializeFirebaseAdmin();

// Middleware come funzione che ritorna un handler
const authenticateUser = (handler) => async (req, res) => {
  console.log(`[Auth] Ricevuta richiesta per: ${req.url}`);
  
  if (admin.apps.length === 0) {
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
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    console.log(`[Auth] Token valido per UID: ${decodedToken.uid}.`);
    return handler(req, res); // Esegui la funzione vera e propria
  } catch (error) {
    console.error('[Auth] Errore verifica token:', error.code);
    res.status(403).send('Unauthorized: Invalid token');
  }
};

module.exports = { authenticateUser };