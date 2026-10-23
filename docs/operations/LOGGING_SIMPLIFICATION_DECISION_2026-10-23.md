# DEMOS — architettura di logging semplificata (proposta, 23/10/2026)

## Perché questo piano
La disciplina GDPR non richiede una copia indiscriminata di tutti i log in Axiom/B2; è necessario distinguere sicurezza, diagnostica, obblighi eventualmente applicabili agli amministratori di sistema e minimizzazione. L'eccezione per il titolare-unico AdS non si dimostra contando gli Admin applicativi di DEMOS. Rivedere l'inquadramento degli accessi tecnici (inclusi i provider) con il DPO, senza presumere esenzioni.

## Stato accertato al checkpoint CP-EA-092
- Axiom **centralized_logs**: retention **30 giorni**, screenshot 23/10/2026.
- Axiom **real-time**: retention **30 giorni**, screenshot 23/10/2026.
- **axiom-audit**: 30 giorni, ma NON è automaticamente la sorgente effettiva dell'audit applicativo (default dell'API: real-time).
- **demos-security-staging**: 7 giorni, **non è prova di una policy di produzione**.
- Backblaze bucket **demos-log-archive-eu** privato, encryption abilitata, lifecycle **Keep all versions**: nessuna scadenza automatica alle copie; 2.408 file per circa 1,7 MB al 23/10.
- Job Axiom→B2 copia file `technical`, `audit`, `security` da dataset `centralized_logs` e `real-time`, produce manifest e checkpoint. Restore read-only passato (CP-EA-057).
- PR #218 outbox resta **draft e NO-GO produzione**; non finalizzare soltanto perché è stata implementata.
- RP-09, RP-10, RP-17 **NON approvate**; nessuna regola lifecycle B2 è stata impostata.

## Scelta minima raccomandata (soggetta al parere del DPO)
1. **Log tecnici**: tenere diagnostica minimizzata su Axiom, retention attuale 30 giorni mentre si verifica se ancora necessaria. I path identificanti e i testi di errore liberi vengono sostituiti in PR #243 con categoria API e codici controllati. Il GDPR non impone il logging automatico di ogni lettura/operazione.
2. **Audit e sicurezza**: tenere solo eventi selezionati con finalità definita, per rilevare accessi abusivi e ricostruire incidenti. Non confondere con il tracciamento di tutte le opinioni o votazioni; questi dati potrebbero essere particolarmente sensibili.
3. **B2**: valutare di non archiviare più *nuovi* log `technical` quando il DPO confermerà che Axiom 30gg è sufficiente, mantenendo se necessario un archivio mirato di eventi `audit`/`security`. Questo **non** risolve la conservazione dei file già presenti e dei manifest/checkpoint: occorre una policy per versioni, prefissi e metadati. Non cambiare prima di analisi di impatto sulle prove.
4. **Accessi AdS**: chiarire chi è effettivamente AdS e se si applica il provvedimento Garante, inclusi privilegi infrastrutturali e provider. Se applicabile, occorre un sistema adeguato per gli **accessi** AdS, non tutti i log Axiom; effettuare gap analysis dell'origine, integrità, protezione, durata, e verifica periodica.
5. **PR #218**: raccomandazione **NON procedere ora** a worker/outbox in produzione. Per un'eventuale ripresa documentare eventi critici per cui il recapito affidabile sia indispensabile e la policy RP-17.

## Rischio e prerequisiti del cambio B2
B2 con `Keep all versions` conserva indefinitamente gli oggetti se non interviene cancellazione/lifecycle. Per file di archivio con nomi unici, `Keep prior versions N days` NON costituisce una retention sufficiente dei file correnti. Qualsiasi lifecycle automatico può rendere i dati indisponibili irreversibilmente. Richiedere parere DPO + decisione titolare esplicita e verifica non distruttiva dei prefissi `data/technical`, `data/audit`, `data/security`, `manifests`, `control`. Eseguire un piano rollback possibile prima di attivare, senza interpretare Keep all versions come prova GDPR.

## Azioni effettivamente eseguite nel ramo della PR #243
- Trattamento **prospettico**: i log HTTP tecnici emettono gruppo API anziché URL contenenti ID, email, query, slug e preferenze politiche; eventuali URL non riconosciuti sono classificati genericamente.
- I log d'errore ordinari usano codici diagnostici controllati, non message/stack arbitrari; audit/security espliciti restano separati.
- Commenti che descrivevano il logging indiscriminato come obbligatorio per il GDPR corretti, **senza disattivare un controllo di sicurezza**.
- Nessuna modifica ad archiviazione, retention, token, DB, ruoli, log già archiviati. La richiesta di valutazione DPO è registrata nella matrice Google Sheet Privacy: `Log - matrice DPO`.

## Decisioni pendenti da compilare
- DPO: parere per ogni categoria della matrice (necessità, minimizzazione, dati identificativi, durata, log AdS se applicabile).
- Titolare: decisione distinta sui log necessari, eventuale sospensione prospettica delle copie B2 `technical`, lifecycle dei dati storici e PR #218.
- Verifica retention Render e Supabase account-specific, ancora non attestata.

**Questo documento è una proposta tecnica e non è un parere legale né un'attestazione di conformità.**
