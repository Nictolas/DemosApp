/**
 * Configurazione per il sistema di audit logging
 */

const auditConfig = {
  // Abilita/disabilita job automatici
  enableScheduledJobs: process.env.NODE_ENV === 'production' && process.env.ENABLE_AUDIT_JOBS === 'true',
  
  // Configurazione pulizia log
  logRetentionDays: 365, // Mantieni log per 1 anno
  
  // Configurazione job
  cleanupSchedule: '0 2 * * *', // Ogni giorno alle 2:00 AM
  suspiciousActivitySchedule: '0 * * * *', // Ogni ora
  dailyStatsSchedule: '0 6 * * *', // Ogni giorno alle 6:00 AM
  
  // Soglie per rilevamento attività sospette
  suspiciousThresholds: {
    maxFailedActions: 10, // Massimo 10 azioni fallite in 7 giorni
    maxRapidActions: 50, // Massimo 50 azioni in 1 ora
    maxUsersPerIP: 5, // Massimo 5 utenti diversi per IP
    maxUnauthorizedAccess: 3 // Massimo 3 accessi non autorizzati
  },
  
  // Configurazione database
  database: {
    maxConnections: 10,
    connectionTimeout: 30000,
    queryTimeout: 60000
  }
};

module.exports = auditConfig;
