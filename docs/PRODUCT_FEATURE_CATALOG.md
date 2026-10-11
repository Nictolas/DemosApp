# DEMOS — Catalogo canonico delle funzionalità

**Versione:** 2026-10-11  
**Scope:** funzionalità effettivamente presenti nel repository `DemosApp`, con distinzione tra superfici utente, funzioni condizionate da ruolo/capability, superfici operative/Admin e route legacy/ritirate.

## Come leggere il catalogo

Stati usati:

- **ATTIVA** — funzione raggiungibile nel prodotto corrente e sostenuta dal codice attivo.
- **ATTIVA / ACCESSO LIMITATO** — funzione corrente, ma disponibile soltanto a determinati account/capability o previa autenticazione.
- **PUBBLICA** — consultabile senza account.
- **INTERNA / ADMIN** — superficie operativa, amministrativa o diagnostica; non è una normale funzione utente.
- **ALIAS / COMPATIBILITÀ** — URL mantenuto per compatibilità e convergente su una funzione canonica.
- **RITIRATA / REDIRECT** — vecchia funzione non più disponibile come azione autonoma; la route reindirizza alla superficie canonica.

Le capability canoniche sono composabili (`isAdmin`, `isActivist`, `isCandidate`, `isPolitician`) e il tipo account è `PERSON`, `INSTITUTION` o `ORGANIZATION`; i vecchi ruoli `E/P/C/CP/A/I/O/AD` restano una proiezione di compatibilità. Riferimento: `api/services/accountCapabilitiesService.js`.

## 1. Accesso, onboarding e identità

| ID | Funzione | Accesso | Stato | Riferimento tecnico principale |
|---|---|---|---|---|
| UF-001 | Landing page e ingresso nell'app | Tutti | PUBBLICA | `client/src/pages/LandingPage.tsx`, route `/` |
| UF-002 | Login/autenticazione | Tutti | PUBBLICA | `client/src/pages/auth-page.tsx`, route `/auth`, `client/src/hooks/useAuthLogin.ts` |
| UF-003 | Login/bootstrap con Google | Nuovi/esistenti | ATTIVA | `api/routes/auth/oauth.js`, `api/services/oauthRegistrationService.js` |
| UF-004 | Login/bootstrap con Apple | Nuovi/esistenti, provider configurato | ATTIVA / ACCESSO LIMITATO | `api/routes/auth/oauth.js`, servizi OAuth |
| UF-005 | Passkey/WebAuthn per registrazione/accesso | Browser/dispositivo compatibile | ATTIVA | route `/registrazione-crea-passkey`, `api/routes/auth/webauthn*`, servizi WebAuthn |
| UF-006 | Verifica CIE obbligatoria prima della creazione di un nuovo account personale | Nuovi account personali | ATTIVA; E2E provider ufficiale pendente | `api/routes/auth/identity.js`, servizi CIE/OIDC e finalizer post-CIE |
| UF-007 | Raccolta dati anagrafici di registrazione | Nuovi utenti | ATTIVA | route `/registrazione-nome`, `/registrazione-genere`, `/registrazione-cittadinanza`, `/registrazione-data-nascita` |
| UF-008 | Consensi Privacy, Termini e dati/opinioni politiche | Nuovi utenti | ATTIVA | `/registrazione-consensi`, `api/routes/user/registration-consents.js`, `api/routes/user/political-opinions-consent.js` |
| UF-009 | Residenza/territorio in registrazione | Nuovi utenti | ATTIVA | `/registrazione-3-residenza`, servizi territoriali canonici |
| UF-010 | Protezione delle route autenticata | Utenti autenticati | ATTIVA | `client/src/lib/protected-route.tsx` |

## 2. Profilo, account e diritti privacy

