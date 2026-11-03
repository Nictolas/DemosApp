const PrivacyErasureLedgerService = require('./privacyErasureLedgerService');

const USER_LINK_COLUMNS = Object.freeze(['user_id', 'userid', 'userId', 'utente_id', 'id_utente']);

// Dati generati dall'utente che, nella DPIA corrente, rientrano nel perimetro
// del consenso esplicito alle opinioni/scelte politiche. Non include voti
// istituzionali importati su Politici/Candidati da fonti pubbliche.
const CONSENT_SCOPED_TABLES = Object.freeze([
  'opinioni_risposte',
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
]);

async function getPoliticalConsentState(db, userId) {
  const result = await db.query(
    `SELECT
       u.id,
       COALESCE(uc.political_opinions_consent, u.political_opinions_consent, false) AS granted
     FROM users u
     LEFT JOIN user_consents uc ON uc.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return { exists: false, granted: false };
  }

  return {
    exists: true,
    granted: result.rows[0].granted === true
  };
}

async function clearLegacyUserOpinionColumns(db, userId) {
  const sharedColumns = await db.query(`
    SELECT response_cols.column_name
    FROM information_schema.columns response_cols
    JOIN information_schema.columns user_cols
      ON user_cols.table_schema = 'public'
     AND user_cols.table_name = 'users'
     AND user_cols.column_name = response_cols.column_name
    WHERE response_cols.table_schema = 'public'
      AND response_cols.table_name = 'opinioni_risposte'
      AND response_cols.column_name NOT IN ('user_id', 'id', 'created_at', 'updated_at')
  `);

  const columns = [...new Set(sharedColumns.rows.map((row) => row.column_name).filter(Boolean))];
  if (columns.length === 0) return 0;

  const assignments = columns
    .map((column) => `${PrivacyErasureLedgerService.quoteIdentifier(column)} = NULL`)
    .join(', ');
  const update = await db.query(
    `UPDATE public.users SET ${assignments}, updated_at = NOW() WHERE id = $1`,
    [userId]
  );
  return update.rowCount > 0 ? columns.length : 0;
}

async function clearPendingProposalLink(db, userId) {
  if (!(await PrivacyErasureLedgerService.tableHasColumn(db, 'users', 'opinione_proposta_id'))) {
    return 0;
  }
  const update = await db.query(
    `UPDATE public.users
     SET opinione_proposta_id = NULL, updated_at = NOW()
     WHERE id = $1 AND opinione_proposta_id IS NOT NULL`,
    [userId]
  );
  return update.rowCount || 0;
}

async function cleanupConsentScopedPoliticalData(db, userId) {
  let totalDeleted = 0;
  const deletedByTable = {};

  for (const table of CONSENT_SCOPED_TABLES) {
    const deleted = await PrivacyErasureLedgerService.deleteByAnyColumn(
      db,
      table,
      USER_LINK_COLUMNS,
      userId
    );
    if (deleted > 0) deletedByTable[table] = deleted;
    totalDeleted += deleted;
  }

  const legacyOpinionColumnsCleared = await clearLegacyUserOpinionColumns(db, userId);
  const proposalLinksCleared = await clearPendingProposalLink(db, userId);

  return {
    totalDeleted,
    deletedByTable,
    legacyOpinionColumnsCleared,
    proposalLinksCleared
  };
}

module.exports = {
  USER_LINK_COLUMNS,
  CONSENT_SCOPED_TABLES,
  getPoliticalConsentState,
  clearLegacyUserOpinionColumns,
  clearPendingProposalLink,
  cleanupConsentScopedPoliticalData
};
