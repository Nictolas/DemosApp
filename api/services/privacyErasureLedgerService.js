const crypto = require('crypto');
const {normalizeLedgerTimestamp} = require('./privacyLedgerTimestamp');

class PrivacyErasureLedgerService {
  static EVENT_TYPES = Object.freeze({
    ACCOUNT_DELETED: 'account_deleted',
    POLITICAL_CONSENT_REVOKED: 'political_consent_revoked',
    POLITICAL_CONSENT_GRANTED: 'political_consent_granted'
  });

  // Never silently fall back to the legacy non-outbox write path because of
  // a typo in a GDPR durability flag. Only an absent flag or explicit 'false'
  // opts out; an unexpected configured value fails before database I/O.
  static outboxEnabled() {
    const mode = process.env.GDPR_ERASURE_OUTBOX_ENABLED;
    if (mode !== undefined && mode !== 'false' && mode !== 'true') {
      throw Error('Invalid GDPR erasure outbox mode');
    }
    return mode === 'true';
  }

  static async ensureTable(client) {
    // Explicit maintenance/legacy-bootstrap helper. CREATE + RLS + REVOKE
    // must be in ONE PostgreSQL command, so an exposed table never commits.
    // Do NOT invoke provisioning on a live user-facing request.
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.privacy_erasure_ledger (
        event_key TEXT PRIMARY KEY,
        subject_user_id TEXT NOT NULL,
        event_type TEXT NOT NULL CHECK (event_type IN (
          'account_deleted',
          'political_consent_revoked',
          'political_consent_granted'
        )),
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        details JSONB NOT NULL DEFAULT '{}'::jsonb
      );
      -- Provision the GDPR ledger as a single transactional block: the table
      -- must never commit in public without RLS and restricted API grants.
      ALTER TABLE public.privacy_erasure_ledger ENABLE ROW LEVEL SECURITY;
      REVOKE ALL ON TABLE public.privacy_erasure_ledger FROM PUBLIC;
      DO $gdpr_ledger_privileges$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='anon') THEN
          REVOKE ALL ON TABLE public.privacy_erasure_ledger FROM anon;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='authenticated') THEN
          REVOKE ALL ON TABLE public.privacy_erasure_ledger FROM authenticated;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='service_role') THEN
          REVOKE ALL ON TABLE public.privacy_erasure_ledger FROM service_role;
        END IF;
      END
      $gdpr_ledger_privileges$;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_privacy_erasure_ledger_subject_time
      ON public.privacy_erasure_ledger(subject_user_id, occurred_at DESC)
    `);
  }

  static async ensureDeliveryOutbox(client) {
    // This table must be installed intentionally by the operator before
    // turning on the feature. IF NOT EXISTS supports synthetic CI bootstrap;
    // it does NOT replace explicit schema migration and permission review.
    // The CREATE + RLS + REVOKE statements below MUST be one SQL request:
    // no auto-commit window may expose this table through Supabase Data API.
    // The operator must still isolate providers before running this DDL.
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.privacy_erasure_delivery_outbox (
        event_key TEXT PRIMARY KEY REFERENCES public.privacy_erasure_ledger(event_key) ON DELETE RESTRICT,
        queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        delivered_at TIMESTAMPTZ,
        b2_version_id TEXT,
        b2_sha256 CHAR(64),
        CHECK (
          (delivered_at IS NULL AND b2_version_id IS NULL AND b2_sha256 IS NULL)
          OR (delivered_at IS NOT NULL AND b2_version_id IS NOT NULL AND b2_sha256 IS NOT NULL)
        )
      );
      -- PostgreSQL executes this batch as one implicit transaction when
      -- no explicit BEGIN is open. Never expose a just-created public table
      -- before RLS and API role grants are locked down.
      ALTER TABLE public.privacy_erasure_delivery_outbox ENABLE ROW LEVEL SECURITY;
      REVOKE ALL ON TABLE public.privacy_erasure_delivery_outbox FROM PUBLIC;
      DO $gdpr_outbox_privileges$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='anon') THEN
          REVOKE ALL ON TABLE public.privacy_erasure_delivery_outbox FROM anon;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='authenticated') THEN
          REVOKE ALL ON TABLE public.privacy_erasure_delivery_outbox FROM authenticated;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='service_role') THEN
          REVOKE ALL ON TABLE public.privacy_erasure_delivery_outbox FROM service_role;
        END IF;
      END
      $gdpr_outbox_privileges$;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_privacy_erasure_outbox_pending
      ON public.privacy_erasure_delivery_outbox (queued_at, event_key)
      WHERE delivered_at IS NULL
    `);
  }

  static async backfillDeliveryOutbox(client, { maintenanceConfirmed = false } = {}) {
    if (maintenanceConfirmed !== true || !this.outboxEnabled()) {
      throw Error('GDPR ledger outbox backfill requires approved maintenance');
    }
    // Must run only after ALL ingress and workers are quiesced.
    // The database copy alone cannot prove that freeze.
    await this.ensureTable(client);
    await this.ensureDeliveryOutbox(client);
    const result = await client.query(`
      INSERT INTO public.privacy_erasure_delivery_outbox (event_key)
      SELECT event_key FROM public.privacy_erasure_ledger
      ON CONFLICT (event_key) DO NOTHING
    `);
    return result.rowCount || 0;
  }

  static async assertProtectedLedger(client) {
    // This check only inspects pg_catalog; it never reads GDPR event rows.
    // regclass resolution raises 42P01 if a restore omitted the ledger.
    // A restored table that exists but lacks RLS or has API/public grants
    // must not silently accept a new sensitive GDPR event.
    const result = await client.query(`
      SELECT c.relrowsecurity AS rls_enabled,
        EXISTS (
          SELECT 1
          FROM pg_catalog.aclexplode(
            COALESCE(c.relacl, pg_catalog.acldefault('r', c.relowner))
          ) acl WHERE acl.grantee = 0
        ) AS public_grants_exist,
        EXISTS (
          SELECT 1
          FROM pg_catalog.pg_attribute a
          CROSS JOIN LATERAL pg_catalog.aclexplode(a.attacl) acl
          WHERE a.attrelid = c.oid
            AND a.attnum > 0
            AND NOT a.attisdropped
            AND acl.grantee = 0
        ) AS public_column_grants_exist,
        (
          SELECT COUNT(*)::integer
          FROM pg_catalog.pg_roles r
          WHERE r.rolname IN ('anon', 'authenticated', 'service_role')
            AND (
              pg_catalog.has_any_column_privilege(r.rolname, c.oid, 'SELECT') OR
              pg_catalog.has_any_column_privilege(r.rolname, c.oid, 'INSERT') OR
              pg_catalog.has_any_column_privilege(r.rolname, c.oid, 'UPDATE') OR
              pg_catalog.has_table_privilege(r.rolname, c.oid, 'DELETE')
            )
        ) AS api_roles_with_dml_grants
      FROM pg_catalog.pg_class c
      WHERE c.oid = 'public.privacy_erasure_ledger'::regclass
    `);
    const state = result.rows?.[0];
    if (state?.rls_enabled !== true ||
        state?.public_grants_exist !== false ||
        state?.public_column_grants_exist !== false ||
        state?.api_roles_with_dml_grants !== 0) {
      const error = new Error('GDPR_LEDGER_SCHEMA_NOT_PROTECTED');
      error.code = 'GDPR_LEDGER_SCHEMA_NOT_PROTECTED';
      throw error;
    }
  }

  static async recordEvent(client, { userId, eventType, details = {} }) {
    if (!Object.values(this.EVENT_TYPES).includes(eventType)) {
      throw new Error(`Unsupported privacy ledger event: ${eventType}`);
    }
    if (userId == null || String(userId).trim() === '') {
      throw new Error('Privacy ledger event requires userId');
    }

    const outboxEnabled = this.outboxEnabled();

    // Never execute DDL from ANY user-facing GDPR request, including legacy.
    // Both modes require intentional pre-installation. A missing table fails
    // closed instead of creating an exposed public relation in the middle of
    // an account deletion or consent revocation.
    const eventKey = crypto.randomUUID();
    const subjectUserId = String(userId);
    const detailsJson = JSON.stringify(details);
    if (outboxEnabled) {
      // Validate the EXACT JSON value being sent to PostgreSQL, not the
      // original JS object. Dates, inherited/non-enumerable toJSON methods
      // and stateful serializers can produce different JSON on a second
      // traversal, bypassing the 8192-byte immutable B2 archive limit.
      // Serialize once, then preflight the parsed, immutable-in-practice
      // snapshot that is also used as the SQL parameter.
      if (typeof detailsJson !== 'string') {
        throw Error('Invalid GDPR outbox JSON details');
      }
      const { normalizeEvent } = require('./privacyErasureB2Journal');
      normalizeEvent({
        event_key: eventKey, subject_user_id: subjectUserId, event_type: eventType,
        // NOW() has the same canonical ISO timestamp length.
        occurred_at: '2000-01-01T00:00:00.000Z',
        details: JSON.parse(detailsJson)
      });
    }
    // Validate the B2 payload first without ANY SQL. Reuse #366's
    // read-only RLS/ACL preflight in BOTH modes after that local validation,
    // but before the first ledger or outbox INSERT.
    await this.assertProtectedLedger(client);
    const params = [eventKey, subjectUserId, eventType, detailsJson];
    if (outboxEnabled) {
      // NO automatic DDL on a live revocation/deletion request. This fails
      // closed if the schema was not deliberately provisioned and backfilled
      // during an approved maintenance window.
      // ONE PostgreSQL statement makes event + pending-delivery durable
      // atomically even if the caller forgot to open an explicit transaction.
      // In a surrounding consent/account transaction both roll back together.
      const atomic = await client.query(`
        WITH event_insert AS (
          INSERT INTO public.privacy_erasure_ledger
            (event_key, subject_user_id, event_type, occurred_at, details)
          VALUES ($1, $2, $3, NOW(), $4::jsonb)
          RETURNING event_key, subject_user_id, event_type, occurred_at, details
        ),
        delivery_insert AS (
          INSERT INTO public.privacy_erasure_delivery_outbox (event_key)
          SELECT event_key FROM event_insert
          RETURNING event_key
        )
        SELECT e.* FROM event_insert e
        JOIN delivery_insert d ON d.event_key = e.event_key
      `, params);
      if (atomic.rows.length !== 1) {
        throw Error('GDPR ledger event was not queued atomically');
      }
      return atomic.rows[0];
    }
    const result = await client.query(
      `INSERT INTO public.privacy_erasure_ledger
        (event_key, subject_user_id, event_type, occurred_at, details)
       VALUES ($1, $2, $3, NOW(), $4::jsonb)
       RETURNING event_key, subject_user_id, event_type, occurred_at, details`,
      params
    );
    return result.rows[0];
  }

  static async captureCurrent(client) {
    // Capturing recovery evidence must never bootstrap a missing ledger.
    await this.assertProtectedLedger(client);
    const result = await client.query(`
      SELECT event_key, subject_user_id, event_type,
        to_char(occurred_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS occurred_at, details
      FROM public.privacy_erasure_ledger
      ORDER BY occurred_at ASC, event_key ASC
    `);
    return result.rows;
  }

  static async mergeCaptured(client, rows = [], { requirePreinstalled = false } = {}) {
    // Preflight every row before the FIRST SQL statement: a malformed later
    // event must not leave earlier writes in a direct caller that forgot BEGIN.
    // This complements, but cannot replace, the signed recovery transaction.
    const invalid = () => {
      const error = new Error('GDPR_LEDGER_INVALID_CAPTURED_EVENT');
      error.code = 'GDPR_LEDGER_INVALID_CAPTURED_EVENT';
      return error;
    };
    if (!Array.isArray(rows)) throw invalid();
    const prepared = [];
    const seenKeys = new Set();
    for (const row of rows) {
      if (!row || typeof row !== 'object' ||
          typeof row.event_key !== 'string' || !row.event_key.trim() ||
          typeof row.subject_user_id !== 'string' || !row.subject_user_id.trim() ||
          !Object.values(this.EVENT_TYPES).includes(row.event_type) ||
          seenKeys.has(row.event_key)) throw invalid();
      let timestamp, details;
      try {
        // JS Date drops PostgreSQL microseconds: require validated UTC text.
        timestamp = normalizeLedgerTimestamp(row.occurred_at);
        // Snapshot a custom toJSON exactly once. B2 accepts only a JSON object.
        // Do not turn missing/null JSONB into a valid-looking empty archive.
        details = JSON.stringify(row.details);
        const parsed = JSON.parse(details);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw invalid();
        }
      } catch (_) { throw invalid(); }
      seenKeys.add(row.event_key);
      prepared.push([
        row.event_key, row.subject_user_id, row.event_type, timestamp, details
      ]);
    }

    // The offline recovery gate must never silently provision a missing
    // ledger. Keep legacy explicit import behavior for existing callers.
    if (!requirePreinstalled) await this.ensureTable(client);
    // Signed recovery always uses requirePreinstalled and must reject a
    // restored ledger with RLS disabled or unexpected API/PUBLIC grants.
    await this.assertProtectedLedger(client);
    let merged = 0;
    for (const event of prepared) {
      const result = await client.query(
        `INSERT INTO public.privacy_erasure_ledger
          (event_key, subject_user_id, event_type, occurred_at, details)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         ON CONFLICT (event_key) DO NOTHING`,
        event
      );
      if (result.rowCount === 0) {
        // The event UUID is the immutable identity. A conflicting event must
        // never be treated as successful idempotent recovery. In particular,
        // an event with the same key but a different revocation/subject/time
        // must fail closed rather than be silently discarded.
        const existing = await client.query(
          `SELECT (
             subject_user_id = $2::text AND event_type = $3::text
             AND occurred_at = $4::timestamptz AND details = $5::jsonb
           ) AS identical
           FROM public.privacy_erasure_ledger WHERE event_key = $1`,
          event
        );
        if (existing.rows.length !== 1 || existing.rows[0].identical !== true) {
          const error = new Error('GDPR_LEDGER_EVENT_KEY_CONFLICT');
          error.code = 'GDPR_LEDGER_EVENT_KEY_CONFLICT';
          throw error;
        }
      }
      merged += result.rowCount || 0;
    }
    return merged;
  }

  static async tableHasColumn(client, table, column) {
    const result = await client.query(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = $1
           AND column_name = $2
       ) AS exists`,
      [table, column]
    );
    return result.rows[0]?.exists === true;
  }

  static quoteIdentifier(identifier) {
    return `"${String(identifier).replace(/"/g, '""')}"`;
  }

  static async deleteByColumn(client, table, column, userId) {
    if (!(await this.tableHasColumn(client, table, column))) return 0;
    const result = await client.query(
      `DELETE FROM public.${this.quoteIdentifier(table)} WHERE ${this.quoteIdentifier(column)}::text = $1`,
      [String(userId)]
    );
    return result.rowCount || 0;
  }

  static async deleteByAnyColumn(client, table, columns, userId) {
    const uniqueColumns = [...new Set(columns || [])];
    if (uniqueColumns.length === 0) return 0;

    const columnInfo = await client.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND column_name = ANY($2::text[])`,
      [table, uniqueColumns]
    );
    if (columnInfo.rows.length === 0) return 0;

    const conditions = columnInfo.rows
      .map((row) => `${this.quoteIdentifier(row.column_name)}::text = $1`)
      .join(' OR ');
    const result = await client.query(
      `DELETE FROM public.${this.quoteIdentifier(table)} WHERE ${conditions}`,
      [String(userId)]
    );
    return result.rowCount || 0;
  }

  static async deleteByUserId(client, table, userId) {
    return this.deleteByColumn(client, table, 'user_id', userId);
  }

  static async removeUserFromArrayColumn(client, table, column, userId) {
    const columnInfo = await client.query(
      `SELECT udt_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
      [table, column]
    );
    if (columnInfo.rows.length === 0) return 0;

    const udtName = columnInfo.rows[0].udt_name;
    let sql;
    if (udtName === '_uuid') {
      sql = `UPDATE public.${this.quoteIdentifier(table)}
             SET ${this.quoteIdentifier(column)} = array_remove(${this.quoteIdentifier(column)}, $1::uuid)
             WHERE $1::uuid = ANY(${this.quoteIdentifier(column)})`;
    } else if (['_text', '_varchar', '_bpchar'].includes(udtName)) {
      sql = `UPDATE public.${this.quoteIdentifier(table)}
             SET ${this.quoteIdentifier(column)} = array_remove(${this.quoteIdentifier(column)}, $1::text)
             WHERE $1::text = ANY(${this.quoteIdentifier(column)}::text[])`;
    } else {
      return 0;
    }
    const result = await client.query(sql, [String(userId)]);
    return result.rowCount || 0;
  }

  static async cleanupAdditionalAccountData(client, userId) {
    let rowsDeleted = 0;
    let rowsUnlinked = 0;

    // Le superfici storiche DEMOS non usano tutte lo stesso nome per l'ID utente.
    // La cancellazione account deve quindi coprire in modo schema-aware le varianti
    // user_id / userid / utente_id / id_utente senza dipendere da una singola migrazione.
    const accountLinkColumns = ['user_id', 'userid', 'userId', 'utente_id', 'id_utente'];

    const userGeneratedTables = [
      'opinioni_risposte',
      'candidature_elezioni',
      'notifiche',
      'voti_elezioni',
      'voti_capo_stato',
      'voti_ice',
      'voti_referendum_abrogativi',
      'voti_amnistia',
      'voti_grazia',
      'voti_iniziative_popolari',
      'voti_ministri',
      'voti_opinioni_proposte',
      'voti_primo_ministro',
      'voti_difesa',
      'voti_economia',
      'voti_esteri',
      'voti_giustizia',
      'voti_interno',
      'voti_istruzione',
      'voti_lavoro',
      'voti_salute',
      'voti_trasporti',
      'voti_ambiente',
      'voti_ambiente_sicurezza_energetica',
      'voti_cultura',
      'voti_sport',
      'consenso_governo',
      'consenso_capo_stato'
    ];
    for (const table of userGeneratedTables) {
      rowsDeleted += await this.deleteByAnyColumn(client, table, accountLinkColumns, userId);
    }

    // Reazioni create dall'utente.
    rowsDeleted += await this.deleteByColumn(client, 'reazioni', 'utente_id', userId);

    // Reazioni ricevute dalle comunicazioni dell'utente, prima di cancellare le comunicazioni.
    if (
      await this.tableHasColumn(client, 'reazioni', 'comunicazione_id') &&
      await this.tableHasColumn(client, 'comunicazioni', 'id') &&
      await this.tableHasColumn(client, 'comunicazioni', 'id_utente')
    ) {
      const result = await client.query(
        `DELETE FROM public.reazioni
         WHERE comunicazione_id::text IN (
           SELECT id::text FROM public.comunicazioni WHERE id_utente::text = $1
         )`,
        [String(userId)]
      );
      rowsDeleted += result.rowCount || 0;
    }

    rowsDeleted += await this.deleteByColumn(client, 'comunicazioni', 'id_utente', userId);

    // Rimuove l'identificativo dell'utente dagli elenchi di lettura di comunicazioni altrui.
    rowsUnlinked += await this.removeUserFromArrayColumn(client, 'comunicazioni', 'read_by', userId);

    // Relazioni sociali in entrambe le direzioni.
    rowsDeleted += await this.deleteByColumn(client, 'sostenitori', 'utente_id', userId);
    rowsDeleted += await this.deleteByColumn(client, 'sostenitori', 'sostenuto_id', userId);

    // Altri record applicativi direttamente riconducibili all'account.
    const directLinks = [
      ['notifiche_demos', 'id_utente'],
      ['notifiche_comunali', 'id_utente'],
      ['programmi', 'utente_id'],
      ['user_devices', 'user_id'],
      ['user_notifications', 'user_id'],
      ['notifiche_preferenze', 'user_id'],
      ['preference_change_cooldowns', 'user_id'],
      ['political_opinion_notifications', 'recipient_user_id'],
      ['political_opinion_notifications', 'subject_user_id'],
      // Account-owned canonical/legacy political preferences must not remain
      // as orphaned rows when older schemas lack ON DELETE CASCADE.
      ['user_representatives', 'user_id'],
      ['user_consents', 'user_id'],
      ['political_selections', 'user_id'],
      ['political_selections', 'selected_user_id'],
      ['user_political_territories', 'user_id'],
      ['user_electoral_unit_memberships', 'user_id'],
      ['riconoscimenti', 'user_id'],
      ['user_auth_providers', 'user_id']
    ];
    for (const [table, column] of directLinks) {
      rowsDeleted += await this.deleteByColumn(client, table, column, userId);
    }

    return { rowsDeleted, rowsUnlinked };
  }

  static async enforceAccountDeletion(client, userId) {
    const additional = await this.cleanupAdditionalAccountData(client, userId);
    let dependentDeleted = additional.rowsDeleted;

    // Policy RP-05: una persona puo registrarsi di nuovo dopo avere cancellato
    // volontariamente l'account. La chiave CIE pseudonima anti-duplicazione serve
    // solo mentre esiste un account e viene quindi eliminata insieme all'account.
    dependentDeleted += await this.deleteByAnyColumn(
      client,
      'identity_verifications',
      ['user_id'],
      userId
    );

    let userDeleted = 0;
    if (await this.tableHasColumn(client, 'users', 'id')) {
      const result = await client.query('DELETE FROM public.users WHERE id::text = $1', [String(userId)]);
      userDeleted = result.rowCount || 0;
    }

    return { userDeleted, dependentDeleted, rowsUnlinked: additional.rowsUnlinked };
  }

  static async enforcePoliticalRevocation(client, userId) {
    // Restore/backup reconciliation must enforce exactly the same erasure
    // scope as the live consent-revocation transaction. Import lazily because
    // politicalConsentService depends on this ledger's schema helpers.
    const { cleanupConsentScopedPoliticalData } = require('./politicalConsentService');
    const cleanup = await cleanupConsentScopedPoliticalData(client, userId);

    const userConsentColumns = [
      'political_opinions_consent',
      'political_opinions_consent_timestamp',
      'political_opinions_consent_ip_address',
      'political_opinions_consent_user_agent'
    ];
    const userHasConsent = await Promise.all(
      userConsentColumns.map((column) => this.tableHasColumn(client, 'users', column))
    );
    if (userHasConsent.every(Boolean)) {
      await client.query(
        `UPDATE public.users SET
           political_opinions_consent = false,
           political_opinions_consent_timestamp = NULL,
           political_opinions_consent_ip_address = NULL,
           political_opinions_consent_user_agent = NULL,
           updated_at = NOW()
         WHERE id::text = $1`,
        [String(userId)]
      );
    }

    const consentHasUserId = await this.tableHasColumn(client, 'user_consents', 'user_id');
    const consentHasFlag = await this.tableHasColumn(client, 'user_consents', 'political_opinions_consent');
    if (consentHasUserId && consentHasFlag) {
      await client.query(
        `UPDATE public.user_consents SET
           political_opinions_consent = false,
           political_opinions_consent_timestamp = NULL,
           political_opinions_consent_ip_address = NULL,
           political_opinions_consent_user_agent = NULL,
           updated_at = NOW()
         WHERE user_id::text = $1`,
        [String(userId)]
      );
    }

    return { opinionsDeleted: cleanup.deletedByTable.opinioni_risposte || 0,
      totalDeleted: cleanup.totalDeleted,
      legacySelectionsCleared: cleanup.legacySelectionsCleared };
  }

  static async assertReplayCoreSchema(client) {
    // A partial/old restore must never be reported as a successful replay
    // merely because schema-aware deletion helpers skip missing relations.
    // Inspect only catalog metadata; do not read user rows.
    const result = await client.query(`
      SELECT NOT EXISTS (
        SELECT 1
        FROM (VALUES
          ('users', 'id'),
          ('users', 'political_opinions_consent'),
          ('users', 'political_opinions_consent_timestamp'),
          ('users', 'political_opinions_consent_ip_address'),
          ('users', 'political_opinions_consent_user_agent'),
          ('users', 'updated_at'),
          ('opinioni_risposte', 'user_id'),
          ('user_consents', 'user_id'),
          ('user_consents', 'political_opinions_consent'),
          ('user_consents', 'political_opinions_consent_timestamp'),
          ('user_consents', 'political_opinions_consent_ip_address'),
          ('user_consents', 'political_opinions_consent_user_agent'),
          ('user_consents', 'updated_at')
        ) AS required(table_name, column_name)
        WHERE NOT EXISTS (
          SELECT 1
          FROM pg_catalog.pg_class c
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
          WHERE n.nspname = 'public'
            AND c.relname = required.table_name
            AND c.relkind IN ('r', 'p')
            AND a.attname = required.column_name
            AND a.attnum > 0
            AND NOT a.attisdropped
        )
      ) AS complete
    `);
    if (result.rows?.[0]?.complete !== true) {
      const error = new Error('GDPR_REPLAY_SCHEMA_INCOMPLETE');
      error.code = 'GDPR_REPLAY_SCHEMA_INCOMPLETE';
      throw error;
    }
  }

  static async applyCurrentPrivacyState(client, { requirePreinstalled = false } = {}) {
    // The signed offline recovery path verifies the schema before replay.
    // Do not run implicit CREATE TABLE/INDEX inside that transaction.
    if (!requirePreinstalled) await this.ensureTable(client);
    await this.assertProtectedLedger(client);
    // Direct callers must also refuse partial restored core tables before DML.
    // Optional legacy relations remain schema-aware in cleanup helpers.
    await this.assertReplayCoreSchema(client);

    // Exact PostgreSQL microseconds are the authoritative event order.
    // DISTINCT grant/revocation times inside one millisecond are ordered,
    // whereas a true timestamp tie has no trustworthy causal sequence.
    // Fail closed on ties BEFORE any cleanup; never order random UUIDs.
    const ambiguousConsent = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM public.privacy_erasure_ledger
        WHERE event_type IN ('political_consent_revoked', 'political_consent_granted')
        GROUP BY subject_user_id, occurred_at
        HAVING COUNT(DISTINCT event_type) > 1
      ) AS present
    `);
    if (ambiguousConsent.rows?.[0]?.present !== false) {
      const error = new Error('Ambiguous simultaneous GDPR consent grant and revocation in ledger');
      error.code = 'GDPR_LEDGER_AMBIGUOUS_CONSENT_ORDER';
      throw error;
    }

    const accountEvents = await client.query(`
      SELECT DISTINCT subject_user_id
      FROM public.privacy_erasure_ledger
      WHERE event_type = 'account_deleted'
    `);

    let accountsRemoved = 0;
    let dependentRowsRemoved = 0;
    for (const row of accountEvents.rows) {
      const result = await this.enforceAccountDeletion(client, row.subject_user_id);
      accountsRemoved += result.userDeleted;
      dependentRowsRemoved += result.dependentDeleted;
    }

    const consentStates = await client.query(`
      SELECT DISTINCT ON (subject_user_id)
        subject_user_id, event_type, occurred_at
      FROM public.privacy_erasure_ledger
      WHERE event_type IN ('political_consent_revoked', 'political_consent_granted')
      ORDER BY subject_user_id, occurred_at DESC, event_key DESC
    `);

    let revocationsReapplied = 0;
    let opinionsRemoved = 0;
    for (const row of consentStates.rows) {
      if (row.event_type !== this.EVENT_TYPES.POLITICAL_CONSENT_REVOKED) continue;
      const result = await this.enforcePoliticalRevocation(client, row.subject_user_id);
      revocationsReapplied += 1;
      opinionsRemoved += result.opinionsDeleted;
    }

    return {
      accountsRemoved,
      dependentRowsRemoved,
      revocationsReapplied,
      opinionsRemoved
    };
  }
}

module.exports = PrivacyErasureLedgerService;
