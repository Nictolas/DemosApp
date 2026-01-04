-- Aggiunta di "Eccesso colposo di legittima difesa" per la tabella voti_amnistia

-- Prima, verifica e inserisci la legge nella tabella amnistia se non esiste già
INSERT INTO amnistia (legge, articolo, descrizione)
VALUES (
  'Eccesso colposo di legittima difesa',
  'Art. 55 c.p.',
  'Amnistia per eccesso colposo di legittima difesa'
)
ON CONFLICT DO NOTHING;

-- Nota: Per inserire un voto in voti_amnistia, è necessario un userid valido.
-- Se vuoi inserire un voto di esempio, usa questo comando (sostituisci USERID_UUID con un UUID valido):
/*
INSERT INTO voti_amnistia (id, userid, legge, amnistia_id)
SELECT 
  gen_random_uuid() as id,
  'USERID_UUID'::uuid as userid,
  'Eccesso colposo di legittima difesa' as legge,
  (SELECT id FROM amnistia WHERE legge = 'Eccesso colposo di legittima difesa') as amnistia_id
WHERE NOT EXISTS (
  SELECT 1 FROM voti_amnistia 
  WHERE legge = 'Eccesso colposo di legittima difesa' 
  AND userid = 'USERID_UUID'::uuid
);
*/

-- Alternativa: Se vuoi solo aggiungere la legge senza un voto specifico,
-- il comando sopra per amnistia è sufficiente.

