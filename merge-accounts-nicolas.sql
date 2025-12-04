-- ============================================
-- SCRIPT PER FONDERE I DUE ACCOUNT DI NICOLAS
-- ============================================
-- 
-- Account esistente (admin): 5e51ec52-c656-4f4b-a940-425acb873b0b
--   Email: nicolasmicheletti90@gmail.com
--   Ruolo: admin
--
-- Account CIE (nuovo): f635801f-ad5a-414d-a619-64cf1df87309
--   Email: MCHNLS90L11G702W@cie.local
--   Fiscal number: MCHNLS90L11G702W
--
-- RISULTATO FINALE:
-- L'account 5e51ec52-c656-4f4b-a940-425acb873b0b avrà:
--   - Email: nicolasmicheletti90@gmail.com (preservata)
--   - Ruolo: admin (preservato)
--   - Fiscal number: MCHNLS90L11G702W (aggiunto)
--   - Tutti i dati dell'account CIE (trasferiti)
--
-- ============================================

BEGIN;

-- STEP 1: Verifica che l'account esistente non abbia già un fiscal_number
DO $$
DECLARE
    existing_fiscal_number VARCHAR;
BEGIN
    SELECT fiscal_number INTO existing_fiscal_number
    FROM users 
    WHERE id = '5e51ec52-c656-4f4b-a940-425acb873b0b';
    
    IF existing_fiscal_number IS NOT NULL AND existing_fiscal_number != '' THEN
        RAISE EXCEPTION 'L''account esistente ha già un fiscal_number: %', existing_fiscal_number;
    END IF;
END $$;

-- STEP 2: Aggiorna l'account esistente con il fiscal_number dell'account CIE
UPDATE users 
SET 
    fiscal_number = 'MCHNLS90L11G702W',
    updated_at = CURRENT_TIMESTAMP
WHERE id = '5e51ec52-c656-4f4b-a940-425acb873b0b';

-- STEP 3: Aggiorna tutte le comunicazioni associate all'account CIE
UPDATE comunicazioni 
SET id_utente = '5e51ec52-c656-4f4b-a940-425acb873b0b'
WHERE id_utente = 'f635801f-ad5a-414d-a619-64cf1df87309';

-- STEP 4: Aggiorna i voti capo stato (gestisce sia userId che userid)
UPDATE voti_capo_stato 
SET "userId" = '5e51ec52-c656-4f4b-a940-425acb873b0b'
WHERE "userId" = 'f635801f-ad5a-414d-a619-64cf1df87309';

UPDATE voti_capo_stato 
SET userid = '5e51ec52-c656-4f4b-a940-425acb873b0b'
WHERE userid = 'f635801f-ad5a-414d-a619-64cf1df87309';

-- STEP 5: Aggiorna i voti grazia (gestisce sia user_id che userid)
UPDATE voti_grazia 
SET user_id = '5e51ec52-c656-4f4b-a940-425acb873b0b'
WHERE user_id = 'f635801f-ad5a-414d-a619-64cf1df87309';

UPDATE voti_grazia 
SET userid = '5e51ec52-c656-4f4b-a940-425acb873b0b'
WHERE userid = 'f635801f-ad5a-414d-a619-64cf1df87309';

-- STEP 6: Aggiorna i voti referendum (gestisce sia userId che userid)
UPDATE voti_referendum_abrogativi 
SET "userId" = '5e51ec52-c656-4f4b-a940-425acb873b0b'
WHERE "userId" = 'f635801f-ad5a-414d-a619-64cf1df87309';

UPDATE voti_referendum_abrogativi 
SET userid = '5e51ec52-c656-4f4b-a940-425acb873b0b'
WHERE userid = 'f635801f-ad5a-414d-a619-64cf1df87309';

-- STEP 7: Aggiorna iniziative popolari (userid)
UPDATE iniziative_popolari 
SET userid = '5e51ec52-c656-4f4b-a940-425acb873b0b'
WHERE userid = 'f635801f-ad5a-414d-a619-64cf1df87309';

-- STEP 8: Aggiorna voti iniziative popolari (gestisce sia userId che userid)
UPDATE voti_iniziative_popolari 
SET "userId" = '5e51ec52-c656-4f4b-a940-425acb873b0b'
WHERE "userId" = 'f635801f-ad5a-414d-a619-64cf1df87309';

