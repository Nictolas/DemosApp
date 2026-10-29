# DEMOS — ricognizione DOB politici, fonti istituzionali (28/10/2026)

**Stato:** audit read-only, con date lette da Supabase produzione e confrontate con il portale ufficiale della Camera. Non è un file di migrazione, non contiene ID/account privati, **nessuna DOB è stata modificata**.

## Campione nominativo Andrea

Il confronto su 11 nominativi distinti, 12 record DEMOS (due per Andrea Giorgis, uno Camera e uno Senato), presenta queste **discrepanze**:

| Nominativo | DEMOS (AAAA-MM-GG) | Camera ufficiale | Profili DEMOS | Riscontro |
|---|---|---|---:|---|
| Andrea Caroppo | 1987-06-26 | **1979-06-26** | 1 | XIX, Camera |
| Andrea De Maria | 1966-06-04 | **1966-10-05** | 1 | XIX, Camera |
| Andrea Delmastro Delle Vedove | 1971-10-22 | **1976-10-22** | 1 | XIX, Camera |
| Andrea Di Giuseppe | 1968-02-23 | **1968-05-20** | 1 | XIX, Camera |
| Andrea Gentile | 1980-02-03 | **1980-06-01** | 1 | XIX, Camera |
| Andrea Giaccone | 1976-11-30 | **1976-10-08** | 1 | XIX, Camera |
| Andrea Giorgis | 1965-08-24 | **1965-04-12** | 2 | XVII/XVIII Camera, XIX Senato |
| Andrea Mascaretti | 1965-01-23 | **1965-04-14** | 1 | XIX, Camera |
| Andrea Quartini | 1960-04-13 | **1960-03-21** | 1 | XIX, Camera |
| Andrea Rossi | 1976-05-20 | **1976-10-09** | 1 | XIX, Camera |
| Andrea Volpi | 1981-07-24 | **1981-04-28** | 1 | XIX, Camera |

**Fonti ufficiali (anagrafiche pubbliche):**
- Camera, XIX legislatura, elenco alfabetico proclamati con cognome e data di nascita: https://www.camera.it/deputati/elezioni/eletti
- Camera, Andrea Giorgis, XVII legislatura: https://www.camera.it/deputati/elenco/17-305567
- Camera, Andrea Giorgis, XVIII legislatura: https://www.camera.it/deputati/elenco/18-305567
- Camera, Andrea Delmastro Delle Vedove, portale storico: https://storia.camera.it/deputato/andrea-delmastro-delle-vedove-19761022/leg-repubblica-XVIII/atti?anno=2018

Il nome e l'incarico forniscono indizi utili, ma **DEMOS non dispone di un ID parlamentare canonico per questi utenti**. Queste differenze giustificano una riconciliazione, non un UPDATE indiscriminato. Il campione è intenzionale: **non è una stima della percentuale di errori sull'intera popolazione**. La data di creazione in DB di numerosi politici (9 gennaio 2026) non prova l'origine della DOB.

## Metodo raccomandato per riconciliare

1. Recuperare identificativi esterni Camera/Senato tramite fonte primaria, oltre a nome, cognome, data e legislatura. Non inferire ID o DOB da fotografie o URL costruiti.
2. Collegare ogni ID istituzionale a un **singolo soggetto** DEMOS verificato, distinguendo storicità e multipli mandati. Un doppione di Andrea Giorgis NON significa che sia corretto eliminare una riga: analizzare dipendenze, risposte e cronologia.
3. Registrare la provenienza del dato, data di consultazione, stato della verifica, conflitti e piano di rollback. Se la DOB è stata autodichiarata da una persona iscritta, **non sovrascriverla automaticamente** con un record pubblico basato sul solo nome.
4. Prima di qualsiasi aggiornamento su produzione: simulare su staging, controllare statistiche delle età e logica di consenso/GDPR, fare QA, poi eseguire modifiche idempotenti solo su ID univocamente risolti.
5. Evitare di utilizzare DOB non verificate come prerequisito per attribuire la qualifica «CIE certificata».

Collegamento operativo: GH-260, PR #380. Nessuna operazione di cancellazione, correzione anagrafica o attribuzione di fonte CIE è stata eseguita da questo audit.
