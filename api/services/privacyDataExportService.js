const { getPool } = require('../config/database');
const { decrypt: decryptEmail } = require('../utils/emailCrypto');
const AuditService = require('./auditService');
const { normalizeAccountType } = require('./accountCapabilitiesService');

const pool = getPool();

const USER_LINK_COLUMNS = ['user_id', 'userid', 'utente_id', 'id_utente'];
const TECHNICAL_SECRET_KEY = /(password|secret|token|credential)/i;

const ACTIVITY_TABLES = [
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
  'consenso_capo_stato',
  'candidature_elezioni',
  'political_candidacies',
  'political_mandates',
  'political_selections',
  'user_political_territories',
  'user_electoral_unit_memberships',
  'programmi',
  'riconoscimenti',
];

const COMMUNICATION_TABLES = [
  'comunicazioni',
  'notifiche',
  'user_notifications',
  'political_opinion_notifications',
  'notifiche_preferenze',
  'preference_change_cooldowns',
];

const DEVICE_TABLES = ['user_devices'];

const EXTRA_LINK_COLUMNS = Object.freeze({
  political_opinion_notifications: ['recipient_user_id', 'subject_user_id'],
  comunicazioni: ['id_utente'],
  programmi: ['utente_id'],
});

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function redactTechnicalSecrets(value) {
  if (Array.isArray(value)) return value.map(redactTechnicalSecrets);
  if (!value || typeof value !== 'object' || value instanceof Date) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => {
      if (TECHNICAL_SECRET_KEY.test(key)) {
        return [key, child == null || child === '' ? child : '[REDACTED_TECHNICAL_CREDENTIAL]'];
      }
      return [key, redactTechnicalSecrets(child)];
    })
  );
}

async function getColumns(tableName) {
  const result = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [tableName]
  );
  return result.rows.map((row) => row.column_name);
}

async function selectRowsForUser(tableName, userId, extraColumns = []) {
  const columns = await getColumns(tableName);
  if (columns.length === 0) return null;

  const candidates = [...new Set([...USER_LINK_COLUMNS, ...extraColumns])];
  const matchingColumns = candidates.filter((column) => columns.includes(column));
  if (matchingColumns.length === 0) return null;

  const conditions = matchingColumns
    .map((column) => `${quoteIdentifier(column)}::text = $1`)
    .join(' OR ');

  const result = await pool.query(
    `SELECT * FROM ${quoteIdentifier(tableName)} WHERE ${conditions}`,
    [String(userId)]
  );
  return redactTechnicalSecrets(result.rows);
}

async function selectSingleUserRow(tableName, userId) {
  const rows = await selectRowsForUser(tableName, userId);
  return rows?.[0] || null;
}

async function getUserCore(userId) {
  const columns = await getColumns('users');
  if (columns.length === 0 || !columns.includes('id')) return null;

  const safeColumns = [
    'id', 'email', 'nome', 'cognome', 'ruolo', 'status', 'premium',
    'account_type', 'is_admin', 'is_activist',
    'data_nascita', 'genere', 'cittadinanza',
    'paese_residenza', 'regione_residenza', 'provincia_residenza', 'comune_residenza',
    'paese_elezione', 'regione_elezione', 'provincia_elezione', 'comune_elezione', 'grado_elezione',
    'paese_candidatura', 'regione_candidatura', 'provincia_candidatura', 'comune_candidatura', 'grado_candidatura',
    'created_at', 'updated_at', 'last_login',
  ].filter((column) => columns.includes(column));

  const result = await pool.query(
    `SELECT ${safeColumns.map(quoteIdentifier).join(', ')}
     FROM users WHERE id::text = $1`,
    [String(userId)]
  );

  const row = result.rows[0] || null;
  if (row?.account_type) row.account_type = normalizeAccountType(row.account_type) || row.account_type;
  if (row?.email) {
    try {
      row.email = decryptEmail(row.email);
    } catch (_error) {
      // Alcuni account legacy possono avere email gia in chiaro.
    }
  }
  return row;
}

async function getProfile(userId) {
  const [account, profile, consents, authProviders] = await Promise.all([
    getUserCore(userId),
    selectSingleUserRow('user_profile', userId),
    selectSingleUserRow('user_consents', userId),
    selectRowsForUser('user_auth_providers', userId),
  ]);

  return {
    account,
    profile,
    consents,
    auth_providers: authProviders || [],
  };
}

async function getOpinions(userId) {
  const rows = await selectRowsForUser('opinioni_risposte', userId);
  return rows || [];
}

async function getTableGroup(tableNames, userId) {
  const entries = await Promise.all(
    tableNames.map(async (tableName) => {
      const rows = await selectRowsForUser(
        tableName,
        userId,
        EXTRA_LINK_COLUMNS[tableName] || []
      );
      return [tableName, rows];
    })
  );

  return Object.fromEntries(
    entries.filter(([, rows]) => Array.isArray(rows) && rows.length > 0)
  );
}

async function getActivity(userId) {
  const [votesAndPolitical, communications, devices, auditLogs] = await Promise.all([
    getTableGroup(ACTIVITY_TABLES, userId),
    getTableGroup(COMMUNICATION_TABLES, userId),
    getTableGroup(DEVICE_TABLES, userId),
    AuditService.getUserAuditLogs(userId, { limit: 1000 }).catch(() => []),
  ]);

  return {
    votes_and_political_activity: votesAndPolitical,
    communications_and_notifications: communications,
    devices,
    audit_logs: redactTechnicalSecrets(auditLogs || []),
  };
}

async function buildExport(userId, type) {
  const exportData = {
    metadata: {
      export_date: new Date().toISOString(),
      data_type: type,
      format_version: '2.0',
      gdpr_article: 'Art. 20 - Diritto alla portabilita dei dati',
      technical_credentials: 'Token, password e segreti tecnici sono esclusi o oscurati dall\'export.',
    },
  };

  if (type === 'profile' || type === 'complete') {
    exportData.profile = await getProfile(userId);
  }
  if (type === 'opinions' || type === 'complete') {
    exportData.opinions = await getOpinions(userId);
  }
  if (type === 'activity' || type === 'complete') {
    exportData.activity = await getActivity(userId);
  }

  return exportData;
}

module.exports = {
  buildExport,
  selectRowsForUser,
  redactTechnicalSecrets,
};
