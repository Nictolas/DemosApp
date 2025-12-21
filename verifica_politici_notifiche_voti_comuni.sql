-- Script per verificare e correggere la colonna "politico" in notifiche_voti_comuni
-- Assicura che tutti i valori in "politico" corrispondano a utenti registrati con ruolo "P"

-- ============================================
-- PARTE 1: Verifica dati esistenti
-- ============================================

-- Mostra tutte le notifiche con politico che non corrisponde a un utente con ruolo "P"
SELECT 
    nv.id,
    nv.titolo,
    nv.politico,
    nv.id_utente,
    CASE 
        WHEN u.id IS NULL THEN '❌ Utente non trovato'
        WHEN u.ruolo != 'P' THEN '❌ Utente non ha ruolo P (ruolo: ' || COALESCE(u.ruolo, 'NULL') || ')'
        ELSE '✅ OK'
    END as stato
FROM notifiche_voti_comuni nv
LEFT JOIN users u ON (
    u.nome || ' ' || u.cognome = nv.politico
    OR u.id::text = nv.politico
    OR u.id = nv.id_utente
)
WHERE nv.politico IS NOT NULL
ORDER BY 
    CASE 
        WHEN u.id IS NULL THEN 1
        WHEN u.ruolo != 'P' THEN 2
        ELSE 3
    END,
    nv.titolo;

-- ============================================
-- PARTE 2: Correzione automatica
-- ============================================

-- Aggiorna i valori di "politico" per corrispondere a utenti con ruolo "P"
-- Usa il nome e cognome dell'utente se id_utente corrisponde a un utente con ruolo "P"
UPDATE notifiche_voti_comuni nv
SET politico = u.nome || ' ' || u.cognome
FROM users u
WHERE nv.id_utente = u.id
  AND u.ruolo = 'P'
  AND (nv.politico IS NULL OR nv.politico != (u.nome || ' ' || u.cognome));

-- ============================================
-- PARTE 3: Rimuovi o correggi notifiche con politico non valido
-- ============================================

-- Opzione 1: Imposta politico a NULL per notifiche con utente non valido
UPDATE notifiche_voti_comuni nv
SET politico = NULL
WHERE nv.politico IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 
      FROM users u 
      WHERE (u.nome || ' ' || u.cognome = nv.politico OR u.id = nv.id_utente)
        AND u.ruolo = 'P'
  );

-- Opzione 2: Se id_utente esiste ma non ha ruolo P, cerca un utente con ruolo P basato sul nome
UPDATE notifiche_voti_comuni nv
SET politico = u2.nome || ' ' || u2.cognome
FROM users u1
LEFT JOIN users u2 ON (
    u2.nome || ' ' || u2.cognome = nv.politico
    AND u2.ruolo = 'P'
)
WHERE nv.id_utente = u1.id
  AND u1.ruolo != 'P'
  AND u2.id IS NOT NULL;

-- ============================================
-- PARTE 4: Verifica finale
-- ============================================

-- Mostra il risultato finale
SELECT 
    COUNT(*) as totale_notifiche,
    COUNT(CASE WHEN nv.politico IS NOT NULL THEN 1 END) as con_politico,
    COUNT(CASE 
        WHEN nv.politico IS NOT NULL 
        AND EXISTS (
            SELECT 1 
            FROM users u 
            WHERE (u.nome || ' ' || u.cognome = nv.politico OR u.id = nv.id_utente)
              AND u.ruolo = 'P'
        ) 
        THEN 1 
    END) as politico_valido,
    COUNT(CASE 
        WHEN nv.politico IS NOT NULL 
        AND NOT EXISTS (
            SELECT 1 
            FROM users u 
            WHERE (u.nome || ' ' || u.cognome = nv.politico OR u.id = nv.id_utente)
              AND u.ruolo = 'P'
        ) 
        THEN 1 
    END) as politico_non_valido
FROM notifiche_voti_comuni nv;

