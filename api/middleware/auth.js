// File: api/middleware/auth.js
const jwt = require('jsonwebtoken');

const authenticateUser = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split('Bearer ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    req.user = decoded;
    return decoded;
  } catch (error) {
    console.error('Errore autenticazione:', error);
    return null;
  }
};

module.exports = { authenticateUser };