UPDATE voti_iniziative_popolari 
SET user_id = '5e51ec52-c656-4f4b-a940-425acb873b0b'
WHERE user_id = 'f635801f-ad5a-414d-a619-64cf1df87309';

-- STEP 9: Aggiorna voti ICE (user_id)
UPDATE voti_ice 
SET user_id = '5e51ec52-c656-4f4b-a940-425acb873b0b'
WHERE user_id = 'f635801f-ad5a-414d-a619-64cf1df87309';

-- STEP 10: Aggiorna voti amnistia (gestisce sia userId che user_id)
UPDATE voti_amnistia 
SET "userId" = '5e51ec52-c656-4f4b-a940-425acb873b0b'
WHERE "userId" = 'f635801f-ad5a-414d-a619-64cf1df87309';

UPDATE voti_amnistia 
SET user_id = '5e51ec52-c656-4f4b-a940-425acb873b0b'
WHERE user_id = 'f635801f-ad5a-414d-a619-64cf1df87309';

-- STEP 11: Aggiorna voti ministri (gestisce sia userId che user_id)
UPDATE voti_ministri 
SET "userId" = '5e51ec52-c656-4f4b-a940-425acb873b0b'
WHERE "userId" = 'f635801f-ad5a-414d-a619-64cf1df87309';

UPDATE voti_ministri 
SET user_id = '5e51ec52-c656-4f4b-a940-425acb873b0b'
WHERE user_id = 'f635801f-ad5a-414d-a619-64cf1df87309';

-- STEP 12: Aggiorna opinioni_risposte (user_id)
UPDATE opinioni_risposte 
SET user_id = '5e51ec52-c656-4f4b-a940-425acb873b0b'
WHERE user_id = 'f635801f-ad5a-414d-a619-64cf1df87309';

-- STEP 13: Aggiorna riferimenti come attivista o organizzazione nella tabella users
UPDATE users 
SET attivisti = '5e51ec52-c656-4f4b-a940-425acb873b0b'
WHERE attivisti = 'f635801f-ad5a-414d-a619-64cf1df87309';

UPDATE users 
SET organizzazioni = '5e51ec52-c656-4f4b-a940-425acb873b0b'
WHERE organizzazioni = 'f635801f-ad5a-414d-a619-64cf1df87309';

-- STEP 14: Aggiorna altre tabelle che potrebbero referenziare l'utente
-- (aggiungi altre tabelle se necessario)

-- STEP 15: Elimina l'account CIE (ora tutti i dati sono stati trasferiti)
DELETE FROM users 
WHERE id = 'f635801f-ad5a-414d-a619-64cf1df87309';

-- STEP 16: Verifica finale
DO $$
DECLARE
    fiscal_check VARCHAR;
    cie_account_exists BOOLEAN;
BEGIN
    -- Verifica che il fiscal_number sia stato aggiunto
    SELECT fiscal_number INTO fiscal_check
    FROM users 
    WHERE id = '5e51ec52-c656-4f4b-a940-425acb873b0b';
    
    IF fiscal_check IS NULL OR fiscal_check != 'MCHNLS90L11G702W' THEN
        RAISE EXCEPTION 'Errore: fiscal_number non aggiornato correttamente';
    END IF;
    
    -- Verifica che l'account CIE sia stato eliminato
    SELECT EXISTS(SELECT 1 FROM users WHERE id = 'f635801f-ad5a-414d-a619-64cf1df87309') INTO cie_account_exists;
    
    IF cie_account_exists THEN
        RAISE EXCEPTION 'Errore: account CIE non eliminato';
    END IF;
    
    RAISE NOTICE '✅ Merge completato con successo!';
END $$;

COMMIT;

-- ============================================
-- DOPO IL MERGE:
-- ============================================
-- 1. L'account 5e51ec52-c656-4f4b-a940-425acb873b0b avrà:
--    - Email: nicolasmicheletti90@gmail.com (preservata)
--    - Ruolo: admin (preservato)
--    - Fiscal number: MCHNLS90L11G702W (aggiunto)
--    - Tutti i dati storici (preservati)
--    - Tutti i dati dell'account CIE (trasferiti)
--
-- 2. L'account CIE sarà stato eliminato
--
-- 3. Ora quando fai login con CIE, il sistema troverà l'account esistente
--    tramite il fiscal_number e ti loggherà con quell'account (admin)
-- ============================================

