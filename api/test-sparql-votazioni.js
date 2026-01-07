const axios = require('axios');

async function findVotazioni() {
  const endpoint = 'http://dati.camera.it/sparql';
  
  console.log('🔍 Cerca tipi disponibili...\n');
  
  // Prima trova tutti i tipi disponibili
  const typesQuery = `SELECT DISTINCT ?type WHERE { ?s a ?type } LIMIT 50`;
  const params1 = new URLSearchParams();
  params1.append('query', typesQuery);
  params1.append('format', 'json');
  
  try {
    const response1 = await axios.get(`${endpoint}?${params1.toString()}`, {
      headers: {
        'Accept': 'application/sparql-results+json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 30000
    });
    
    const types = response1.data?.results?.bindings || [];
    console.log(`📊 Trovati ${types.length} tipi diversi\n`);
    
    // Cerca tipi che contengono "vot" o "Vot"
    const votTypes = types.filter(t => 
      t.type?.value?.toLowerCase().includes('vot') || 
      t.type?.value?.toLowerCase().includes('ballot')
    );
    
    if (votTypes.length > 0) {
      console.log('✅ Tipi trovati che contengono "vot":');
      votTypes.forEach(t => console.log(`   - ${t.type.value}`));
      console.log();
    }
    
    // Prova diverse varianti di query per votazioni
    const queries = [
      {
        name: 'Query con ocd:Votazione',
        query: `PREFIX ocd: <http://dati.camera.it/ocd/> SELECT ?v WHERE { ?v a ocd:Votazione } LIMIT 5`
      },
      {
        name: 'Query con URI completo Votazione',
        query: `SELECT ?v WHERE { ?v a <http://dati.camera.it/ocd/Votazione> } LIMIT 5`
      },
      {
        name: 'Query cerca qualsiasi cosa con "votazione" nel nome',
        query: `SELECT ?s WHERE { ?s ?p ?o . FILTER(CONTAINS(LCASE(STR(?s)), "votazione")) } LIMIT 5`
      },
      {
        name: 'Query cerca seduta (potrebbe contenere votazioni)',
        query: `PREFIX ocd: <http://dati.camera.it/ocd/> SELECT ?s WHERE { ?s a ocd:Seduta } LIMIT 5`
      }
    ];
    
    for (const test of queries) {
      console.log(`\n🔍 ${test.name}...`);
      const params = new URLSearchParams();
      params.append('query', test.query);
      params.append('format', 'json');
      
      try {
        const response = await axios.get(`${endpoint}?${params.toString()}`, {
          headers: {
            'Accept': 'application/sparql-results+json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 30000
        });
        
        const bindings = response.data?.results?.bindings || [];
        console.log(`   📊 Risultati: ${bindings.length}`);
        
        if (bindings.length > 0) {
          console.log(`   ✅ SUCCESSO! Primi risultati:`);
          bindings.slice(0, 2).forEach((b, i) => {
            const key = Object.keys(b)[0];
            console.log(`      ${i+1}. ${b[key]?.value || 'N/A'}`);
          });
          return test.query;
        }
      } catch (error) {
        console.log(`   ❌ Errore: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  }
  
  return null;
}

findVotazioni().then(query => {
  if (query) {
    console.log(`\n✅ Query funzionante: ${query}`);
  } else {
    console.log('\n⚠️ Nessuna query per votazioni ha restituito risultati');
  }
  process.exit(0);
});

