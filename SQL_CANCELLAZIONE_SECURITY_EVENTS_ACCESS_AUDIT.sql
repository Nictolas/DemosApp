-- =====================================================
-- SQL per cancellare security_events e access_audit da Neon
-- =====================================================
-- 
-- NOTA: Queste tabelle sono state migrate su Axiom nel dataset 'real-time'
-- La scrittura su Neon è stata disabilitata nel codice
-- 
-- PRIMA DI ESEGUIRE:
-- 1. Verifica che i dati siano stati migrati completamente su Axiom
-- 2. Verifica che la scrittura su Neon sia disabilitata (AXIOM_ENABLED=true)
-- 3. Esegui un backup delle tabelle se necessario
-- 
-- =====================================================

-- 1. Verifica esistenza e dimensione delle tabelle
SELECT 
  'security_events' as tabella,
  COUNT(*) as record_count,
  pg_size_pretty(pg_total_relation_size('security_events')) as dimensione
FROM security_events
UNION ALL
SELECT 
  'access_audit' as tabella,
  COUNT(*) as record_count,
  pg_size_pretty(pg_total_relation_size('access_audit')) as dimensione
FROM access_audit;

-- 2. Cancella tutti i dati dalle tabelle (OPZIONALE - se vuoi mantenere la struttura)
-- TRUNCATE TABLE security_events CASCADE;
-- TRUNCATE TABLE access_audit CASCADE;

-- 3. Cancella gli indici associati
DROP INDEX IF EXISTS idx_security_events_type;
DROP INDEX IF EXISTS idx_security_events_ip;
DROP INDEX IF EXISTS idx_security_events_created_at;
DROP INDEX IF EXISTS idx_security_events_severity;

DROP INDEX IF EXISTS idx_access_audit_user_id;
DROP INDEX IF EXISTS idx_access_audit_ip;
DROP INDEX IF EXISTS idx_access_audit_created_at;

-- 4. Cancella le tabelle (DEFINITIVO)
DROP TABLE IF EXISTS security_events CASCADE;
DROP TABLE IF EXISTS access_audit CASCADE;

-- 5. Verifica che le tabelle siano state cancellate
SELECT 
  table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('security_events', 'access_audit');

-- Se la query sopra non restituisce righe, le tabelle sono state cancellate con successo

-- =====================================================
-- NOTE IMPORTANTI:
-- =====================================================
-- 
-- 1. Security Events sono OBBLIGATORI per GDPR (Articolo 32)
--    - Ora vengono salvati su Axiom nel dataset 'real-time'
--    - La scrittura su Neon è stata disabilitata in api/middleware/securityMonitoring.js
-- 
-- 2. Access Audit non viene più utilizzato
--    - I dati di audit sono ora gestiti tramite AuditService che scrive su Axiom
--    - La tabella access_audit non viene più popolata
-- 
-- 3. Dopo la cancellazione:
--    - I nuovi security events verranno salvati solo su Axiom
--    - I dati storici rimangono su Axiom (se migrati)
--    - Non è possibile recuperare i dati da Neon dopo la cancellazione
-- 
-- =====================================================

