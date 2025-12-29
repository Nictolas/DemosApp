const { Pool } = require('pg');
require('dotenv').config();

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Importa le utilità per la conversione geografica
const { compressRegione, decompressRegione } = require('./api/utils/regioniUtils');
const { compressProvince, decompressProvince } = require('./api/utils/provinceUtils');

async function updateEventiGeographicData() {
  try {
    console.log('🗺️ Aggiornamento dati geografici tabella eventi...');
    
    // Verifica che DATABASE_URL sia configurata correttamente
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('username:password')) {
      console.log('❌ DATABASE_URL non configurata correttamente nel file .env');
      console.log('📝 Assicurati che DATABASE_URL contenga la stringa di connessione corretta a Neon');
      return;
    }
    
    const client = await pool.connect();
    console.log('✅ Connesso al database Neon');
    
    // Prima controlliamo se la tabella esiste
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'eventi'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('❌ Tabella eventi non trovata');
      return;
    }
    
    console.log('📋 Tabella eventi trovata, procedo con l\'aggiornamento...');
    
    // Ottieni tutti gli eventi esistenti
    const result = await client.query(`
      SELECT id, paese_evento, regione_evento, provincia_evento 
      FROM eventi 
      WHERE paese_evento IS NOT NULL OR regione_evento IS NOT NULL OR provincia_evento IS NOT NULL
    `);
    
    console.log(`📊 Trovati ${result.rows.length} eventi da aggiornare`);
    
    let updatedCount = 0;
    
    for (const evento of result.rows) {
      let needsUpdate = false;
      let newPaeseEvento = evento.paese_evento;
      let newRegioneEvento = evento.regione_evento;
      let newProvinciaEvento = evento.provincia_evento;
      
      // 1. Aggiorna paese_evento da "Italia" a "it"
      if (evento.paese_evento === 'Italia') {
        newPaeseEvento = 'it';
        needsUpdate = true;
        console.log(`🔄 Evento ${evento.id}: paese_evento "Italia" -> "it"`);
      }
      
      // 2. Aggiorna regione_evento per usare le sigle standard
      if (evento.regione_evento && evento.regione_evento !== '') {
        const compressedRegione = compressRegione(evento.regione_evento);
        if (compressedRegione && compressedRegione !== evento.regione_evento) {
          newRegioneEvento = compressedRegione;
          needsUpdate = true;
          console.log(`🔄 Evento ${evento.id}: regione_evento "${evento.regione_evento}" -> "${compressedRegione}"`);
        }
      }
      
      // 3. Aggiorna provincia_evento per usare le targhe standard
      if (evento.provincia_evento && evento.provincia_evento !== '') {
        const compressedProvincia = compressProvince(evento.provincia_evento);
        if (compressedProvincia && compressedProvincia !== evento.provincia_evento) {
          newProvinciaEvento = compressedProvincia;
          needsUpdate = true;
          console.log(`🔄 Evento ${evento.id}: provincia_evento "${evento.provincia_evento}" -> "${compressedProvincia}"`);
        }
      }
      
      // Esegui l'aggiornamento se necessario
      if (needsUpdate) {
        await client.query(`
          UPDATE eventi 
          SET paese_evento = $1, regione_evento = $2, provincia_evento = $3, updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
        `, [newPaeseEvento, newRegioneEvento, newProvinciaEvento, evento.id]);
        
        updatedCount++;
        console.log(`✅ Evento ${evento.id} aggiornato`);
      }
    }
    
    console.log(`🎉 Aggiornamento completato! ${updatedCount} eventi modificati su ${result.rows.length} totali`);
    
    // Verifica finale
    const finalCheck = await client.query(`
      SELECT COUNT(*) as total,
             COUNT(CASE WHEN paese_evento = 'it' THEN 1 END) as paese_it,
             COUNT(CASE WHEN regione_evento ~ '^[A-Z]{2}$' THEN 1 END) as regioni_sigle,
             COUNT(CASE WHEN provincia_evento ~ '^[A-Z]{2}$' THEN 1 END) as province_targhe
      FROM eventi
    `);
    
    console.log('📊 Statistiche finali:');
    console.log(`   - Totale eventi: ${finalCheck.rows[0].total}`);
    console.log(`   - Paese "it": ${finalCheck.rows[0].paese_it}`);
    console.log(`   - Regioni con sigle (2 lettere): ${finalCheck.rows[0].regioni_sigle}`);
    console.log(`   - Province con targhe (2 lettere): ${finalCheck.rows[0].province_targhe}`);
    
  } catch (error) {
    console.error('❌ Errore durante l\'aggiornamento:', error);
    console.error('❌ Stack trace:', error.stack);
  } finally {
    await pool.end();
    console.log('🔌 Connessione database chiusa');
  }
}

// Esegui lo script
updateEventiGeographicData();
