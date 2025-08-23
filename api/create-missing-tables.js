require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function createMissingTables() {
  try {
    console.log('🔧 CREAZIONE TABELLE MANCANTI');
    console.log('=' .repeat(60));
    
    // 1. Crea tabella categorie_opinioni
    console.log('📋 Creazione tabella categorie_opinioni...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS categorie_opinioni (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(100) NOT NULL UNIQUE,
        descrizione TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Inserisci categorie di default
    const categorieOpinioni = [
      'Politica',
      'Economia',
      'Ambiente',
      'Salute',
      'Istruzione',
      'Sicurezza',
      'Trasporti',
      'Cultura',
      'Sport',
      'Tecnologia'
    ];
    
    for (const categoria of categorieOpinioni) {
      try {
        await pool.query(
          'INSERT INTO categorie_opinioni (nome) VALUES ($1) ON CONFLICT (nome) DO NOTHING',
          [categoria]
        );
      } catch (error) {
        console.log(`  ⚠️ Categoria ${categoria} già esistente`);
      }
    }
    console.log('✅ Tabella categorie_opinioni creata e popolata');
    
    // 2. Crea tabella categorie_rappresentanti
    console.log('\n📋 Creazione tabella categorie_rappresentanti...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS categorie_rappresentanti (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(100) NOT NULL UNIQUE,
        descrizione TEXT,
        livello VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Inserisci categorie di default
    const categorieRappresentanti = [
      { nome: 'Europeo', livello: 'europeo' },
      { nome: 'Camera', livello: 'nazionale' },
      { nome: 'Senato', livello: 'nazionale' },
      { nome: 'Regionale', livello: 'regionale' },
      { nome: 'Comunale', livello: 'comunale' }
    ];
    
    for (const categoria of categorieRappresentanti) {
      try {
        await pool.query(
          'INSERT INTO categorie_rappresentanti (nome, livello) VALUES ($1, $2) ON CONFLICT (nome) DO NOTHING',
          [categoria.nome, categoria.livello]
        );
      } catch (error) {
        console.log(`  ⚠️ Categoria ${categoria.nome} già esistente`);
      }
    }
    console.log('✅ Tabella categorie_rappresentanti creata e popolata');
    
    // 3. Crea tabella voti_governo (alias per voti_ministri)
    console.log('\n📋 Creazione tabella voti_governo (alias)...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS voti_governo (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        ministero_id INTEGER REFERENCES ministeri(id) ON DELETE CASCADE,
        candidato VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Tabella voti_governo creata');
    
    // 4. Verifica finale
    console.log('\n🔍 VERIFICA FINALE TABELLE:');
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('categorie_opinioni', 'categorie_rappresentanti', 'voti_governo')
      ORDER BY table_name
    `);
    
    tablesResult.rows.forEach(row => {
      console.log(`  ✅ ${row.table_name}: CREATA`);
    });
    
    console.log('\n🎉 TUTTE LE TABELLE MANCANTI SONO STATE CREATE!');
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

createMissingTables();
