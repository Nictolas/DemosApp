// Script per verificare se _time, message, request_id è davvero una chiave unica
// Verifica se ci sono log diversi con stessi _time, message, request_id ma altri campi diversi
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

async function verifyUniqueness() {
  console.log('🔍 Verifica Unicità: _time, message, request_id\n');
  console.log('Verifico se ci sono log DIVERSI con stessi _time, message, request_id...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
  });
  
  try {
    // 1. Analizza su Neon: log con stesso timestamp, message, request_id ma altri campi diversi
    console.log('📊 STEP 1: Analisi su Neon\n');
    
    const neonDuplicates = await pool.query(`
      SELECT 
        TO_TIMESTAMP(timestamp / 1000)::text as ts,
        message,
        request_id,
        COUNT(*) as count,
        COUNT(DISTINCT user_id) as distinct_users,
        COUNT(DISTINCT ip_address) as distinct_ips,
        COUNT(DISTINCT endpoint) as distinct_endpoints,
        COUNT(DISTINCT session_id) as distinct_sessions,
        COUNT(DISTINCT user_agent) as distinct_user_agents,
        COUNT(DISTINCT level) as distinct_levels,
        COUNT(DISTINCT pid) as distinct_pids,
        COUNT(DISTINCT hostname) as distinct_hostnames
      FROM centralized_logs
      WHERE request_id IS NOT NULL AND request_id != ''
      GROUP BY TO_TIMESTAMP(timestamp / 1000)::text, message, request_id
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT 20
    `);
    
    console.log(`   Trovati ${neonDuplicates.rows.length} gruppi con stesso timestamp+message+request_id su Neon\n`);
    
    if (neonDuplicates.rows.length > 0) {
      console.log('   ⚠️ ATTENZIONE: Trovati log con stesso _time, message, request_id!');
      console.log('   Top 20 gruppi:\n');
      console.log('   ' + '='.repeat(100));
      
      let totalConflicts = 0;
      neonDuplicates.rows.forEach((row, idx) => {
        const ts = new Date(row.ts).toLocaleString('it-IT');
        const msg = row.message?.substring(0, 40) || '';
        const reqId = row.request_id?.substring(0, 30) || '';
        const count = parseInt(row.count);
        totalConflicts += (count - 1);
        
        console.log(`\n   ${idx + 1}. Timestamp: ${ts}`);
        console.log(`      Message: "${msg}${msg.length >= 40 ? '...' : ''}"`);
        console.log(`      Request ID: "${reqId}${reqId.length >= 30 ? '...' : ''}"`);
        console.log(`      Count: ${count} record`);
        console.log(`      User diversi: ${parseInt(row.distinct_users)}`);
        console.log(`      IP diversi: ${parseInt(row.distinct_ips)}`);
        console.log(`      Endpoint diversi: ${parseInt(row.distinct_endpoints)}`);
        console.log(`      Session ID diversi: ${parseInt(row.distinct_sessions)}`);
        console.log(`      User Agent diversi: ${parseInt(row.distinct_user_agents)}`);
        console.log(`      Level diversi: ${parseInt(row.distinct_levels)}`);
        console.log(`      PID diversi: ${parseInt(row.distinct_pids)}`);
        console.log(`      Hostname diversi: ${parseInt(row.distinct_hostnames)}`);
        
        // Se ci sono campi diversi, sono log DIVERSI con stessa chiave!
        const hasDifferences = parseInt(row.distinct_users) > 1 || 
                              parseInt(row.distinct_ips) > 1 || 
                              parseInt(row.distinct_endpoints) > 1 ||
                              parseInt(row.distinct_sessions) > 1 ||
                              parseInt(row.distinct_user_agents) > 1 ||
                              parseInt(row.distinct_levels) > 1 ||
                              parseInt(row.distinct_pids) > 1 ||
                              parseInt(row.distinct_hostnames) > 1;
        
        if (hasDifferences) {
          console.log(`      ❌ PROBLEMA: Questi sono log DIVERSI con stessa chiave!`);
          console.log(`      ❌ La chiave _time, message, request_id NON è unica!`);
        } else {
          console.log(`      ✅ Tutti i campi sono identici (duplicati reali)`);
        }
      });
      
      console.log(`\n   Totale conflitti: ${totalConflicts} log che verrebbero eliminati erroneamente\n`);
      
      if (totalConflicts > 0) {
        console.log(`   ⚠️ CONCLUSIONE: La chiave _time, message, request_id NON è sufficiente!`);
        console.log(`   ⚠️ Ci sono log diversi con stessa chiave che verrebbero eliminati!\n`);
      }
    } else {
      console.log('   ✅ Nessun gruppo duplicato trovato con _time, message, request_id');
      console.log('   ✅ La chiave è UNICA su Neon\n');
    }
    
    // 2. Verifica record senza request_id
    console.log('📊 STEP 2: Verifica record senza request_id\n');
    
    const neonWithoutRequestId = await pool.query(`
      SELECT COUNT(*) as count
      FROM centralized_logs
      WHERE request_id IS NULL OR request_id = ''
    `);
    
    const withoutRequestId = parseInt(neonWithoutRequestId.rows[0].count);
    const totalNeon = await pool.query(`SELECT COUNT(*) as count FROM centralized_logs`);
    const totalNeonCount = parseInt(totalNeon.rows[0].count);
    const withRequestId = totalNeonCount - withoutRequestId;
    
    console.log(`   Record totali su Neon: ${totalNeonCount.toLocaleString('it-IT')}`);
    console.log(`   Record CON request_id: ${withRequestId.toLocaleString('it-IT')} (${((withRequestId / totalNeonCount) * 100).toFixed(2)}%)`);
    console.log(`   Record SENZA request_id: ${withoutRequestId.toLocaleString('it-IT')} (${((withoutRequestId / totalNeonCount) * 100).toFixed(2)}%)\n`);
    
    if (withoutRequestId > 0) {
      console.log(`   ⚠️ ATTENZIONE: ${withoutRequestId.toLocaleString('it-IT')} record non hanno request_id!`);
      console.log(`   ⚠️ Per questi record, la chiave _time, message, request_id non funziona`);
      console.log(`   ⚠️ Dovresti usare una chiave alternativa per questi record\n`);
      
      // Analizza duplicati tra record senza request_id
      const duplicatesWithoutRequestId = await pool.query(`
        SELECT 
          TO_TIMESTAMP(timestamp / 1000)::text as ts,
          message,
          COUNT(*) as count,
          COUNT(DISTINCT user_id) as distinct_users,
          COUNT(DISTINCT ip_address) as distinct_ips,
          COUNT(DISTINCT endpoint) as distinct_endpoints
        FROM centralized_logs
        WHERE request_id IS NULL OR request_id = ''
        GROUP BY TO_TIMESTAMP(timestamp / 1000)::text, message
        HAVING COUNT(*) > 1
        ORDER BY COUNT(*) DESC
        LIMIT 10
      `);
      
      if (duplicatesWithoutRequestId.rows.length > 0) {
        console.log(`   Trovati ${duplicatesWithoutRequestId.rows.length} gruppi duplicati SENZA request_id:\n`);
        duplicatesWithoutRequestId.rows.forEach((row, idx) => {
          const ts = new Date(row.ts).toLocaleString('it-IT');
          const msg = row.message?.substring(0, 40) || '';
          console.log(`      ${idx + 1}. ${ts} - "${msg}${msg.length >= 40 ? '...' : ''}" - ${parseInt(row.count)} record`);
          console.log(`         User diversi: ${parseInt(row.distinct_users)}, IP diversi: ${parseInt(row.distinct_ips)}, Endpoint diversi: ${parseInt(row.distinct_endpoints)}`);
        });
        console.log('');
      }
    }
    
    // 3. Analizza su Axiom (campione)
    console.log('📊 STEP 3: Analisi su Axiom (campione)\n');
    
    let duplicateGroups = [];
    try {
      const axiomSampleQuery = `['centralized_logs'] | limit 5000`;
      const axiomSampleResult = await axiomClient.query(axiomSampleQuery, {
        startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Ultimi 7 giorni
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
      
      console.log(`   Campione analizzato: ${axiomSampleRows.length} record (ultimi 7 giorni)\n`);
      
      // Raggruppa per _time, message, request_id
      const groups = {};
      axiomSampleRows.forEach(row => {
        const time = row._time;
        let message = '';
        let requestId = '';
        
        // Estrai dal campo data se presente
        if (row.data && typeof row.data === 'object') {
          message = row.data.message || '';
          requestId = row.data.request_id || row.data.requestId || '';
        } else {
          message = row.message || '';
          requestId = row.request_id || row.requestId || '';
        }
        
        if (time && message) {
          const key = `${time}|${message.substring(0, 100)}|${requestId}`;
          if (!groups[key]) {
            groups[key] = {
              time,
              message: message.substring(0, 100),
              requestId,
              records: [],
              distinctUsers: new Set(),
              distinctIPs: new Set(),
              distinctEndpoints: new Set(),
              distinctSessions: new Set()
            };
          }
          
          const data = row.data || row;
          if (data.user_id || data.userId) groups[key].distinctUsers.add(data.user_id || data.userId);
          if (data.ip_address || data.ipAddress) groups[key].distinctIPs.add(data.ip_address || data.ipAddress);
          if (data.endpoint) groups[key].distinctEndpoints.add(data.endpoint);
          if (data.session_id || data.sessionId) groups[key].distinctSessions.add(data.session_id || data.sessionId);
          
          groups[key].records.push(row);
        }
      });
      
      // Trova gruppi con più di un record
      const duplicateGroups = Object.values(groups)
        .filter(g => g.records.length > 1)
        .sort((a, b) => b.records.length - a.records.length)
        .slice(0, 10);
      
      console.log(`   Trovati ${duplicateGroups.length} gruppi con stesso _time+message+request_id nel campione\n`);
      
      if (duplicateGroups.length > 0) {
        console.log('   Top 10 gruppi duplicati su Axiom:');
        console.log('   ' + '='.repeat(100));
        
        let hasConflicts = false;
        duplicateGroups.forEach((group, idx) => {
          const time = new Date(group.time).toLocaleString('it-IT');
          const msg = group.message.substring(0, 40);
          const reqId = group.requestId.substring(0, 30) || '(vuoto)';
          
          console.log(`\n   ${idx + 1}. Timestamp: ${time}`);
          console.log(`      Message: "${msg}${msg.length >= 40 ? '...' : ''}"`);
          console.log(`      Request ID: "${reqId}${reqId.length >= 30 ? '...' : ''}"`);
          console.log(`      Count: ${group.records.length} record`);
          console.log(`      User diversi: ${group.distinctUsers.size}`);
          console.log(`      IP diversi: ${group.distinctIPs.size}`);
          console.log(`      Endpoint diversi: ${group.distinctEndpoints.size}`);
          console.log(`      Session ID diversi: ${group.distinctSessions.size}`);
          
          const hasDifferences = group.distinctUsers.size > 1 || 
                                group.distinctIPs.size > 1 || 
                                group.distinctEndpoints.size > 1 ||
                                group.distinctSessions.size > 1;
          
          if (hasDifferences) {
            hasConflicts = true;
            console.log(`      ❌ PROBLEMA: Questi sono log DIVERSI con stessa chiave!`);
            console.log(`      ❌ La chiave _time, message, request_id NON è unica!`);
          } else {
            console.log(`      ✅ Tutti i campi sono identici (duplicati reali)`);
          }
        });
        
        if (hasConflicts) {
          console.log(`\n   ⚠️ CONCLUSIONE: La chiave _time, message, request_id NON è sufficiente!`);
        } else {
          console.log(`\n   ✅ CONCLUSIONE: Nel campione, la chiave sembra essere unica`);
        }
      } else {
        console.log('   ✅ Nessun gruppo duplicato trovato nel campione Axiom');
        console.log('   ✅ La chiave sembra essere unica nel campione\n');
      }
      
    } catch (axiomErr) {
      console.error('   ❌ Errore analisi Axiom:', axiomErr.message);
    }
    
    // 4. Raccomandazioni finali
    console.log('\n\n📊 STEP 4: Raccomandazioni Finali\n');
    console.log('   ' + '='.repeat(100));
    
    const hasNeonConflicts = neonDuplicates.rows.length > 0 && neonDuplicates.rows.some(r => 
      parseInt(r.distinct_users) > 1 || 
      parseInt(r.distinct_ips) > 1 || 
      parseInt(r.distinct_endpoints) > 1);
    
    const hasAxiomConflicts = duplicateGroups && duplicateGroups.length > 0 && 
      duplicateGroups.some(g => 
        g.distinctUsers.size > 1 || 
        g.distinctIPs.size > 1 || 
        g.distinctEndpoints.size > 1 ||
        g.distinctSessions.size > 1);
    
    if (neonDuplicates.rows.length === 0 && (!duplicateGroups || duplicateGroups.length === 0)) {
      console.log('\n   ✅ La chiave _time, message, request_id è UNICA per record CON request_id');
      console.log('   ✅ Puoi usarla per la deduplicazione senza rischi');
      console.log(`\n   ⚠️ MA: ${withoutRequestId.toLocaleString('it-IT')} record (${((withoutRequestId / totalNeonCount) * 100).toFixed(2)}%) NON hanno request_id`);
      console.log('   ⚠️ Per questi record, devi usare una chiave alternativa\n');
      console.log('   💡 SOLUZIONE:');
      console.log('      - Per record CON request_id: usa _time, message, request_id');
      console.log('      - Per record SENZA request_id: usa _time, message, user_id, ip_address');
      console.log('      - Oppure: _time, message, session_id\n');
    } else if (hasNeonConflicts || hasAxiomConflicts) {
      console.log('\n   ❌ La chiave _time, message, request_id NON è sufficiente');
      console.log('   ❌ Ci sono log diversi con stessa chiave');
      console.log('\n   💡 RACCOMANDAZIONI:');
      console.log('      1. Usa una chiave più specifica: _time, message, request_id, user_id');
      console.log('      2. Oppure: _time, message, request_id, ip_address');
      console.log('      3. Oppure: _time, message, request_id, session_id');
      console.log('      4. Per record senza request_id, usa: _time, message, user_id, ip_address\n');
    } else {
      console.log('\n   ✅ La chiave _time, message, request_id è UNICA per record CON request_id');
      console.log(`   ⚠️ MA: ${withoutRequestId.toLocaleString('it-IT')} record (${((withoutRequestId / totalNeonCount) * 100).toFixed(2)}%) NON hanno request_id`);
      console.log('\n   💡 RACCOMANDAZIONI:');
      console.log('      1. Per record CON request_id: usa _time, message, request_id ✅');
      console.log('      2. Per record SENZA request_id: usa _time, message, user_id, ip_address');
      console.log('      3. Oppure: _time, message, session_id\n');
    }
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Errore:', error);
    await pool.end();
    process.exit(1);
  }
}

verifyUniqueness();

