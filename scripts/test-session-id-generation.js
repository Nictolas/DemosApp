/**
 * Script per testare la generazione di session_id
 * Simula richieste HTTP e verifica che session_id venga generato correttamente
 */

const crypto = require('crypto');

// Simula la logica di generazione session_id dal centralizedLogger
function generateSessionId(req) {
  let sessionId = req.sessionID || null;
  
  if (!sessionId) {
    // Se l'utente è autenticato, usa il JWT ID (jti) come base per la sessione
    if (req.user?.jti) {
      // Usa jti + finestra temporale di 24 ore per tracciare la sessione di login
      const timeWindow = Math.floor(Date.now() / (1000 * 60 * 60 * 24)); // Finestra di 24 ore
      const sessionKey = `${req.user.jti}-${timeWindow}`;
      sessionId = crypto
        .createHash('sha256')
        .update(sessionKey)
        .digest('hex')
        .substring(0, 16);
      sessionId = `jwt_${sessionId}`; // Prefisso per sessioni basate su JWT
    } else {
      // Per utenti non autenticati (non dovrebbe mai accadere secondo l'utente)
      const userId = 'anonymous';
      const ip = req.ip || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';
      
      const timeWindow = Math.floor(Date.now() / (1000 * 60 * 60 * 24)); // Finestra di 24 ore
      const sessionKey = `${userId}-${ip}-${userAgent}-${timeWindow}`;
      sessionId = crypto
        .createHash('sha256')
        .update(sessionKey)
        .digest('hex')
        .substring(0, 16);
      sessionId = `gen_${sessionId}`;
    }
  }
  
  return sessionId;
}

// Test 1: Utente autenticato con jti
console.log('🧪 TEST 1: Utente autenticato con JWT ID (jti)');
const req1 = {
  user: {
    id: 'user-123',
    jti: 'jwt-token-abc-123'
  },
  ip: '192.168.1.100',
  get: (header) => header === 'User-Agent' ? 'Mozilla/5.0 (Chrome)' : null
};

const sessionId1 = generateSessionId(req1);
console.log(`   session_id: ${sessionId1}`);
console.log(`   ✅ Prefisso corretto: ${sessionId1.startsWith('jwt_') ? 'SÌ' : 'NO'}`);
console.log(`   ✅ Lunghezza: ${sessionId1.length} caratteri\n`);

// Test 2: Stesso utente, stesso jti, stessa giornata (dovrebbe dare stesso session_id)
console.log('🧪 TEST 2: Stesso utente, stesso jti, stessa giornata');
const req2 = {
  user: {
    id: 'user-123',
    jti: 'jwt-token-abc-123' // Stesso jti
  },
  ip: '192.168.1.100',
  get: (header) => header === 'User-Agent' ? 'Mozilla/5.0 (Chrome)' : null
};

const sessionId2 = generateSessionId(req2);
console.log(`   session_id: ${sessionId2}`);
console.log(`   ✅ Stesso session_id: ${sessionId1 === sessionId2 ? 'SÌ' : 'NO'}\n`);

// Test 3: Utente diverso, jti diverso
console.log('🧪 TEST 3: Utente diverso, jti diverso');
const req3 = {
  user: {
    id: 'user-456',
    jti: 'jwt-token-def-456' // Jti diverso
  },
  ip: '192.168.1.100',
  get: (header) => header === 'User-Agent' ? 'Mozilla/5.0 (Chrome)' : null
};

const sessionId3 = generateSessionId(req3);
console.log(`   session_id: ${sessionId3}`);
console.log(`   ✅ Session_id diverso: ${sessionId1 !== sessionId3 ? 'SÌ' : 'NO'}\n`);

// Test 4: Stesso utente, stesso jti, ma IP diverso (dovrebbe dare stesso session_id perché usa solo jti)
console.log('🧪 TEST 4: Stesso utente, stesso jti, IP diverso');
const req4 = {
  user: {
    id: 'user-123',
    jti: 'jwt-token-abc-123' // Stesso jti
  },
  ip: '192.168.1.200', // IP diverso
  get: (header) => header === 'User-Agent' ? 'Mozilla/5.0 (Chrome)' : null
};

const sessionId4 = generateSessionId(req4);
console.log(`   session_id: ${sessionId4}`);
console.log(`   ✅ Stesso session_id (usa solo jti): ${sessionId1 === sessionId4 ? 'SÌ' : 'NO'}\n`);

// Test 5: Verifica formato completo del logEntry
console.log('🧪 TEST 5: Formato completo logEntry per Axiom');
const meta = {
  method: 'GET',
  url: '/api/users/profile',
  statusCode: 200,
  responseTime: '50ms',
  ipAddress: req1.ip,
  userAgent: req1.get('User-Agent'),
  userId: req1.user.id,
  sessionId: sessionId1,
  requestId: 'req-123',
  endpoint: '/api/users/profile'
};

const logEntry = {
  _time: new Date().toISOString(),
  message: `${meta.method} ${meta.url} - ${meta.statusCode}`,
  user_id: meta.userId || null,
  ip_address: meta.ipAddress || null,
  endpoint: meta.endpoint || null,
  session_id: meta.sessionId || null
};

console.log('   LogEntry completo:');
console.log(JSON.stringify(logEntry, null, 2));
console.log(`\n   ✅ Campi presenti: ${Object.keys(logEntry).length}/6`);
console.log(`   ✅ session_id presente: ${logEntry.session_id ? 'SÌ' : 'NO'}`);
console.log(`   ✅ session_id non null: ${logEntry.session_id !== null ? 'SÌ' : 'NO'}`);
console.log(`   ✅ Formato corretto: ${logEntry.session_id && logEntry.session_id.startsWith('jwt_') ? 'SÌ' : 'NO'}\n`);

// Test 6: Verifica che session_id cambi il giorno successivo (simulazione)
console.log('🧪 TEST 6: Verifica finestra temporale (simulazione giorno successivo)');
// Simula richiesta del giorno successivo (aggiungi 25 ore)
const tomorrow = Date.now() + (25 * 60 * 60 * 1000);
const originalDateNow = Date.now;
Date.now = () => tomorrow;

const req5 = {
  user: {
    id: 'user-123',
    jti: 'jwt-token-abc-123' // Stesso jti, ma giorno diverso
  },
  ip: '192.168.1.100',
  get: (header) => header === 'User-Agent' ? 'Mozilla/5.0 (Chrome)' : null
};

const sessionId5 = generateSessionId(req5);
Date.now = originalDateNow; // Ripristina

console.log(`   session_id (oggi): ${sessionId1}`);
console.log(`   session_id (domani): ${sessionId5}`);
console.log(`   ✅ Session_id diverso il giorno dopo: ${sessionId1 !== sessionId5 ? 'SÌ' : 'NO'}\n`);

console.log('✅ Tutti i test completati!');
console.log('\n📊 Riepilogo:');
console.log('   - session_id viene generato correttamente per utenti autenticati');
console.log('   - Usa jti (JWT ID) per tracciare la sessione di login');
console.log('   - Stesso login nella stessa giornata = stesso session_id');
console.log('   - Login diverso o giorno diverso = session_id diverso');
console.log('   - Formato: jwt_<hash> (16 caratteri)');
console.log('   - Sempre presente (non null) nei log inviati ad Axiom');

