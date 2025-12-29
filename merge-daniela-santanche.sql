-- Script SQL per fondere i due record di Daniela Santanché
-- Mantiene i dati più vecchi e aggiunge i nuovi solo dove i vecchi sono NULL

-- STEP 1: Verifica i duplicati esistenti
SELECT 
    id,
    nome,
    cognome,
    email,
    data_nascita,
    genere,
    cittadinanza,
    comune_residenza,
    comune_elezione,
    grado_elezione,
    created_at,
    'DUPLICATI TROVATI' as stato
FROM users
WHERE LOWER(TRIM(nome)) LIKE '%daniela%'
  AND LOWER(TRIM(cognome)) LIKE '%santanch%'
ORDER BY created_at ASC;

-- STEP 2: Fonde i record usando un blocco DO
DO $$
DECLARE
    id_vecchio UUID;
    id_nuovo UUID;
BEGIN
    -- Identifica i due record
    SELECT id INTO id_vecchio
    FROM users
    WHERE LOWER(TRIM(nome)) LIKE '%daniela%'
      AND LOWER(TRIM(cognome)) LIKE '%santanch%'
    ORDER BY created_at ASC
    LIMIT 1;
    
    SELECT id INTO id_nuovo
    FROM users
    WHERE LOWER(TRIM(nome)) LIKE '%daniela%'
      AND LOWER(TRIM(cognome)) LIKE '%santanch%'
      AND id != id_vecchio
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Se ci sono effettivamente due record, procedi con la fusione
    IF id_vecchio IS NOT NULL AND id_nuovo IS NOT NULL THEN
        -- Aggiorna il record più vecchio con i dati del più nuovo (solo dove NULL)
        UPDATE users u_old
        SET 
            -- Campi base
            email = COALESCE(u_old.email, u_new.email),
            nome = COALESCE(u_old.nome, u_new.nome),
            cognome = COALESCE(u_old.cognome, u_new.cognome),
            
            -- Dati personali
            data_nascita = COALESCE(u_old.data_nascita, u_new.data_nascita),
            genere = COALESCE(u_old.genere, u_new.genere),
            cittadinanza = COALESCE(u_old.cittadinanza, u_new.cittadinanza),
            
            -- Residenza
            paese_residenza = COALESCE(u_old.paese_residenza, u_new.paese_residenza),
            regione_residenza = COALESCE(u_old.regione_residenza, u_new.regione_residenza),
            provincia_residenza = COALESCE(u_old.provincia_residenza, u_new.provincia_residenza),
            comune_residenza = COALESCE(u_old.comune_residenza, u_new.comune_residenza),
            
            -- Elezione
            paese_elezione = COALESCE(u_old.paese_elezione, u_new.paese_elezione),
            regione_elezione = COALESCE(u_old.regione_elezione, u_new.regione_elezione),
            provincia_elezione = COALESCE(u_old.provincia_elezione, u_new.provincia_elezione),
            -- comune_elezione: priorità a 'Cremona' se presente in uno dei due record
            comune_elezione = CASE 
                WHEN u_new.comune_elezione = 'Cremona' THEN 'Cremona'
                WHEN u_old.comune_elezione = 'Cremona' THEN 'Cremona'
                ELSE COALESCE(u_old.comune_elezione, u_new.comune_elezione)
            END,
            grado_elezione = COALESCE(u_old.grado_elezione, u_new.grado_elezione),
            
            -- Candidatura
            paese_candidatura = COALESCE(u_old.paese_candidatura, u_new.paese_candidatura),
            regione_candidatura = COALESCE(u_old.regione_candidatura, u_new.regione_candidatura),
            provincia_candidatura = COALESCE(u_old.provincia_candidatura, u_new.provincia_candidatura),
            comune_candidatura = COALESCE(u_old.comune_candidatura, u_new.comune_candidatura),
            grado_candidatura = COALESCE(u_old.grado_candidatura, u_new.grado_candidatura),
            
            -- Altri campi
            ruolo = COALESCE(u_old.ruolo, u_new.ruolo),
            status = COALESCE(u_old.status, u_new.status),
            premium = COALESCE(u_old.premium, u_new.premium),
            
            -- Timestamp
            updated_at = CURRENT_TIMESTAMP
        FROM users u_new
        WHERE u_old.id = id_vecchio
          AND u_new.id = id_nuovo;
        
        -- Aggiorna i riferimenti nelle altre tabelle
        -- Comunicazioni
        UPDATE comunicazioni
        SET id_utente = id_vecchio
        WHERE id_utente = id_nuovo;
        
        -- Opinioni risposte (se esiste)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'opinioni_risposte') THEN
            UPDATE opinioni_risposte
            SET user_id = id_vecchio
            WHERE user_id = id_nuovo;
        END IF;
        
        -- Voti capo stato
        UPDATE voti_capo_stato
        SET userId = id_vecchio
        WHERE userId = id_nuovo;
        
        -- Voti referendum abrogativi
        UPDATE voti_referendum_abrogativi
        SET userId = id_vecchio
        WHERE userId = id_nuovo;
        
        -- Voti iniziative popolari
        UPDATE voti_iniziative_popolari
        SET userId = id_vecchio
        WHERE userId = id_nuovo;
        
        -- Voti ICE
        UPDATE voti_ice
        SET userId = id_vecchio
        WHERE userId = id_nuovo;
        
        -- Governo attuale (se esiste)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'governo_attuale') THEN
            UPDATE governo_attuale
            SET user_id = id_vecchio
            WHERE user_id = id_nuovo;
        END IF;
        
        -- Forza comune_elezione = 'Cremona' se uno dei due record aveva questo valore
        -- (verifica prima di eliminare il record nuovo)
        IF EXISTS (
            SELECT 1 FROM users 
            WHERE (id = id_vecchio AND comune_elezione = 'Cremona')
               OR (id = id_nuovo AND comune_elezione = 'Cremona')
        ) THEN
            UPDATE users
            SET comune_elezione = 'Cremona'
            WHERE id = id_vecchio;
        END IF;
        
        -- Elimina il record duplicato più nuovo
        DELETE FROM users
        WHERE id = id_nuovo;
        
        RAISE NOTICE 'Record fusi con successo. ID vecchio: %, ID nuovo eliminato: %', id_vecchio, id_nuovo;
    ELSE
        RAISE NOTICE 'Non sono stati trovati duplicati da fondere';
    END IF;
END $$;

-- STEP 3: Verifica il risultato finale (dovrebbe esserci solo un record)
SELECT 
    id,
    nome,
    cognome,
    email,
    data_nascita,
    genere,
    cittadinanza,
    comune_residenza,
    comune_elezione,
    grado_elezione,
    created_at,
    'RISULTATO FINALE' as stato
FROM users
WHERE LOWER(TRIM(nome)) LIKE '%daniela%'
  AND LOWER(TRIM(cognome)) LIKE '%santanch%'
ORDER BY created_at ASC;

-- Verifica che ci sia esattamente un record
SELECT 
    COUNT(*) as totale_record,
    CASE 
        WHEN COUNT(*) = 1 THEN 'OK: Un solo record presente'
        WHEN COUNT(*) > 1 THEN 'ATTENZIONE: Ci sono ancora duplicati!'
        ELSE 'ERRORE: Nessun record trovato'
    END as stato
FROM users
WHERE LOWER(TRIM(nome)) LIKE '%daniela%'
  AND LOWER(TRIM(cognome)) LIKE '%santanch%';
