# Tabella delle Differenze: vota-iniziativa-popolare vs vota-referendum-abrogativo

## Confronto tra le due pagine di voto

| Aspetto | vota-iniziativa-popolare | vota-referendum-abrogativo |
|---------|-------------------------|---------------------------|
| **URL** | `/api/iniziative-popolari?vota=true` | `/api/referendum-abrogativi?vota=true` |
| **Tabelle sorgente** | `iniziative_ministero` + `iniziative_popolari` | `iniziative_ministero` + `referendum_abrogativi` |
| **Tabella voti** | `voti_iniziative_popolari` | `voti_referendum_abrogativi` |
| **Colonna ID voto** | `iniziativa_id` (TEXT) | `referendum_id` (TEXT) |

### Filtri per iniziative_ministero (quando votaOnly=true)

| Criterio | vota-iniziativa-popolare | vota-referendum-abrogativo |
|----------|-------------------------|---------------------------|
| **tipo** | `'%Legge%di%iniziativa%popolare%'` | `'%Referendum%abrogativo%'` OR `'%Referendum%costituzionale%'` |
| **stato** | `'conclusa'` | `'conclusa'` |
| **quorum_raggiunto** | `true` | `true` |
| **firme_raccolte** | `>= 50000` | `>= 500000` |

### Filtri per tabelle legacy (quando votaOnly=true)

| Criterio | iniziative_popolari | referendum_abrogativi |
|----------|---------------------|----------------------|
| **quorum_raggiunto** | `true` | `true` |
| **stato** | Non richiesto | Non richiesto |
| **firme_raccolte** | Non richiesto | Non richiesto |

### Query di classifica

| Aspetto | vota-iniziativa-popolare | vota-referendum-abrogativo |
|---------|-------------------------|---------------------------|
| **Tabella voti** | `voti_iniziative_popolari` | `voti_referendum_abrogativi` |
| **Colonna join** | `iniziativa_id` | `referendum_id` |
| **Logica quando votaOnly=true** | Usa query SQL UNION | **Crea classifica da normalizedData** (conta voti per ogni referendum mostrato) |
| **Filtro iniziative_ministero** | `quorum_raggiunto = true AND stato = 'conclusa' AND firme_raccolte >= 50000` | `quorum_raggiunto = true AND stato = 'conclusa' AND firme_raccolte >= 500000` |
| **Filtro tabelle legacy** | `quorum_raggiunto = true` | `quorum_raggiunto = true` |

### Endpoint POST /vota

| Aspetto | vota-iniziativa-popolare | vota-referendum-abrogativo |
|---------|-------------------------|---------------------------|
| **Verifica iniziative_ministero** | `tipo LIKE '%Legge%di%iniziativa%popolare%'`<br>`quorum_raggiunto = true`<br>`stato = 'conclusa'`<br>`firme_raccolte >= 50000` | `tipo LIKE '%Referendum%abrogativo%' OR tipo LIKE '%Referendum%costituzionale%'`<br>`quorum_raggiunto = true`<br>`stato = 'conclusa'`<br>`firme_raccolte >= 500000` |
| **Verifica tabelle legacy** | `quorum_raggiunto = true` | `quorum_raggiunto = true` |
| **Inserimento** | `INSERT INTO voti_iniziative_popolari (userid, iniziativa_id, ...)` | `INSERT INTO voti_referendum_abrogativi (userid, referendum_id, ...)` |

### Funzioni emoji

| Aspetto | vota-iniziativa-popolare | vota-referendum-abrogativo |
|---------|-------------------------|---------------------------|
| **Funzione** | `getEmojiAutomatica(iniziativa)` | `getEmojiAutomaticaReferendum(referendum)` |
| **Emoji default** | `'📋'` | `'🗳️'` |

### Problemi noti

| Problema | vota-iniziativa-popolare | vota-referendum-abrogativo |
|----------|-------------------------|---------------------------|
| **Classifica vuota** | ✅ Risolto (usa query SQL UNION) | ⚠️ **Problema attuale**: classifica creata da normalizedData ma potrebbe essere sovrascritta |
| **Voti non salvati** | ✅ Risolto | ✅ Risolto |
| **Voti non contati** | ✅ Funziona | ⚠️ **Problema attuale**: classifica mostra "0 voti" anche se ci sono voti nel database |

### Note importanti

1. **vota-referendum-abrogativo** ha una logica speciale per la classifica: quando `votaOnly=true`, crea la classifica direttamente da `normalizedData` invece di usare la query SQL UNION. Questo potrebbe essere la causa del problema della classifica vuota.

2. **Firme minime diverse**: 
   - Iniziative popolari: 50.000 firme
   - Referendum abrogativi: 500.000 firme

3. **Tipi referendum**: La pagina referendum supporta sia "Referendum abrogativo" che "Referendum costituzionale", mentre le iniziative supportano solo "Legge di iniziativa popolare".

4. **Query classifica**: La query per referendum usa una logica alternativa (crea classifica da normalizedData) che potrebbe non funzionare correttamente se la classifica viene sovrascritta dopo.



