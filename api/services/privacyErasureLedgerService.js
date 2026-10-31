const crypto = require('crypto');

class PrivacyErasureLedgerService {
  static EVENT_TYPES = Object.freeze({
    ACCOUNT_DELETED: 'account_deleted',
    POLITICAL_CONSENT_REVOKED: 'political_consent_revoked',
    POLITICAL_CONSENT_GRANTED: 'political_consent_granted'
  });

  // Optional. The default is OFF. Never auto-enable B2 or worker processing.
  static outboxEnabled() {
    const mode = process.env.GDPR_ERASURE_OUTBOX_ENABLED;
    if (mode !== undefined && mode !== 'false' && mode !== 'true') {
      const error = new Error('GDPR_ERASURE_OUTBOX_INVALID_MODE');
      error.code = 'GDPR_ERASURE_OUTBOX_INVALID_MODE';
      throw error;
    }
    return mode === 'true';
  }

  static async ensureTable(client) {
    // OPERATOR-ONLY bootstrap/maintenance. PostgreSQL commits the entire
    // multi-statement query atomically: never commit a public relation before
    // RLS and revocation of PostgREST API-role grants are applied.
    // Never invoke this helper from a user-facing GDPR transaction.
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
      ALTER TABLE public.privacy_erasure_ledger ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.privacy_erasure_ledger FORCE ROW LEVEL SECURITY;
      REVOKE ALL ON TABLE public.privacy_erasure_ledger FROM PUBLIC;
      DO $gdpr_ledger_privileges$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
          REVOKE ALL ON TABLE public.privacy_erasure_ledger FROM anon;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
          REVOKE ALL ON TABLE public.privacy_erasure_ledger FROM authenticated;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
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
      ALTER TABLE public.privacy_erasure_delivery_outbox FORCE ROW LEVEL SECURITY;
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

  static async assertProtectedLedger(client) {
    // This check only inspects pg_catalog; it never reads GDPR event rows.
    // regclass resolution raises 42P01 if a restore omitted the ledger.
    // Reject restored ledger without FORCE RLS, mirroring the outbox guard.
    // Provider administrators with BYPASSRLS remain outside this check.
    const result = await client.query(`
      SELECT c.relrowsecurity AS rls_enabled,
        c.relforcerowsecurity AS force_rls,
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
    if (state?.rls_enabled !== true || state?.force_rls !== true ||
        state?.public_grants_exist !== false ||
        state?.public_column_grants_exist !== false ||
        state?.api_roles_with_dml_grants !== 0) {
      const error = new Error('GDPR_LEDGER_SCHEMA_NOT_PROTECTED');
      error.code = 'GDPR_LEDGER_SCHEMA_NOT_PROTECTED';
      throw error;
    }
  }

  static async assertProtectedOutbox(client) {
    // This check only inspects pg_catalog; it never reads outbox rows.
    // regclass resolution raises 42P01 if a restore omitted the ledger.
    // A restored table that exists but lacks RLS or has API/public grants
    // must not silently accept a new sensitive GDPR event.
    const result = await client.query(`
      SELECT c.relrowsecurity AS rls_enabled,
        c.relforcerowsecurity AS force_rls,
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
      WHERE c.oid = 'public.privacy_erasure_delivery_outbox'::regclass
    `);
    const state = result.rows?.[0];
    if (state?.rls_enabled !== true || state?.force_rls !== true ||
        state?.public_grants_exist !== false ||
        state?.public_column_grants_exist !== false ||
        state?.api_roles_with_dml_grants !== 0) {
      const error = new Error('GDPR_OUTBOX_SCHEMA_NOT_PROTECTED');
      error.code = 'GDPR_OUTBOX_SCHEMA_NOT_PROTECTED';
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

    // Both the normal and opt-in outbox paths must verify the SQL row,
    // including its subject and JSONB payload. A trigger may suppress or
    // rewrite a successful INSERT without causing PostgreSQL to throw.
    const outboxEnabled = this.outboxEnabled();
    // A ledger event must remain recoverable even while the external outbox
    // is OFF. A JSONB null/array/scalar is not an archival event document.
    if (!details || typeof details !== 'object' || Array.isArray(details)) {
      const error = new Error('Invalid GDPR ledger details: JSON object required');
      error.code = 'GDPR_LEDGER_INVALID_EVENT_DETAILS';
      throw error;
    }
    const eventKey = crypto.randomUUID();
    const subjectUserId = String(userId);
    const detailsJson = JSON.stringify(details);
    if (typeof detailsJson !== 'string' || detailsJson[0] !== '{') {
      // Includes non-object custom toJSON() results. Fail before touching SQL.
      const error = new Error('Invalid GDPR ledger details: JSON object required');
      error.code = 'GDPR_LEDGER_INVALID_EVENT_DETAILS';
      throw error;
    }
    // Enforce the immutable B2 event format even when the outbox is OFF.
    // Otherwise a committed SQL-only erasure can exceed the bounded 8192-byte
    // archive format and become impossible to export when B2 is enabled later.
    // This is a local validation only: importing the formatter does not
    // construct an SDK client, open a connection or enable the exporter.
    const { normalizeEvent } = require('./privacyErasureB2Journal');
    normalizeEvent({
      event_key: eventKey,
      subject_user_id: subjectUserId,
      event_type: eventType,
      // PostgreSQL NOW() can include six fractional digits; validate against
      // the longest lossless timestamp, not a shorter millisecond fixture.
      occurred_at: '2000-01-01T00:00:00.000001Z',
      details: JSON.parse(detailsJson)
    });

    // The caller must use a single explicit SQL transaction for all account/
    // consent changes, this event and the outbox. No implicit DDL here.
    await this.assertProtectedLedger(client);
    if (outboxEnabled) await this.assertProtectedOutbox(client);
    const params = [eventKey, subjectUserId, eventType, detailsJson];
    let result;
    if (outboxEnabled) {
      result = await client.query(`
        WITH event_insert AS (
          INSERT INTO public.privacy_erasure_ledger
            (event_key, subject_user_id, event_type, occurred_at, details)
          VALUES ($1, $2, $3, NOW(), $4::jsonb)
          RETURNING event_key, subject_user_id, event_type, occurred_at, details
        ), delivery_insert AS (
          INSERT INTO public.privacy_erasure_delivery_outbox (event_key)
          SELECT event_key FROM event_insert
          RETURNING event_key
        )
        SELECT e.*, e.details = $4::jsonb AS details_match
        FROM event_insert e JOIN delivery_insert d ON d.event_key = e.event_key
      `, params);
    } else {
      result = await client.query(
        `INSERT INTO public.privacy_erasure_ledger
          (event_key, subject_user_id, event_type, occurred_at, details)
         VALUES ($1, $2, $3, NOW(), $4::jsonb)
         RETURNING event_key, subject_user_id, event_type, occurred_at, details,
           details = $4::jsonb AS details_match`,
        params
      );
    }
    const row = result.rows?.[0];
    if (result.rowCount !== 1 || result.rows?.length !== 1 ||
        row?.event_key !== eventKey ||
        row.subject_user_id !== subjectUserId ||
        row.event_type !== eventType ||
        row.details_match !== true ||
        !row.occurred_at) {
      const error = new Error('GDPR_LEDGER_INSERT_NOT_CONFIRMED');
      error.code = 'GDPR_LEDGER_INSERT_NOT_CONFIRMED';
      throw error;
    }
    const { details_match: _verified, ...event } = row;
    return event;
  }

  // Recovery/export MUST run with SQL visibility of the complete ledger.
  // A correctly protected relation can return only a subset (or zero rows)
  // to a subject-scoped RLS role, which is never a complete archive.
  static async assertUnfilteredLedger(client) {
    await this.assertProtectedLedger(client);
    const result = await client.query(
      "SELECT NOT pg_catalog.row_security_active(" +
      "'public.privacy_erasure_ledger'::regclass) AS complete_visibility"
    );
    if (result.rows?.[0]?.complete_visibility !== true) {
      const error = new Error('GDPR_LEDGER_VISIBILITY_INCOMPLETE');
      error.code = 'GDPR_LEDGER_VISIBILITY_INCOMPLETE';
      throw error;
    }
  }

  static async captureCurrent(client) {
    // Never manufacture an incomplete/empty history during export.
    await this.assertUnfilteredLedger(client);
    const result = await client.query(`
      SELECT event_key, subject_user_id, event_type,
        -- node-postgres TIMESTAMPTZ -> Date truncates PostgreSQL microseconds.
        -- Preserve full precision for signed/exported recovery evidence.
        to_char(occurred_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS occurred_at,
        details
      FROM public.privacy_erasure_ledger
      ORDER BY occurred_at ASC, event_key ASC
    `);
    return result.rows;
  }

  static async mergeCaptured(client, rows = []) {
    // An offline operator must still wrap import AND privacy replay in one
    // transaction. Preflight every captured value nevertheless: a late bad
    // timestamp, duplicate event key or JSON serialization failure must not
    // leave earlier rows inserted by a caller that forgot BEGIN.
    await this.assertUnfilteredLedger(client);
    const invalid = () => {
      const error = new Error('GDPR_LEDGER_INVALID_CAPTURED_EVENT');
      error.code = 'GDPR_LEDGER_INVALID_CAPTURED_EVENT';
      return error;
    };
    if (!Array.isArray(rows)) throw invalid();
    const seenKeys = new Set();
    const prepared = [];
    for (const row of rows) {
      if (!row || typeof row !== 'object' ||
          typeof row.event_key !== 'string' || !row.event_key.trim() ||
          typeof row.subject_user_id !== 'string' || !row.subject_user_id.trim() ||
          !Object.values(this.EVENT_TYPES).includes(row.event_type) ||
          seenKeys.has(row.event_key)) throw invalid();

      // PostgreSQL accepts implicit NULL or permissive timestamp casts, and
      // JavaScript Date loses microseconds. Require lossless UTC text from
      // captureCurrent (or an equivalent validated legacy UTC timestamp).
      const timestamp = row.occurred_at;
      const match = typeof timestamp === 'string' &&
        /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?Z$/.exec(timestamp);
      if (!match) throw invalid();
      const milliseconds = match[1] + '.' +
        (match[2] || '').padEnd(3, '0').slice(0, 3) + 'Z';
      const parsed = new Date(milliseconds);
      if (!Number.isFinite(parsed.getTime()) ||
          parsed.toISOString() !== milliseconds) throw invalid();

      // Ledger details are JSONB objects in actual PostgreSQL captures.
      // Do not silently turn absent/null/false/0 details into '{}' during restore.
      // A malformed archive must fail before the first INSERT in the batch.
      if (!row.details || typeof row.details !== 'object' ||
          Array.isArray(row.details)) throw invalid();
      // Serialize once in the preflight. Objects with circular references,
      // BigInt or a serializer returning undefined must fail before ANY DML.
      let details;
      try { details = JSON.stringify(row.details); } catch (_) { throw invalid(); }
      if (typeof details !== 'string' || details[0] !== '{') throw invalid();

      // A captured SQL event is not automatically a valid immutable archive.
      // Validate the exact JSONB-shaped payload and lossless timestamp against
      // the B2 canonical format BEFORE the first import INSERT, even if the
      // live outbox switch is OFF. An oversized or malformed historic event
      // must stop operator recovery rather than be silently imported as a
      // ledger row that could never be exported and independently verified.
      // No B2 client or network connection is constructed by this formatter.
      try {
        const { normalizeEvent } = require('./privacyErasureB2Journal');
        normalizeEvent({
          event_key: row.event_key,
          subject_user_id: row.subject_user_id,
          event_type: row.event_type,
          occurred_at: timestamp,
          details: JSON.parse(details)
        });
      } catch (_) { throw invalid(); }

      seenKeys.add(row.event_key);
      prepared.push([
        row.event_key, row.subject_user_id, row.event_type, timestamp, details
      ]);
    }
    let merged = 0;
    for (const event of prepared) {
      const result = await client.query(
        `INSERT INTO public.privacy_erasure_ledger
          (event_key, subject_user_id, event_type, occurred_at, details)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         ON CONFLICT (event_key) DO NOTHING
         RETURNING (
           event_key = $1::text AND subject_user_id = $2::text
           AND event_type = $3::text AND occurred_at = $4::timestamptz
           AND details = $5::jsonb
         ) AS identical`,
        event
      );
      // A BEFORE INSERT trigger can rewrite any imported field and still
      // produce rowCount=1. Verify the exact persisted SQL values, including
      // microseconds, rather than trusting successful execution alone.
      if (result.rowCount === 1) {
        if (result.rows?.length !== 1 || result.rows[0]?.identical !== true) {
          const error = new Error('GDPR_LEDGER_IMPORT_NOT_CONFIRMED');
          error.code = 'GDPR_LEDGER_IMPORT_NOT_CONFIRMED';
          throw error;
        }
      } else if (result.rowCount === 0) {
        // Idempotent replay is safe only when the previously stored event
        // matches in full. A reused event_key with different content must
        // stop recovery, not silently discard a later erasure/revocation.
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

  // Schema-qualified DML is essential in offline GDPR replay: pg_temp can
  // shadow an unqualified public relation even when metadata checks use public.
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

  // Preserve independently useful public civic records while removing the
  // account reference. Fail closed if a future schema makes the field required:
  // silently skipping it would leave a personal identifier after deletion.
  static async clearNullableUserReference(client, table, column, userId) {
    const info = await client.query(
      `SELECT is_nullable FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
      [table, column]
    );
    if (info.rows.length === 0) return 0;
    if (info.rows[0].is_nullable !== 'YES') {
      const error = new Error('GDPR_ERASURE_REFERENCE_NOT_NULLABLE');
      error.code = 'GDPR_ERASURE_REFERENCE_NOT_NULLABLE';
      throw error;
    }
    const result = await client.query(
      `UPDATE public.${this.quoteIdentifier(table)}
       SET ${this.quoteIdentifier(column)} = NULL
       WHERE ${this.quoteIdentifier(column)}::text = $1`,
      [String(userId)]
    );
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
      'civic_ballot_positions',
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
      ['user_profile', 'user_id'],
      ['active_sessions', 'user_id'],
      // Explicit erasure also works on a partial restore without FK CASCADE.
      // GDPR request receipts are account-scoped; the separate protected
      // privacy_erasure_ledger remains the minimum restore tombstone.
      ['user_rights_requests', 'user_id'],
      ['data_processing_limits', 'user_id'],
      ['rate_limit_violations', 'user_id'],
      ['premium_requests', 'userid'],
      ['richieste_premium', 'utente_id'],
      ['richieste_grazia', 'utente_id'],
      ['segnalazioni', 'utente_id'],
      ['notifiche_avvistamenti', 'id_utente'],
      ['notifiche_voti_comuni', 'id_utente'],
      ['notifiche_voti_parlamento', 'id_utente'],
      ['grazia_requests', 'userid'],
      // Handle dependent public-profile rows before deleting users.
      // political_programs depends on political_candidacies, and mandate
      // snapshots depend on political_mandates; children must go first.
      ['candidati', 'user_id'],
      ['mandate_program_snapshots', 'user_id'],
      ['political_programs', 'user_id'],
      ['political_candidacies', 'user_id'],
      ['political_mandates', 'user_id'],
      ['user_devices', 'user_id'],
      ['user_notifications', 'user_id'],
      ['notifiche_preferenze', 'user_id'],
      ['preference_change_cooldowns', 'user_id'],
      ['political_opinion_notifications', 'recipient_user_id'],
      ['political_opinion_notifications', 'subject_user_id'],
      ['political_selections', 'user_id'],
      ['political_selections', 'selected_user_id'],
      // Do not rely solely on restored FK ON DELETE CASCADE constraints.
      // A partial/legacy restore may have the table but lack its FK.
      ['user_representatives', 'user_id'],
      ['user_consents', 'user_id'],
      ['user_political_territories', 'user_id'],
      ['user_electoral_unit_memberships', 'user_id'],
      ['riconoscimenti', 'user_id'],
      ['user_auth_providers', 'user_id'],
      ['user_providers', 'user_id'],
      ['sessions', 'user_id']
    ];
    for (const [table, column] of directLinks) {
      rowsDeleted += await this.deleteByColumn(client, table, column, userId);
    }

    // Public processes may outlive the author/approver's DEMOS account.
    // Preserve the civic item, NOT the deleted user's UUID: relevant columns
    // are nullable in the audited 2026-10-28 production schema.
    const nullableLinks = [
      ['eventi', 'creator_user_id'],
      ['eventi', 'approved_by_user_id'],
      ['eventi', 'election_lifecycle_closed_by_user_id'],
      ['referendum_abrogativi', 'userid'],
      ['iniziative_popolari', 'userid'],
      ['governo_attuale', 'user_id'],
      ['programmi', 'user_id_backup'],
      ['civic_process_reconciliation_candidates', 'reviewed_by_user_id'],
      ['civic_processes', 'realized_verified_by_user_id']
    ];
    for (const [table, column] of nullableLinks) {
      rowsUnlinked += await this.clearNullableUserReference(client, table, column, userId);
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
    // Restore replay must erase the same consent-scoped political data as the
    // live revocation route, including votes and legacy opinion columns.
    // Lazy require avoids the module cycle: politicalConsentService uses our
    // schema-aware deletion helpers.
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

    return { opinionsDeleted: cleanup.deletedByTable.opinioni_risposte || 0 };
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

  // An operator can own/read the ledger but still have RLS-filtered access
  // to restored application tables. DELETE/UPDATE on those tables could then
  // silently touch zero rows and falsely report a successful replay.
  // Conservatively refuse replay when ANY restored public application table
  // applies RLS to the executing role. This is an offline operator gate only.
  static async assertUnfilteredReplayTables(client) {
    const result = await client.query(`
      SELECT COALESCE(
        bool_and(NOT pg_catalog.row_security_active(c.oid::regclass)),
        true
      ) AS complete_visibility
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public'
        AND c.relkind IN ('r','p')
        AND c.relname NOT IN (
          'privacy_erasure_ledger',
          'privacy_erasure_delivery_outbox'
        )
    `);
    if (result.rows?.[0]?.complete_visibility !== true) {
      const error = new Error('GDPR_REPLAY_DATA_VISIBILITY_INCOMPLETE');
      error.code = 'GDPR_REPLAY_DATA_VISIBILITY_INCOMPLETE';
      throw error;
    }
  }

  static async applyCurrentPrivacyState(client) {
    // Missing or RLS-filtered tombstones must block replay before any DML.
    await this.assertUnfilteredLedger(client);
    // Schema-aware cleanup is intentionally tolerant of optional legacy tables,
    // but these core relations/columns must exist before any replay mutation.
    await this.assertReplayCoreSchema(client);
    // A full tombstone SELECT is insufficient if application tables hide
    // deletable records behind a different RLS policy. Check catalog-only
    // visibility before the first user-data mutation.
    await this.assertUnfilteredReplayTables(client);

    // Two opposite consent events with the same PostgreSQL timestamp have no
    // trustworthy causal order: event_key is a random UUID, not a sequence.
    // Refuse replay before any deletion instead of arbitrarily choosing the
    // last consent state. Clock skew across distinct timestamps remains an
    // independent recovery attestation concern.
    const orderCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM public.privacy_erasure_ledger
        WHERE event_type IN ('political_consent_revoked', 'political_consent_granted')
        GROUP BY subject_user_id, occurred_at
        HAVING COUNT(DISTINCT event_type) > 1
      ) AS ambiguous
    `);
    if (orderCheck.rows?.[0]?.ambiguous !== false) {
      const error = new Error('GDPR_LEDGER_AMBIGUOUS_CONSENT_ORDER');
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
