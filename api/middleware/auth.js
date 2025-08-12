// File: api/middleware/auth.js
const { adminAuth } = require('../firebase-config.cjs');

const authenticateUser = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    
    req.user = decodedToken;
    return decodedToken;
  } catch (error) {
    console.error('Errore autenticazione:', error);
    return null;
  }
};

module.exports = { authenticateUser };
