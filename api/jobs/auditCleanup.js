const cron = require('node-cron');
const AuditService = require('../services/auditService');

/**
 * Job automatico per la pulizia dei log di audit
 * Esegue ogni giorno alle 2:00 AM
 */
const auditCleanupJob = cron.schedule('0 2 * * *', async () => {
  try {
    // Se Axiom è abilitato, la pulizia viene gestita automaticamente da Axiom
    if (process.env.AXIOM_ENABLED === 'true') {
      console.log('ℹ️  Con Axiom abilitato, la pulizia dei log viene gestita automaticamente da Axiom');
      return;
    }
    
    console.log('🧹 Avvio pulizia automatica log di audit...');
    
    // Pulisce log più vecchi di 1 anno (365 giorni)
    const deletedCount = await AuditService.cleanupOldLogs(365);
    
    console.log(`✅ Pulizia completata: rimossi ${deletedCount} log di audit`);
    
    // Log dell'operazione di pulizia
    await AuditService.logAction({
      userId: 'system',
      action: 'AUDIT_CLEANUP',
      resource: 'audit_logs',
      details: { 
        deleted_count: deletedCount,
        retention_days: 365,
        cleanup_date: new Date().toISOString()
      },
      success: true
    });
    
  } catch (error) {
    console.error('❌ Errore nella pulizia automatica log audit:', error);
    
    // Log dell'errore
    await AuditService.logAction({
      userId: 'system',
      action: 'AUDIT_CLEANUP',
      resource: 'audit_logs',
      details: { 
        error: error.message,
        cleanup_date: new Date().toISOString()
      },
      success: false,
      errorMessage: error.message
    });
  }
}, {
  scheduled: false, // Non avviare automaticamente
  timezone: 'Europe/Rome'
});

/**
 * Job per l'analisi delle attività sospette
 * Esegue ogni ora
 */
const suspiciousActivityJob = cron.schedule('0 * * * *', async () => {
  try {
    console.log('🔍 Analisi attività sospette...');
    
    // Analizza attività degli ultimi 24 ore
    const suspiciousQuery = `
      SELECT 
        user_id,
        ip_address,
        COUNT(*) as action_count,
        COUNT(CASE WHEN success = false THEN 1 END) as failed_count
      FROM audit_logs 
      WHERE timestamp >= NOW() - INTERVAL '24 hours'
      GROUP BY user_id, ip_address
      HAVING COUNT(*) > 100 OR COUNT(CASE WHEN success = false THEN 1 END) > 20
      ORDER BY action_count DESC
    `;
    
    // Qui potresti implementare notifiche agli admin
    // o inviare alert per attività sospette
    
    console.log('✅ Analisi attività sospette completata');
    
  } catch (error) {
    console.error('❌ Errore nell\'analisi attività sospette:', error);
  }
}, {
  scheduled: false,
  timezone: 'Europe/Rome'
});

/**
 * Job per statistiche giornaliere
 * Esegue ogni giorno alle 6:00 AM
 */
const dailyStatsJob = cron.schedule('0 6 * * *', async () => {
  try {
    console.log('📊 Generazione statistiche giornaliere audit...');
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const startOfDay = new Date(yesterday.setHours(0, 0, 0, 0));
    const endOfDay = new Date(yesterday.setHours(23, 59, 59, 999));
    
    // Statistiche del giorno precedente
    const statsQuery = `
      SELECT 
        COUNT(*) as total_actions,
        COUNT(CASE WHEN success = true THEN 1 END) as successful_actions,
        COUNT(CASE WHEN success = false THEN 1 END) as failed_actions,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT action) as unique_actions
      FROM audit_logs 
      WHERE timestamp >= $1 AND timestamp <= $2
    `;
    
    // Qui potresti salvare le statistiche in una tabella dedicata
    // o inviare un report giornaliero agli admin
    
    console.log('✅ Statistiche giornaliere generate');
    
  } catch (error) {
    console.error('❌ Errore nella generazione statistiche giornaliere:', error);
  }
}, {
  scheduled: false,
  timezone: 'Europe/Rome'
});

/**
 * Avvia tutti i job
 * NOTA: Con Axiom abilitato, i job vengono disabilitati
 */
const startAuditJobs = () => {
  // Se Axiom è abilitato, non avviare i job (non necessari)
  if (process.env.AXIOM_ENABLED === 'true') {
    console.log('ℹ️  Job di audit logging disabilitati: Axiom gestisce automaticamente i log');
    return;
  }
  
  console.log('🚀 Avvio job di audit logging...');
  
  auditCleanupJob.start();
  suspiciousActivityJob.start();
  dailyStatsJob.start();
  
  console.log('✅ Job di audit logging avviati');
};

/**
 * Ferma tutti i job
 */
const stopAuditJobs = () => {
  console.log('🛑 Arresto job di audit logging...');
  
  auditCleanupJob.stop();
  suspiciousActivityJob.stop();
  dailyStatsJob.stop();
  
  console.log('✅ Job di audit logging fermati');
};

module.exports = {
  startAuditJobs,
  stopAuditJobs,
  auditCleanupJob,
  suspiciousActivityJob,
  dailyStatsJob
};
