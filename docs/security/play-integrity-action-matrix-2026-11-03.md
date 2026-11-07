# DEMOS — Matrice azioni candidate Play Integrity (audit codice)

Data 03/11/2026. PR #572. **Proposta di selezione**, non approvazione all'uso né collegamento ai percorsi utente.

| Operazione | Endpoint verificato in repository | Rischio | Decisione iniziale | Vincoli |
|---|---|---|---|---|
| Registrazione con OAuth | `POST /api/auth/oauth/complete-registration` e `POST /api/auth/oauth/registration/exchange` (`api/routes/auth/oauth.js`) | Creazione massiva account e frodi | Candidato alta priorità, ma attestare solo eventi selezionati | Verificare interazioni reali client e quote; non sostituire rate limit o identity check |
| Registrazione passkey | `POST /api/auth/webauthn/register/verify` (`api/routes/auth/webauthn.js`) | Possibile abuso processo di registrazione | Candidato successivo | Non bloccare il flusso web o dispositivi senza Play Services |
| Login OAuth ordinario | `POST /api/auth/oauth/google` e `POST /api/auth/oauth/apple` (`api/routes/auth/oauth.js`) | Automazione tentativi | **Non attestare ogni login** nella fase iniziale | Quota 10k; continuare controlli OAuth/token sul server |
| Salvataggio opinioni | `POST /api/opinioni/salva` (`api/routes/opinioni/user-answers.js`) | Automazione risposte, dati politici sensibili | **Escluso dal primo rollout** | Minimizzazione GDPR Art. 9; non trasmettere testi o risposte in chiaro all'API Integrity |
| Preferenze iniziative | `POST /api/iniziative-popolari/vota` (`api/routes/iniziative-popolari.js`) | Abuso preferenze civiche | Valutare solo dopo metriche/falsi positivi | Nel codice già presenti autenticazione, consenso e verifica identità civica; Integrity non li sostituisce |
| Preferenze referendum | `POST /api/referendum-abrogativi/vota` (`api/routes/referendum-abrogativi.js`) | Automazione preferenze | Non nel primo rollout | Verificare endpoint e policy specifiche; nessun blocco automatico |
| Revoca consenso politico | `PUT /api/user/political-opinions-consent/revoke` (`api/routes/user/political-opinions-consent.js`) | Diritto privacy e revoca | **Mai imporre Play Integrity** | La revoca del consenso deve restare disponibile anche se API/device non attestabili |
| Firma legalmente valida su portali istituzionali | Eventuali portali esterni raggiunti via UI Firma | Eventuale bot | **Escluso** | Integrity DEMOS non verifica identità o firma legale sul portale ministeriale |

## Scelta tecnica provvisoria

1. Richieste standard soltanto su Android, on-demand, mai su ogni schermata/apertura.
2. In fase iniziale **solo telemetria**, senza rifiuto degli utenti e senza penalizzazioni per ROM modificate.
3. Nessuna dipendenza del web o degli accessi con Apple/Google/passkey dall'attestazione Android.
4. Non loggare token grezzi, risposte opinioni, identificatori personali, IP o testi di ricerca nel canale Integrity.
5. Backoffice e DPO devono approvare tempi di conservazione, classificazioni e trigger prima della prima chiamata reale.
6. Costi: non collegare Google Cloud né introdurre billing prima di una verifica esplicita che l'uso rimanga **€0**.

## Impatto quota (con ipotesi editabili nello Sheet)

Google documenta 10.000 richieste classiche/preparazioni standard e 10.000 decodifiche al giorno. Una preparazione standard può essere riutilizzata per più richieste di token su azioni diverse; le decodifiche restano conteggiate individualmente. Anche un solo controllo per utente su 100.000 utenti attivi al giorno supererebbe il limite; non attestare l'intera base utenti. La simulazione nello Sheet è orientativa.

## Stato validazione

- Test offline Play Integrity: GitHub Actions #41637757394 **PASS**.
- Android Alpha Validation: GitHub Actions #41637757475 **PASS** (APK debug e AAB CI non pubblicato).
- Frontend/catalogo: GitHub Actions #41637757287 **PASS**.
- L'attestazione reale con token Google NON è stata provata e rimane DISABILITATA.

## Fonti

- https://developer.android.com/google/play/integrity/setup
- https://developer.android.com/google/play/integrity/standard
- `api/routes/auth/oauth.js`, `api/routes/auth/webauthn.js`, `api/routes/opinioni/user-answers.js`, `api/routes/iniziative-popolari.js`, `api/routes/referendum-abrogativi.js`, `api/routes/user/political-opinions-consent.js`