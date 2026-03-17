-- Script di migrazione dati da voti_ministri alle tabelle separate per ministero
-- Questo script migra tutti i dati esistenti dalla tabella unica alle 12 tabelle separate

-- Prima controlla quanti record ci sono da migrare
SELECT 'Record da migrare:' as info, COUNT(*) as count FROM voti_ministri;

-- 1. Migrazione Difesa
INSERT INTO voti_ministro_difesa (id, userid, nome_ministro, nome_display, timestamp)
SELECT id, userid, nome_ministro, nome_display, timestamp
FROM voti_ministri 
WHERE categoria = 'difesa';

SELECT 'Difesa migrati:' as info, COUNT(*) as count FROM voti_ministro_difesa;

-- 2. Migrazione Economia
INSERT INTO voti_ministro_economia (id, userid, nome_ministro, nome_display, timestamp)
SELECT id, userid, nome_ministro, nome_display, timestamp
FROM voti_ministri 
WHERE categoria = 'economia';

SELECT 'Economia migrati:' as info, COUNT(*) as count FROM voti_ministro_economia;

-- 3. Migrazione Esteri
INSERT INTO voti_ministro_esteri (id, userid, nome_ministro, nome_display, timestamp)
SELECT id, userid, nome_ministro, nome_display, timestamp
FROM voti_ministri 
WHERE categoria = 'esteri';

SELECT 'Esteri migrati:' as info, COUNT(*) as count FROM voti_ministro_esteri;

-- 4. Migrazione Giustizia
INSERT INTO voti_ministro_giustizia (id, userid, nome_ministro, nome_display, timestamp)
SELECT id, userid, nome_ministro, nome_display, timestamp
FROM voti_ministri 
WHERE categoria = 'giustizia';

SELECT 'Giustizia migrati:' as info, COUNT(*) as count FROM voti_ministro_giustizia;

-- 5. Migrazione Interno
INSERT INTO voti_ministro_interno (id, userid, nome_ministro, nome_display, timestamp)
SELECT id, userid, nome_ministro, nome_display, timestamp
FROM voti_ministri 
WHERE categoria = 'interno';

SELECT 'Interno migrati:' as info, COUNT(*) as count FROM voti_ministro_interno;

-- 6. Migrazione Istruzione
INSERT INTO voti_ministro_istruzione (id, userid, nome_ministro, nome_display, timestamp)
SELECT id, userid, nome_ministro, nome_display, timestamp
FROM voti_ministri 
WHERE categoria = 'istruzione';

SELECT 'Istruzione migrati:' as info, COUNT(*) as count FROM voti_ministro_istruzione;

-- 7. Migrazione Lavoro
INSERT INTO voti_ministro_lavoro (id, userid, nome_ministro, nome_display, timestamp)
SELECT id, userid, nome_ministro, nome_display, timestamp
FROM voti_ministri 
WHERE categoria = 'lavoro';

SELECT 'Lavoro migrati:' as info, COUNT(*) as count FROM voti_ministro_lavoro;

-- 8. Migrazione Salute
INSERT INTO voti_ministro_salute (id, userid, nome_ministro, nome_display, timestamp)
SELECT id, userid, nome_ministro, nome_display, timestamp
FROM voti_ministri 
WHERE categoria = 'salute';

SELECT 'Salute migrati:' as info, COUNT(*) as count FROM voti_ministro_salute;

-- 9. Migrazione Trasporti
INSERT INTO voti_ministro_trasporti (id, userid, nome_ministro, nome_display, timestamp)
SELECT id, userid, nome_ministro, nome_display, timestamp
FROM voti_ministri 
WHERE categoria = 'trasporti';

SELECT 'Trasporti migrati:' as info, COUNT(*) as count FROM voti_ministro_trasporti;

-- 10. Migrazione Ambiente
INSERT INTO voti_ministro_ambiente (id, userid, nome_ministro, nome_display, timestamp)
SELECT id, userid, nome_ministro, nome_display, timestamp
FROM voti_ministri 
WHERE categoria = 'ambiente';

SELECT 'Ambiente migrati:' as info, COUNT(*) as count FROM voti_ministro_ambiente;

-- 11. Migrazione Cultura
INSERT INTO voti_ministro_cultura (id, userid, nome_ministro, nome_display, timestamp)
SELECT id, userid, nome_ministro, nome_display, timestamp
FROM voti_ministri 
WHERE categoria = 'cultura';

SELECT 'Cultura migrati:' as info, COUNT(*) as count FROM voti_ministro_cultura;

-- 12. Migrazione Sport
INSERT INTO voti_ministro_sport (id, userid, nome_ministro, nome_display, timestamp)
SELECT id, userid, nome_ministro, nome_display, timestamp
FROM voti_ministri 
WHERE categoria = 'sport';

SELECT 'Sport migrati:' as info, COUNT(*) as count FROM voti_ministro_sport;

-- Verifica finale: conta tutti i record migrati
SELECT 
  'TOTALE MIGRATI:' as info,
  (SELECT COUNT(*) FROM voti_ministro_difesa) +
  (SELECT COUNT(*) FROM voti_ministro_economia) +
  (SELECT COUNT(*) FROM voti_ministro_esteri) +
  (SELECT COUNT(*) FROM voti_ministro_giustizia) +
  (SELECT COUNT(*) FROM voti_ministro_interno) +
  (SELECT COUNT(*) FROM voti_ministro_istruzione) +
  (SELECT COUNT(*) FROM voti_ministro_lavoro) +
  (SELECT COUNT(*) FROM voti_ministro_salute) +
  (SELECT COUNT(*) FROM voti_ministro_trasporti) +
  (SELECT COUNT(*) FROM voti_ministro_ambiente) +
  (SELECT COUNT(*) FROM voti_ministro_cultura) +
  (SELECT COUNT(*) FROM voti_ministro_sport) as total_migrated;

-- Verifica che tutti i record siano stati migrati
SELECT 
  'VERIFICA:' as info,
  CASE 
    WHEN (SELECT COUNT(*) FROM voti_ministri) = 
         ((SELECT COUNT(*) FROM voti_ministro_difesa) +
          (SELECT COUNT(*) FROM voti_ministro_economia) +
          (SELECT COUNT(*) FROM voti_ministro_esteri) +
          (SELECT COUNT(*) FROM voti_ministro_giustizia) +
          (SELECT COUNT(*) FROM voti_ministro_interno) +
          (SELECT COUNT(*) FROM voti_ministro_istruzione) +
          (SELECT COUNT(*) FROM voti_ministro_lavoro) +
          (SELECT COUNT(*) FROM voti_ministro_salute) +
          (SELECT COUNT(*) FROM voti_ministro_trasporti) +
          (SELECT COUNT(*) FROM voti_ministro_ambiente) +
          (SELECT COUNT(*) FROM voti_ministro_cultura) +
          (SELECT COUNT(*) FROM voti_ministro_sport))
    THEN 'MIGRAZIONE COMPLETATA CON SUCCESSO! ✅'
    ELSE 'ATTENZIONE: NUMERO RECORD NON CORRISPONDE! ⚠️'
  END as status;
