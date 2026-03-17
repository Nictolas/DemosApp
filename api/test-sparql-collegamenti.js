const axios = require('axios');

async function cercaCollegamenti() {
  const endpoint = 'http://dati.camera.it/sparql';
  
  console.log('='.repeat(80));
  console.log('RICERCA COLLEGAMENTI VOTAZIONI-SEDUTE-DEPUTATI');
  console.log('='.repeat(80));
  console.log();

  // Cerca collegamento votazione -> seduta
  console.log('1️⃣ Cerca collegamento votazione -> seduta...\n');
  
  const query1 = `
    PREFIX ocd: <http://dati.camera.it/ocd/>
    
    SELECT ?votazione ?seduta ?predicato
    WHERE {
      ?votazione a <http://dati.camera.it/ocd/votazione> .
      ?seduta a <http://dati.camera.it/ocd/seduta> .
      ?votazione ?predicato ?seduta .
    }
    LIMIT 20
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
    
    const bindings1 = response1.data?.results?.bindings || [];
    console.log(`📊 Collegamenti votazione-seduta: ${bindings1.length}`);
    
    if (bindings1.length > 0) {
      bindings1.slice(0, 3).forEach((b, i) => {
        const pred = b.predicato?.value.split('/').pop().split('#').pop();
        console.log(`   ${i+1}. ${pred}: ${b.votazione?.value.split('/').pop()} -> ${b.seduta?.value.split('/').pop()}`);
      });
    }
    console.log();
    
  } catch (error) {
    console.log('⚠️ Errore:', error.message);
    console.log();
  }
  
  // Cerca voti dei deputati
  console.log('2️⃣ Cerca voti dei deputati...\n');
  
  const query2 = `
    PREFIX ocd: <http://dati.camera.it/ocd/>
    
    SELECT ?votazione ?deputato ?voto
    WHERE {
      ?votazione a <http://dati.camera.it/ocd/votazione> .
      ?votazione ocd:haVotazione ?votazioneDeputato .
      ?votazioneDeputato ocd:rif_deputato ?deputato .
      ?votazioneDeputato ocd:voto ?voto .
    }
    LIMIT 10
  `;
  
  const params2 = new URLSearchParams();
  params2.append('query', query2);
  params2.append('format', 'json');
  
  try {
    const response2 = await axios.get(`${endpoint}?${params2.toString()}`, {
      headers: {
        'Accept': 'application/sparql-results+json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 30000
    });
    
    const bindings2 = response2.data?.results?.bindings || [];
    console.log(`📊 Voti deputati trovati: ${bindings2.length}`);
    
    if (bindings2.length > 0) {
      console.log('✅ Trovati voti dei deputati!');
      bindings2.slice(0, 5).forEach((b, i) => {
        const deputato = b.deputato?.value.split('/').pop() || b.deputato?.value;
        console.log(`   ${i+1}. Deputato: ${deputato}, Voto: ${b.voto?.value}`);
      });
    } else {
      console.log('⚠️ Nessun voto trovato con questa struttura');
    }
    console.log();
    
  } catch (error) {
    console.log('⚠️ Errore:', error.message);
    console.log();
  }
  
  // Cerca tutte le proprietà di una seduta
  console.log('3️⃣ Analizza struttura seduta completa...\n');
  
  const query3 = `
    PREFIX ocd: <http://dati.camera.it/ocd/>
    
    SELECT ?seduta ?predicato ?oggetto
    WHERE {
      ?seduta a <http://dati.camera.it/ocd/seduta> .
      ?seduta ?predicato ?oggetto .
    }
    LIMIT 100
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
    const sedute = {};
    const predicati = new Set();
    
    bindings3.forEach(b => {
      const seduta = b.seduta?.value;
      if (!sedute[seduta]) sedute[seduta] = {};
      const pred = b.predicato?.value;
      const nomePred = pred.split('/').pop().split('#').pop();
      predicati.add(nomePred);
      sedute[seduta][nomePred] = b.oggetto?.value;
    });
    
    console.log(`📊 Sedute analizzate: ${Object.keys(sedute).length}`);
    console.log(`📊 Predicati sedute: ${predicati.size}`);
    console.log('   Predicati trovati:');
    Array.from(predicati).sort().forEach(p => console.log(`     - ${p}`));
    
    if (Object.keys(sedute).length > 0) {
      const primaSeduta = Object.entries(sedute)[0];
      console.log('\n   Esempio seduta completa:');
      console.log(`   URI: ${primaSeduta[0]}`);
      Object.entries(primaSeduta[1]).forEach(([k, v]) => {
        const valStr = String(v).length > 100 ? String(v).substring(0, 100) + '...' : String(v);
        console.log(`     ${k}: ${valStr}`);
      });
    }
    console.log();
    
  } catch (error) {
    console.log('⚠️ Errore:', error.message);
    console.log();
  }
  
  // Cerca legislatura nelle sedute
  console.log('4️⃣ Cerca legislatura nelle sedute...\n');
  
  const query4 = `
    PREFIX ocd: <http://dati.camera.it/ocd/>
    
    SELECT ?seduta ?legislatura ?numero
    WHERE {
      ?seduta a <http://dati.camera.it/ocd/seduta> .
      OPTIONAL {
        ?seduta ocd:rif_legislatura ?legislatura .
        ?legislatura ocd:numero ?numero .
      }
    }
    LIMIT 20
  `;
  
  const params4 = new URLSearchParams();
  params4.append('query', query4);
  params4.append('format', 'json');
  
  try {
    const response4 = await axios.get(`${endpoint}?${params4.toString()}`, {
      headers: {
        'Accept': 'application/sparql-results+json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 30000
    });
    
    const bindings4 = response4.data?.results?.bindings || [];
    const legislature = new Set();
    
    bindings4.forEach(b => {
      if (b.numero?.value) {
        legislature.add(b.numero.value);
      }
    });
    
    console.log(`📊 Legislature trovate nelle sedute: ${Array.from(legislature).sort().join(', ') || 'Nessuna'}`);
    console.log();
    
  } catch (error) {
    console.log('⚠️ Errore:', error.message);
    console.log();
  }
}

cercaCollegamenti().then(() => {
  console.log('='.repeat(80));
  process.exit(0);
}).catch(err => {
  console.error('Errore:', err);
  process.exit(1);
});


