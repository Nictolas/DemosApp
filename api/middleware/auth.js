// File: api/middleware/auth.js
const admin = require('firebase-admin');

// Funzione di inizializzazione robusta
function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) {
    console.log("Firebase Admin già inizializzato.");
    return;
  }
  
  console.log("Tentativo di inizializzare Firebase Admin...");

  // Controlla che le variabili d'ambiente esistano
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    console.error("ERRORE: Variabili d'ambiente di Firebase non trovate!");
    // Non lanciare un errore qui, altrimenti il server non parte. Lo gestiremo dopo.
    return;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    console.log("Firebase Admin inizializzato con successo.");
  } catch (error) {
    console.error('ERRORE CRITICO nell'inizializzazione di Firebase Admin:', error);
  }
}

// Esegui l'inizializzazione una sola volta all'avvio del modulo
initializeFirebaseAdmin();

async function authenticateUser(req, res, next) {
  console.log(`[Auth Middleware] Ricevuta richiesta per: ${req.url}`);
  
  // Controlla se Firebase Admin è stato inizializzato
  if (admin.apps.length === 0) {
      console.error("[Auth Middleware] ERRORE: Firebase Admin non è inizializzato. Controlla le variabili d'ambiente.");
      return res.status(500).send('Internal Server Error: Auth service not configured.');
  }

  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log("[Auth Middleware] ERRORE: Token mancante o malformato.");
    return res.status(401).send('Unauthorized: No token provided');
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    console.log(`[Auth Middleware] Token valido per UID: ${decodedToken.uid}. Procedo.`);
    next(); // Passa alla rotta successiva (es. /me)
  } catch (error) {
    console.error('[Auth Middleware] ERRORE nella verifica del token:', error.code, error.message);
    res.status(403).send('Unauthorized: Invalid token');
  }
}

module.exports = { authenticateUser };