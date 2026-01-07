const axios = require('axios');

async function esploraStruttura() {
  const endpoint = 'http://dati.camera.it/sparql';
  
  console.log('='.repeat(80));
  console.log('ESPLORAZIONE STRUTTURA COMPLETA');
  console.log('='.repeat(80));
  console.log();

  // Prendi una votazione specifica e vedi tutte le sue proprietà
  const query1 = `
    PREFIX ocd: <http://dati.camera.it/ocd/>
    
    SELECT ?votazione ?predicato ?oggetto
    WHERE {
      ?votazione a <http://dati.camera.it/ocd/votazione> .
      ?votazione ?predicato ?oggetto .
    }
    LIMIT 100
  `;
  
  const params1 = new URLSearchParams();
  params1.append('query', query1);
  params1.append('format', 'json');
  
  try {
    const response1 = await axios.get(`${endpoint}?${params1.toString()}`, {
      headers: {
        'Accept': 'application/sparql-results+json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 30000
    });
    
    const bindings = response1.data?.results?.bindings || [];
    console.log(`📊 Trovati ${bindings.length} bindings totali\n`);
    
    // Raggruppa per votazione e vedi tutti i predicati
    const votazioni = {};
    const tuttiPredicati = new Set();
    
    for (const binding of bindings) {
      const votazioneUri = binding.votazione?.value;
      const predicato = binding.predicato?.value;
      const oggetto = binding.oggetto?.value;
      
      if (!votazioni[votazioneUri]) {
        votazioni[votazioneUri] = {};
      }
      
      votazioni[votazioneUri][predicato] = oggetto;
      tuttiPredicati.add(predicato);
    }
    
    console.log(`📊 Votazioni analizzate: ${Object.keys(votazioni).length}`);
    console.log(`📊 Predicati totali trovati: ${tuttiPredicati.size}\n`);
    
    console.log('📋 TUTTI I PREDICATI TROVATI:');
    Array.from(tuttiPredicati).sort().forEach(p => {
      const nome = p.split('/').pop().split('#').pop();
      console.log(`   - ${nome} (${p})`);
    });
    console.log();
    
    // Mostra una votazione completa
    if (Object.keys(votazioni).length > 0) {
      const primaVotazione = Object.entries(votazioni)[0];
      console.log('📄 ESEMPIO VOTAZIONE COMPLETA:');
      console.log(`   URI: ${primaVotazione[0]}`);
      console.log('   Tutte le proprietà:');
      Object.entries(primaVotazione[1]).forEach(([pred, val]) => {
        const nomePred = pred.split('/').pop().split('#').pop();
        const valStr = String(val).length > 150 ? String(val).substring(0, 150) + '...' : String(val);
        console.log(`     ${nomePred}: ${valStr}`);
      });
      console.log();
    }
    
    // Cerca collegamenti con altri oggetti
    console.log('🔍 Cerca collegamenti con altri oggetti...\n');
    
    const query2 = `
      PREFIX ocd: <http://dati.camera.it/ocd/>
      
      SELECT ?votazione ?predicato ?oggetto
      WHERE {
        ?votazione a <http://dati.camera.it/ocd/votazione> .
        ?votazione ?predicato ?oggetto .
        FILTER(STRSTARTS(STR(?oggetto), "http://dati.camera.it/"))
      }
      LIMIT 50
    `;
    
    const params2 = new URLSearchParams();
    params2.append('query', query2);
    params2.append('format', 'json');
    
    const response2 = await axios.get(`${endpoint}?${params2.toString()}`, {
      headers: {
        'Accept': 'application/sparql-results+json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 30000
    });
    
    const bindings2 = response2.data?.results?.bindings || [];
    console.log(`📊 Collegamenti trovati: ${bindings2.length}`);
    
    if (bindings2.length > 0) {
      const collegamenti = {};
      bindings2.forEach(b => {
        const pred = b.predicato?.value;
        const nomePred = pred.split('/').pop().split('#').pop();
        if (!collegamenti[nomePred]) {
          collegamenti[nomePred] = new Set();
        }
        collegamenti[nomePred].add(b.oggetto?.value);
      });
      
      console.log('   Collegamenti disponibili:');
      Object.entries(collegamenti).forEach(([pred, uris]) => {
        console.log(`     ${pred}: ${uris.size} oggetti collegati`);
        Array.from(uris).slice(0, 2).forEach(uri => {
          console.log(`       - ${uri.split('/').pop()}`);
        });
      });
    }
    console.log();
    
    // Cerca sedute e loro collegamenti
    console.log('🔍 Cerca sedute e collegamenti...\n');
    
    const query3 = `
      PREFIX ocd: <http://dati.camera.it/ocd/>
      
      SELECT ?seduta ?predicato ?oggetto
      WHERE {
        ?seduta a <http://dati.camera.it/ocd/seduta> .
        ?seduta ?predicato ?oggetto .
      }
      LIMIT 30
    `;
    
    const params3 = new URLSearchParams();
    params3.append('query', query3);
    params3.append('format', 'json');
    
    try {
      const response3 = await axios.get(`${endpoint}?${params3.toString()}`, {
        headers: {
          'Accept': 'application/sparql-results+json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 30000
      });
      
      const bindings3 = response3.data?.results?.bindings || [];
      console.log(`📊 Proprietà sedute trovate: ${bindings3.length}`);
      
      if (bindings3.length > 0) {
        const sedute = {};
        bindings3.forEach(b => {
          const seduta = b.seduta?.value;
          if (!sedute[seduta]) sedute[seduta] = {};
          const pred = b.predicato?.value.split('/').pop().split('#').pop();
          sedute[seduta][pred] = b.oggetto?.value;
        });
        
        console.log(`📊 Sedute trovate: ${Object.keys(sedute).length}`);
        if (Object.keys(sedute).length > 0) {
          const primaSeduta = Object.entries(sedute)[0];
          console.log('   Esempio seduta:');
          Object.entries(primaSeduta[1]).forEach(([k, v]) => {
            console.log(`     ${k}: ${String(v).substring(0, 100)}`);
          });
        }
      }
    } catch (error) {
      console.log('⚠️ Errore query sedute:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  }
}

esploraStruttura().then(() => {
  console.log('='.repeat(80));
  process.exit(0);
}).catch(err => {
  console.error('Errore:', err);
  process.exit(1);
});