| ID | Funzione | Accesso | Stato | Riferimento tecnico principale |
|---|---|---|---|---|
| UF-011 | Visualizzare e modificare il proprio profilo | Autenticato | ATTIVA | `/profilo`, `client/src/pages/Profilo`, `api/routes/users/profile.js` |
| UF-012 | Visualizzare il profilo politico pubblico di un altro politico/candidato | Autenticato | ATTIVA | `/profilo/:userId`, `api/routes/users/public-profile.js` |
| UF-013 | Personalizzare avatar/immagine profilo | Autenticato | ATTIVA | `/modifica-immagine`, `client/src/pages/ModificaImmagine.tsx` |
| UF-014 | Visualizzare rappresentanti, candidati e governo ideale nel profilo | Autenticato; dati pubblici solo dove previsto | ATTIVA | componenti `ProfileRepresentatives`, `ProfileCandidates`, `ProfileGovernoIdeale` |
| UF-015 | Gestire consenso alle opinioni politiche | Autenticato | ATTIVA | `/impostazioni/gestione-privacy`, `api/routes/user/political-opinions-consent.js` |
| UF-016 | Scaricare/esportare i propri dati | Autenticato | ATTIVA | `/impostazioni/scarica-dati`, `/gdpr`, `api/routes/user/gdpr-rights.js` |
| UF-017 | Avviare la cancellazione account | Autenticato | ATTIVA | `/impostazioni/cancella-account`, servizio canonico account erasure |
| UF-018 | Richiedere limitazione del trattamento | Autenticato | ATTIVA | `/impostazioni/limitazione-trattamento` |
| UF-019 | Esercitare opposizione al trattamento | Autenticato | ATTIVA | `/impostazioni/opposizione-trattamento` |
| UF-020 | Consultare informazioni legali, copyright e impostazioni privacy | Autenticato | ATTIVA | `/impostazioni`, `/impostazioni/informazioni-legali`, `/impostazioni/copyright` |

## 3. Opinioni politiche, matching e selezioni

| ID | Funzione | Accesso | Stato | Riferimento tecnico principale |
|---|---|---|---|---|
| UF-021 | Hub Opinioni | Autenticato | ATTIVA | `/opinioni`, `client/src/pages/Opinioni.tsx` |
| UF-022 | Esprimere opinioni europee | Autenticato | ATTIVA | `/opinioni-europee`, API opinioni |
| UF-023 | Esprimere opinioni nazionali | Autenticato | ATTIVA | `/opinioni-nazionali`, API opinioni |
| UF-024 | Esprimere opinioni regionali | Autenticato | ATTIVA | `/opinioni-regionali`, API opinioni |
| UF-025 | Esprimere opinioni comunali | Autenticato | ATTIVA | `/opinioni-comunali`, API opinioni |
| UF-026 | Proporre una nuova Opinione per moderazione | Autenticato | ATTIVA | `/proponi-opinione`, route Admin/moderazione opinioni |
| UF-027 | Matching politico basato sulle Opinioni | Autenticato; tutte le Opinioni richieste per i suggerimenti | ATTIVA | `api/services/politicalMatchingService.js`, pagine Rappresentanti/Candidati |
| UF-028 | Scegliere il proprio rappresentante per livello | Autenticato; eleggibilità territoriale | ATTIVA | `/rappresentanti`, `/scegli-rappresentante/:categoria`, `politicalSelectionService` |
| UF-029 | Scegliere il candidato sostenuto per livello/elezione | Autenticato; eleggibilità territoriale | ATTIVA | `/candidati`, `/candidati/:categoria`, `politicalSelectionService` |
| UF-030 | Podio/alternative di selezione politica e metriche di trasparenza | Autenticato | ATTIVA | `/api/podio-trasparenza`, test `transparencyPodium*` |
| UF-031 | Statistiche aggregate delle Opinioni con soglia privacy minima 10 | Autenticato sulle UI correnti; API con guard small-cell | ATTIVA | `/statistiche-opinione`, `api/routes/opinioni/stats.js` |

## 4. Preferiti, directory e relazioni

