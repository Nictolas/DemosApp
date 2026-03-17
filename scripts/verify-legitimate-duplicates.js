// Script per verificare se ci sono log legittimi con stesso _time e message
// Se ci sono, la deduplicazione potrebbe eliminare log importanti
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

let Axiom;
let axiomClient;

try {
  Axiom = require('@axiomhq/axiom-node');
  const region = (process.env.AXIOM_REGION || 'eu').toLowerCase();
  axiomClient = new Axiom.Client({
    token: process.env.AXIOM_API_TOKEN,
    orgId: process.env.AXIOM_ORG_ID,
    region: region
  });
} catch (sdkErr) {
  console.error('⚠️ SDK Axiom non disponibile:', sdkErr.message);
  process.exit(1);
}

const { Pool } = require('pg');

async function verifyLegitimateDuplicates() {
  console.log('🔍 Verifica Log Legittimi Duplicati\n');
  console.log('Analizzo se ci sono log diversi con stesso _time e message...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    // 1. Analizza su Neon: quanti record hanno stesso timestamp e message ma altri campi diversi?
    console.log('📊 STEP 1: Analisi su Neon (database originale)\n');
    
    const neonDuplicates = await pool.query(`
      SELECT 
        TO_TIMESTAMP(timestamp / 1000)::text as ts,
        message,
        COUNT(*) as count,
        COUNT(DISTINCT user_id) as distinct_users,
        COUNT(DISTINCT ip_address) as distinct_ips,
        COUNT(DISTINCT endpoint) as distinct_endpoints,
        COUNT(DISTINCT request_id) as distinct_requests,
        COUNT(DISTINCT session_id) as distinct_sessions
      FROM centralized_logs
      GROUP BY TO_TIMESTAMP(timestamp / 1000)::text, message
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT 20
    `);
    
    console.log(`   Trovati ${neonDuplicates.rows.length} gruppi con stesso timestamp+message su Neon\n`);
    
    if (neonDuplicates.rows.length > 0) {
      console.log('   Top 20 gruppi duplicati su Neon:');
      console.log('   ' + '='.repeat(100));
      neonDuplicates.rows.forEach((row, idx) => {
        const ts = new Date(row.ts).toLocaleString('it-IT');
        const msg = row.message?.substring(0, 50) || '';
        console.log(`\n   ${idx + 1}. Timestamp: ${ts}`);
        console.log(`      Message: "${msg}${msg.length >= 50 ? '...' : ''}"`);
        console.log(`      Count: ${parseInt(row.count)} record`);
        console.log(`      User diversi: ${parseInt(row.distinct_users)}`);
        console.log(`      IP diversi: ${parseInt(row.distinct_ips)}`);
        console.log(`      Endpoint diversi: ${parseInt(row.distinct_endpoints)}`);
        console.log(`      Request ID diversi: ${parseInt(row.distinct_requests)}`);
        console.log(`      Session ID diversi: ${parseInt(row.distinct_sessions)}`);
        
        // Se ci sono user, IP, endpoint o request diversi, sono log legittimi diversi!
        if (parseInt(row.distinct_users) > 1 || 
            parseInt(row.distinct_ips) > 1 || 
            parseInt(row.distinct_endpoints) > 1 ||
            parseInt(row.distinct_requests) > 1) {
          console.log(`      ⚠️ ATTENZIONE: Questi sono log LEGITTIMI diversi!`);
          console.log(`      ⚠️ La deduplicazione eliminerà ${parseInt(row.count) - 1} log legittimi!`);
        } else {
          console.log(`      ✅ Probabilmente duplicati reali (stessi campi)`);
        }
      });
    } else {
      console.log('   ✅ Nessun gruppo duplicato trovato su Neon');
      console.log('   ✅ Tutti i log hanno timestamp+message unici');
    }
    
    // 2. Analizza su Axiom: quanti record hanno stesso _time e message?
    console.log('\n\n📊 STEP 2: Analisi su Axiom\n');
    
    try {
      // Query per trovare gruppi con stesso _time e message
      // Prendiamo un campione per non sovraccaricare
      const axiomSampleQuery = `['centralized_logs'] | limit 10000`;
      const axiomSampleResult = await axiomClient.query(axiomSampleQuery, {
        startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Ultimi 30 giorni
        endTime: new Date()
      });
      
      let axiomSampleRows = [];
      if (axiomSampleResult.matches && Array.isArray(axiomSampleResult.matches)) {
        axiomSampleRows = axiomSampleResult.matches;
      } else if (axiomSampleResult.buckets && Array.isArray(axiomSampleResult.buckets)) {
        axiomSampleRows = axiomSampleResult.buckets.flatMap(b => {
          if (b.rows && Array.isArray(b.rows)) return b.rows;
          if (b.data && Array.isArray(b.data)) return b.data;
          return [];
        });
      }
      
      console.log(`   Campione analizzato: ${axiomSampleRows.length} record (ultimi 30 giorni)\n`);
      
      // Raggruppa per _time e message
      const groups = {};
      axiomSampleRows.forEach(row => {
        const time = row._time;
        let message = '';
        
        // Estrai message dal campo data se presente
        if (row.data && typeof row.data === 'object') {
          message = row.data.message || '';
        } else if (row.message) {
          message = row.message;
        }
        
        if (time && message) {
          const key = `${time}|${message.substring(0, 100)}`;
          if (!groups[key]) {
            groups[key] = {
              time,
              message: message.substring(0, 100),
              records: [],
              distinctUsers: new Set(),
              distinctIPs: new Set(),
              distinctEndpoints: new Set(),
              distinctRequests: new Set()
            };
          }
          
          // Estrai campi dal data object
          const data = row.data || row;
          if (data.user_id || data.userId) groups[key].distinctUsers.add(data.user_id || data.userId);
          if (data.ip_address || data.ipAddress) groups[key].distinctIPs.add(data.ip_address || data.ipAddress);
          if (data.endpoint) groups[key].distinctEndpoints.add(data.endpoint);
          if (data.request_id || data.requestId) groups[key].distinctRequests.add(data.request_id || data.requestId);
          
          groups[key].records.push(row);
        }
      });
      
      // Trova gruppi con più di un record
      const duplicateGroups = Object.values(groups)
        .filter(g => g.records.length > 1)
        .sort((a, b) => b.records.length - a.records.length)
        .slice(0, 20);
      
      console.log(`   Trovati ${duplicateGroups.length} gruppi con stesso _time+message nel campione\n`);
      
      if (duplicateGroups.length > 0) {
        console.log('   Top 20 gruppi duplicati su Axiom (campione):');
        console.log('   ' + '='.repeat(100));
        duplicateGroups.forEach((group, idx) => {
          const time = new Date(group.time).toLocaleString('it-IT');
          const msg = group.message.substring(0, 50);
          console.log(`\n   ${idx + 1}. Timestamp: ${time}`);
          console.log(`      Message: "${msg}${msg.length >= 50 ? '...' : ''}"`);
          console.log(`      Count: ${group.records.length} record`);
          console.log(`      User diversi: ${group.distinctUsers.size}`);
          console.log(`      IP diversi: ${group.distinctIPs.size}`);
          console.log(`      Endpoint diversi: ${group.distinctEndpoints.size}`);
          console.log(`      Request ID diversi: ${group.distinctRequests.size}`);
          
          // Se ci sono user, IP, endpoint o request diversi, sono log legittimi diversi!
          if (group.distinctUsers.size > 1 || 
              group.distinctIPs.size > 1 || 
              group.distinctEndpoints.size > 1 ||
              group.distinctRequests.size > 1) {
            console.log(`      ⚠️ ATTENZIONE: Questi sono log LEGITTIMI diversi!`);
            console.log(`      ⚠️ La deduplicazione eliminerà ${group.records.length - 1} log legittimi!`);
          } else {
            console.log(`      ✅ Probabilmente duplicati reali (stessi campi)`);
          }
        });
      } else {
        console.log('   ✅ Nessun gruppo duplicato trovato nel campione Axiom');
      }
      
      // 3. Calcola statistiche
      console.log('\n\n📊 STEP 3: Statistiche\n');
      
      const totalDuplicateGroups = duplicateGroups.length;
      const legitimateGroups = duplicateGroups.filter(g => 
        g.distinctUsers.size > 1 || 
        g.distinctIPs.size > 1 || 
        g.distinctEndpoints.size > 1 ||
        g.distinctRequests.size > 1
      );
      const legitimateDuplicates = legitimateGroups.length;
      
      const totalDuplicateRecords = duplicateGroups.reduce((sum, g) => sum + g.records.length, 0);
      const legitimateDuplicateRecords = legitimateGroups.reduce((sum, g) => sum + (g.records.length - 1), 0);
      
      console.log(`   Gruppi duplicati nel campione: ${totalDuplicateGroups}`);
      console.log(`   Gruppi con log legittimi diversi: ${legitimateDuplicates}`);
      console.log(`   Record duplicati totali nel campione: ${totalDuplicateRecords}`);
      console.log(`   Record legittimi che verrebbero eliminati: ${legitimateDuplicateRecords}`);
      
      if (legitimateDuplicates > 0) {
        const percentage = totalDuplicateRecords > 0 
          ? ((legitimateDuplicateRecords / totalDuplicateRecords) * 100).toFixed(2)
          : 0;
        console.log(`\n   ⚠️ PERCENTUALE: ${percentage}% dei duplicati nel campione sono log legittimi!`);
        console.log(`   ⚠️ La deduplicazione eliminerà questi log legittimi!`);
      } else {
        console.log(`\n   ✅ Tutti i duplicati sembrano essere duplicati reali`);
        console.log(`   ✅ La deduplicazione è sicura`);
      }
      
    } catch (axiomErr) {
      console.error('   ❌ Errore analisi Axiom:', axiomErr.message);
    }
    
    // 4. Conclusioni
    console.log('\n\n📊 STEP 4: Conclusioni e Raccomandazioni\n');
    console.log('   ' + '='.repeat(100));
    
    const hasLegitimateDuplicates = (neonDuplicates.rows.length > 0 && 
      neonDuplicates.rows.some(r => parseInt(r.distinct_requests) > 1)) ||
      (duplicateGroups.length > 0 && legitimateDuplicates > 0);
    
    if (neonDuplicates.rows.length === 0 && duplicateGroups.length === 0) {
      console.log('\n   ✅ CONCLUSIONE: Nessun log legittimo duplicato trovato');
      console.log('   ✅ La deduplicazione è SICURA');
      console.log('   ✅ Puoi procedere con la deduplicazione senza rischi\n');
    } else if (hasLegitimateDuplicates) {
      console.log('\n   ⚠️ CONCLUSIONE: Trovati log legittimi con stesso _time e message');
      console.log('   ⚠️ La deduplicazione eliminerà questi log legittimi');
      console.log('\n   💡 RACCOMANDAZIONI:');
      console.log('      1. Usa una chiave unica più specifica (es: _time, message, request_id)');
      console.log('      2. Oppure accetta di perdere alcuni log legittimi');
      console.log('      3. Oppure non deduplicare e mantieni i duplicati\n');
    } else {
      console.log('\n   ✅ CONCLUSIONE: I duplicati sembrano essere duplicati reali');
      console.log('   ✅ La deduplicazione è relativamente sicura');
      console.log('   ✅ Puoi procedere, ma monitora i risultati\n');
    }
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Errore:', error);
    await pool.end();
    process.exit(1);
  }
}

verifyLegitimateDuplicates();

