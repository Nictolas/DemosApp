const axios = require('axios');

/**
 * Test completo per verificare quali dati sono REALMENTE disponibili
 * dagli endpoint SPARQL di Camera e Senato
 */

async function testCamera() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST CAMERA - Dati Disponibili');
  console.log('='.repeat(80));
  
  const endpoint = 'http://dati.camera.it/sparql';
  
  // Query per ottenere TUTTI i predicati di una votazione
  const query = `
    PREFIX ocd: <http://dati.camera.it/ocd/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    
    SELECT DISTINCT ?votazione ?label ?approvato ?seduta ?sedutaData ?sedutaNumero ?legislatura ?numeroLegislatura
    WHERE {
      ?votazione a <http://dati.camera.it/ocd/votazione> .
      FILTER(CONTAINS(STR(?votazione), "vs19"))
      
      OPTIONAL { ?votazione rdfs:label ?label . }
      OPTIONAL { ?votazione ocd:approvato ?approvato . }
      OPTIONAL { 
        ?votazione ocd:rif_seduta ?seduta .
        OPTIONAL { ?seduta ocd:data ?sedutaData . }
        OPTIONAL { ?seduta ocd:numero ?sedutaNumero . }
      }
      OPTIONAL { 
        ?votazione ocd:rif_legislatura ?legislatura .
        OPTIONAL { ?legislatura ocd:numero ?numeroLegislatura . }
      }
    }
    ORDER BY DESC(?votazione)
    LIMIT 5
  `;
  
  try {
    const params = new URLSearchParams();
    params.append('query', query);
    params.append('format', 'json');
    
    const response = await axios.get(`${endpoint}?${params.toString()}`, {
      headers: {
        'Accept': 'application/sparql-results+json, application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 30000
    });
    
    const bindings = response.data?.results?.bindings || [];
    console.log(`✅ Trovate ${bindings.length} votazioni\n`);
    
    if (bindings.length > 0) {
      console.log('📋 DATI DISPONIBILI PER CAMERA:');
      console.log('─'.repeat(80));
      
      const primo = bindings[0];
      const datiDisponibili = {
        'URI Votazione': primo.votazione?.value || 'N/A',
        'Label/Descrizione': primo.label?.value || 'NON DISPONIBILE',
        'Approvato (1/0)': primo.approvato?.value || 'NON DISPONIBILE',
        'URI Seduta': primo.seduta?.value || 'NON DISPONIBILE',
        'Data Seduta': primo.sedutaData?.value || 'NON DISPONIBILE',
        'Numero Seduta': primo.sedutaNumero?.value || 'NON DISPONIBILE',
        'URI Legislatura': primo.legislatura?.value || 'NON DISPONIBILE',
        'Numero Legislatura': primo.numeroLegislatura?.value || 'NON DISPONIBILE'
      };
      
      Object.entries(datiDisponibili).forEach(([key, value]) => {
        const status = value === 'NON DISPONIBILE' ? '❌' : '✅';
        console.log(`${status} ${key}: ${value}`);
      });
      
      console.log('\n📄 ESEMPIO COMPLETO:');
      console.log(JSON.stringify(primo, null, 2));
    } else {
      console.log('⚠️ Nessuna votazione trovata');
    }
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  }
}

async function testSenato() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SENATO - Dati Disponibili');
  console.log('='.repeat(80));
  
  const endpoint = 'https://dati.senato.it/sparql';
  
  // Query per ottenere TUTTI i predicati di una votazione
  const query = `
    PREFIX osr: <http://dati.senato.it/osr/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    
    SELECT DISTINCT ?votazione ?label ?favorevoli ?contrari ?presenti ?votanti ?maggioranza 
                    ?tipoVotazione ?seduta ?sedutaData ?sedutaNumero
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
        OPTIONAL { ?seduta osr:data ?sedutaData . }
        OPTIONAL { ?seduta osr:numero ?sedutaNumero . }
      }
    }
    ORDER BY DESC(?votazione)
    LIMIT 5
  `;
  
  try {
    const params = new URLSearchParams();
    params.append('query', query);
    params.append('format', 'json');
    
    const response = await axios.get(`${endpoint}?${params.toString()}`, {
      headers: {
        'Accept': 'application/sparql-results+json, application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 30000
    });
    
    const bindings = response.data?.results?.bindings || [];
    console.log(`✅ Trovate ${bindings.length} votazioni\n`);
    
    if (bindings.length > 0) {
      console.log('📋 DATI DISPONIBILI PER SENATO:');
      console.log('─'.repeat(80));
      
      const primo = bindings[0];
      const datiDisponibili = {
        'URI Votazione': primo.votazione?.value || 'N/A',
        'Label/Descrizione': primo.label?.value || 'NON DISPONIBILE',
        'Favorevoli': primo.favorevoli?.value || 'NON DISPONIBILE',
        'Contrari': primo.contrari?.value || 'NON DISPONIBILE',
        'Presenti': primo.presenti?.value || 'NON DISPONIBILE',
        'Votanti': primo.votanti?.value || 'NON DISPONIBILE',
        'Maggioranza': primo.maggioranza?.value || 'NON DISPONIBILE',
        'Tipo Votazione': primo.tipoVotazione?.value || 'NON DISPONIBILE',
        'URI Seduta': primo.seduta?.value || 'NON DISPONIBILE',
        'Data Seduta': primo.sedutaData?.value || 'NON DISPONIBILE',
        'Numero Seduta': primo.sedutaNumero?.value || 'NON DISPONIBILE'
      };
      
      Object.entries(datiDisponibili).forEach(([key, value]) => {
        const status = value === 'NON DISPONIBILE' ? '❌' : '✅';
        console.log(`${status} ${key}: ${value}`);
      });
      
      console.log('\n📄 ESEMPIO COMPLETO:');
      console.log(JSON.stringify(primo, null, 2));
    } else {
      console.log('⚠️ Nessuna votazione trovata');
    }
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  }
}

