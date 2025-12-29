const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function analyzeAuditLogs() {
  const client = await pool.connect();
  try {
    console.log('📊 Analisi tabella audit_logs...');
    
    // Struttura tabella
    const structure = await client.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'audit_logs' 
      ORDER BY ordinal_position;
    `);
    
    console.log('\n📋 Struttura tabella:');
    structure.rows.forEach(col => {
      console.log(`   • ${col.column_name}: ${col.data_type}${col.character_maximum_length ? '(' + col.character_maximum_length + ')' : ''} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    // Statistiche
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT action) as unique_actions,
        COUNT(DISTINCT ip_address) as unique_ips,
        COUNT(DISTINCT user_agent) as unique_user_agents,
        MIN(timestamp) as oldest_record,
        MAX(timestamp) as newest_record
      FROM audit_logs;
    `);
    
    const s = stats.rows[0];
    console.log('\n📈 Statistiche:');
    console.log(`   • Record totali: ${s.total_records}`);
    console.log(`   • Azioni uniche: ${s.unique_actions}`);
    console.log(`   • IP unici: ${s.unique_ips}`);
    console.log(`   • User Agent unici: ${s.unique_user_agents}`);
    console.log(`   • Record più vecchio: ${s.oldest_record}`);
    console.log(`   • Record più recente: ${s.newest_record}`);
    
    // Top azioni
    const topActions = await client.query(`
      SELECT action, COUNT(*) as count
      FROM audit_logs
      GROUP BY action
      ORDER BY count DESC
      LIMIT 10;
    `);
    
    console.log('\n🔝 Top 10 azioni:');
    topActions.rows.forEach((row, i) => {
      console.log(`   ${i+1}. ${row.action}: ${row.count} record`);
    });
    
    // Top IP addresses
    const topIPs = await client.query(`
      SELECT ip_address, COUNT(*) as count
      FROM audit_logs
      WHERE ip_address IS NOT NULL
      GROUP BY ip_address
      ORDER BY count DESC
      LIMIT 10;
    `);
    
    console.log('\n🌐 Top 10 IP addresses:');
    topIPs.rows.forEach((row, i) => {
      console.log(`   ${i+1}. ${row.ip_address}: ${row.count} record`);
    });
    
    // Top user agents
    const topUserAgents = await client.query(`
      SELECT user_agent, COUNT(*) as count
      FROM audit_logs
      WHERE user_agent IS NOT NULL AND user_agent != ''
      GROUP BY user_agent
      ORDER BY count DESC
      LIMIT 5;
    `);
    
    console.log('\n🖥️ Top 5 User Agents:');
    topUserAgents.rows.forEach((row, i) => {
      const ua = row.user_agent.length > 80 ? row.user_agent.substring(0, 80) + '...' : row.user_agent;
      console.log(`   ${i+1}. ${ua}: ${row.count} record`);
    });
    
  } finally {
    client.release();
    await pool.end();
  }
}

analyzeAuditLogs().catch(console.error);
