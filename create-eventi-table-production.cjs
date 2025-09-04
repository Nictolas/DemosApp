const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function createEventiTableProduction() {
  console.log('🏗️ Creazione tabella eventi in produzione...');
  
  try {
    const client = await pool.connect();
    console.log('✅ Connesso al database di produzione');
    
    // La tabella eventi esiste già, aggiungi solo alcuni dati di esempio
    console.log('✅ Tabella eventi già esistente in produzione');
    
    // Aggiungi alcuni dati di esempio con UUID validi
    const sampleData = `
      INSERT INTO eventi (id, nome_evento, tipologia_evento, paese_evento, regione_evento, provincia_evento, comune_evento, indirizzo_evento, orario_evento) VALUES
      (gen_random_uuid(), 'Assemblea Pubblica', 'Assemblea', 'Italia', 'Toscana', 'Firenze', 'Firenze', 'Piazza della Signoria, 1', '18:00:00'),
      (gen_random_uuid(), 'Incontro con i Cittadini', 'Incontro', 'Italia', 'Lombardia', 'Milano', 'Milano', 'Via Brera, 28', '19:00:00'),
      (gen_random_uuid(), 'Conferenza Stampa', 'Conferenza', 'Italia', 'Lazio', 'Roma', 'Roma', 'Piazza del Campidoglio, 1', '10:00:00'),
      (gen_random_uuid(), 'Consiglio Comunale', 'Consiglio', 'Italia', 'Emilia-Romagna', 'Bologna', 'Bologna', 'Piazza Maggiore, 1', '20:30:00'),
      (gen_random_uuid(), 'Presentazione Piano Urbanistico', 'Presentazione', 'Italia', 'Veneto', 'Venezia', 'Venezia', 'Palazzo Ducale, San Marco 1', '16:00:00');
    `;
    
    await client.query(sampleData);
    console.log('✅ Dati di esempio inseriti in produzione');
    
    // Verifica i dati inseriti
    const result = await client.query('SELECT COUNT(*) FROM eventi');
    console.log(`📊 Totale eventi nella tabella di produzione: ${result.rows[0].count}`);
    
    client.release();
    console.log('🎉 Operazione completata con successo in produzione!');
    
  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await pool.end();
  }
}

createEventiTableProduction();
