# Demos-Staging — Verifica outbox Supabase (21 ottobre 2026)

**Esito: progetto Supabase separato creato e collaudo SQL reale riuscito.**
**Non è un'autorizzazione al rollout di produzione.** Questo documento contiene
solo gli identificativi pubblici dei progetti, risultati aggregati e istruzioni;
nessuna password, token, dato personale o stringa di connessione privata.

## Separazione e costi

| Elemento | Dettaglio |
| --- | --- |
| Progetto di staging | `Demos-Staging` |
| Project ref staging | `fkeayjzvtuvzesljhjbc` |
| Organizzazione | `DemosReplit` (piano Free) |
| Regione | `eu-central-1` |
| Database di staging | PostgreSQL 17.11 |
| Stato verificato | `ACTIVE_HEALTHY` |
| Preventivo connettore Supabase prima della creazione | **0 USD/mese**, con limiti del piano Free |
| Progetto di produzione DEMOS | `wxnblcqoyjqxktwkcqok` — **non modificato** |
| Vecchio progetto `DemosReplit` | `INACTIVE` — non utilizzato nel test |

**Attenzione ai costi:** il preventivo di creazione è 0 USD/mese. I limiti di
progetti gratuiti e delle risorse vanno ricontrollati se la configurazione
dell'organizzazione cambia. I progetti Free possono sospendersi per inattività;
lo staging è per collaudi, non un servizio che deve restare sempre acceso.

## Migrazione applicata soltanto sullo staging

- Nome: `create_private_audit_delivery_outbox_staging`
- Versione registrata in `supabase_migrations`: `20261021154902`
- Oggetti: schema `demos_private`, tabella `audit_delivery_outbox`,
  chiave primaria, indice `audit_delivery_outbox_due`, indice
  `audit_delivery_outbox_expired_lease`.
- RLS attiva; nessuna policy aperta agli utenti.
- Schema e tabella senza permessi per `anon` e `authenticated`.
- L'identità Postgres proprietaria ha il permesso di inserimento. La
  `service_role` non ha un grant SELECT su questa tabella; non usare la
  chiave `service_role` per accedere alla coda attraverso la Data API.

**La migrazione non è stata applicata a DEMOS in produzione.** Una query
separata di sola lettura ha confermato l'assenza di `demos_private` nel
progetto di produzione.

## Controlli eseguiti nello staging reale

| Controllo | Risultato |
| --- | --- |
| RLS attiva | Superato |
| `anon` senza USAGE sullo schema e SELECT sulla tabella | Superato |
| `authenticated` senza USAGE sullo schema e INSERT sulla tabella | Superato |
| Indici e vincoli PostgreSQL creati | Superato |
| INSERT di evento audit sintetico con UUID | Superato |
| Claim SQL con `FOR UPDATE SKIP LOCKED` e lease | Superato |
| Simulazione HTTP fallito: ritorno in `pending` | Superato |
| Secondo claim: `attempt_count=2` e ID invariato | Superato |
| Tentativo di DELETE con vecchio lease: zero righe cancellate | Superato |
| DELETE con lease corrente: una riga cancellata | Superato |
| Evento security sintetico al tentativo 8: `dead_letter` | Superato |
| `dead_letter` escluso dall'insieme dovuto al retry | Superato |
| Rimozione dei **soli due eventi sintetici** | Superato |
| Righe nella tabella alla fine | **0** |

I claim e le transizioni sono stati eseguiti direttamente tramite query SQL
nel nuovo progetto, usando lo stesso schema di query del codice applicativo.
**Non** sono state eseguite chiamate HTTP a un dataset Axiom reale, notifiche
FCM o un'app DEMOS deployata sullo staging. L'invio "fallito" e la conferma
sono simulazioni esplicite, non richieste HTTP a provider.

La concorrenza effettiva tra due connessioni è stata testata separatamente
nella pipeline GitHub Actions usando PostgreSQL 17 temporaneo. Va ancora
eseguita con le credenziali del ruolo backend e la configurazione completa
Supabase di staging.

## Advisor Supabase

- **Security advisor:** un avviso informativo `rls_enabled_no_policy`
  per `demos_private.audit_delivery_outbox`. È **intenzionale**: la tabella
  è privata e non deve essere leggibile tramite client pubblici.
  Documentazione: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- **Performance advisor:** nessuna segnalazione al momento della verifica.

Non aggiungere una policy RLS permissiva per rimuovere l'avviso informativo.

## Bloccanti prima di abilitare la coda su DEMOS

1. Confermare con il titolare/DPO, ove presente, finalità, campi ammessi,
   retention `pending`/`dead_letter` e trattamento incidenti; vedi
   `AUDIT_OUTBOX_RETENTION_PROPOSAL_2026-10-21.md`.
2. Eseguire un test applicativo end-to-end in staging con un backend
   isolato, credenziali Postgres limitate, Axiom/dataset di prova e
   destinatari admin sintetici. Non collegare il backend di produzione a
   `Demos-Staging`.
3. Verificare esplicitamente le impostazioni Data API e grants del ruolo
   effettivamente usato dall'applicazione; eseguire un test con le credenziali
   backend isolate, senza stampare password o token.
4. Verificare l'ACK Axiom, l'eventuale consegna duplicata, la notifica
   amministrativa, e il comportamento in caso di ripartenza/fallimento DB.
5. Svolgere un recupero **di sola lettura** di B2 usando credenziali
   autorizzate, senza duplicare il job d'archivio di produzione.
6. Soltanto dopo le verifiche e la policy approvata: valutare una migrazione
   separata e un'attivazione progressiva su DEMOS con rollback.

**Stato finale:** staging con solo schema vuoto; nessun worker collegato;
nessun flag di outbox attivato; produzione intatta.