| ID | Funzione | Accesso | Stato | Riferimento tecnico principale |
|---|---|---|---|---|
| UF-032 | Hub Preferiti | Autenticato, non mostrato agli account Institution nel nav principale | ATTIVA | `/preferiti`, `client/src/pages/Preferiti` |
| UF-033 | Directory politici/rappresentanti | Autenticato | ATTIVA | `/rappresentanti` |
| UF-034 | Directory candidati | Autenticato | ATTIVA | `/candidati` |
| UF-035 | Directory Attivisti | Tutti nella route corrente | PUBBLICA | `/attivisti`, `client/src/pages/Attivisti` |
| UF-036 | Directory Organizzazioni | Autenticato | ATTIVA | `/organizzazioni` |
| UF-037 | Siti e Social collegati | Autenticato | ATTIVA | `/siti`, `/social` |
| UF-038 | Visualizzare i propri sostenitori/aggregati di supporto | Autenticato; soprattutto profili politici/candidati | ATTIVA / ACCESSO LIMITATO | `/sostenitori`, API supporter private/public counts |

## 5. Firma, processi civici e fonti ufficiali

| ID | Funzione | Accesso | Stato | Riferimento tecnico principale |
|---|---|---|---|---|
| UF-039 | Hub Firma/Democrazia diretta | Autenticato | ATTIVA | `/firma`, `client/src/pages/Proponi.tsx` |
| UF-040 | Consultare Iniziative Popolari italiane da fonti ufficiali | Autenticato | ATTIVA | `/iniziative-popolari`, registry/processi civici canonici |
| UF-041 | Consultare Referendum Abrogativi da fonti ufficiali | Autenticato | ATTIVA | `/referendum-abrogativi` |
| UF-042 | Consultare ICE/ECI UE e raggiungere il canale ufficiale di firma | Autenticato | ATTIVA | `/ice`; `/eci` è alias; pagina ICE ufficiale read-only |
| UF-043 | Esprimere priorità DEMOS tra iniziative popolari ammesse | Autenticato | ATTIVA | `/vota-iniziativa-popolare`, servizio civic priority |
| UF-044 | Riconciliazione multi-fonte e marcatura “realizzata” di un processo civico | Admin/Staff | INTERNA / ADMIN | `api/routes/admin/civic-processes.js`, servizi civic reconciliation |

## 6. Preferenze democratiche e istituzionali

| ID | Funzione | Accesso | Stato | Riferimento tecnico principale |
|---|---|---|---|---|
| UF-045 | Hub Vota | Autenticato | ATTIVA | `/vota`, `client/src/pages/Vota.tsx` |
| UF-046 | Preferenza per Capo di Stato | Autenticato | ATTIVA | `/capo-di-stato` (`/capo-stato` alias), servizi cooldown |
| UF-047 | Composizione del Governo ideale / preferenze ministri | Autenticato | ATTIVA | `/governo`, `/governo/:slug`, servizi governo/cooldown |
| UF-048 | Preferenze sulla Grazia | Autenticato | ATTIVA | `/grazia` |
| UF-049 | Preferenze sull’Amnistia | Autenticato | ATTIVA | `/amnistia` |
| UF-050 | Cooldown di 24 ore sulle preferenze che lo richiedono | Autenticato | ATTIVA | `api/services/preferenceCooldownService.js` |

## 7. Eventi, comunicazioni e strumenti per ruoli avanzati

| ID | Funzione | Accesso | Stato | Riferimento tecnico principale |
|---|---|---|---|---|
| UF-051 | Consultare il feed/calendario Eventi | Autenticato | ATTIVA | `/eventi`, modello eventi canonico |
| UF-052 | Visualizzare dettaglio Evento | Autenticato | ATTIVA | `/evento` |
| UF-053 | Creare/proporre Eventi | Candidati/politici/attivisti/ruoli ammessi secondo capability; moderazione Staff | ATTIVA / ACCESSO LIMITATO | route eventi + `eventApprovalService`/test event approval |
| UF-054 | Strumenti avanzati per comunicazioni istituzionali e attività | P/C/CP/Admin/I/A/O nel client; backend capability-aware | ATTIVA / ACCESSO LIMITATO | `/strumenti`, `client/src/pages/Strumenti.tsx` |
| UF-055 | Comunicare un voto/posizione istituzionale | Politico/ruolo autorizzato | ATTIVA / ACCESSO LIMITATO | `/comunica`, `api/routes/comunicazioni*` |
| UF-056 | Informa Cittadini: avviso territoriale istituzionale | Istituzione/autorità comunale OFFICIAL | ATTIVA / ACCESSO LIMITATO | `/informa-cittadini`, `institutionalTerritorialNoticeService` |
| UF-057 | Programma elettorale associato a candidatura | Candidato con candidatura attiva | ATTIVA / ACCESSO LIMITATO | `/programma`, `politicalProgramService` |
| UF-058 | Reclamo/riconoscimento di un profilo | Utente autenticato / flusso di riconoscimento | ATTIVA / ACCESSO LIMITATO | `/riconoscimento`, componenti `reclama-profilo` |

