# DEMOS — Gate di staging per export legacy e cancellazione Axiom/Neon

**Data:** 31/10/2026 · **Stato:** PREPARATO, NON ESEGUITO · **Release:** NO-GO

## Scopo
Collaudare esclusivamente la dismissione delle due rotte amministrative legacy:
- `POST /api/admin/data-export/start` → **410 Gone** dopo autenticazione e autorizzazione Admin.
- `POST /api/admin/axiom-migration/delete-migrated` → **410 Gone** dopo autenticazione e autorizzazione Admin.

Entrambe devono inviare `Cache-Control: no-store` e non avviare processi, esportazioni, cancellazioni, `TRUNCATE`, accessi Axiom o query per l'operazione distruttiva. I middleware originali di autenticazione possono usare il consueto lookup dell'account. Le funzioni lecite e indipendenti (es. richieste diritti GDPR) non devono subire regressioni.

## Evidenze già ottenute (non sostitutive dello staging)
- PR [#490](https://github.com/Nictolas/DemosApp/pull/490), **Draft, non integrata**; PR [#487](https://github.com/Nictolas/DemosApp/pull/487), fix `follow-redirects=1.16.2`, **non integrata**.
- [GitHub Actions — prova combinata](https://github.com/Nictolas/DemosApp/actions/runs/41201485737): `main` `c24f8fb95aeb14070dde8221227104b8610ea1bc` + #487 `00c36708eaa5d5575c5c27aaac394db47a4ef8e7` + #490 `7bd44de72c3694bad70867f9d253156a56ae558a`, due merge solo nel runner senza push; 19/19 test, audit `--audit-level=high` e build frontend Vite PASS. **11 vulnerabilità moderate** non risolte, registrate in [issue #493](https://github.com/Nictolas/DemosApp/issues/493).
- Test di sicurezza includono vero Express e vero `verifyToken`/`requireAdmin`, ma token e account sono **sintetici**; l'isolamento di SQL/provider è simulato.

## Ambiente esistente verificato su Render (metadati API, sola lettura)
| Servizio | Branch | Auto-deploy | Uso ammesso adesso |
| --- | --- | --- | --- |
| `demos-backend` (production, `srv-d2gt3dodl3ps73fmereg`) | `main` | **ON** | NON modificare |
| `demos-frontend` (production, `srv-d2nm5pmmcj7s73cophhg`) | `main` | **ON** | NON modificare |
| `demos-functional-staging` (`srv-db52l1g473hc739ld250`) | `staging/functional-integration-v0` | **OFF** | Solo candidato da valutare: non contiene automaticamente #490, non modificarlo senza coordinamento |
| `demos-sondaggi-op37-http-staging` (`srv-dbeeca5g1s2s73fb7pd0`) | `feature/sondaggi-text-bulk-op37-20261024` | **OFF** | NON riutilizzare: servizio dedicato a prove Sondaggi |

I servizi elencati sono già esistenti su piano Free. Nessun servizio, piano, database o branch staging è stato creato da questa verifica. **La presenza di uno staging non prova l'isolamento delle sue credenziali**: il solo `get_service` non dimostra quali valori o environment group siano impostati. Documentazione storica indica Supabase **Demos-Staging** distinto dal progetto di produzione e con `public` non rappresentativo di DEMOS: non assumere parità di schema.

## Preflight obbligatorio — prima di qualunque deploy staging
- [ ] Identificare il responsabile della prova e bloccare interferenze con esperimenti già in corso su `demos-functional-staging`.
- [ ] Autorizzare esplicitamente **il singolo deploy staging**, senza merge su `main` e senza costi aggiuntivi.
- [ ] Mostrare in forma redatta gli **identificativi** di progetto Supabase, host DB, environment group e token provider collegati al servizio; rifiutare qualsiasi risorsa o credenziale di **produzione**. Non copiare segreti in GitHub, Sheets, CI, log o chat.
- [ ] Se non si possono dimostrare i confini tra staging e produzione, **STOP**. Non avviare un backend con accesso reale alla produzione per testare una rotta distruttiva.
- [ ] Preparare un ambiente HTTP isolato con fixture inventate, senza dati personali e senza credenziali Axiom/B2 o permessi di cancellazione; non usare account Admin reali come fixture se esistono alternative isolate.
- [ ] Fissare gli SHA `main`, #487 e #490 all'inizio dell'esecuzione; se uno è cambiato, ripetere la prova composita CI e documentare l'HEAD reale.
- [ ] Assicurarsi che il servizio utilizzato non abbia auto-deploy, preview o variabili condivise con `demos-backend`/`demos-frontend` produzione.

## Matrice di accettazione HTTP — staging autenticamente isolato
| Percorso | Identità | Atteso | Divieto |
| --- | --- | --- | --- |
| Entrambe le rotte POST | Senza token / token errato | 401 | Nessun processo/DELETE/AXIOM |
| Entrambe le rotte POST | Utente valido non Admin | 403 | Nessun processo/DELETE/AXIOM |
| Entrambe le rotte POST | Legacy role admin senza capability `isAdmin` | 403 | Nessuna elevazione |
| Entrambe le rotte POST | Admin sintetico autorizzato | 410 + `Cache-Control: no-store` | Nessun processo/DELETE/AXIOM |
| Entrambe le rotte POST | Admin con `deleteAfterExport=true`, `confirm=DELETE`, tabelle inaspettate, body vuoto | 410 | Mai eseguire cancellazioni |
| `GET /api/admin/data-export/status` | Admin | Contratto preesistente senza nuova attività distruttiva | No regressioni |
| UI DataExport | Admin | Opzione eliminazione e pulsante avvio export inattivi, comando Neon non presente | Nessuna chiamata distruttiva |

**Raccolta prove:** soli codici HTTP, header necessari, timestamp, SHA, contatori aggregati di side effect zero e build/versione; NON registrare JWT, corpi con dati personali, password o sessioni. Non usare test di carico o enumerazione utenti. Se i contratti reali differiscono, fermarsi e riportare il difetto senza bypassare l'autenticazione.

## Uscita e rollback
1. Se un controllo fallisce: registrare solo evidenza minima, interrompere la prova, ripristinare l'ambiente staging **nella configurazione isolata iniziale**; nessun deploy di produzione.
2. Non proporre di risolvere il problema riattivando i vecchi endpoint distruttivi o uno script `--delete`.
3. Rivalidare le procedure separate per diritti dell'interessato e il percorso Axiom `/migrate` prima di applicare modifiche più ampie. Il test di queste rotte non autorizza cancellazioni automatiche o retention.
4. Solo dopo approvazione della matrice RP-09/RP-10/RP-17, DPIA e inventario provider, definire una **nuova** procedura di export/eliminazione idempotente, verificabile, transazionale dove possibile, con ricevute e audit minimizzato.
5. Fase release: il merge su `main` **innesca auto-deploy** backend e frontend Render; non effettuare merge o modificare `autoDeploy` prima della decisione esplicita del titolare/DPO e del gate REL-01. A integrazione approvata, verificare SHA effettivamente LIVE su ciascun servizio e ripetere smoke sicuri.

## Decisione attuale
**NO-GO.** L'esito positivo delle CI è necessario ma non sufficiente. Mancano isolamento staging attestato, esecuzione dei test HTTP in staging, approvazione legale della retention/RP-10 e decisione esplicita sul rilascio. Non inventare una percentuale di completamento per questa attività.

**Fonti:** [inventario provider e retention](https://github.com/Nictolas/DemosApp/blob/main/docs/operations/LOG_RETENTION_PROVIDER_REVIEW_2026-10-23.md), [CHECKLIST MASTER](https://docs.google.com/spreadsheets/d/1o7gI3m2Mbs2NRQtoyVh3DZW-7jlQinZgC-ou9Nc-q10/edit#gid=1930281028), [PR #490](https://github.com/Nictolas/DemosApp/pull/490), [issue #493](https://github.com/Nictolas/DemosApp/issues/493).
