/**
 * Utilità per la compressione di centralized_logs
 * Frontend: Valori completi
 * Database: Valori compressi
 */

// Mappatura hostname (da lunghi nomi a codici corti)
const HOSTNAME_COMPRESSION = {
  'srv-d2gt3dodl3ps73fmereg-hibernate-766757689f-qlw8': 'H1',
  'srv-d2gt3dodl3ps73fmereg-hibernate-84d9f5c8fd-tlr8': 'H2',
  'srv-d2gt3dodl3ps73fmereg-hibernate-6c59c45cf-2l97d': 'H3',
  'srv-d2gt3dodl3ps73fmereg-hibernate-6755665cdb-zlwv': 'H4',
  'srv-d2gt3dodl3ps73fmereg-hibernate-6c94dbfc6d-7wpd': 'H5',
  'srv-d2gt3dodl3ps73fmereg-hibernate-657f97c957-hfgp': 'H6',
  'srv-d2gt3dodl3ps73fmereg-hibernate-6554c9f64d-tcmk': 'H7',
  'srv-d2gt3dodl3ps73fmereg-hibernate-7f99dff7b4-f7zf': 'H8',
  'srv-d2gt3dodl3ps73fmereg-hibernate-85c6f56bcf-vgvw': 'H9',
  'srv-d2gt3dodl3ps73fmereg-hibernate-7998576bf8-v5nc': 'H10'
};

// Mappatura user agent (da lunghi string a codici corti)
const USER_AGENT_COMPRESSION = {
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36': 'CHR-WIN',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36': 'CHR-MAC',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36': 'CHR-LIN',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0': 'FF-WIN',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:124.0) Gecko/20100101 Firefox/124.0': 'FF-MAC',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1': 'SAF-IOS',
  'Mozilla/5.0 (iPad; CPU OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1': 'SAF-IPAD',
  'Mozilla/5.0 (Linux; Android 14; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36': 'AND-CHR',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36': 'AND-PIX',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.0.0 Mobile/15E148 Safari/604.1': 'CHR-IOS'
};

// Mappatura endpoint (da URL lunghi a codici corti)
const ENDPOINT_COMPRESSION = {
  '/api/notifiche': '/n',
  '/api/candidati': '/c',
  '/api/rappresentanti': '/r',
  '/api/users': '/u',
  '/api/auth/login': '/l',
  '/api/auth/register': '/reg',
  '/api/auth/logout': '/out',
  '/api/users/profile': '/p',
  '/api/users/me': '/me',
  '/api/admin': '/a',
  '/api/opinioni': '/o',
  '/api/voti': '/v',
  '/api/elezioni': '/e',
  '/api/eventi': '/ev',
  '/api/comunicazioni': '/com',
  '/api/segnalazioni': '/s',
  '/api/health': '/h',
  '/api/metrics': '/m'
};

// Mappatura messaggi comuni (da messaggi lunghi a codici corti)
const MESSAGE_COMPRESSION = {
  'OPTIONS /api/notifiche': 'OPT-N',
  'GET /api/candidati - 429': 'GET-C-429',
  'GET /api/notifiche': 'GET-N',
  'PUT /api/notifiche': 'PUT-N',
  'POST /api/auth/login': 'POST-L',
  'POST /api/auth/register': 'POST-R',
  'GET /api/users/profile': 'GET-P',
  'Memoria ottimizzata': 'MEM-OPT',
  'User logged in successfully': 'LOGIN-OK',
  'User registration successful': 'REG-OK',
  'Database connection established': 'DB-CONN',
  'Cache cleared successfully': 'CACHE-CLR',
  'Session expired': 'SESS-EXP',
  'Rate limit exceeded': 'RATE-LIM',
  'Validation failed': 'VAL-FAIL',
  'Unauthorized access': 'UNAUTH',
  'Internal server error': 'INT-ERR',
  'Not found': '404',
  'Bad request': '400',
  'Forbidden': '403'
};

/**
 * Comprimi hostname
 */
function compressHostname(hostname) {
  if (!hostname) return null;
  
  // Cerca corrispondenza esatta
  if (HOSTNAME_COMPRESSION[hostname]) {
    return HOSTNAME_COMPRESSION[hostname];
  }
  
  // Pattern matching per hostname simili
  if (hostname.includes('hibernate')) {
    const parts = hostname.split('-');
    if (parts.length >= 4) {
      const hash = parts[3].substring(0, 4);
      return `H-${hash}`;
    }
  }
  
  // Fallback: primi 10 caratteri
  return hostname.substring(0, 10);
}

/**
 * Decomprimi hostname
 */
function decompressHostname(compressedHostname) {
  if (!compressedHostname) return null;
  
  // Cerca corrispondenza esatta
  for (const [original, compressed] of Object.entries(HOSTNAME_COMPRESSION)) {
    if (compressed === compressedHostname) {
      return original;
    }
  }
  
  // Se inizia con H- è un hash
  if (compressedHostname.startsWith('H-')) {
    return `srv-d2gt3dodl3ps73fmereg-hibernate-${compressedHostname.substring(2)}-xxxx`;
  }
  
  // Fallback: restituisci come è
  return compressedHostname;
}

/**
 * Comprimi user agent
 */
