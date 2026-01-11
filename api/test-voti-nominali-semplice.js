const axios = require('axios');

async function testVotiNominaliSemplice() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 TEST VOTI NOMINALI - QUERY SEMPLIFICATE');
  console.log('='.repeat(80));
  
  // Test Senato - Query separata per voti favorevoli
  console.log('\n📊 SENATO - Query separata per voti favorevoli\n');
  
  const queryFavorevoli = `
    PREFIX osr: <http://dati.senato.it/osr/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    
    SELECT DISTINCT ?votazione ?label ?senatore ?nomeSenatore
    WHERE {
      ?votazione a osr:Votazione .
      OPTIONAL { ?votazione rdfs:label ?label . }
      ?votazione osr:favorevole ?senatore .
      OPTIONAL { ?senatore rdfs:label ?nomeSenatore . }
    }
    ORDER BY DESC(?votazione)
    LIMIT 10
  `;
  
  try {
    const params = new URLSearchParams();
    params.append('query', queryFavorevoli);
    params.append('format', 'json');
    
    const response = await axios.get(`https://dati.senato.it/sparql?${params.toString()}`, {
      headers: {
        'Accept': 'application/sparql-results+json, application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 30000
    });
    
    const bindings = response.data?.results?.bindings || [];
    console.log(`✅ Trovati ${bindings.length} voti favorevoli\n`);
    
    if (bindings.length > 0) {
      const votazioni = {};
      bindings.forEach(b => {
        const uri = b.votazione?.value;
        if (!votazioni[uri]) {
          votazioni[uri] = {
            label: b.label?.value || 'N/A',
            favorevoli: []
          };
        }
        if (b.nomeSenatore?.value) {
          votazioni[uri].favorevoli.push(b.nomeSenatore.value);
        }
      });
      
      const prima = Object.values(votazioni)[0];
      console.log(`📋 Votazione: ${prima.label}`);
      console.log(`   Favorevoli: ${prima.favorevoli.length} senatori`);
      if (prima.favorevoli.length > 0) {
        console.log(`   - ${prima.favorevoli.slice(0, 5).join(', ')}${prima.favorevoli.length > 5 ? '...' : ''}`);
      }
    }
    
  } catch (error) {
    console.error(`❌ Errore: ${error.message}`);
  }
  
  // Test Senato - Query per una votazione specifica
  console.log('\n\n📊 SENATO - Dettagli di una votazione specifica (URI)\n');
  
  // Prendiamo un URI di esempio dalla query precedente
  const uriEsempio = 'http://dati.senato.it/votazione/19-378-1';
  
  const queryDettagli = `
    PREFIX osr: <http://dati.senato.it/osr/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    
    SELECT DISTINCT ?votazione ?label ?favorevoli ?contrari ?presenti ?votanti ?maggioranza 
                    ?tipoVotazione ?astenuti ?numeroLegale ?presidente ?esito ?seduta 
                    ?sedutaData ?sedutaNumero ?sedutaLegislatura ?sedutaTipo
    WHERE {
      BIND(<${uriEsempio}> AS ?votazione)
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
    }
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
      timeout: 30000
    });
    
    const bindings = response.data?.results?.bindings || [];
    console.log(`✅ Trovati ${bindings.length} risultati\n`);
    
    if (bindings.length > 0) {
      const primo = bindings[0];
      console.log(`📋 Votazione: ${primo.label?.value || 'N/A'}`);
      console.log(`   Data: ${primo.sedutaData?.value || 'N/A'}`);
      console.log(`   Favorevoli: ${primo.favorevoli?.value || 'N/A'}`);
      console.log(`   Contrari: ${primo.contrari?.value || 'N/A'}`);
      console.log(`   Presenti: ${primo.presenti?.value || 'N/A'}`);
      console.log(`   Votanti: ${primo.votanti?.value || 'N/A'}`);
      console.log(`   Maggioranza: ${primo.maggioranza?.value || 'N/A'}`);
      console.log(`   Tipo: ${primo.tipoVotazione?.value || 'N/A'}`);
      console.log(`   Astenuti: ${primo.astenuti?.value || 'N/A'}`);
      console.log(`   Numero Legale: ${primo.numeroLegale?.value || 'N/A'}`);
      console.log(`   Presidente: ${primo.presidente?.value || 'N/A'}`);
      console.log(`   Esito: ${primo.esito?.value || 'N/A'}`);
      console.log(`   Seduta: n. ${primo.sedutaNumero?.value || 'N/A'}, tipo: ${primo.sedutaTipo?.value || 'N/A'}`);
    }
    
  } catch (error) {
    console.error(`❌ Errore: ${error.message}`);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ TEST COMPLETATO');
  console.log('='.repeat(80));
}

testVotiNominaliSemplice().catch(console.error);
