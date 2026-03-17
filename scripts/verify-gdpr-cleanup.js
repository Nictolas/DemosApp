// Script per verificare che la pulizia GDPR funzioni correttamente
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Campi da RIMUOVERE (non necessari per GDPR)
const FIELDS_TO_REMOVE = [
  'pid', 'hostname', 'freed', 'afterGC', 'beforeGC',
  'alertType', 'errors', 'method', 'statusCode', 'responseTime',
  'url', 'headers', 'created', 'timestamp', 'severity', 'skipped',
  'threshold', 'total', 'updated', 'value'
];

// Campi da MANTENERE (necessari per GDPR o per deduplicazione)
const FIELDS_TO_KEEP = [
  '_time', 'level', 'message', 'log_type', 'user_id', 'ip_address',
  'endpoint', 'session_id', 'user_agent', 'request_id',
  'userId', 'ipAddress', 'sessionId', 'userAgent', 'requestId'
];

// Simula un record come viene da Axiom
const sampleRecord = {
  _time: '2025-12-13T17:00:00.000Z',
  _sysTime: '2025-12-13T17:00:00.100Z',
  _rowId: 'test-123',
  data: {
    level: 'INFO',
    message: 'Test message',
    log_type: 'application',
    user_id: 'user-123',
    ip_address: '192.168.1.1',
    endpoint: '/api/test',
    session_id: 'session-123',
    user_agent: 'Mozilla/5.0',
    request_id: 'req-123',
    // Campi da rimuovere
    pid: 1234,
    hostname: 'server-1',
    freed: 100,
    afterGC: 200,
    beforeGC: 150,
    alertType: 'warning',
    errors: null,
    method: 'GET',
    statusCode: 200,
    responseTime: 50,
    url: '/api/test',
    headers: '{}',
    created: '2025-12-13T17:00:00.000Z',
    timestamp: '2025-12-13T17:00:00.000Z',
    severity: 'low',
    skipped: false,
    threshold: 100,
    total: 1000,
    updated: '2025-12-13T17:00:00.000Z',
    value: 42
  }
};

console.log('🧹 Test Pulizia GDPR\n');
console.log('Record originale:');
console.log(JSON.stringify(sampleRecord, null, 2));
console.log('\nCampi nel data object:', Object.keys(sampleRecord.data).length);

// Applica la pulizia (come nella deduplicazione)
let cleanRecord;
if (sampleRecord.data && typeof sampleRecord.data === 'object') {
  cleanRecord = {
    _time: sampleRecord._time || sampleRecord.data._time || new Date().toISOString(),
    ...sampleRecord.data
  };
} else {
  cleanRecord = { ...sampleRecord };
}

const cleaned = {};
Object.keys(cleanRecord).forEach(key => {
  if (key.startsWith('_') || FIELDS_TO_KEEP.includes(key)) {
    cleaned[key] = cleanRecord[key];
  } else if (!FIELDS_TO_REMOVE.includes(key)) {
    cleaned[key] = cleanRecord[key];
  }
  // Altrimenti rimuovilo
});

console.log('\nRecord dopo pulizia GDPR:');
console.log(JSON.stringify(cleaned, null, 2));
console.log('\nCampi rimasti:', Object.keys(cleaned).length);
console.log('\nCampi rimossi:', Object.keys(cleanRecord).length - Object.keys(cleaned).length);

const removedFields = Object.keys(cleanRecord).filter(k => !Object.keys(cleaned).includes(k));
console.log('\nLista campi rimossi:');
removedFields.forEach(f => console.log(`  - ${f}`));

const keptFields = Object.keys(cleaned);
console.log('\nLista campi mantenuti:');
keptFields.forEach(f => console.log(`  ✅ ${f}`));

// Verifica che tutti i campi GDPR siano presenti
const requiredGDPRFields = ['_time', 'level', 'message', 'log_type', 'user_id', 'ip_address', 'endpoint', 'session_id'];
const missingFields = requiredGDPRFields.filter(f => !keptFields.includes(f));
if (missingFields.length > 0) {
  console.log('\n⚠️ ERRORE: Campi GDPR mancanti:', missingFields);
} else {
  console.log('\n✅ Tutti i campi GDPR necessari sono presenti');
}

// Verifica che i campi non GDPR siano stati rimossi
const shouldBeRemoved = ['pid', 'hostname', 'freed', 'afterGC', 'beforeGC'];
const stillPresent = shouldBeRemoved.filter(f => keptFields.includes(f));
if (stillPresent.length > 0) {
  console.log('\n⚠️ ERRORE: Campi non GDPR ancora presenti:', stillPresent);
} else {
  console.log('✅ Tutti i campi non GDPR sono stati rimossi');
}

