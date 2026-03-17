-- ============================================
-- Script SQL per correggere token FCM duplicati
-- ============================================

-- 1. CONTEGGIO: Quanti utenti hanno 2 o più token FCM
SELECT 
  COUNT(*) as utenti_con_token_duplicati,
  COUNT(CASE WHEN array_length(fcm_tokens, 1) = 2 THEN 1 END) as utenti_con_2_token,
  COUNT(CASE WHEN array_length(fcm_tokens, 1) > 2 THEN 1 END) as utenti_con_piu_di_2_token
FROM users
WHERE fcm_tokens IS NOT NULL 
  AND array_length(fcm_tokens, 1) > 1;

-- 2. DETTAGLIO: Elenco utenti con 2 o più token
SELECT 
  id,
  email,
  nome,
  cognome,
  array_length(fcm_tokens, 1) as numero_token,
  fcm_tokens
FROM users
WHERE fcm_tokens IS NOT NULL 
  AND array_length(fcm_tokens, 1) > 1
ORDER BY array_length(fcm_tokens, 1) DESC;

-- 3. CORREZIONE: Mantieni solo l'ultimo token (più recente) per ogni utente
-- Versione semplificata: mantieni solo l'ultimo elemento dell'array (più recente)
-- Se l'ultimo token non è valido, rimuovilo (diventa array vuoto)
UPDATE users
SET 
  fcm_tokens = CASE
    -- Se l'ultimo token è valido, mantieni solo quello
    WHEN array_length(fcm_tokens, 1) > 0 
      AND fcm_tokens[array_length(fcm_tokens, 1)] IS NOT NULL
      AND length(fcm_tokens[array_length(fcm_tokens, 1)]) > 100
      AND NOT fcm_tokens[array_length(fcm_tokens, 1)] LIKE 'web_%'
    THEN ARRAY[fcm_tokens[array_length(fcm_tokens, 1)]]
    -- Se l'ultimo token non è valido, rimuovi tutti i token
    ELSE ARRAY[]::TEXT[]
  END,
  updated_at = NOW()
WHERE fcm_tokens IS NOT NULL 
  AND array_length(fcm_tokens, 1) > 1;

-- 4. VERIFICA POST-CORREZIONE: Controlla che tutti gli utenti abbiano max 1 token
SELECT 
  COUNT(*) as totale_utenti,
  COUNT(CASE WHEN fcm_tokens IS NULL OR array_length(fcm_tokens, 1) = 0 THEN 1 END) as utenti_senza_token,
  COUNT(CASE WHEN array_length(fcm_tokens, 1) = 1 THEN 1 END) as utenti_con_1_token,
  COUNT(CASE WHEN array_length(fcm_tokens, 1) > 1 THEN 1 END) as utenti_con_piu_token -- Dovrebbe essere 0
FROM users
WHERE fcm_tokens IS NOT NULL;

-- 5. (OPZIONALE) PULIZIA AGGIUNTIVA: Rimuovi tutti i token non validi anche per utenti con 1 solo token
UPDATE users
SET 
  fcm_tokens = ARRAY[]::TEXT[],
  updated_at = NOW()
WHERE fcm_tokens IS NOT NULL
  AND array_length(fcm_tokens, 1) = 1
  AND (
    fcm_tokens[1] IS NULL 
    OR length(fcm_tokens[1]) <= 100 
    OR fcm_tokens[1] LIKE 'web_%'
  );

