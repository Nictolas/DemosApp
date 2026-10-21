# DEMOS — outbox durevole per audit e sicurezza (proposta, 21/10/2026)

**Stato: implementazione parziale su ramo separato, NON attivata in produzione.**
La PR #217 ha migliorato il controllo dell'esito HTTP di Axiom, ma un evento critico
può andare perduto se Axiom è indisponibile. L'archivio storico B2 non può
recuperare eventi mai ricevuti da Axiom. Serve una coda *prima* dell'invio.

## Componente già preparato

`api/services/auditOutboxService.js` implementa, ma non attiva:
- `enqueue(event, dataset)`: convalida categoria `audit` o `security`, limita il
  payload a 2 KiB, assegna UUID stabile `axiom_delivery_id` e attende conferma
  di `INSERT` sul database. Se la scrittura fallisce non simula il successo.
- `drainOnce()`: acquisisce al massimo 50 eventi dovuti usando
  `FOR UPDATE SKIP LOCKED`, *lease* di 90 s e token di proprietà per lavoratori
  concorrenti. Cancella il record solo quando il trasporto conferma realmente
  l'invio. Altrimenti aggiorna scadenza e prossimo tentativo.
- Backoff esponenziale con jitter, massimo un'ora più jitter; dopo otto
  tentativi porta l'evento in `dead_letter` e produce una segnalazione priva
  di identificatori personali.
- Nessun avvio automatico, query su dati personali, invio Axiom, cambio
  retention o modifica al database di produzione.

**Garanzia prevista: at-least-once**, non exactly-once. Se Axiom riceve l'evento
ma il processo cade prima del DELETE, al riavvio l'evento può essere ritrasmesso.
L'UUID `axiom_delivery_id` è stabile per consentire la deduplicazione a valle;
l'archivio/ricerca deve verificarne esplicitamente la gestione.

## Schema PostgreSQL proposto (NON applicato)

Utilizzare lo schema privato `demos_private`, escluso dagli schemi esposti
nel Supabase Data API. Lo schema seguente serve per revisione; **non è una
migrazione automaticamente applicabile**:

```sql
CREATE SCHEMA IF NOT EXISTS demos_private;
REVOKE ALL ON SCHEMA demos_private FROM PUBLIC, anon, authenticated;

CREATE TABLE demos_private.audit_delivery_outbox (
  id UUID PRIMARY KEY,
  dataset VARCHAR(96) NOT NULL
    CHECK (dataset ~ '^[A-Za-z0-9_-]{1,96}$'),
  category VARCHAR(8) NOT NULL
    CHECK (category IN ('audit', 'security')),
  payload JSONB NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'dead_letter')),
  attempt_count INTEGER NOT NULL DEFAULT 0
    CHECK (attempt_count BETWEEN 0 AND 100),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lease_id UUID,
  lease_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX audit_delivery_outbox_due
ON demos_private.audit_delivery_outbox (next_attempt_at, created_at)
WHERE status IN ('pending', 'sending');

REVOKE ALL ON demos_private.audit_delivery_outbox FROM PUBLIC, anon, authenticated;
```

La tabella deve essere visibile **solo** all'identità Postgres usata dal
backend (privilegi dedicati da definire prima dell'attivazione), non alle
chiavi `anon`/`authenticated`; verificare RLS e Data API con query di controllo.
Non è necessaria una nuova istanza database: la tabella può vivere nello
stesso Supabase di DEMOS, con un limite di dimensione e monitoraggio dei costi.

## Da completare prima dell'attivazione

1. Revisionare schema e impatto GDPR (finalità, IP/user ID, cifratura, accessi,
   periodi di conservazione degli eventi non consegnati e `dead_letter`).
2. Eseguire una migrazione **solo in staging** e verificare accessi, RLS,
   indici, concorrenza e isolamento dal Data API.
3. Collegare il metodo `AuditService.logAction()` all'accodamento con un
   flag esplicito disattivato di default. L'acknowledgement dovrà significare
   *evento persistito*, non necessariamente già consegnato ad Axiom.
4. Definire il trasporto Axiom per eventi già minimizzati, con gestione
   degli errori; aggiungere un worker con timer indipendente e avvio
   protetto da flag, senza sovrapporlo al job Axiom → B2 esistente.
5. Mettere un limite massimo ai record in coda, segnalazioni indipendenti
   da Axiom e metriche **senza PII**: profondità, ritardo, tentativi,
   dead-letter, indisponibilità del database.
6. Testare in staging Axiom non disponibile, riavvio, lease scaduto,
   doppio worker, duplicazioni, dead-letter e recupero completo.
7. Soltanto dopo queste verifiche, valutare rollout graduale su Render.

## Test locali del componente

```bash
cd api
node --test tests/auditOutboxService.test.js
```

I test mock non equivalgono a un'esecuzione SQL vera. La prova indipendente di
recupero B2 resta un'altra attività: `archive:axiom:verify-latest` è presente
in `main` ma richiede un ambiente autorizzato con credenziali **di lettura**
sul bucket reale, che non sono risultate disponibili nella copia di sviluppo
locale controllata tramite DeskMCP.
