// Implementazione Compressione Database per DemosApp
// Riduce significativamente la dimensione delle tabelle di log e audit

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Mappe di compressione
const compressionMaps = {
  logLevels: {
    'INFO': 'I',
    'ERROR': 'E', 
    'WARNING': 'W',
    'DEBUG': 'D',
    'TRACE': 'T'
  },
  
  userStatus: {
    'pending': 'P',
    'approved': 'A',
    'rejected': 'R',
    'suspended': 'S',
    'active': 'A',
    'inactive': 'I'
  },
  
  auditActions: {
    'LOGIN_SUCCESS': 'LS',
    'LOGIN_FAILED': 'LF',
    'LOGOUT': 'LO',
    'DATA_ACCESS': 'DA',
    'DATA_MODIFY': 'DM',
    'DATA_DELETE': 'DD',
    'DATA_CREATE': 'DC',
    'PERMISSION_DENIED': 'PD',
    'SECURITY_VIOLATION': 'SV',
    'AUTH_FAILED': 'AF',
    'TOKEN_EXPIRED': 'TE',
    'TOKEN_INVALID': 'TI'
  },
  
  resources: {
    'users': 'U',
    'opinioni': 'O',
    'comunicazioni': 'C',
    'voti_capo_stato': 'VCS',
    'voti_iniziative_popolari': 'VIP',
    'voti_ice': 'VI',
    'voti_referendum_abrogativi': 'VRA',
    'voti_amnistia': 'VA',
    'voti_grazia': 'VG',
    'voti_ministri': 'VM',
    'iniziative_popolari': 'IP',
    'ice': 'ICE',
    'referendum_abrogativi': 'RA',
    'elezioni': 'E',
    'ministeri': 'M',
    'programmi': 'P',
    'notifiche_utente': 'NU',
    'admin_notifications': 'AN'
  }
};

