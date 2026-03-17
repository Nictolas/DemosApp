-- ============================================================
-- Script di rollback per l'allineamento tabelle
-- ============================================================
-- Questo script rimuove le colonne aggiunte (da usare solo se necessario)
-- ============================================================

-- Rimuovi trigger
DROP TRIGGER IF EXISTS trigger_sync_iniziative_popolari_nome_titolo ON iniziative_popolari;
DROP TRIGGER IF EXISTS trigger_sync_referendum_abrogativi_nome_titolo ON referendum_abrogativi;

-- Rimuovi funzioni
DROP FUNCTION IF EXISTS sync_iniziative_popolari_nome_titolo();
DROP FUNCTION IF EXISTS sync_referendum_abrogativi_nome_titolo();

-- Rimuovi indici aggiunti (opzionale, possono essere utili)
-- DROP INDEX IF EXISTS idx_iniziative_popolari_titolo;
-- DROP INDEX IF EXISTS idx_iniziative_popolari_stato;
-- DROP INDEX IF EXISTS idx_iniziative_popolari_quorum_raggiunto;
-- DROP INDEX IF EXISTS idx_iniziative_popolari_esito;
-- DROP INDEX IF EXISTS idx_iniziative_popolari_tipo;
-- DROP INDEX IF EXISTS idx_referendum_abrogativi_titolo;
-- DROP INDEX IF EXISTS idx_referendum_abrogativi_stato;
-- DROP INDEX IF EXISTS idx_referendum_abrogativi_quorum_raggiunto;
-- DROP INDEX IF EXISTS idx_referendum_abrogativi_esito;
-- DROP INDEX IF EXISTS idx_referendum_abrogativi_tipo;

-- Rimuovi colonne aggiunte (ATTENZIONE: questo elimina i dati!)
-- ALTER TABLE iniziative_popolari DROP COLUMN IF EXISTS titolo;
-- ALTER TABLE iniziative_popolari DROP COLUMN IF EXISTS stato;
-- ALTER TABLE iniziative_popolari DROP COLUMN IF EXISTS quorum_raggiunto;
-- ALTER TABLE iniziative_popolari DROP COLUMN IF EXISTS firme_raccolte;
-- ALTER TABLE iniziative_popolari DROP COLUMN IF EXISTS esito;
-- ALTER TABLE iniziative_popolari DROP COLUMN IF EXISTS tipo;
-- ALTER TABLE iniziative_popolari DROP COLUMN IF EXISTS data_ultimo_aggiornamento;

-- ALTER TABLE referendum_abrogativi DROP COLUMN IF EXISTS titolo;
-- ALTER TABLE referendum_abrogativi DROP COLUMN IF EXISTS stato;
-- ALTER TABLE referendum_abrogativi DROP COLUMN IF EXISTS quorum_raggiunto;
-- ALTER TABLE referendum_abrogativi DROP COLUMN IF EXISTS firme_raccolte;
-- ALTER TABLE referendum_abrogativi DROP COLUMN IF EXISTS esito;
-- ALTER TABLE referendum_abrogativi DROP COLUMN IF EXISTS tipo;
-- ALTER TABLE referendum_abrogativi DROP COLUMN IF EXISTS data_ultimo_aggiornamento;

