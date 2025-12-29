const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createAuditLogsCompressionFunctions() {
  const client = await pool.connect();
  try {
    console.log('🔧 Creazione funzioni di compressione per audit_logs...');

    // 1. Funzione per comprimere le azioni
    console.log('\n1. Creazione compress_audit_action...');
    await client.query(`
      CREATE OR REPLACE FUNCTION compress_audit_action(action_text TEXT)
      RETURNS VARCHAR(3) AS $$
      BEGIN
        IF action_text IS NULL THEN
          RETURN NULL;
        END IF;
        
        RETURN CASE 
          WHEN action_text = 'DATA_ACCESS' THEN 'DA'
          WHEN action_text = 'AUTH_OPERATION' THEN 'AO'
          WHEN action_text = 'DATA_CREATE' THEN 'DC'
          WHEN action_text = 'LOGIN_FAILED' THEN 'LF'
          WHEN action_text = 'DATA_DELETION_REQUEST' THEN 'DD'
          WHEN action_text = 'PROFILE_UPDATE' THEN 'PU'
          WHEN action_text = 'GDPR_CONSENT_GIVEN' THEN 'GC'
          WHEN action_text = 'LOGIN_SUCCESS' THEN 'LS'
          WHEN action_text = 'LOGOUT_SUCCESS' THEN 'LO'
          WHEN action_text = 'PASSWORD_CHANGE' THEN 'PC'
          WHEN action_text = 'ACCOUNT_LOCKED' THEN 'AL'
          WHEN action_text = 'SUSPICIOUS_ACTIVITY' THEN 'SA'
          WHEN action_text = 'DATA_EXPORT' THEN 'DE'
          WHEN action_text = 'DATA_DELETE' THEN 'DL'
          WHEN action_text = 'PERMISSION_DENIED' THEN 'PD'
          ELSE LEFT(action_text, 3) -- Fallback per azioni non mappate
        END;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('   ✅ compress_audit_action creata');

    // 2. Funzione per decomprimere le azioni
    console.log('\n2. Creazione decompress_audit_action...');
    await client.query(`
      CREATE OR REPLACE FUNCTION decompress_audit_action(action_code VARCHAR(3))
      RETURNS TEXT AS $$
      BEGIN
        IF action_code IS NULL THEN
          RETURN NULL;
        END IF;
        
        RETURN CASE 
          WHEN action_code = 'DA' THEN 'DATA_ACCESS'
          WHEN action_code = 'AO' THEN 'AUTH_OPERATION'
          WHEN action_code = 'DC' THEN 'DATA_CREATE'
          WHEN action_code = 'LF' THEN 'LOGIN_FAILED'
          WHEN action_code = 'DD' THEN 'DATA_DELETION_REQUEST'
          WHEN action_code = 'PU' THEN 'PROFILE_UPDATE'
          WHEN action_code = 'GC' THEN 'GDPR_CONSENT_GIVEN'
          WHEN action_code = 'LS' THEN 'LOGIN_SUCCESS'
          WHEN action_code = 'LO' THEN 'LOGOUT_SUCCESS'
          WHEN action_code = 'PC' THEN 'PASSWORD_CHANGE'
          WHEN action_code = 'AL' THEN 'ACCOUNT_LOCKED'
          WHEN action_code = 'SA' THEN 'SUSPICIOUS_ACTIVITY'
          WHEN action_code = 'DE' THEN 'DATA_EXPORT'
          WHEN action_code = 'DL' THEN 'DATA_DELETE'
          WHEN action_code = 'PD' THEN 'PERMISSION_DENIED'
          ELSE action_code -- Fallback per codici non mappati
        END;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('   ✅ decompress_audit_action creata');

    // 3. Funzione per comprimere le risorse
    console.log('\n3. Creazione compress_audit_resource...');
    await client.query(`
      CREATE OR REPLACE FUNCTION compress_audit_resource(resource_text TEXT)
      RETURNS VARCHAR(10) AS $$
      BEGIN
        IF resource_text IS NULL THEN
          RETURN NULL;
        END IF;
        
        RETURN CASE 
          WHEN resource_text = 'users' THEN 'usr'
          WHEN resource_text = 'profiles' THEN 'prof'
          WHEN resource_text = 'elections' THEN 'elec'
          WHEN resource_text = 'votes' THEN 'vote'
          WHEN resource_text = 'candidates' THEN 'cand'
          WHEN resource_text = 'representatives' THEN 'repr'
          WHEN resource_text = 'ministers' THEN 'min'
          WHEN resource_text = 'initiatives' THEN 'init'
          WHEN resource_text = 'referendums' THEN 'ref'
          WHEN resource_text = 'consents' THEN 'cons'
          WHEN resource_text = 'audit_logs' THEN 'audit'
          WHEN resource_text = 'security_events' THEN 'sec'
          WHEN resource_text = 'sessions' THEN 'sess'
          WHEN resource_text = 'tokens' THEN 'tok'
          ELSE LEFT(resource_text, 10) -- Fallback per risorse non mappate
        END;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('   ✅ compress_audit_resource creata');

    // 4. Funzione per decomprimere le risorse
    console.log('\n4. Creazione decompress_audit_resource...');
    await client.query(`
      CREATE OR REPLACE FUNCTION decompress_audit_resource(resource_code VARCHAR(10))
      RETURNS TEXT AS $$
      BEGIN
        IF resource_code IS NULL THEN
          RETURN NULL;
        END IF;
        
        RETURN CASE 
          WHEN resource_code = 'usr' THEN 'users'
          WHEN resource_code = 'prof' THEN 'profiles'
          WHEN resource_code = 'elec' THEN 'elections'
          WHEN resource_code = 'vote' THEN 'votes'
          WHEN resource_code = 'cand' THEN 'candidates'
          WHEN resource_code = 'repr' THEN 'representatives'
          WHEN resource_code = 'min' THEN 'ministers'
          WHEN resource_code = 'init' THEN 'initiatives'
          WHEN resource_code = 'ref' THEN 'referendums'
          WHEN resource_code = 'cons' THEN 'consents'
          WHEN resource_code = 'audit' THEN 'audit_logs'
          WHEN resource_code = 'sec' THEN 'security_events'
          WHEN resource_code = 'sess' THEN 'sessions'
          WHEN resource_code = 'tok' THEN 'tokens'
          ELSE resource_code -- Fallback per codici non mappati
        END;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('   ✅ decompress_audit_resource creata');

    // 5. Funzione per comprimere user agents (specifica per audit_logs)
    console.log('\n5. Creazione compress_audit_user_agent...');
    await client.query(`
      CREATE OR REPLACE FUNCTION compress_audit_user_agent(ua_text TEXT)
      RETURNS VARCHAR(20) AS $$
      BEGIN
        IF ua_text IS NULL OR ua_text = '' THEN
          RETURN NULL;
        END IF;
        
        -- Pattern matching per user agents comuni
        IF ua_text ILIKE '%chrome%windows%' THEN
          RETURN 'CHR-WIN';
        ELSIF ua_text ILIKE '%chrome%mac%' THEN
          RETURN 'CHR-MAC';
        ELSIF ua_text ILIKE '%chrome%linux%' THEN
          RETURN 'CHR-LIN';
        ELSIF ua_text ILIKE '%firefox%windows%' THEN
          RETURN 'FF-WIN';
        ELSIF ua_text ILIKE '%firefox%mac%' THEN
          RETURN 'FF-MAC';
        ELSIF ua_text ILIKE '%safari%iphone%' THEN
          RETURN 'SAF-IOS';
        ELSIF ua_text ILIKE '%safari%ipad%' THEN
          RETURN 'SAF-IPAD';
        ELSIF ua_text ILIKE '%android%chrome%' THEN
          RETURN 'AND-CHR';
        ELSIF ua_text ILIKE '%edge%windows%' THEN
          RETURN 'EDG-WIN';
        ELSIF ua_text ILIKE '%opera%' THEN
          RETURN 'OPERA';
        ELSIF ua_text ILIKE '%bot%' OR ua_text ILIKE '%crawler%' THEN
          RETURN 'BOT';
        ELSIF ua_text ILIKE '%mobile%' THEN
          RETURN 'MOBILE';
        ELSIF ua_text ILIKE '%tablet%' THEN
          RETURN 'TABLET';
        ELSE
          RETURN 'UNK';
        END IF;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('   ✅ compress_audit_user_agent creata');

    // 6. Funzione per decomprimere user agents
    console.log('\n6. Creazione decompress_audit_user_agent...');
    await client.query(`
      CREATE OR REPLACE FUNCTION decompress_audit_user_agent(ua_code VARCHAR(20))
      RETURNS TEXT AS $$
      BEGIN
        IF ua_code IS NULL THEN
          RETURN NULL;
        END IF;
        
        RETURN CASE 
          WHEN ua_code = 'CHR-WIN' THEN 'Chrome/Windows'
          WHEN ua_code = 'CHR-MAC' THEN 'Chrome/macOS'
          WHEN ua_code = 'CHR-LIN' THEN 'Chrome/Linux'
          WHEN ua_code = 'FF-WIN' THEN 'Firefox/Windows'
          WHEN ua_code = 'FF-MAC' THEN 'Firefox/macOS'
          WHEN ua_code = 'SAF-IOS' THEN 'Safari/iOS'
          WHEN ua_code = 'SAF-IPAD' THEN 'Safari/iPad'
          WHEN ua_code = 'AND-CHR' THEN 'Chrome/Android'
          WHEN ua_code = 'EDG-WIN' THEN 'Edge/Windows'
          WHEN ua_code = 'OPERA' THEN 'Opera'
          WHEN ua_code = 'BOT' THEN 'Bot/Crawler'
          WHEN ua_code = 'MOBILE' THEN 'Mobile Browser'
          WHEN ua_code = 'TABLET' THEN 'Tablet Browser'
          WHEN ua_code = 'UNK' THEN 'Unknown Browser'
          ELSE ua_code -- Fallback per codici non mappati
        END;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('   ✅ decompress_audit_user_agent creata');

    console.log('\n✅ Tutte le funzioni di compressione per audit_logs create con successo!');

  } finally {
    client.release();
    await pool.end();
  }
}

createAuditLogsCompressionFunctions().catch(console.error);