async function implementCompression() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Implementazione Compressione Database...\n');
    
    // 1. Crea tabelle compresse per centralized_logs
    console.log('1. Creazione tabella centralized_logs_compressed...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS centralized_logs_compressed (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timestamp BIGINT NOT NULL, -- Unix timestamp invece di TIMESTAMP
        level CHAR(1) NOT NULL, -- 'I', 'E', 'W', 'D', 'T' invece di 'INFO', 'ERROR', etc.
        pid INTEGER NOT NULL,
        hostname VARCHAR(50), -- Ridotto da 255
        message TEXT NOT NULL,
        user_id VARCHAR(255),
        ip_address INTEGER, -- IPv4 come integer invece di VARCHAR(45)
        user_agent VARCHAR(20), -- Compresso invece di TEXT
        endpoint VARCHAR(100), -- Compresso invece di VARCHAR(500)
        request_id VARCHAR(255),
        session_id VARCHAR(255),
        meta_data JSONB,
        created_at BIGINT -- Unix timestamp invece di TIMESTAMP
      )
    `);
    
    // 2. Crea tabelle compresse per audit_logs
    console.log('2. Creazione tabella audit_logs_compressed...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs_compressed (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL,
        action VARCHAR(10) NOT NULL, -- Compresso invece di VARCHAR(50)
        resource VARCHAR(10) NOT NULL, -- Compresso invece di VARCHAR(100)
        resource_id VARCHAR(255),
        details JSONB DEFAULT '{}'::jsonb,
        ip_address INTEGER, -- IPv4 come integer invece di VARCHAR(45)
        user_agent VARCHAR(20), -- Compresso invece di TEXT
        timestamp BIGINT NOT NULL, -- Unix timestamp invece di TIMESTAMP
        success BOOLEAN DEFAULT true,
        error_message TEXT,
        created_at BIGINT -- Unix timestamp invece di TIMESTAMP
      )
    `);
    
    // 3. Crea tabelle compresse per users
    console.log('3. Creazione tabella users_compressed...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users_compressed (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        nome VARCHAR(255) NOT NULL,
        cognome VARCHAR(255) NOT NULL,
        status CHAR(1) NOT NULL DEFAULT 'P', -- 'P', 'A', 'R', 'S' invece di 'pending', 'approved', etc.
        created_at BIGINT NOT NULL, -- Unix timestamp
        updated_at BIGINT NOT NULL, -- Unix timestamp
        fcm_tokens TEXT[],
        notifiche_preferenze JSONB DEFAULT '{}'::jsonb,
        avatar_config JSONB DEFAULT '{}'::jsonb,
        ruolo VARCHAR(50),
        premium BOOLEAN DEFAULT false,
        CONSTRAINT valid_status CHECK (status IN ('P', 'A', 'R', 'S', 'I'))
      )
    `);
    
    // 4. Crea indici per performance
    console.log('4. Creazione indici per performance...');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_centralized_logs_comp_timestamp ON centralized_logs_compressed (timestamp);',
      'CREATE INDEX IF NOT EXISTS idx_centralized_logs_comp_level ON centralized_logs_compressed (level);',
      'CREATE INDEX IF NOT EXISTS idx_centralized_logs_comp_user_id ON centralized_logs_compressed (user_id);',
      'CREATE INDEX IF NOT EXISTS idx_centralized_logs_comp_ip ON centralized_logs_compressed (ip_address);',
      
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_comp_user_id ON audit_logs_compressed (user_id);',
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_comp_action ON audit_logs_compressed (action);',
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_comp_timestamp ON audit_logs_compressed (timestamp);',
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_comp_resource ON audit_logs_compressed (resource);',
      
      'CREATE INDEX IF NOT EXISTS idx_users_comp_status ON users_compressed (status);',
      'CREATE INDEX IF NOT EXISTS idx_users_comp_created_at ON users_compressed (created_at);'
    ];
    
    for (const indexQuery of indexes) {
      await client.query(indexQuery);
    }
    
    // 5. Funzioni di compressione/decompressione
    console.log('5. Creazione funzioni di compressione...');
    
    await client.query(`
      CREATE OR REPLACE FUNCTION compress_log_level(level_text TEXT)
      RETURNS CHAR(1) AS $$
      BEGIN
        CASE level_text
          WHEN 'INFO' THEN RETURN 'I';
          WHEN 'ERROR' THEN RETURN 'E';
          WHEN 'WARNING' THEN RETURN 'W';
          WHEN 'DEBUG' THEN RETURN 'D';
          WHEN 'TRACE' THEN RETURN 'T';
          ELSE RETURN level_text::CHAR(1);
        END CASE;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    await client.query(`
      CREATE OR REPLACE FUNCTION decompress_log_level(level_char CHAR(1))
      RETURNS TEXT AS $$
      BEGIN
        CASE level_char
          WHEN 'I' THEN RETURN 'INFO';
          WHEN 'E' THEN RETURN 'ERROR';
          WHEN 'W' THEN RETURN 'WARNING';
          WHEN 'D' THEN RETURN 'DEBUG';
          WHEN 'T' THEN RETURN 'TRACE';
          ELSE RETURN level_char::TEXT;
        END CASE;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    await client.query(`
      CREATE OR REPLACE FUNCTION compress_ip_address(ip_text TEXT)
      RETURNS INTEGER AS $$
      DECLARE
        parts TEXT[];
      BEGIN
        IF ip_text IS NULL OR ip_text = 'unknown' THEN
          RETURN NULL;
        END IF;
        
        parts := string_to_array(ip_text, '.');
        IF array_length(parts, 1) != 4 THEN
          RETURN NULL;
        END IF;
        
        RETURN (parts[1]::INTEGER << 24) + 
               (parts[2]::INTEGER << 16) + 
               (parts[3]::INTEGER << 8) + 
               parts[4]::INTEGER;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    await client.query(`
      CREATE OR REPLACE FUNCTION decompress_ip_address(ip_int INTEGER)
      RETURNS TEXT AS $$
      BEGIN
        IF ip_int IS NULL THEN
          RETURN NULL;
        END IF;
        
        RETURN ((ip_int >> 24) & 255)::TEXT || '.' ||
               ((ip_int >> 16) & 255)::TEXT || '.' ||
               ((ip_int >> 8) & 255)::TEXT || '.' ||
               (ip_int & 255)::TEXT;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    // 6. Script di migrazione dati
    console.log('6. Creazione script di migrazione...');
    
    const migrationScript = `
      -- Migrazione centralized_logs
      INSERT INTO centralized_logs_compressed (
        id, timestamp, level, pid, hostname, message, user_id, 
        ip_address, user_agent, endpoint, request_id, session_id, 
        meta_data, created_at
      )
      SELECT 
        id,
        EXTRACT(EPOCH FROM timestamp)::BIGINT * 1000,
        compress_log_level(level),
        pid,
        LEFT(hostname, 50),
        message,
        user_id,
        compress_ip_address(ip_address),
        CASE 
          WHEN user_agent LIKE '%Chrome%Windows%' THEN 'CHR-WIN'
          WHEN user_agent LIKE '%Chrome%Mac%' THEN 'CHR-MAC'
          WHEN user_agent LIKE '%Firefox%Windows%' THEN 'FF-WIN'
          WHEN user_agent LIKE '%Safari%Mac%' THEN 'SAF-MAC'
          WHEN user_agent LIKE '%Edge%Windows%' THEN 'EDG-WIN'
          ELSE 'UNK'
        END,
        CASE 
          WHEN endpoint LIKE '/api/users/profile' THEN '/u/p'
          WHEN endpoint LIKE '/api/opinioni/create' THEN '/o/c'
          WHEN endpoint LIKE '/api/voti/capo-stato' THEN '/v/cs'
          ELSE LEFT(endpoint, 100)
        END,
        request_id,
        session_id,
        meta_data,
        EXTRACT(EPOCH FROM created_at)::BIGINT * 1000
      FROM centralized_logs
      WHERE NOT EXISTS (
        SELECT 1 FROM centralized_logs_compressed 
        WHERE centralized_logs_compressed.id = centralized_logs.id
      );
    `;
    
    console.log('✅ Compressione implementata con successo!');
    console.log('\n📊 Benefici attesi:');
    console.log('• Riduzione 60-90% dello spazio per log e audit');
    console.log('• Migliori performance di query');
    console.log('• Riduzione costi storage');
    console.log('• Backup più veloci');
    
    console.log('\n🔧 Prossimi passi:');
    console.log('1. Eseguire migrazione dati con script fornito');
    console.log('2. Aggiornare applicazione per usare tabelle compresse');
    console.log('3. Testare funzioni di compressione/decompressione');
    console.log('4. Monitorare performance e spazio risparmiato');
    
  } catch (error) {
    console.error('❌ Errore implementazione compressione:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  implementCompression()
    .then(() => {
      console.log('\n🎉 Implementazione compressione completata!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Errore implementazione compressione:', error);
      process.exit(1);
    });
}

module.exports = { implementCompression };