## 8. Notifiche, sondaggi, segnalazioni e utilità

| ID | Funzione | Accesso | Stato | Riferimento tecnico principale |
|---|---|---|---|---|
| UF-059 | Feed Notifiche | Autenticato | ATTIVA | `/notifiche` |
| UF-060 | Preferenze Notifiche | Autenticato | ATTIVA | `/notifiche/preferenze` |
| UF-061 | Aggregati/Notifiche totali | Autenticato | ATTIVA | `/notifiche-totali` |
| UF-062 | Notifiche sul cambio di Opinione di politico/candidato seguito | Autenticato; destinatari da selezioni correnti | ATTIVA | `politicalOpinionNotificationService`, UI notifiche |
| UF-063 | Sondaggi territoriali Regione/Provincia/Comune | Account con accesso avanzato previsto dalla pagina | ATTIVA / ACCESSO LIMITATO | `/sondaggi` e route territoriali |
| UF-064 | Segnalare un problema | Autenticato | ATTIVA | `/segnala-problema` |
| UF-065 | Avvistamenti / contatti di emergenza | Autenticato | ATTIVA | `/avvistamenti` |
| UF-066 | Riscontro/feedback | Autenticato | ATTIVA | `/riscontro` |

## 9. Superfici operative e amministrative

Queste superfici sono censite perché fanno parte dell'applicazione, ma **non devono essere presentate come normali funzionalità cittadino**.

| ID | Funzione | Accesso previsto | Stato | Riferimento tecnico principale |
|---|---|---|---|---|
| AF-001 | Hub Gestisci | Admin/Staff/capability specifica | INTERNA / ADMIN | `/gestisci` |
| AF-002 | Gestione riconoscimenti | Admin/Staff | INTERNA / ADMIN | `/gestisci/riconoscimenti` |
| AF-003 | Gestione utenti | Admin/Staff | INTERNA / ADMIN | `/utenti`; `/gestisci-utenti` è redirect |
| AF-004 | Moderazione/gestione Opinioni | Admin | INTERNA / ADMIN | `/gestisci-opinioni` |
| AF-005 | Gestione Governo | Admin | INTERNA / ADMIN | `/gestisci-governo` |
| AF-006 | Gestione Notifiche DEMOS | Admin | INTERNA / ADMIN | `/gestisci/notifiche-demos` |
| AF-007 | Metriche endpoint e riduzione compute | Admin | INTERNA / ADMIN | `/gestisci/metriche-endpoint`, `/gestisci/riduzione-compute` |
| AF-008 | Pannello parametri/capacità | Admin | INTERNA / ADMIN | `/admin/parametri` |
| AF-009 | GDPR/legal management ed export operativo | Admin | INTERNA / ADMIN | `/admin/gdpr-legal`, `/admin/data-export` |
| AF-010 | Ops Center / Security / Monitoring / Audit dashboards | Admin/operativo | INTERNA / ADMIN | `/admin/ops-center`, route monitoring/security/audit |
| AF-011 | Log centralizzati e Axiom | Admin/operativo | INTERNA / ADMIN | `/admin/data-export/centralized-logs`, `/admin/data-export/axiom` |
| AF-012 | Test/diagnostica Ministero | Sviluppo/Admin | INTERNA / ADMIN | `/test-ministero` |
| AF-013 | Viste specialistiche voti politici/parlamentari | Accesso protetto/capability specifica | INTERNA / ACCESSO LIMITATO | `/voti-politici`, `/voti-parlamento`, `/voti-parlamento-europeo` |
| AF-014 | Statistiche utenti | Accesso protetto/amministrativo | INTERNA / ACCESSO LIMITATO | `/statistiche-utenti` |

