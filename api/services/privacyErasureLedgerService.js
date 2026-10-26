const crypto = require('crypto');

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
      )
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
      )
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

  static async recordEvent(client, { userId, eventType, details = {} }) {
    if (!Object.values(this.EVENT_TYPES).includes(eventType)) {
      throw new Error(`Unsupported privacy ledger event: ${eventType}`);
    }
    if (userId == null || String(userId).trim() === '') {
      throw new Error('Privacy ledger event requires userId');
    }

    const outboxEnabled = this.outboxEnabled();

    // Never execute DDL from a user-facing GDPR request in outbox mode.
    // Both ledger and delivery tables must be installed/backfilled during
    // an approved maintenance operation. A missing relation fails closed.
    if (!outboxEnabled) {
      await this.ensureTable(client);
    }
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
    await this.ensureTable(client);
    const result = await client.query(`
      SELECT event_key, subject_user_id, event_type, occurred_at, details
      FROM public.privacy_erasure_ledger
      ORDER BY occurred_at ASC, event_key ASC
    `);
    return result.rows;
  }

  static async mergeCaptured(client, rows = [], { requirePreinstalled = false } = {}) {
    // The offline recovery gate must never silently provision a missing
    // ledger. Keep legacy explicit import behavior for existing callers.
    if (!requirePreinstalled) await this.ensureTable(client);
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

  static async applyCurrentPrivacyState(client, { requirePreinstalled = false } = {}) {
    // The signed offline recovery path verifies the schema before replay.
    // Do not run implicit CREATE TABLE/INDEX inside that transaction.
    if (!requirePreinstalled) await this.ensureTable(client);

    // Fail BEFORE deleting any account or political data if historical
    // grants and revocations share a timestamp. event_key is a random UUID,
    // not a reliable ordering of consent, and cannot resolve this tie.
    // This guard also protects direct ledger replay callers (not only the
    // signed-manifest recovery entry point).
    const ambiguousConsent = await client.query(`
      SELECT EXISTS (
        SELECT 1
        FROM public.privacy_erasure_ledger revoked
        JOIN public.privacy_erasure_ledger granted
          ON granted.subject_user_id = revoked.subject_user_id
         AND date_trunc('milliseconds', granted.occurred_at) =\n             date_trunc('milliseconds', revoked.occurred_at)
        WHERE revoked.event_type = 'political_consent_revoked'
          AND granted.event_type = 'political_consent_granted'
      ) AS present
    `);
    if (ambiguousConsent.rows[0]?.present !== false) {
      throw Error('Ambiguous simultaneous GDPR consent grant and revocation in ledger');
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
