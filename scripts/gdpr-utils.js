/**
 * Utilità GDPR per anonimizzazione e crittografia dati
 * Conforme al Regolamento Generale sulla Protezione dei Dati (GDPR)
 */

const crypto = require('crypto');

// Configurazione anonimizzazione
const GDPR_CONFIG = {
  // Anonimizza IP address (solo rete, non host specifico)
  anonymizeIP: true,
  
  // Hash per identificatori utente
  hashUserIds: true,
  hashSessionIds: true,
  
  // Chiave per crittografia (da impostare nel .env)
  encryptionKey: process.env.EXPORT_ENCRYPTION_KEY || null,
  
  // Algoritmo di hash
  hashAlgorithm: 'sha256',
  
  // Salt per hash (usa un salt fisso per consistent hashing)
  hashSalt: process.env.EXPORT_HASH_SALT || 'demosapp-export-salt-2024'
};

/**
 * Anonimizza IP address mantenendo solo la rete
 * Es: 192.168.1.100 -> 192.168.1.0
 */
function anonymizeIPAddress(ipAddress) {
  if (!ipAddress || ipAddress === 'unknown' || ipAddress === '') {
    return null;
  }
  
  // Gestisce formato CIDR (es. "192.168.1.1/32")
  const cleanIP = ipAddress.includes('/') ? ipAddress.split('/')[0] : ipAddress;
  
  // Skip IPv6 per ora (mantieni null)
  if (cleanIP.includes('::')) {
    return null;
  }
  
  const parts = cleanIP.split('.');
  if (parts.length !== 4) {
    return null;
  }
  
  // Mantieni solo i primi 3 ottetti (rete), azzera l'ultimo (host)
  return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
}

/**
 * Hash di un identificatore per pseudonimizzazione GDPR
 */
function hashIdentifier(identifier) {
  if (!identifier || identifier === '') {
    return null;
  }
  
  const hash = crypto
    .createHash(GDPR_CONFIG.hashAlgorithm)
    .update(identifier + GDPR_CONFIG.hashSalt)
    .digest('hex');
  
  // Mantieni solo primi 16 caratteri per compattezza
  return hash.substring(0, 16);
}

/**
 * Anonimizza un oggetto record secondo le policy GDPR
 */
function anonymizeRecord(record, tableName) {
  const anonymized = { ...record };
  
  // Anonimizza in base al tipo di tabella
  switch (tableName) {
    case 'audit_logs':
    case 'audit_logs_compressed':
      // Anonimizza user_id
      if (anonymized.user_id && GDPR_CONFIG.hashUserIds) {
        anonymized.user_id = hashIdentifier(anonymized.user_id);
      }
      
      // Anonimizza IP address
      if (anonymized.ip_address && GDPR_CONFIG.anonymizeIP) {
        anonymized.ip_address = anonymizeIPAddress(anonymized.ip_address);
      }
      
      // Anonimizza session_id se presente
      if (anonymized.session_id && GDPR_CONFIG.hashSessionIds) {
        anonymized.session_id = hashIdentifier(anonymized.session_id);
      }
      
      // Sanitizza message se contiene dati personali
      if (anonymized.message) {
        anonymized.message = sanitizeMessage(anonymized.message);
      }
      break;
      
    case 'centralized_logs':
    case 'centralized_logs_compressed':
      // Anonimizza user_id
      if (anonymized.user_id && GDPR_CONFIG.hashUserIds) {
        anonymized.user_id = hashIdentifier(anonymized.user_id);
      }
      
      // Anonimizza IP address
      if (anonymized.ip_address && GDPR_CONFIG.anonymizeIP) {
        anonymized.ip_address = anonymizeIPAddress(anonymized.ip_address);
      }
      
      // Anonimizza session_id
      if (anonymized.session_id && GDPR_CONFIG.hashSessionIds) {
        anonymized.session_id = hashIdentifier(anonymized.session_id);
      }
      
      // Anonimizza request_id
      if (anonymized.request_id && GDPR_CONFIG.hashSessionIds) {
        anonymized.request_id = hashIdentifier(anonymized.request_id);
      }
      
      // Sanitizza message
      if (anonymized.message) {
        anonymized.message = sanitizeMessage(anonymized.message);
      }
      
      // Sanitizza meta_data se contiene dati personali
      if (anonymized.meta_data && typeof anonymized.meta_data === 'object') {
        anonymized.meta_data = sanitizeMetadata(anonymized.meta_data);
      }
      break;
      
    case 'security_events':
    case 'access_audit':
      // Anonimizza user_id
      if (anonymized.user_id && GDPR_CONFIG.hashUserIds) {
        anonymized.user_id = hashIdentifier(anonymized.user_id);
      }
      
      // Anonimizza IP address
      if (anonymized.ip_address && GDPR_CONFIG.anonymizeIP) {
        anonymized.ip_address = anonymizeIPAddress(anonymized.ip_address);
      }
      break;
  }
  
  return anonymized;
}

