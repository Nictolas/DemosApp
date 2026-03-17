-- Rimuove i due esempi fittizi dalla tabella ECI (inseriti in passato dal seed).
-- Esegui su Neon dopo aver aggiornato gli endpoint API EU, così in fallback la pagina mostrerà
-- "Nessuna ECI disponibile" invece dei placeholder.

DELETE FROM eci
WHERE id IN ('eci-esempio-1', 'eci-esempio-2');

-- Verifica: la tabella può essere vuota o contenere solo dati reali da API/Decidim.
-- SELECT * FROM eci;
