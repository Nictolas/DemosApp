const { adminAuth } = require('./firebase-config.cjs');

module.exports = async (req, res) => {
  // Abilita CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Gestisci preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { idToken } = req.body;
    
    if (!idToken) {
      return res.status(400).json({ error: 'ID token mancante' });
    }

    // Verifica il token Firebase
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    
    res.json({ 
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified
    });
  } catch (error) {
    console.error("Errore POST /api/auth:", error);
    res.status(401).json({ error: "Token non valido" });
  }
};
