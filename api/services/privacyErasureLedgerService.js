const crypto = require('crypto');

class PrivacyErasureLedgerService {
  static EVENT_TYPES = Object.freeze({
    ACCOUNT_DELETED: 'account_deleted',
    POLITICAL_CONSENT_REVOKED: 'political_consent_revoked',
    POLITICAL_CONSENT_GRANTED: 'political_consent_granted'
  });

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

    // The ledger must be preinstalled in a reviewed maintenance operation.
    // Missing relation fails closed (42P01), without DDL during deletion or
    // political-consent revocation and without creating an unprotected table.
    // Even a pre-existing ledger must be rejected if restored with RLS off,
    // unexpected table/column PUBLIC grants or exposed API-role permissions.
    await this.assertProtectedLedger(client);
    const eventKey = crypto.randomUUID();
    const result = await client.query(
      `INSERT INTO public.privacy_erasure_ledger
        (event_key, subject_user_id, event_type, occurred_at, details)
       VALUES ($1, $2, $3, NOW(), $4::jsonb)
       RETURNING event_key, subject_user_id, event_type, occurred_at, details`,
      [eventKey, String(userId), eventType, JSON.stringify(details)]
    );
    return result.rows[0];
  }

  static async captureCurrent(client) {
    await this.ensureTable(client);
    const result = await client.query(`
      SELECT event_key, subject_user_id, event_type, occurred_at, details
      FROM public.privacy_erasure_ledger
      ORDER BY occurred_at ASC, event_key ASC
    `);
    return result.rows;
  }

  static async mergeCaptured(client, rows = []) {
    await this.ensureTable(client);
    let merged = 0;
    for (const row of rows) {
      const result = await client.query(
        `INSERT INTO public.privacy_erasure_ledger
          (event_key, subject_user_id, event_type, occurred_at, details)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         ON CONFLICT (event_key) DO NOTHING`,
        [
          row.event_key,
          String(row.subject_user_id),
          row.event_type,
          row.occurred_at,
          JSON.stringify(row.details || {})
        ]
      );
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
    let opinionsDeleted = await this.deleteByUserId(client, 'opinioni_risposte', userId);

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

    return { opinionsDeleted };
  }

  static async applyCurrentPrivacyState(client) {
    await this.ensureTable(client);

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
