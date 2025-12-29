const { Pool } = require('pg');
require('dotenv').config();

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function addSampleActivismTypes() {
  console.log('🚀 Aggiungendo tipologie di attivismo di esempio...');
  
  try {
    // Prima vediamo quali attivisti abbiamo
    const attivisti = await pool.query(`
      SELECT id, nome, cognome, ruolo, tipologie_attivismo
      FROM users 
      WHERE ruolo = 'Attivista'
      ORDER BY created_at DESC
    `);
    
    console.log(`📊 Trovati ${attivisti.rows.length} attivisti:`);
    attivisti.rows.forEach((attivista, index) => {
      console.log(`${index + 1}. ${attivista.nome} ${attivista.cognome} (ID: ${attivista.id})`);
      console.log(`   Tipologie attuali: ${JSON.stringify(attivista.tipologie_attivismo)}`);
    });
    
    if (attivisti.rows.length === 0) {
      console.log('❌ Nessun attivista trovato!');
      return;
    }
    
    // Definiamo tipologie di esempio per ogni attivista
    const tipologieEsempio = [
      // Attivista 1
      [
        {
          tipo: "ambiente",
          emoji: "🌱",
          nome: "Ambiente e Sostenibilità",
          descrizione: "Protezione dell'ambiente, sostenibilità, cambiamenti climatici",
          colore: "#22c55e"
        },
        {
          tipo: "diritti_umani",
          emoji: "🤝",
          nome: "Diritti Umani",
          descrizione: "Tutela dei diritti fondamentali, uguaglianza, giustizia sociale",
          colore: "#3b82f6"
        }
      ],
      // Attivista 2
      [
        {
          tipo: "educazione",
          emoji: "📚",
          nome: "Educazione",
          descrizione: "Accesso all'istruzione, formazione, cultura",
          colore: "#8b5cf6"
        },
        {
          tipo: "sanita",
          emoji: "🏥",
          nome: "Sanità",
          descrizione: "Accesso alle cure, salute pubblica, benessere",
          colore: "#ef4444"
        },
        {
          tipo: "volontariato",
          emoji: "❤️",
          nome: "Volontariato",
          descrizione: "Aiuto sociale, solidarietà, supporto alla comunità",
          colore: "#f97316"
        }
      ],
      // Attivista 3
      [
        {
          tipo: "cultura",
          emoji: "🎭",
          nome: "Cultura e Arte",
          descrizione: "Promozione culturale, arte, patrimonio",
          colore: "#ec4899"
        },
        {
          tipo: "sport",
          emoji: "⚽",
          nome: "Sport",
          descrizione: "Promozione sportiva, attività fisica, benessere",
          colore: "#10b981"
        },
        {
          tipo: "tecnologia",
          emoji: "💻",
          nome: "Tecnologia e Innovazione",
          descrizione: "Innovazione digitale, accessibilità tecnologica",
          colore: "#6366f1"
        },
        {
          tipo: "animali",
          emoji: "🐕",
          nome: "Diritti degli Animali",
          descrizione: "Protezione animale, benessere, diritti",
          colore: "#84cc16"
        }
      ]
    ];
    
    // Aggiorna ogni attivista con le sue tipologie
    for (let i = 0; i < attivisti.rows.length && i < tipologieEsempio.length; i++) {
      const attivista = attivisti.rows[i];
      const tipologie = tipologieEsempio[i];
      
      console.log(`\n📝 Aggiornando ${attivista.nome} ${attivista.cognome}...`);
      console.log(`   Tipologie da aggiungere: ${tipologie.map(t => t.emoji + ' ' + t.nome).join(', ')}`);
      
      const result = await pool.query(
        'UPDATE users SET tipologie_attivismo = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING tipologie_attivismo',
        [JSON.stringify(tipologie), attivista.id]
      );
      
      console.log(`   ✅ Aggiornato con successo!`);
      console.log(`   📊 Risultato: ${JSON.stringify(result.rows[0].tipologie_attivismo, null, 2)}`);
    }
    
    // Verifica finale
    console.log('\n🔍 Verifica finale...');
    const attivistiAggiornati = await pool.query(`
      SELECT id, nome, cognome, tipologie_attivismo
      FROM users 
      WHERE ruolo = 'Attivista'
      ORDER BY created_at DESC
    `);
    
    console.log('\n📋 Attivisti con tipologie aggiornate:');
    attivistiAggiornati.rows.forEach((attivista, index) => {
      console.log(`\n${index + 1}. ${attivista.nome} ${attivista.cognome}`);
      if (attivista.tipologie_attivismo && attivista.tipologie_attivismo.length > 0) {
        attivista.tipologie_attivismo.forEach(tipologia => {
          console.log(`   ${tipologia.emoji} ${tipologia.nome}`);
        });
      } else {
        console.log('   ❌ Nessuna tipologia');
      }
    });
    
    // Test query per verificare che funzioni
    console.log('\n🧪 Test query...');
    const testQuery = await pool.query(`
      SELECT nome, cognome, tipologie_attivismo
      FROM users 
      WHERE ruolo = 'Attivista'
      AND tipologie_attivismo @> '[{"tipo": "ambiente"}]'
    `);
    
    console.log(`🔍 Attivisti con tipologia "ambiente": ${testQuery.rows.length}`);
    testQuery.rows.forEach(attivista => {
      console.log(`   - ${attivista.nome} ${attivista.cognome}`);
    });
    
    console.log('\n🎉 Tipologie di attivismo aggiunte con successo!');
    
  } catch (error) {
    console.error('❌ Errore durante l\'aggiunta delle tipologie:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Esegui lo script
addSampleActivismTypes()
  .then(() => {
    console.log('✅ Script completato');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script fallito:', error);
    process.exit(1);
  });
