const axios = require('axios');

async function analizzaDatiDisponibili() {
  const endpoint = 'http://dati.camera.it/sparql';
  
  console.log('='.repeat(80));
  console.log('ANALISI DATI DISPONIBILI - VOTAZIONI CAMERA');
  console.log('='.repeat(80));
  console.log();

  // 1. Trova una votazione e vedi tutti i suoi predicati
  console.log('1️⃣ Analisi struttura di una votazione...\n');
  
  const query1 = `
    PREFIX ocd: <http://dati.camera.it/ocd/>
    
    SELECT DISTINCT ?votazione ?predicato ?oggetto
    WHERE {
      ?votazione a <http://dati.camera.it/ocd/votazione> .
      ?votazione ?predicato ?oggetto .
    }
    LIMIT 50
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
    console.log(`📊 Trovati ${bindings.length} bindings\n`);
    
    // Raggruppa per votazione
    const votazioni = {};
    const predicatiUnici = new Set();
    
    for (const binding of bindings) {
      const votazioneUri = binding.votazione?.value;
      const predicato = binding.predicato?.value;
      const oggetto = binding.oggetto?.value;
      
      if (!votazioni[votazioneUri]) {
        votazioni[votazioneUri] = {};
      }
      
      const nomePredicato = predicato.split('/').pop().split('#').pop();
      predicatiUnici.add(nomePredicato);
      votazioni[votazioneUri][nomePredicato] = oggetto;
    }
    
    console.log(`📊 Votazioni trovate: ${Object.keys(votazioni).length}`);
    console.log(`📊 Predicati unici: ${predicatiUnici.size}\n`);
    
    console.log('📋 PREDICATI DISPONIBILI:');
    Array.from(predicatiUnici).sort().forEach(p => console.log(`   - ${p}`));
    console.log();
    
    // Mostra esempio di una votazione
    if (Object.keys(votazioni).length > 0) {
      const primaVotazione = Object.entries(votazioni)[0];
      console.log('📄 ESEMPIO VOTAZIONE:');
      console.log(`   URI: ${primaVotazione[0]}`);
      console.log('   Proprietà:');
      Object.entries(primaVotazione[1]).forEach(([key, value]) => {
        const valStr = String(value).length > 100 ? String(value).substring(0, 100) + '...' : String(value);
        console.log(`     ${key}: ${valStr}`);
      });
      console.log();
    }
    
    // 2. Cerca informazioni sulla legislatura
    console.log('2️⃣ Cerca informazioni sulla legislatura...\n');
    
    const query2 = `
      PREFIX ocd: <http://dati.camera.it/ocd/>
      
      SELECT DISTINCT ?votazione ?legislatura ?numeroLegislatura
      WHERE {
        ?votazione a <http://dati.camera.it/ocd/votazione> .
        OPTIONAL {
          ?votazione ocd:rif_legislatura ?legislatura .
          ?legislatura ocd:numero ?numeroLegislatura .
        }
      }
      LIMIT 20
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
    const legislature = new Set();
    
    bindings2.forEach(b => {
      if (b.numeroLegislatura?.value) {
        legislature.add(b.numeroLegislatura.value);
      }
    });
    
    console.log(`📊 Legislature trovate: ${Array.from(legislature).sort().join(', ')}`);
    console.log();
    
    // 3. Cerca voti dei singoli politici
    console.log('3️⃣ Cerca voti dei singoli politici...\n');
    
    const query3 = `
      PREFIX ocd: <http://dati.camera.it/ocd/>
      
      SELECT DISTINCT ?votazione ?deputato ?voto
      WHERE {
        ?votazione a <http://dati.camera.it/ocd/votazione> .
        OPTIONAL {
          ?votazione ocd:haVotazione ?votazioneDeputato .
          ?votazioneDeputato ocd:rif_deputato ?deputato .
          ?votazioneDeputato ocd:voto ?voto .
        }
      }
      LIMIT 20
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
      const votiPolitici = bindings3.filter(b => b.deputato && b.voto);
      
      console.log(`📊 Voti di politici trovati: ${votiPolitici.length}`);
      
      if (votiPolitici.length > 0) {
        console.log('✅ È possibile ottenere i voti dei singoli politici!');
        console.log('   Esempi:');
        votiPolitici.slice(0, 3).forEach((b, i) => {
          console.log(`     ${i+1}. Deputato: ${b.deputato?.value?.split('/').pop() || 'N/A'}, Voto: ${b.voto?.value || 'N/A'}`);
        });
      } else {
        console.log('⚠️ Nessun voto di politico trovato con questa query');
      }
      console.log();
      
    } catch (error) {
      console.log('⚠️ Errore nella query voti politici:', error.message);
      console.log();
    }
    
    // 4. Cerca votazioni della XIX legislatura
    console.log('4️⃣ Cerca votazioni della XIX legislatura (19)...\n');
    
    const query4 = `
      PREFIX ocd: <http://dati.camera.it/ocd/>
      
      SELECT DISTINCT ?votazione ?predicato ?oggetto
      WHERE {
        ?votazione a <http://dati.camera.it/ocd/votazione> .
        ?votazione ?predicato ?oggetto .
        ?votazione ocd:rif_legislatura ?legislatura .
        ?legislatura ocd:numero 19 .
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
      console.log(`📊 Votazioni XIX legislatura trovate: ${bindings4.length} bindings`);
      
      if (bindings4.length > 0) {
        console.log('✅ Trovate votazioni della XIX legislatura!');
      } else {
        console.log('⚠️ Nessuna votazione trovata per la XIX legislatura');
      }
      console.log();
      
    } catch (error) {
      console.log('⚠️ Errore nella query XIX legislatura:', error.message);
      console.log();
    }
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data).substring(0, 200));
    }
  }
}

analizzaDatiDisponibili().then(() => {
  console.log('='.repeat(80));
  console.log('ANALISI COMPLETATA');
  console.log('='.repeat(80));
  process.exit(0);
}).catch(err => {
  console.error('Errore generale:', err);
  process.exit(1);
});

