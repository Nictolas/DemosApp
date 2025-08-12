module.exports = async (req, res) => {
  // Abilita CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Gestisci preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Health check endpoint
  if (req.url === '/api/health' || req.url === '/health') {
    return res.json({ 
      status: 'ok', 
      message: 'API health check working!',
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url
    });
  }

  // Endpoint per utenti
  if (req.url === '/api/utenti/me' || req.url === '/utenti/me') {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    // Per ora restituiamo un messaggio di test
    return res.json({ 
      message: 'API utenti/me endpoint working!',
      method: req.method,
      url: req.url
    });
  }

  // Endpoint per autenticazione
  if (req.url === '/api/auth' || req.url === '/auth') {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    // Per ora restituiamo un messaggio di test
    return res.json({ 
      message: 'API auth endpoint working!',
      method: req.method,
      url: req.url
    });
  }

  // Endpoint di default
  return res.json({ 
    message: 'API is working!',
    availableEndpoints: ['/api/health', '/api/utenti/me', '/api/auth'],
    method: req.method,
    url: req.url
  });
};
