const axios = require('axios');

async function testSparqlCamera() {
  console.log('🔍 Test SPARQL Camera...\n');
  
  const sparqlQuery = `
    PREFIX ocd: <http://dati.camera.it/ocd/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    
    SELECT DISTINCT ?votazione ?label ?approvato ?seduta
    WHERE {
      ?votazione a <http://dati.camera.it/ocd/votazione> .
      FILTER(CONTAINS(STR(?votazione), "vs19"))
      OPTIONAL { ?votazione rdfs:label ?label . }
      OPTIONAL { ?votazione ocd:approvato ?approvato . }
      OPTIONAL { ?votazione ocd:rif_seduta ?seduta . }
    }
    ORDER BY DESC(?votazione)
    LIMIT 5
  `;
  
  const params = new URLSearchParams();
  params.append('query', sparqlQuery);
  params.append('format', 'json');
  
  try {
    const response = await axios.get(`http://dati.camera.it/sparql?${params.toString()}`, {
      headers: {
        'Accept': 'application/sparql-results+json, application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 30000
    });
    
    console.log('✅ Status:', response.status);
    const bindings = response.data?.results?.bindings || [];
    console.log(`📊 Risultati trovati: ${bindings.length}\n`);
    
    if (bindings.length > 0) {
      console.log('Primi 3 risultati:');
      bindings.slice(0, 3).forEach((result, index) => {
        console.log(`\n${index + 1}. Votazione URI: ${result.votazione?.value}`);
        console.log(`   Label: ${result.label?.value || 'N/A'}`);
        console.log(`   Approvato: ${result.approvato?.value || 'N/A'}`);
        console.log(`   Seduta: ${result.seduta?.value || 'N/A'}`);
      });
    } else {
      console.log('⚠️ Nessun risultato trovato!');
    }
  } catch (error) {
    console.error('❌ Errore:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2).substring(0, 500));
    }
  }
}

async function testSparqlSenato() {
  console.log('\n\n🔍 Test SPARQL Senato...\n');
  
  const sparqlQuery = `
    PREFIX osr: <http://dati.senato.it/osr/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    
    SELECT DISTINCT ?votazione ?label ?favorevoli ?contrari ?seduta ?tipoVotazione
    WHERE {
      ?votazione a osr:Votazione .
      OPTIONAL { ?votazione rdfs:label ?label . }
      OPTIONAL { ?votazione osr:seduta ?seduta . }
      OPTIONAL { ?votazione osr:favorevoli ?favorevoli . }
      OPTIONAL { ?votazione osr:contrari ?contrari . }
      OPTIONAL { ?votazione osr:tipoVotazione ?tipoVotazione . }
    }
    ORDER BY DESC(?votazione)
    LIMIT 5
  `;
  
  const params = new URLSearchParams();
  params.append('query', sparqlQuery);
  params.append('format', 'json');
  
  try {
    const response = await axios.get(`https://dati.senato.it/sparql?${params.toString()}`, {
      headers: {
        'Accept': 'application/sparql-results+json, application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 30000
    });
    
    console.log('✅ Status:', response.status);
    const bindings = response.data?.results?.bindings || [];
    console.log(`📊 Risultati trovati: ${bindings.length}\n`);
    
    if (bindings.length > 0) {
      console.log('Primi 3 risultati:');
      bindings.slice(0, 3).forEach((result, index) => {
        console.log(`\n${index + 1}. Votazione URI: ${result.votazione?.value}`);
        console.log(`   Label: ${result.label?.value || 'N/A'}`);
        console.log(`   Favorevoli: ${result.favorevoli?.value || 'N/A'}`);
        console.log(`   Contrari: ${result.contrari?.value || 'N/A'}`);
        console.log(`   Seduta: ${result.seduta?.value || 'N/A'}`);
      });
    } else {
      console.log('⚠️ Nessun risultato trovato!');
    }
  } catch (error) {
    console.error('❌ Errore:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2).substring(0, 500));
    }
  }
}

async function main() {
  await testSparqlCamera();
  await testSparqlSenato();
}

main().catch(console.error);
