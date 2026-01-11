const axios = require('axios');

async function testSparqlRecenti() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 TEST SPARQL - VOTAZIONI PIÙ RECENTI');
  console.log('='.repeat(80));
  
  // Test Senato - Verifica ordinamento per data
  console.log('\n📊 SENATO - Test ordinamento per data (più recenti prima)\n');
  
  const querySenato = `
    PREFIX osr: <http://dati.senato.it/osr/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    
    SELECT DISTINCT ?votazione ?label ?favorevoli ?contrari ?presenti ?votanti ?maggioranza 
                    ?tipoVotazione ?seduta ?sedutaData ?sedutaNumero ?sedutaLegislatura
    WHERE {
      ?votazione a osr:Votazione .
      OPTIONAL { ?votazione rdfs:label ?label . }
      OPTIONAL { ?votazione osr:favorevoli ?favorevoli . }
      OPTIONAL { ?votazione osr:contrari ?contrari . }
      OPTIONAL { ?votazione osr:presenti ?presenti . }
      OPTIONAL { ?votazione osr:votanti ?votanti . }
      OPTIONAL { ?votazione osr:maggioranza ?maggioranza . }
      OPTIONAL { ?votazione osr:tipoVotazione ?tipoVotazione . }
      OPTIONAL { 
        ?votazione osr:seduta ?seduta .
        OPTIONAL { ?seduta osr:dataSeduta ?sedutaData . }
        OPTIONAL { ?seduta osr:numeroSeduta ?sedutaNumero . }
        OPTIONAL { ?seduta osr:legislatura ?sedutaLegislatura . }
      }
    }
    ORDER BY DESC(?sedutaData) DESC(?votazione)
    LIMIT 10
  `;
  
  try {
    const params = new URLSearchParams();
    params.append('query', querySenato);
    params.append('format', 'json');
    
    const response = await axios.get(`https://dati.senato.it/sparql?${params.toString()}`, {
      headers: {
        'Accept': 'application/sparql-results+json, application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 30000
    });
    
    const bindings = response.data?.results?.bindings || [];
    console.log(`✅ Trovate ${bindings.length} votazioni\n`);
    
    bindings.forEach((v, i) => {
      console.log(`${i + 1}. ${v.label?.value || 'N/A'}`);
      console.log(`   Data: ${v.sedutaData?.value || 'N/A'}`);
      console.log(`   URI: ${v.votazione?.value}`);
      console.log(`   Favorevoli: ${v.favorevoli?.value || 'N/A'}, Contrari: ${v.contrari?.value || 'N/A'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error(`❌ Errore: ${error.message}`);
  }
  
  // Test Senato - Verifica voti nominali (chi ha votato cosa)
  console.log('\n📊 SENATO - Test voti nominali (prefissi osr:)\n');
  
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
    }
    ORDER BY DESC(?sedutaData)
    LIMIT 5
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
    
    if (bindings.length > 0) {
      bindings.slice(0, 3).forEach((v, i) => {
        console.log(`${i + 1}. Votazione: ${v.label?.value || 'N/A'}`);
        console.log(`   Data: ${v.sedutaData?.value || 'N/A'}`);
        console.log(`   Senatore: ${v.nomeSenatore?.value || v.senatore?.value || 'N/A'}`);
        console.log(`   Voto: ${v.voto?.value || 'N/A'}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error(`❌ Errore: ${error.message}`);
  }
  
  // Test Camera - Verifica ordinamento per data
  console.log('\n📊 CAMERA - Test ordinamento per data (più recenti prima)\n');
  
  const queryCamera = `
    PREFIX ocd: <http://dati.camera.it/ocd/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    
    SELECT DISTINCT ?votazione ?label ?approvato ?seduta ?sedutaData ?sedutaNumero ?sedutaTitle ?sedutaLegislatura
    WHERE {
      ?votazione a <http://dati.camera.it/ocd/votazione> .
      FILTER(CONTAINS(STR(?votazione), "vs19"))
      OPTIONAL { ?votazione rdfs:label ?label . }
      OPTIONAL { ?votazione ocd:approvato ?approvato . }
      OPTIONAL { 
        ?votazione ocd:rif_seduta ?seduta .
        OPTIONAL { ?seduta ocd:data ?sedutaData . }
        OPTIONAL { ?seduta ocd:identifier ?sedutaNumero . }
        OPTIONAL { ?seduta ocd:title ?sedutaTitle . }
        OPTIONAL { 
          ?seduta ocd:rif_leg ?legislatura .
          OPTIONAL { ?legislatura ocd:numero ?sedutaLegislatura . }
        }
      }
    }
    ORDER BY DESC(?sedutaData) DESC(?votazione)
    LIMIT 10
  `;
  
  try {
    const params = new URLSearchParams();
    params.append('query', queryCamera);
    params.append('format', 'json');
    
    const response = await axios.get(`http://dati.camera.it/sparql?${params.toString()}`, {
      headers: {
        'Accept': 'application/sparql-results+json, application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 30000
    });
    
    const bindings = response.data?.results?.bindings || [];
    console.log(`✅ Trovate ${bindings.length} votazioni\n`);
    
    bindings.forEach((v, i) => {
      console.log(`${i + 1}. ${v.label?.value || 'N/A'}`);
      console.log(`   Data: ${v.sedutaData?.value || 'N/A'}`);
      console.log(`   URI: ${v.votazione?.value}`);
      console.log(`   Approvato: ${v.approvato?.value || 'N/A'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error(`❌ Errore: ${error.message}`);
  }
  
  // Test Camera - Verifica voti nominali (prefissi ocp:)
  console.log('\n📊 CAMERA - Test voti nominali (prefissi ocp:)\n');
  
  const queryVotiNominaliCamera = `
    PREFIX ocd: <http://dati.camera.it/ocd/>
    PREFIX ocp: <http://dati.camera.it/ocd/persona/>
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
    LIMIT 5
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
      bindings.slice(0, 3).forEach((v, i) => {
        console.log(`${i + 1}. Votazione: ${v.label?.value || 'N/A'}`);
        console.log(`   Data: ${v.sedutaData?.value || 'N/A'}`);
        console.log(`   Deputato: ${v.nomeDeputato?.value || v.deputato?.value || 'N/A'}`);
        console.log(`   Voto: ${v.voto?.value || 'N/A'}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error(`❌ Errore: ${error.message}`);
  }
  
  console.log('='.repeat(80));
  console.log('✅ TEST COMPLETATO');
  console.log('='.repeat(80));
}

testSparqlRecenti().catch(console.error);