function compressUserAgent(userAgent) {
  if (!userAgent) return null;
  
  // Cerca corrispondenza esatta
  if (USER_AGENT_COMPRESSION[userAgent]) {
    return USER_AGENT_COMPRESSION[userAgent];
  }
  
  // Pattern matching
  if (userAgent.includes('Chrome') && userAgent.includes('Windows')) {
    return 'CHR-WIN';
  } else if (userAgent.includes('Chrome') && userAgent.includes('Mac')) {
    return 'CHR-MAC';
  } else if (userAgent.includes('Firefox') && userAgent.includes('Windows')) {
    return 'FF-WIN';
  } else if (userAgent.includes('Safari') && userAgent.includes('iPhone')) {
    return 'SAF-IOS';
  } else if (userAgent.includes('Android') && userAgent.includes('Chrome')) {
    return 'AND-CHR';
  } else if (userAgent.includes('Mobile')) {
    return 'MOBILE';
  } else if (userAgent.includes('bot') || userAgent.includes('Bot')) {
    return 'BOT';
  }
  
  // Fallback: primi 15 caratteri
  return userAgent.substring(0, 15);
}

/**
 * Decomprimi user agent
 */
function decompressUserAgent(compressedUserAgent) {
  if (!compressedUserAgent) return null;
  
  // Cerca corrispondenza esatta
  for (const [original, compressed] of Object.entries(USER_AGENT_COMPRESSION)) {
    if (compressed === compressedUserAgent) {
      return original;
    }
  }
  
  // Pattern decompression
  switch (compressedUserAgent) {
    case 'CHR-WIN':
      return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';
    case 'CHR-MAC':
      return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';
    case 'FF-WIN':
      return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0';
    case 'SAF-IOS':
      return 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1';
    case 'AND-CHR':
      return 'Mozilla/5.0 (Linux; Android 14; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36';
    case 'MOBILE':
      return 'Mobile Browser';
    case 'BOT':
      return 'Bot/Crawler';
    default:
      return compressedUserAgent;
  }
}

/**
 * Comprimi endpoint
 */
function compressEndpoint(endpoint) {
  if (!endpoint) return null;
  
  // Cerca corrispondenza esatta
  if (ENDPOINT_COMPRESSION[endpoint]) {
    return ENDPOINT_COMPRESSION[endpoint];
  }
  
  // Pattern matching
  if (endpoint.startsWith('/api/notifiche')) {
    return '/n';
  } else if (endpoint.startsWith('/api/candidati')) {
    return '/c';
  } else if (endpoint.startsWith('/api/users')) {
    return '/u';
  } else if (endpoint.startsWith('/api/auth')) {
    return '/auth';
  } else if (endpoint.startsWith('/api/admin')) {
    return '/a';
  }
  
  // Fallback: primi 20 caratteri
  return endpoint.substring(0, 20);
}

/**
 * Decomprimi endpoint
 */
function decompressEndpoint(compressedEndpoint) {
  if (!compressedEndpoint) return null;
  
  // Cerca corrispondenza esatta
  for (const [original, compressed] of Object.entries(ENDPOINT_COMPRESSION)) {
    if (compressed === compressedEndpoint) {
      return original;
    }
  }
  
  // Pattern decompression
  switch (compressedEndpoint) {
    case '/n':
      return '/api/notifiche';
    case '/c':
      return '/api/candidati';
    case '/u':
      return '/api/users';
    case '/auth':
      return '/api/auth';
    case '/a':
      return '/api/admin';
    default:
      return compressedEndpoint;
  }
}

/**
 * Comprimi messaggio
 */
function compressMessage(message) {
  if (!message) return null;
  
  // Cerca corrispondenza esatta
  if (MESSAGE_COMPRESSION[message]) {
    return MESSAGE_COMPRESSION[message];
  }
  
  // Pattern matching per messaggi comuni
  if (message.includes('OPTIONS')) {
    return 'OPT-' + message.split(' ')[1].substring(0, 3).toUpperCase();
  } else if (message.includes('GET') && message.includes('429')) {
    return 'GET-429';
  } else if (message.includes('POST') && message.includes('login')) {
    return 'POST-LOGIN';
  } else if (message.includes('PUT') && message.includes('notifiche')) {
    return 'PUT-NOTIF';
  }
  
  // Fallback: primi 30 caratteri
  return message.substring(0, 30);
}

/**
 * Decomprimi messaggio
 */
function decompressMessage(compressedMessage) {
  if (!compressedMessage) return null;
  
  // Cerca corrispondenza esatta
  for (const [original, compressed] of Object.entries(MESSAGE_COMPRESSION)) {
    if (compressed === compressedMessage) {
      return original;
    }
  }
  
  // Pattern decompression
  if (compressedMessage.startsWith('OPT-')) {
    return `OPTIONS /api/${compressedMessage.substring(4).toLowerCase()}`;
  } else if (compressedMessage === 'GET-429') {
    return 'GET /api/candidati - 429';
  } else if (compressedMessage === 'POST-LOGIN') {
    return 'POST /api/auth/login';
  } else if (compressedMessage === 'PUT-NOTIF') {
    return 'PUT /api/notifiche';
  }
  
  // Fallback: restituisci come è
  return compressedMessage;
}

module.exports = {
  compressHostname,
  decompressHostname,
  compressUserAgent,
  decompressUserAgent,
  compressEndpoint,
  decompressEndpoint,
  compressMessage,
  decompressMessage,
  HOSTNAME_COMPRESSION,
  USER_AGENT_COMPRESSION,
  ENDPOINT_COMPRESSION,
  MESSAGE_COMPRESSION
};
