-- Script per pulire i token FCM non validi
-- Rimuove i token che iniziano con lo stesso prefisso (probabilmente duplicati o vecchi)

-- Prima, verifica i token attuali
SELECT 
  id,
  email,
  fcm_tokens,
  array_length(fcm_tokens, 1) as token_count
FROM users 
WHERE fcm_tokens IS NOT NULL 
  AND array_length(fcm_tokens, 1) > 0;

-- Rimuovi tutti i token FCM esistenti (l'utente dovrà rigenerarli)
-- ATTENZIONE: Questo cancellerà tutti i token FCM!
-- UPDATE users SET fcm_tokens = ARRAY[]::TEXT[] WHERE fcm_tokens IS NOT NULL;

-- Oppure, rimuovi solo i token duplicati o vecchi per un utente specifico
-- Sostituisci 'USER_ID' con l'ID dell'utente
-- UPDATE users 
-- SET fcm_tokens = ARRAY[]::TEXT[]
-- WHERE id = 'USER_ID';

