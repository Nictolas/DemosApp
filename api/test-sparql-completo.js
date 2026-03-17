const axios = require('axios');

async function testSparqlCompleto() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 TEST QUERY SPARQL COMPLETE (Camera e Senato)');
  console.log('='.repeat(80));
  
  // Test Camera
  console.log('\n📊 TEST CAMERA - Query Completa');
  console.log('─'.repeat(80));
  
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
    ORDER BY DESC(?votazione)
    LIMIT 3
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
    console.log(`✅ Status: ${response.status}`);
    console.log(`✅ Votazioni trovate: ${bindings.length}\n`);
    
    if (bindings.length > 0) {
      bindings.forEach((v, i) => {
        console.log(`${i + 1}. ${v.label?.value || 'N/A'}`);
        console.log(`   URI: ${v.votazione?.value}`);
        console.log(`   Approvato: ${v.approvato?.value || 'N/A'}`);
        console.log(`   Data Seduta: ${v.sedutaData?.value || 'N/A'} ${v.sedutaData?.value ? '(✅ DATA DISPONIBILE!)' : '(❌ Data non disponibile)'}`);
        console.log(`   Numero Seduta: ${v.sedutaNumero?.value || 'N/A'} ${v.sedutaNumero?.value ? '(✅)' : '(❌)'}`);
        console.log(`   Titolo Seduta: ${v.sedutaTitle?.value ? v.sedutaTitle.value.substring(0, 60) + '...' : 'N/A'} ${v.sedutaTitle?.value ? '(✅)' : '(❌)'}`);
        console.log(`   Legislatura: ${v.sedutaLegislatura?.value || 'N/A'} ${v.sedutaLegislatura?.value ? '(✅)' : '(❌)'}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error(`❌ Errore Camera: ${error.message}`);
  }
  
  // Test Senato
  console.log('\n📊 TEST SENATO - Query Completa');
  console.log('─'.repeat(80));
  
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
    ORDER BY DESC(?votazione)
    LIMIT 3
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
    console.log(`✅ Status: ${response.status}`);
    console.log(`✅ Votazioni trovate: ${bindings.length}\n`);
    
    if (bindings.length > 0) {
      bindings.forEach((v, i) => {
        console.log(`${i + 1}. ${v.label?.value || 'N/A'}`);
        console.log(`   URI: ${v.votazione?.value}`);
        console.log(`   Favorevoli: ${v.favorevoli?.value || 'N/A'} ${v.favorevoli?.value ? '(✅)' : '(❌)'}`);
        console.log(`   Contrari: ${v.contrari?.value || 'N/A'} ${v.contrari?.value ? '(✅)' : '(❌)'}`);
        console.log(`   Presenti: ${v.presenti?.value || 'N/A'} ${v.presenti?.value ? '(✅)' : '(❌)'}`);
        console.log(`   Votanti: ${v.votanti?.value || 'N/A'} ${v.votanti?.value ? '(✅)' : '(❌)'}`);
        console.log(`   Maggioranza: ${v.maggioranza?.value || 'N/A'} ${v.maggioranza?.value ? '(✅)' : '(❌)'}`);
        console.log(`   Tipo: ${v.tipoVotazione?.value || 'N/A'} ${v.tipoVotazione?.value ? '(✅)' : '(❌)'}`);
        console.log(`   Data Seduta: ${v.sedutaData?.value || 'N/A'} ${v.sedutaData?.value ? '(✅ DATA DISPONIBILE!)' : '(❌ Data non disponibile)'}`);
        console.log(`   Numero Seduta: ${v.sedutaNumero?.value || 'N/A'} ${v.sedutaNumero?.value ? '(✅)' : '(❌)'}`);
        console.log(`   Legislatura: ${v.sedutaLegislatura?.value || 'N/A'} ${v.sedutaLegislatura?.value ? '(✅)' : '(❌)'}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error(`❌ Errore Senato: ${error.message}`);
  }
  
  console.log('='.repeat(80));
  console.log('✅ TEST COMPLETATO');
  console.log('='.repeat(80));
  console.log('\n💡 Se vedi ✅ DATA DISPONIBILE! significa che le query funzionano correttamente');
  console.log('💡 I dati verranno salvati nella tabella "parlamento" quando l\'endpoint viene chiamato');
}

testSparqlCompleto().catch(console.error);
