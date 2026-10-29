# DEMOS — integrazione del profilo mobile e della privacy
**29 ottobre 2026 — piano di verifica, non autorizzazione al rilascio**

## Rami e responsabilità
- UI/cache/nav: PR [#404](https://github.com/Nictolas/DemosApp/pull/404), base `main`, Draft.
- Privacy e profilazione pubblica: catena Draft [#264–#286](https://github.com/Nictolas/DemosApp/pull/286), con proiezione pubblica filtrata e test del consenso.
- Verifica incrociata: [#408](https://github.com/Nictolas/DemosApp/pull/408), **base #286**, contiene il profilo #404 e i test adattati. **Non unire la #408 come se fosse un rilascio**.
- Consolidamento utenti: [#382](https://github.com/Nictolas/DemosApp/pull/382), Draft distinta; non applicata in questa verifica.

## Prove automatiche su HEAD 55444aa8
- Workflow `Legacy Menu retirement regression`, run **40858805418**: PASS (test navbar/layout/cache e build frontend).
- Workflow `Political consent save/revoke atomic privacy`, run **40858805193**: PASS **al rerun dei job falliti**. Primo tentativo: errore `ERR_TEST_FAILURE Unable to deserialize cloned data due to invalid or unsupported version` del runner Node nel test `politicalOpinionWriteRules.smoke.test.js`, senza evidenza di regressione applicativa. Il secondo tentativo PASS va comunque documentato, non mascherato.
- Workflow `DEMOS privacy integration readiness`, run **40858805125**: **FAIL** nel gate `Verify main ancestry`; i test di regressione backend identità, WebAuthn, privacy, logging e hardening nello stesso workflow sono **PASS**.
- Questi esiti non sostituiscono pentest, prove sul telefono, audit GDPR o verifica di rete/CDN.

## Ostacolo reale di integrazione
La catena privacy e `main` sono divergenti. Il merge base misurato è `77cfd86277e8a7c5c5540d42464fe5af46923d01`: `main` ha **22 commit propri** e la catena integrata ha oltre cento commit propri. Il confronto dei file modificati dai due lati individua due percorsi con interventi concorrenti:
1. `.github/workflows/legacy-menu-retirement.yml`: conservare **sia** i controlli più recenti su Utenti/CIE del ramo `main` **sia** i nuovi test cache e frontend della #404 (il ramo #408 incorpora già entrambi, ma va riconfermato nella merge finale).
2. `api/routes/users/profile.js`: il ramo `main` ha tolto `'genere'` dalla lista dei campi aggiornabili, mentre la catena privacy modifica lo stesso router per il consenso. Preservare **la rimozione del vecchio campo** e **le protezioni del consenso**. Rivedere anche la convivenza con i writer di #382, evitando doppie fonti autorevoli.

Il resto del diff di `main` (59 file a quel confronto) è non sovrapposto ai file modificati nella catena di test; **non è prova che la merge sia sicura**, in quanto modifiche indirette possono interagire. Unire sempre su un ramo di integrazione usa-e-getta, prima della revisione finale, senza forzare commit o sovrascrivere la storia. Non presentare il gate ancestry come superato finché un merge reale non conserva la nuova testata di `main`.

## Gate tecnici prima della release
1. Integrare correttamente l'ultima `main` e tutte le dipendenze privacy, con risoluzione esplicita dei due file e review di #382. Verificare `git merge-base --is-ancestor main HEAD` e `git diff --check` sul nuovo candidato.
2. Ripetere sul **medesimo SHA finale** build frontend, regressione UI/cache, test di consenso e revoca PostgreSQL sintetico, suite backend generale, Snyk e controllo privacy della proiezione pubblica.
3. Eseguire test sintetici su iPhone/Android: profilo proprio, profilo politico/candidato altrui, persona ordinaria, logout/cambio account, revoca sull'altro dispositivo, rete interrotta, riconnessione, pannelli espandibili e pulsanti. Non testare preferenze di utenti reali.
4. Misurare GET e SELECT sul flusso «prima apertura, seconda apertura, cambio schermata, modifica, revoca, ripresa» per quantificare il risparmio. La cache dura 10 minuti in RAM, non persiste dopo riavvio.
5. Preparare rollout e rollback documentati, consenso esplicito alla pubblicazione e monitoraggio. Questa nota non approva né avvia merge, deploy, migrazioni o modifiche a Supabase.

## Perimetro GDPR
Il frontend non è una barriera autorizzativa. Il server deve escludere dati politici senza consenso e impostare `private, no-store` sui payload riservati. Le scelte politiche restano soltanto nella cache in memoria, per account; dopo revoca locale avviene reset, mentre la revoca da un altro dispositivo richiede una sincronizzazione rilevabile. Nessun dato deve essere testato in produzione.