## 10. Route pubbliche legali/informative

| Route | Contenuto | Stato |
|---|---|---|
| `/privacy-policy` | Privacy Policy in-app | PUBBLICA; contenuto legale finale ancora soggetto a F5-12 |
| `/terms-of-service` | Termini di servizio | PUBBLICA; contenuto legale finale ancora soggetto a F5-14 |
| `/cookie-policy` | Cookie Policy | PUBBLICA |
| `/accessibilita` | Dichiarazione/stato accessibilità | PUBBLICA; audit tecnico eseguito, test manuali reali pendenti |
| `/registro-trattamenti` | Informazioni/registro trattamenti | PUBBLICA |
| `/security-measures` | Misure di sicurezza | PUBBLICA |
| `/gdpr-rights` | Informazioni sui diritti GDPR | PUBBLICA |
| `/data-retention` | Informazioni retention | PUBBLICA; policy definitiva ancora in verifica F5-17 |
| `/legal-documents` | Documentazione legale | Superficie informativa |

## 11. Funzioni ritirate, alias e compatibilità

| Route/vecchia funzione | Stato corrente | Destinazione/comportamento |
|---|---|---|
| `/eci` | ALIAS / COMPATIBILITÀ | redirect a `/ice` |
| `/capo-stato` | ALIAS / COMPATIBILITÀ | stesso componente di `/capo-di-stato` |
| `/menu/profilo`, `/menu/profilo/:userId` | ALIAS / COMPATIBILITÀ | stesso Profilo delle route canoniche |
| `/registrazione-consensi-privacy` | RITIRATA / REDIRECT | `/registrazione-consensi` |
| `/registrazione-consensi-termini` | RITIRATA / REDIRECT | `/registrazione-consensi` |
| `/registrazione-consensi-opinioni` | RITIRATA / REDIRECT | `/registrazione-consensi` |
| `/vota-referendum-abrogativo` | RITIRATA / REDIRECT | `/referendum-abrogativi`; nessuna “priorità DEMOS” dei referendum |
| `/vota-ice` | RITIRATA / REDIRECT | `/ice`; la firma/votazione avviene sul canale UE ufficiale |
| `/proponi-referendum-abrogativi` | RITIRATA / REDIRECT | `/referendum-abrogativi`; fonte ufficiale italiana |
| `/proponi-iniziativa-popolare` | RITIRATA / REDIRECT | `/iniziative-popolari`; fonte ufficiale italiana |
| `/proponi-ice` | RITIRATA / REDIRECT | `/ice`; creazione sul portale UE |
| `/gestisci-utenti` | RITIRATA / REDIRECT | `/utenti` |
| `/admin/security-dashboard` | RITIRATA / REDIRECT | `/admin/ops-center` |
| `/monitoring-dashboard` | ALIAS / COMPATIBILITÀ | `/monitoring-dashboard/overview` |

## 12. Copertura route `App.tsx`

L'elenco seguente serve come indice tecnico e come guardia anti-regressione del catalogo. Ogni route registrata nel router deve comparire almeno una volta in questo documento.

