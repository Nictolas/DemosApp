const axios = require('axios');

async function testSparqlDettagliCompleti() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 ANALISI COMPLETA DATI SPARQL - VOTAZIONI DETTAGLIATE');
  console.log('='.repeat(80));
  
  // Test 1: Senato - Voti nominali (chi ha votato cosa)
  console.log('\n📊 TEST 1: SENATO - Voti Nominali (osr:favorevole, osr:contrario)\n');
  
  const queryVotiNominali = `
    PREFIX osr: <http://dati.senato.it/osr/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    
    SELECT DISTINCT ?votazione ?label ?sedutaData ?senatore ?nomeSenatore ?voto
    WHERE {
      ?votazione a osr:Votazione .
      OPTIONAL { ?votazione rdfs:label ?label . }
      OPTIONAL { 
        ?votazione osr:seduta ?seduta .
        OPTIONAL { ?seduta osr:dataSeduta ?sedutaData . }
      }
      OPTIONAL { 
        ?votazione osr:favorevole ?senatore .
        OPTIONAL { ?senatore rdfs:label ?nomeSenatore . }
        BIND("Favorevole" AS ?voto)
      }
      OPTIONAL { 
        ?votazione osr:contrario ?senatore .
        OPTIONAL { ?senatore rdfs:label ?nomeSenatore . }
        BIND("Contrario" AS ?voto)
      }
      OPTIONAL { 
        ?votazione osr:astenuto ?senatore .
        OPTIONAL { ?senatore rdfs:label ?nomeSenatore . }
        BIND("Astenuto" AS ?voto)
      }
    }
    ORDER BY DESC(?sedutaData)
    LIMIT 20
  `;
  
  try {
    const params = new URLSearchParams();
    params.append('query', queryVotiNominali);
    params.append('format', 'json');
    
    const response = await axios.get(`https://dati.senato.it/sparql?${params.toString()}`, {
      headers: {
        'Accept': 'application/sparql-results+json, application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 30000
    });
    
    const bindings = response.data?.results?.bindings || [];
    console.log(`✅ Trovati ${bindings.length} risultati\n`);
    
    // Raggruppa per votazione
    const votazioni = {};
    bindings.forEach(b => {
      const uri = b.votazione?.value;
      if (!uri) return;
      
      if (!votazioni[uri]) {
        votazioni[uri] = {
          uri: uri,
          label: b.label?.value || 'N/A',
          data: b.sedutaData?.value || 'N/A',
          voti: {
            favorevoli: [],
            contrari: [],
            astenuti: []
          }
        };
      }
      
      if (b.senatore?.value && b.nomeSenatore?.value) {
        const voto = b.voto?.value;
        if (voto === 'Favorevole') {
          votazioni[uri].voti.favorevoli.push(b.nomeSenatore.value);
        } else if (voto === 'Contrario') {
          votazioni[uri].voti.contrari.push(b.nomeSenatore.value);
        } else if (voto === 'Astenuto') {
          votazioni[uri].voti.astenuti.push(b.nomeSenatore.value);
        }
      }
    });
    
    const primaVotazione = Object.values(votazioni)[0];
    if (primaVotazione) {
      console.log(`📋 Esempio votazione: ${primaVotazione.label}`);
      console.log(`   Data: ${primaVotazione.data}`);
      console.log(`   Favorevoli: ${primaVotazione.voti.favorevoli.length} senatori`);
      if (primaVotazione.voti.favorevoli.length > 0) {
        console.log(`   - ${primaVotazione.voti.favorevoli.slice(0, 3).join(', ')}${primaVotazione.voti.favorevoli.length > 3 ? '...' : ''}`);
      }
      console.log(`   Contrari: ${primaVotazione.voti.contrari.length} senatori`);
      if (primaVotazione.voti.contrari.length > 0) {
        console.log(`   - ${primaVotazione.voti.contrari.slice(0, 3).join(', ')}${primaVotazione.voti.contrari.length > 3 ? '...' : ''}`);
      }
      console.log(`   Astenuti: ${primaVotazione.voti.astenuti.length} senatori`);
    }
    
  } catch (error) {
    console.error(`❌ Errore: ${error.message}`);
  }
  
  // Test 2: Senato - Tutti i dettagli di una votazione specifica
  console.log('\n\n📊 TEST 2: SENATO - Dettagli completi di una votazione\n');
  
  const queryDettagli = `
    PREFIX osr: <http://dati.senato.it/osr/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    
    SELECT DISTINCT ?votazione ?label ?favorevoli ?contrari ?presenti ?votanti ?maggioranza 
                    ?tipoVotazione ?astenuti ?numeroLegale ?presidente ?esito ?seduta 
                    ?sedutaData ?sedutaNumero ?sedutaLegislatura ?sedutaTipo
                    ?senatore ?nomeSenatore ?voto
    WHERE {
      ?votazione a osr:Votazione .
      OPTIONAL { ?votazione rdfs:label ?label . }
      OPTIONAL { ?votazione osr:favorevoli ?favorevoli . }
      OPTIONAL { ?votazione osr:contrari ?contrari . }
      OPTIONAL { ?votazione osr:presenti ?presenti . }
      OPTIONAL { ?votazione osr:votanti ?votanti . }
      OPTIONAL { ?votazione osr:maggioranza ?maggioranza . }
      OPTIONAL { ?votazione osr:tipoVotazione ?tipoVotazione . }
      OPTIONAL { ?votazione osr:astenuti ?astenuti . }
      OPTIONAL { ?votazione osr:numeroLegale ?numeroLegale . }
      OPTIONAL { ?votazione osr:presidente ?presidente . }
      OPTIONAL { ?votazione osr:esito ?esito . }
      OPTIONAL { 
        ?votazione osr:seduta ?seduta .
        OPTIONAL { ?seduta osr:dataSeduta ?sedutaData . }
        OPTIONAL { ?seduta osr:numeroSeduta ?sedutaNumero . }
        OPTIONAL { ?seduta osr:legislatura ?sedutaLegislatura . }
        OPTIONAL { ?seduta osr:tipoSeduta ?sedutaTipo . }
      }
      OPTIONAL { 
        ?votazione osr:favorevole ?senatore .
        OPTIONAL { ?senatore rdfs:label ?nomeSenatore . }
        BIND("Favorevole" AS ?voto)
      }
      OPTIONAL { 
        ?votazione osr:contrario ?senatore .
        OPTIONAL { ?senatore rdfs:label ?nomeSenatore . }
        BIND("Contrario" AS ?voto)
      }
      OPTIONAL { 
        ?votazione osr:astenuto ?senatore .
        OPTIONAL { ?senatore rdfs:label ?nomeSenatore . }
        BIND("Astenuto" AS ?voto)
      }
    }
    ORDER BY DESC(?sedutaData)
    LIMIT 50
  `;
  
  try {
    const params = new URLSearchParams();
    params.append('query', queryDettagli);
    params.append('format', 'json');
    
    const response = await axios.get(`https://dati.senato.it/sparql?${params.toString()}`, {
      headers: {
        'Accept': 'application/sparql-results+json, application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 60000
    });
    
    const bindings = response.data?.results?.bindings || [];
    console.log(`✅ Trovati ${bindings.length} risultati\n`);
    
    // Raggruppa per votazione
    const votazioni = {};
    bindings.forEach(b => {
      const uri = b.votazione?.value;
      if (!uri) return;
      
      if (!votazioni[uri]) {
        votazioni[uri] = {
          uri: uri,
          label: b.label?.value || 'N/A',
          favorevoli: parseInt(b.favorevoli?.value || 0),
          contrari: parseInt(b.contrari?.value || 0),
          presenti: parseInt(b.presenti?.value || 0),
          votanti: parseInt(b.votanti?.value || 0),
          maggioranza: parseInt(b.maggioranza?.value || 0),
          tipoVotazione: b.tipoVotazione?.value || null,
          astenuti: parseInt(b.astenuti?.value || 0),
          numeroLegale: parseInt(b.numeroLegale?.value || 0),
          presidente: b.presidente?.value || null,
          esito: b.esito?.value || null,
          data: b.sedutaData?.value || null,
          numeroSeduta: b.sedutaNumero?.value || null,
          legislatura: b.sedutaLegislatura?.value || null,
          tipoSeduta: b.sedutaTipo?.value || null,
          voti: {
            favorevoli: [],
            contrari: [],
            astenuti: []
          }
        };
      }
      
      if (b.senatore?.value && b.nomeSenatore?.value) {
        const voto = b.voto?.value;
        const nome = b.nomeSenatore.value;
        if (voto === 'Favorevole' && !votazioni[uri].voti.favorevoli.includes(nome)) {
          votazioni[uri].voti.favorevoli.push(nome);
        } else if (voto === 'Contrario' && !votazioni[uri].voti.contrari.includes(nome)) {
          votazioni[uri].voti.contrari.push(nome);
        } else if (voto === 'Astenuto' && !votazioni[uri].voti.astenuti.includes(nome)) {
          votazioni[uri].voti.astenuti.push(nome);
        }
      }
    });
    
    const primaVotazione = Object.values(votazioni)[0];
    if (primaVotazione) {
      console.log(`📋 Votazione completa: ${primaVotazione.label}`);
      console.log(`   Data: ${primaVotazione.data}`);
      console.log(`   Favorevoli: ${primaVotazione.favorevoli} (${primaVotazione.voti.favorevoli.length} nomi recuperati)`);
      console.log(`   Contrari: ${primaVotazione.contrari} (${primaVotazione.voti.contrari.length} nomi recuperati)`);
      console.log(`   Astenuti: ${primaVotazione.astenuti} (${primaVotazione.voti.astenuti.length} nomi recuperati)`);
      console.log(`   Presenti: ${primaVotazione.presenti}`);
      console.log(`   Votanti: ${primaVotazione.votanti}`);
      console.log(`   Maggioranza: ${primaVotazione.maggioranza}`);
      console.log(`   Tipo: ${primaVotazione.tipoVotazione}`);
      console.log(`   Numero Legale: ${primaVotazione.numeroLegale}`);
      console.log(`   Presidente: ${primaVotazione.presidente || 'N/A'}`);
      console.log(`   Esito: ${primaVotazione.esito || 'N/A'}`);
      console.log(`   Seduta: n. ${primaVotazione.numeroSeduta || 'N/A'}, tipo: ${primaVotazione.tipoSeduta || 'N/A'}`);
    }
    
  } catch (error) {
    console.error(`❌ Errore: ${error.message}`);
  }
  
  // Test 3: Camera - Voti nominali (prefissi ocp:)
  console.log('\n\n📊 TEST 3: CAMERA - Voti Nominali (prefissi ocp:)\n');
  
  const queryVotiNominaliCamera = `
    PREFIX ocd: <http://dati.camera.it/ocd/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    
    SELECT DISTINCT ?votazione ?label ?sedutaData ?deputato ?nomeDeputato ?voto
    WHERE {
      ?votazione a <http://dati.camera.it/ocd/votazione> .
      FILTER(CONTAINS(STR(?votazione), "vs19"))
      OPTIONAL { ?votazione rdfs:label ?label . }
      OPTIONAL { 
        ?votazione ocd:rif_seduta ?seduta .
        OPTIONAL { ?seduta ocd:data ?sedutaData . }
      }
      OPTIONAL { 
        ?votazione ocd:voto_favorevole ?deputato .
        OPTIONAL { ?deputato rdfs:label ?nomeDeputato . }
        BIND("Favorevole" AS ?voto)
      }
      OPTIONAL { 
        ?votazione ocd:voto_contrario ?deputato .
        OPTIONAL { ?deputato rdfs:label ?nomeDeputato . }
        BIND("Contrario" AS ?voto)
      }
      OPTIONAL { 
        ?votazione ocd:voto_astenuto ?deputato .
        OPTIONAL { ?deputato rdfs:label ?nomeDeputato . }
        BIND("Astenuto" AS ?voto)
      }
    }
    ORDER BY DESC(?sedutaData)
    LIMIT 20
  `;
  
  try {
    const params = new URLSearchParams();
    params.append('query', queryVotiNominaliCamera);
    params.append('format', 'json');
    
    const response = await axios.get(`http://dati.camera.it/sparql?${params.toString()}`, {
      headers: {
        'Accept': 'application/sparql-results+json, application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 30000
    });
    
    const bindings = response.data?.results?.bindings || [];
    console.log(`✅ Trovati ${bindings.length} risultati\n`);
    
    if (bindings.length > 0) {
      const votazioni = {};
      bindings.forEach(b => {
        const uri = b.votazione?.value;
        if (!uri) return;
        
        if (!votazioni[uri]) {
          votazioni[uri] = {
            label: b.label?.value || 'N/A',
            data: b.sedutaData?.value || 'N/A',
            voti: { favorevoli: [], contrari: [], astenuti: [] }
          };
        }
        
        if (b.deputato?.value && b.nomeDeputato?.value) {
          const voto = b.voto?.value;
          const nome = b.nomeDeputato.value;
          if (voto === 'Favorevole' && !votazioni[uri].voti.favorevoli.includes(nome)) {
            votazioni[uri].voti.favorevoli.push(nome);
          } else if (voto === 'Contrario' && !votazioni[uri].voti.contrari.includes(nome)) {
            votazioni[uri].voti.contrari.push(nome);
          } else if (voto === 'Astenuto' && !votazioni[uri].voti.astenuti.includes(nome)) {
            votazioni[uri].voti.astenuti.push(nome);
          }
        }
      });
      
      const primaVotazione = Object.values(votazioni)[0];
      if (primaVotazione) {
        console.log(`📋 Esempio votazione Camera: ${primaVotazione.label}`);
        console.log(`   Data: ${primaVotazione.data}`);
        console.log(`   Favorevoli: ${primaVotazione.voti.favorevoli.length} deputati`);
        console.log(`   Contrari: ${primaVotazione.voti.contrari.length} deputati`);
        console.log(`   Astenuti: ${primaVotazione.voti.astenuti.length} deputati`);
      }
    } else {
      console.log('⚠️ Nessun risultato trovato - potrebbe essere che Camera non espone voti nominali via SPARQL');
    }
    
  } catch (error) {
    console.error(`❌ Errore: ${error.message}`);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ ANALISI COMPLETATA');
  console.log('='.repeat(80));
  console.log('\n💡 CONCLUSIONI:');
  console.log('   - Senato: Voti nominali disponibili (osr:favorevole, osr:contrario, osr:astenuto)');
  console.log('   - Camera: Da verificare se voti nominali disponibili (ocd:voto_favorevole, ecc.)');
  console.log('   - Dati tecnici completi disponibili per entrambe');
}

testSparqlDettagliCompleti().catch(console.error);
