# Crediti dei dati geografici offline — Eventi

Quattro file `municipalityCentroids-1.json` … `municipalityCentroids-4.json` contengono un estratto del dataset `RP92/comuni-italiani` (revisione disponibile il 12 novembre 2026):
https://github.com/RP92/comuni-italiani

**Licenza dei dati:** Creative Commons Attribution 4.0 International (CC BY 4.0):
https://creativecommons.org/licenses/by/4.0/

**Fonti attribuite:** ISTAT — Istituto Nazionale di Statistica (https://www.istat.it/) per denominazioni e gerarchia territoriale; Garda Informatica (https://www.gardainformatica.it/database-comuni-italiani) per coordinate geografiche, tratte dal proprio database con licenza MIT.

**Modifiche:** rispetto al dataset originale sono stati selezionati solo nome, provincia, regione, latitudine e longitudine; le coordinate sono arrotondate a 5 cifre decimali e sono stati esclusi i Comuni privi di coordinate. Totale: 7.893 record.

**Limite:** le coordinate indicano una posizione del Comune / municipio; il Comune più vicino per distanza non coincide necessariamente con quello in cui si trova la persona, soprattutto presso confini comunali e nelle città estese. L'app lo segnala e offre sempre la selezione manuale.

La posizione dell'utente non è inclusa nei file e non è inviata a servizi di geocodifica.