`/`, `/auth`, `/privacy-policy`, `/terms-of-service`, `/cookie-policy`, `/accessibilita`, `/registro-trattamenti`, `/security-measures`, `/gdpr-rights`, `/data-retention`, `/violations-dashboard`, `/security-dashboard`, `/legal-documents`, `/backup-dashboard`, `/rate-limiting-dashboard`, `/validation-dashboard`, `/logging-dashboard`, `/monitoring-dashboard`, `/monitoring-dashboard/overview`, `/monitoring-dashboard/health`, `/monitoring-dashboard/performance`, `/monitoring-dashboard/disk`, `/monitoring-dashboard/database`, `/monitoring-dashboard/memory`, `/monitoring-dashboard/security`, `/monitoring-dashboard/services`, `/audit-dashboard`, `/admin/security-dashboard`, `/admin/ops-center`, `/admin/ops-center/:section`, `/admin/parametri`, `/admin/gdpr-legal`, `/admin/data-export`, `/admin/data-export/centralized-logs`, `/admin/data-export/axiom`, `/registrazione-nome`, `/registrazione-genere`, `/registrazione-cittadinanza`, `/registrazione-data-nascita`, `/registrazione-consensi`, `/registrazione-consensi-privacy`, `/registrazione-consensi-termini`, `/registrazione-consensi-opinioni`, `/registrazione-crea-passkey`, `/registrazione-3-residenza`, `/menu`, `/profilo`, `/menu/profilo`, `/profilo/:userId`, `/menu/profilo/:userId`, `/modifica-immagine`, `/opinioni`, `/opinioni-nazionali`, `/opinioni-regionali`, `/opinioni-comunali`, `/rappresentanti`, `/preferiti`, `/candidati`, `/attivisti`, `/siti`, `/social`, `/organizzazioni`, `/scegli-rappresentante/:categoria`, `/candidati/:categoria`, `/notifiche`, `/notifiche/preferenze`, `/notifiche-totali`, `/vota`, `/eventi`, `/strumenti`, `/gestisci`, `/gestisci/riconoscimenti`, `/gestisci/riduzione-compute`, `/gestisci/metriche-endpoint`, `/voti-politici`, `/voti-parlamento`, `/voti-parlamento-europeo`, `/gestisci/notifiche-demos`, `/impostazioni`, `/riconoscimento`, `/segnala-problema`, `/avvistamenti`, `/impostazioni/password`, `/impostazioni/scarica-dati`, `/impostazioni/cancella-account`, `/impostazioni/gestione-privacy`, `/impostazioni/limitazione-trattamento`, `/impostazioni/opposizione-trattamento`, `/impostazioni/copyright`, `/impostazioni/informazioni-legali`, `/gdpr`, `/sondaggi`, `/sondaggi/:regione`, `/sondaggi/:regione/:provincia`, `/sondaggi/:regione/:provincia/:comune`, `/firma`, `/proponi-opinione`, `/capo-stato`, `/capo-di-stato`, `/amnistia`, `/grazia`, `/governo`, `/governo/:slug`, `/ice`, `/eci`, `/referendum-abrogativi`, `/iniziative-popolari`, `/gestisci-utenti`, `/utenti`, `/gestisci-opinioni`, `/approfondimento`, `/gestisci-governo`, `/test-ministero`, `/statistiche-utenti`, `/statistiche-opinione`, `/statistiche-opinione/:id`, `/statistiche-opinione/:id/regione/:regione`, `/vota-iniziativa-popolare`, `/vota-referendum-abrogativo`, `/vota-ice`, `/comunica`, `/sostenitori`, `/evento`, `/informa-cittadini`, `/programma`, `/riscontro`, `/opinioni-europee`, `/proponi-referendum-abrogativi`, `/proponi-iniziativa-popolare`, `/proponi-ice`.

## 13. Limiti noti del catalogo

- Il catalogo descrive il **prodotto implementato**, non equivale a una promessa che ogni integrazione esterna sia già qualificata in produzione.
- CIE è implementata come gate pre-account, ma l'E2E con provider CIE ufficiale resta dipendente da onboarding/federazione e credenziali non-production.
- Apple Sign in richiede ancora le condizioni esterne già registrate in roadmap per l'E2E reale.
- Le funzioni privacy/legali sono tecnicamente raggiungibili, ma i contenuti finali dipendono dai task legali ancora aperti.
- Alcune route operative storiche sono ancora registrate nel frontend pur non appartenendo alla normale UX cittadino; sono quindi censite separatamente come `INTERNA / ADMIN` anziché omesse.

## 14. Regola di manutenzione

Quando viene aggiunta, eliminata o reindirizzata una route utente in `client/src/App.tsx`, aggiornare questo catalogo nello stesso checkpoint. Il test `api/tests/productFeatureCatalog.smoke.test.js` verifica automaticamente che nessuna route del router resti fuori dal censimento e che le principali funzioni ritirate continuino a essere descritte come tali.