async function testSedutaCamera() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SEDUTA CAMERA - Dati Disponibili');
  console.log('='.repeat(80));
  
  const endpoint = 'http://dati.camera.it/sparql';
  
  // Prima trova una seduta collegata a una votazione
  const query = `
    PREFIX ocd: <http://dati.camera.it/ocd/>
    
    SELECT DISTINCT ?seduta ?predicato ?oggetto
    WHERE {
      ?votazione a <http://dati.camera.it/ocd/votazione> .
      FILTER(CONTAINS(STR(?votazione), "vs19"))
      ?votazione ocd:rif_seduta ?seduta .
      ?seduta ?predicato ?oggetto .
    }
    LIMIT 30
  `;
  
  try {
    const params = new URLSearchParams();
    params.append('query', query);
    params.append('format', 'json');
    
    const response = await axios.get(`${endpoint}?${params.toString()}`, {
      headers: {
        'Accept': 'application/sparql-results+json, application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 30000
    });
    
    const bindings = response.data?.results?.bindings || [];
    console.log(`✅ Trovati ${bindings.length} predicati di sedute\n`);
    
    if (bindings.length > 0) {
      const predicati = new Set();
      const sedute = {};
      
      bindings.forEach(b => {
        const seduta = b.seduta?.value;
        const pred = b.predicato?.value;
        const obj = b.oggetto?.value;
        
        if (!sedute[seduta]) sedute[seduta] = {};
        sedute[seduta][pred] = obj;
        predicati.add(pred);
      });
      
      console.log('📋 PREDICATI DISPONIBILI PER SEDUTA CAMERA:');
      console.log('─'.repeat(80));
      Array.from(predicati).sort().forEach(p => {
        const nome = p.split('/').pop().split('#').pop();
        console.log(`✅ ${nome}`);
      });
      
      if (Object.keys(sedute).length > 0) {
        const primaSeduta = Object.entries(sedute)[0];
        console.log('\n📄 ESEMPIO SEDUTA:');
        console.log(`URI: ${primaSeduta[0]}`);
        Object.entries(primaSeduta[1]).forEach(([pred, obj]) => {
          const nome = pred.split('/').pop().split('#').pop();
          console.log(`  ${nome}: ${String(obj).substring(0, 100)}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  }
}

async function testSedutaSenato() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SEDUTA SENATO - Dati Disponibili');
  console.log('='.repeat(80));
  
  const endpoint = 'https://dati.senato.it/sparql';
  
  const query = `
    PREFIX osr: <http://dati.senato.it/osr/>
    
    SELECT DISTINCT ?seduta ?predicato ?oggetto
    WHERE {
      ?votazione a osr:Votazione .
      ?votazione osr:seduta ?seduta .
      ?seduta ?predicato ?oggetto .
    }
    LIMIT 30
  `;
  
  try {
    const params = new URLSearchParams();
    params.append('query', query);
    params.append('format', 'json');
    
    const response = await axios.get(`${endpoint}?${params.toString()}`, {
      headers: {
        'Accept': 'application/sparql-results+json, application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 30000
    });
    
    const bindings = response.data?.results?.bindings || [];
    console.log(`✅ Trovati ${bindings.length} predicati di sedute\n`);
    
    if (bindings.length > 0) {
      const predicati = new Set();
      const sedute = {};
      
      bindings.forEach(b => {
        const seduta = b.seduta?.value;
        const pred = b.predicato?.value;
        const obj = b.oggetto?.value;
        
        if (!sedute[seduta]) sedute[seduta] = {};
        sedute[seduta][pred] = obj;
        predicati.add(pred);
      });
      
      console.log('📋 PREDICATI DISPONIBILI PER SEDUTA SENATO:');
      console.log('─'.repeat(80));
      Array.from(predicati).sort().forEach(p => {
        const nome = p.split('/').pop().split('#').pop();
        console.log(`✅ ${nome}`);
      });
      
      if (Object.keys(sedute).length > 0) {
        const primaSeduta = Object.entries(sedute)[0];
        console.log('\n📄 ESEMPIO SEDUTA:');
        console.log(`URI: ${primaSeduta[0]}`);
        Object.entries(primaSeduta[1]).forEach(([pred, obj]) => {
          const nome = pred.split('/').pop().split('#').pop();
          console.log(`  ${nome}: ${String(obj).substring(0, 100)}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  }
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 ANALISI COMPLETA DATI SPARQL DISPONIBILI');
  console.log('='.repeat(80));
  
  await testCamera();
  await testSedutaCamera();
  await testSenato();
  await testSedutaSenato();
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ ANALISI COMPLETATA');
  console.log('='.repeat(80));
}

main().catch(console.error);