/**
 * Sanitizza un messaggio rimuovendo potenziali dati personali
 */
function sanitizeMessage(message) {
  if (!message || typeof message !== 'string') {
    return message;
  }
  
  let sanitized = message;
  
  // Rimuovi pattern di email
  sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]');
  
  // Rimuovi pattern di IP completi (già anonimizzati nel campo dedicato)
  sanitized = sanitized.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP_REDACTED]');
  
  // Rimuovi pattern di telefoni italiani
  sanitized = sanitized.replace(/\b\d{3}[\s-]?\d{3}[\s-]?\d{4}\b/g, '[PHONE_REDACTED]');
  
  return sanitized;
}

/**
 * Sanitizza metadata rimuovendo dati personali
 */
function sanitizeMetadata(meta) {
  if (!meta || typeof meta !== 'object') {
    return meta;
  }
  
  const sanitized = { ...meta };
  
  // Rimuovi campi sensibili
  const sensitiveFields = ['email', 'password', 'token', 'secret', 'apiKey', 'authToken'];
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  // Anonimizza userId se presente
  if (sanitized.userId && GDPR_CONFIG.hashUserIds) {
    sanitized.userId = hashIdentifier(sanitized.userId);
  }
  
  // Anonimizza IP se presente
  if (sanitized.ipAddress && GDPR_CONFIG.anonymizeIP) {
    sanitized.ipAddress = anonymizeIPAddress(sanitized.ipAddress);
  }
  
  return sanitized;
}

/**
 * Crittografa un buffer usando AES-256-GCM
 */
function encryptBuffer(buffer, key) {
  if (!key) {
    throw new Error('Chiave di crittografia non configurata. Imposta EXPORT_ENCRYPTION_KEY nel .env');
  }
  
  // Deriva chiave da password usando PBKDF2
  const salt = crypto.randomBytes(16);
  const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha256');
  
  // Crea IV (Initialization Vector)
  const iv = crypto.randomBytes(16);
  
  // Crea cipher
  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
  
  // Crittografa
  const encrypted = Buffer.concat([
    cipher.update(buffer),
    cipher.final()
  ]);
  
  // Ottieni auth tag
  const authTag = cipher.getAuthTag();
  
  // Combina salt + iv + authTag + encrypted
  return Buffer.concat([salt, iv, authTag, encrypted]);
}

/**
 * Decrittografa un buffer crittografato
 */
function decryptBuffer(encryptedBuffer, key) {
  if (!key) {
    throw new Error('Chiave di crittografia non configurata');
  }
  
  // Estrai componenti
  const salt = encryptedBuffer.slice(0, 16);
  const iv = encryptedBuffer.slice(16, 32);
  const authTag = encryptedBuffer.slice(32, 48);
  const encrypted = encryptedBuffer.slice(48);
  
  // Deriva chiave
  const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha256');
  
  // Crea decipher
  const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
  decipher.setAuthTag(authTag);
  
  // Decrittografa
  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);
}

/**
 * Anonimizza un array di record
 */
function anonymizeRecords(records, tableName) {
  return records.map(record => anonymizeRecord(record, tableName));
}

/**
 * Genera una chiave di crittografia casuale
 */
function generateEncryptionKey() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  anonymizeIPAddress,
  hashIdentifier,
  anonymizeRecord,
  anonymizeRecords,
  sanitizeMessage,
  sanitizeMetadata,
  encryptBuffer,
  decryptBuffer,
  generateEncryptionKey,
  GDPR_CONFIG
};

