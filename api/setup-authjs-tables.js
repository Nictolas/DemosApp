const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Schema per le tabelle Auth.js
const authJsSchema = `
-- Tabelle per Auth.js (NextAuth.js)

CREATE TABLE IF NOT EXISTS accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type VARCHAR(255) NOT NULL,
  provider VARCHAR(255) NOT NULL,
  provider_account_id VARCHAR(255) NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at BIGINT,
  token_type VARCHAR(255),
  scope VARCHAR(255),
  id_token TEXT,
  session_state VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  user_id UUID NOT NULL,
  expires TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  email_verified TIMESTAMP WITH TIME ZONE,
  image VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier VARCHAR(255) NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- Indici per prestazioni
CREATE INDEX IF NOT EXISTS accounts_user_id_idx ON accounts(user_id);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_session_token_idx ON sessions(session_token);

-- Foreign keys (rimosso IF NOT EXISTS che non è supportato)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounts_user_id_fkey') THEN
    ALTER TABLE accounts ADD CONSTRAINT accounts_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sessions_user_id_fkey') THEN
    ALTER TABLE sessions ADD CONSTRAINT sessions_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Migrazione dati dalla tabella utenti esistente
INSERT INTO users (id, name, email, email_verified, created_at)
SELECT 
  gen_random_uuid(),
  COALESCE(nome || ' ' || NULLIF(cognome, ''), nome, email),
  email,
  NOW(),
  COALESCE(created_at, NOW())
FROM utenti 
WHERE email IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM users WHERE users.email = utenti.email);
`;

async function setupAuthJsTables() {
  try {
    console.log('🔧 Creazione tabelle Auth.js...');
    
    await pool.query(authJsSchema);
    
    console.log('✅ Tabelle Auth.js create con successo!');
    console.log('📊 Tabelle create:');
    console.log('   - accounts (account provider)');
    console.log('   - sessions (sessioni utente)');
    console.log('   - users (utenti Auth.js)');
    console.log('   - verification_tokens (token verifica email)');
    
    // Verifica migrazione dati
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    console.log(`📈 Utenti migrati: ${userCount.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Errore creazione tabelle Auth.js:', error);
  } finally {
    await pool.end();
  }
}

setupAuthJsTables();
