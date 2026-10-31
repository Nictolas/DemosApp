# DEMOS — Controllo delle pubblicazioni in produzione (31 ottobre 2026)

**Stato: proposta in PR Draft. NESSUNA impostazione di produzione modificata. Gate release NO-GO.**

## Evidenze verificate

- GitHub: `Nictolas/DemosApp`, `main` restituisce `protected=false`, repository rulesets REST = `[]`. La lettura dell'endpoint classico branch-protection è negata al connettore (403); non equivale a confermare altri controlli.
- Render workspace `Nicolas`, backend `demos-backend` (`srv-d2gt3dodl3ps73fmereg`) e frontend `demos-frontend` (`srv-d2nm5pmmcj7s73cophhg`) sono collegati a `main` con auto-deploy **attivo** nel provider. Backend Free, `rootDir=api`, `node index.js`. Al momento della verifica il backend aveva deploy live `dep-dbj258nb9u1s73b8j5j0` su commit `0989d6eed954d84fbbb02d0391aaecfc9023159f` (Opinioni #513).
- `render.yaml` in `main` usa `autoDeploy: true` per entrambi i servizi. Questa PR propone `autoDeployTrigger: off`, sintassi Render attuale. **Modificare solo lo YAML in GitHub non è prova di aver cambiato il servizio già esistente:** il dashboard/API Render resta la fonte di verità.
- Il workspace elenca 11 servizi (web/static), nessun servizio di tipo `cron_job`; non esclude processi schedulati dentro il backend o fuori Render.
- PR #490 (export/migrazione legacy) e #504 (backup legacy) sono ancora Draft. In produzione i percorsi legacy sono montati dietro autenticazione e permessi Admin, ma non applicano i blocchi 410 proposti. Nessun accesso non autorizzato è stato dimostrato.

## Gate P0 aggiuntivo — Blueprint Auto Sync e differenze dalla produzione

**ATTENZIONE: disabilitare l'Auto-Deploy dei due servizi non basta se sono gestiti da un Render Blueprint con `Auto Sync` attivo.** Secondo [Render Infrastructure as Code](https://render.com/docs/infrastructure-as-code), la sincronizzazione automatica di un Blueprint può **ridistribuire i servizi interessati** per applicare la configurazione modificata. Il Blueprint è separato dalla modalità `autoDeployTrigger=off` del singolo servizio. Il solo commit della PR #515 che modifica `render.yaml` non è automaticamente innocuo.

### Differenze osservate, senza leggere segreti

| Parametro | Backend LIVE Render | Backend `render.yaml` PR #515 |
| --- | --- | --- |
| `rootDir` | `api` | `api` |
| Build command | `npm install` | `npm ci` |
| Start command | `node index.js` | `node index.js` |

| Parametro | Frontend LIVE Render | Frontend `render.yaml` PR #515 |
| --- | --- | --- |
| `rootDir` | `client` | omesso (predefinito: root repository) |
| Build command | `npm install; npm run build` | `cd client && npm ci --only=production && npm run build` |
| Publish path | `dist` | `client/dist` |

Il risultato di una sincronizzazione può dipendere da come i servizi esistenti sono associati al Blueprint; **non è stato attestato alcun collegamento Blueprint né il suo valore Auto Sync**. Non assumere che una modifica a `render.yaml` controlli automaticamente i servizi esistenti, né che una sincronizzazione sia limitata ai campi Auto-Deploy.

### Condizioni aggiuntive prima dell'integrazione

1. Con l'accesso autorizzato a Render, verificare **se** `demos-backend` e `demos-frontend` sono gestiti da un Blueprint. Se sì, aprirlo e impostare **Blueprint Auto Sync → No**, con successivo read-back, **prima** di integrare PR #515. Non usare `Manual Sync`.
2. Se i servizi non sono Blueprint-managed, non associare questa PR a un nuovo Blueprint e non creare duplicati dei servizi di produzione.
3. Confrontare la configurazione effettiva di build, directory e pubblicazione con il Blueprint e decidere separatamente se conservarla o aggiornarla; non alterare build command, root directory, env var o publish path per il solo scopo di spegnere i deploy automatici.
4. Verificare che **Auto-Deploy dei due servizi = Off**, **Blueprint Auto Sync = No se applicabile**, e che nessun deploy inatteso sia partito. Poi verificare la protezione GitHub `main`.
5. Conservare il blocco `NO-GO` anche dopo questi passaggi finché DPO/GDPR, backup/restore, QA e approvazione della release non siano completati.

La CI `blueprint-policy` controlla esclusivamente il codice versionato, **non** legge né modifica Auto Sync, root directory o build command dei servizi Render. Nessuna sincronizzazione Blueprint è stata eseguita.

## Piano di attivazione controllata — da eseguire soltanto con autorizzazione

1. **Prima del merge di questa PR**, disabilitare manualmente `Auto-Deploy` su entrambi i servizi principali nel dashboard Render, scegliendo **Off**. Non toccare gli staging. Verificare con successivo read-back che entrambi siano effettivamente `off`. Non confondere `After CI Checks Pass` con approvazione manuale del rilascio: in quella modalità Render distribuisce comunque automaticamente dopo CI verdi.
2. Su GitHub, predisporre una regola che si applichi a `main`: richiedere modifiche tramite PR, evitare push diretti, imporre controlli di stato verificabili e non consentire bypass non autorizzati. Valutare la regola sui review obbligatori: con un unico manutentore e nessun revisore indipendente, richiedere un'approvazione altrui può rendere impossibile procedere. Prima occorre organizzare il reviewer.
3. Una volta disponibile su `main`, verificare che il workflow **Release Blueprint Policy** produca su *ogni* PR a `main` il check `blueprint-policy`; solo allora selezionarlo come check richiesto, assieme ad altri check **che non siano limitati a certi file**. Workflow con `paths:` come Security Agent Validation e Android Alpha Validation **non devono essere imposti a tutte le PR senza adeguare i trigger**, altrimenti alcune PR resteranno bloccate senza eseguire il controllo.
4. Dopo conferma provider/off, verifica di **Blueprint Auto Sync=No se applicabile**, differenze di build/rootDir/publish path e regole GitHub, effettuare la revisione del diff di questa PR. **Non sincronizzare il Blueprint** finché la configurazione di produzione non sia stata riconciliata e la sincronizzazione non sia stata autorizzata separatamente. Integrare solo con autorizzazione esplicita e verificare ancora che backend e frontend conservino Auto-Deploy OFF.
5. **Non distribuire DEMOS soltanto perché i check sono verdi.** Occorrono gate SQL/RLS, DPO e retention, ripristino isolato/rollback, privacy URL pubblici, QA/E2E e release Android firmata. Il rilascio successivo deve essere manuale e verificato su un commit approvato, con piano di rollback e registrazione dello SHA live.

## Questa PR

- Modifica **soltanto** il Blueprint `render.yaml`, aggiunge `api/tests/releaseBlueprintPolicy.test.js` e un workflow PR-only, più questo runbook.
- I test sono sintetici e non usano segreti, database, provider o utenti reali. Non fanno push, merge o deploy.
- Il nuovo workflow è universale su PR verso `main` (senza `paths`): la presenza di un check **non protegge** il branch senza un ruleset/branch protection effettivamente abilitato su GitHub.
- Lascia invariato il comportamento dei 9 servizi staging elencati nel workspace.

## Attivazione con interfaccia web: controlli verificabili (31/10)

**Questa è una procedura da eseguire nell'interfaccia autorizzata, non una modifica applicata automaticamente dalla PR.**

- [ ] Aprire [Render — demos-backend](https://dashboard.render.com/web/srv-d2gt3dodl3ps73fmereg), **Settings → Auto-Deploy → Off**. Salvare, poi rileggere lo stato: `autoDeployTrigger=off`.
- [ ] Aprire [Render — demos-frontend](https://dashboard.render.com/static/srv-d2nm5pmmcj7s73cophhg), **Settings → Auto-Deploy → Off**. Salvare, poi rileggere lo stato: `autoDeployTrigger=off`.
- [ ] Accertare che nessuna delle due operazioni abbia avviato un nuovo deploy e che il commit LIVE sia invariato; non premere "Manual Deploy".
- [ ] Aprire [GitHub — Repository rulesets](https://github.com/Nictolas/DemosApp/settings/rules). Creare un **branch ruleset attivo** con target esatto `main`: richiedere una Pull Request, bloccare force push e cancellazioni, evitando eccezioni che consentano push diretti non revisionati. Non imporre un secondo reviewer inesistente; nominare un reviewer prima di abilitare approvazioni obbligatorie.
- [ ] Solo **quando il workflow `Release Blueprint Policy` è presente stabilmente su `main` e risulta eseguito su una PR ordinaria**, rendere obbligatorio il check `blueprint-policy`. Non applicare ai check con trigger `paths` (es. Android Alpha, Security Agent) la richiesta globale finché non siano disponibili su tutte le PR.
- [ ] Eseguire un nuovo read-back: Render backend/frontend `off`, GitHub `main.protected=true` oppure ruleset attivo con vincoli effettivi, nessun nuovo deploy inatteso, PR #490/#504/#515 ancora in stato previsto. Aggiornare SHA e criteri di chiusura della CHECKLIST MASTER.

### Limite di esecuzione della connessione corrente

Al controllo del 31/10 il provider Render restituisce per **entrambi** i servizi di produzione `autoDeployTrigger=commit`; `main` GitHub restituisce `protected=false` e zero ruleset. Il connettore Render collegato non offre un'azione per aggiornare Auto-Deploy e il connettore GitHub collegato non offre la creazione di ruleset o la modifica della branch protection. Il PC remoto era offline e la connessione desktop alternativa non raggiungibile. **Nessuno di questi controlli è stato attivato da questa sessione**: non usare una variabile d'ambiente, un deploy o il semplice commit di `render.yaml` come surrogato della modifica dei provider.

La scelta di `Off` è intenzionale: `After CI Checks Pass` permette ancora a Render di distribuire automaticamente dopo i check verdi. I test della PR #515 sono preparatori, non sostituiscono l'azione autorizzata nel dashboard.

## Verifica supplementare — pubblicazioni e visibilità dei log

Verificato il 31/10 in **sola lettura**, nello stesso workspace Render e con gli ID dei servizi di produzione:

- Il backend `demos-backend` e il frontend `demos-frontend` risultano entrambi **LIVE** sul commit `9e7c17b636ca2d817c014def35e307c816150774`. I deploy precedenti su `0989d6e` e `45fb2b9` risultano disattivati per entrambi.
- Entrambi i servizi mantengono `autoDeployTrigger=commit` e il ramo `main`. GitHub `main` è a `9e7c17b`, restituisce `protected=false` e la API rulesets restituisce una lista vuota.
- La ricerca degli eventi `auto_deploy_disabled`/`auto_deploy_enabled` nella cronologia Render disponibile non ha restituito eventi. **Lo stato letto nei dettagli dei servizi, non l'assenza di eventi, è la prova che Auto-Deploy resta attivo.**
- La richiesta di log HTTP tipo `request` su `POST` verso i percorsi amministrativi legacy, nel periodo 24–31/10, non ha restituito registrazioni. Anche una verifica generale limitata di log `request` sul medesimo periodo è vuota: **l'assenza di record non dimostra che quelle API non siano state utilizzate**. Non dichiarare assenza di abusi, di chiamate o di trasferimenti a provider sulla base di log mancanti.
- Le attuali connessioni consentono le letture Render/GitHub ma **non** espongono una mutazione autorizzata di `autoDeployTrigger` né un'azione GitHub di creazione dei ruleset. Per completare l'attivazione occorre accedere ai pannelli dei due provider con permessi adeguati, oppure disporre di un connettore che supporti esplicitamente tali operazioni.

La configurazione `autoDeployTrigger: off` della PR è coerente con la [specifica ufficiale Blueprint Render](https://render.com/docs/blueprint-spec); `off` disabilita il deploy automatico, mentre `checksPass` continua a pubblicare dopo CI verdi. Le [regole dei required checks GitHub](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks) richiedono attenzione ai workflow con filtri `paths`: un check mai avviato resta pendente e può bloccare le PR.

## Riferimenti

- Render: https://render.com/docs/deploys
- Render Blueprint `autoDeployTrigger`: https://render.com/docs/blueprint-spec
- GitHub rulesets e status checks: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets
- Backend Render: https://dashboard.render.com/web/srv-d2gt3dodl3ps73fmereg
- Frontend Render: https://dashboard.render.com/static/srv-d2nm5pmmcj7s73cophhg
- Gate operativo Google Sheet: `SEC-RELEASE-20261031`, `REL-01`, `REL-04`, `SEC-CRED-20261031`.
