# DEMOS — Controllo delle pubblicazioni in produzione (31 ottobre 2026)

**Stato: proposta in PR Draft. NESSUNA impostazione di produzione modificata. Gate release NO-GO.**

## Evidenze verificate

- GitHub: `Nictolas/DemosApp`, `main` restituisce `protected=false`, repository rulesets REST = `[]`. La lettura dell'endpoint classico branch-protection è negata al connettore (403); non equivale a confermare altri controlli.
- Render workspace `Nicolas`, backend `demos-backend` (`srv-d2gt3dodl3ps73fmereg`) e frontend `demos-frontend` (`srv-d2nm5pmmcj7s73cophhg`) sono collegati a `main` con auto-deploy **attivo** nel provider. Backend Free, `rootDir=api`, `node index.js`. Al momento della verifica il backend aveva deploy live `dep-dbj258nb9u1s73b8j5j0` su commit `0989d6eed954d84fbbb02d0391aaecfc9023159f` (Opinioni #513).
- `render.yaml` in `main` usa `autoDeploy: true` per entrambi i servizi. Questa PR propone `autoDeployTrigger: off`, sintassi Render attuale. **Modificare solo lo YAML in GitHub non è prova di aver cambiato il servizio già esistente:** il dashboard/API Render resta la fonte di verità.
- Il workspace elenca 11 servizi (web/static), nessun servizio di tipo `cron_job`; non esclude processi schedulati dentro il backend o fuori Render.
- PR #490 (export/migrazione legacy) e #504 (backup legacy) sono ancora Draft. In produzione i percorsi legacy sono montati dietro autenticazione e permessi Admin, ma non applicano i blocchi 410 proposti. Nessun accesso non autorizzato è stato dimostrato.

## Piano di attivazione controllata — da eseguire soltanto con autorizzazione

1. **Prima del merge di questa PR**, disabilitare manualmente `Auto-Deploy` su entrambi i servizi principali nel dashboard Render, scegliendo **Off**. Non toccare gli staging. Verificare con successivo read-back che entrambi siano effettivamente `off`. Non confondere `After CI Checks Pass` con approvazione manuale del rilascio: in quella modalità Render distribuisce comunque automaticamente dopo CI verdi.
2. Su GitHub, predisporre una regola che si applichi a `main`: richiedere modifiche tramite PR, evitare push diretti, imporre controlli di stato verificabili e non consentire bypass non autorizzati. Valutare la regola sui review obbligatori: con un unico manutentore e nessun revisore indipendente, richiedere un'approvazione altrui può rendere impossibile procedere. Prima occorre organizzare il reviewer.
3. Una volta disponibile su `main`, verificare che il workflow **Release Blueprint Policy** produca su *ogni* PR a `main` il check `blueprint-policy`; solo allora selezionarlo come check richiesto, assieme ad altri check **che non siano limitati a certi file**. Workflow con `paths:` come Security Agent Validation e Android Alpha Validation **non devono essere imposti a tutte le PR senza adeguare i trigger**, altrimenti alcune PR resteranno bloccate senza eseguire il controllo.
4. Dopo conferma provider/off e regole GitHub, effettuare la revisione del diff di questa PR, valutare la sincronizzazione Blueprint e integrarla solo con autorizzazione esplicita. Verificare nuovamente che backend e frontend conservino auto-deploy OFF nel provider.
5. **Non distribuire DEMOS soltanto perché i check sono verdi.** Occorrono gate SQL/RLS, DPO e retention, ripristino isolato/rollback, privacy URL pubblici, QA/E2E e release Android firmata. Il rilascio successivo deve essere manuale e verificato su un commit approvato, con piano di rollback e registrazione dello SHA live.

## Questa PR

- Modifica **soltanto** il Blueprint `render.yaml`, aggiunge `api/tests/releaseBlueprintPolicy.test.js` e un workflow PR-only, più questo runbook.
- I test sono sintetici e non usano segreti, database, provider o utenti reali. Non fanno push, merge o deploy.
- Il nuovo workflow è universale su PR verso `main` (senza `paths`): la presenza di un check **non protegge** il branch senza un ruleset/branch protection effettivamente abilitato su GitHub.
- Lascia invariato il comportamento dei 9 servizi staging elencati nel workspace.

## Riferimenti

- Render: https://render.com/docs/deploys
- Render Blueprint `autoDeployTrigger`: https://render.com/docs/blueprint-spec
- GitHub rulesets e status checks: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets
- Backend Render: https://dashboard.render.com/web/srv-d2gt3dodl3ps73fmereg
- Frontend Render: https://dashboard.render.com/static/srv-d2nm5pmmcj7s73cophhg
- Gate operativo Google Sheet: `SEC-RELEASE-20261031`, `REL-01`, `REL-04`, `SEC-CRED-20261031`.
