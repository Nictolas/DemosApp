# DEMOS — conservazione dei log e GDPR

> **Revisionato il 21 ottobre 2026.** Questo documento sostituisce le precedenti indicazioni non corrette che attribuivano al GDPR periodi minimi generalizzati di 6 mesi, 3 anni o 7 anni per ogni tipo di log. La retention effettiva in produzione **non è certificata** da questo file.

**Piano operativo dettagliato:** [docs/operations/LOGGING_COST_GDPR_ACTIONS_2026-10-21.md](docs/operations/LOGGING_COST_GDPR_ACTIONS_2026-10-21.md). **Progetto archivio Axiom → Backblaze:** [docs/operations/axiom-b2-log-archive.md](docs/operations/axiom-b2-log-archive.md).

## Regole da applicare
- Il GDPR impone finalità definite, minimizzazione, misure proporzionate e **limitazione della conservazione** (artt. 5, 24, 25 e 32). Non impone di registrare ogni richiesta HTTP e non prescrive un identico numero di anni per tutti i log.
- Per gli **accessi logici degli amministratori di sistema**, il provvedimento del Garante del 27 novembre 2008, con modifiche e ambito di applicazione specifici, prevede registrazioni integre e verificabili da conservare **non meno di sei mesi**. Questo non equivale a sei mesi per ogni richiesta degli utenti.
- L'art. 2220 del Codice civile disciplina **scritture contabili** e indica **dieci anni**: non costituisce fondamento automatico per conservare i log di audit sette anni né per trattenere profili e opinioni politiche.
- Dati di voto e opinioni politiche possono rientrare nell'art. 9 GDPR: evitare payload, token, identificatori inutili e preferenze individuali nei log. Per gli eventi di sicurezza/audit giustificati, definire separatamente finalità, accesso, minimizzazione e retention.
- Distinguere logging tecnico, errori, sicurezza, accessi privilegiati e audit: serve una matrice **approvata** dopo la valutazione dei rischi/DPIA e confronto con il responsabile privacy.

## Periodi da discutere (non policy vigente approvata)
| Tipo | Intervallo iniziale ipotetico | Note |
|---|---|---|
| Debug/trace e log tecnici | 7–30 giorni | Minimizzzazione e campionamento |
| Errori | 30–90 giorni | Non salvare dati sensibili negli errori |
| Sicurezza | 90–180 giorni, salvo motivata estensione | Analisi dei rischi e indagini |
| Accessi amministratori di sistema | almeno 6 mesi dove applicabile | Prescrizione specifica del Garante |
| Audit amministrativo e modifiche a dati personali | da definire | Finalità e necessità documentate |

Nessuno di questi intervalli autorizza da solo cancellazioni automatizzate o modifiche al codice operativo. Prima serve verificare quali eventi sono realmente raccolti, dove si trovano, il loro contenuto, la base giuridica, eventuali vincoli ulteriori e il piano di recupero.

## Implementazione e costi
- **Axiom** per ricerca recente; sul piano Personal la retention massima è 30 giorni. **Backblaze B2** è destinato all'archivio storico compresso in EU Central: la presenza del codice e del bucket **non dimostra** che i trasferimenti in produzione siano attivi.
- Prima di abilitare `AXIOM_ARCHIVE_ENABLED`, testare su dati non personali, verificare oggetto/manifest/hash/checkpoint, effettuare restore, controllare accessi/cifratura e definire lifecycle separati per categoria.
- Verificare i limiti e i costi dal consumo **reale** di Axiom e B2: evitare proiezioni basate soltanto sul numero di iscritti.
- `api/services/dataRetentionService.js` e `api/config/audit-config.js` contengono durate discordanti e motivazioni giuridiche da revisionare; non considerarli automaticamente applicabili né conformi.

## Fonti
- GDPR: https://eur-lex.europa.eu/eli/reg/2016/679/oj
- Garante, provvedimento amministratori di sistema: https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/1577499
- Codice civile, art. 2220: https://www.normattiva.it/
- Axiom: https://axiom.co/docs/reference/limits
- Backblaze B2: https://www.backblaze.com/cloud-storage/pricing
