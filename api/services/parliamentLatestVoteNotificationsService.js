'use strict';

// Feature-gated writer: one verified last FINAL vote per selected representative.
// No per-follower data, no AI calls, no push dispatch.
// Schema: api/database/20261103_latest_parliament_votes.sql
const crypto = require('node:crypto');
const { getVerifiedFinalBallots } = require('./parliamentVerifiedFinalBallotsService');

const ALLOWED = new Set(['Favorevole', 'Contrario', 'Astensione', 'Astenuto', 'Astenuto R',
  'Assente', 'In missione', 'In congedo', 'Non ha partecipato',
  'Presente non votante', 'Presidente di turno']);

function normalizeName(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ').toLowerCase();
}
function dateIso(date) {
  if (date instanceof Date && Number.isFinite(date.getTime())) return date.toISOString().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}/.test(String(date || '')) ? String(date).slice(0, 10) : null;
}
function voteOrder(vote) {
  const pattern = vote?.camera === 'Camera' ? /^vs19_(\d{1,5})_(\d{1,5})$/ :
    vote?.camera === 'Senato' ? /^19-(\d{1,5})-(\d{1,5})$/ : null;
  const parts = pattern && String(vote.openpolis_id || '').match(pattern);
  if (!parts) return null;
  return Number(parts[1]) * 100000 + Number(parts[2]);
}
function isRecentFinal(vote, now = new Date()) {
  const iso = dateIso(vote?.data_votazione);
  const order = voteOrder(vote);
  if (!iso || order === null || !['Approvata', 'Respinta'].includes(vote.esito) ||
      vote.url_dettaglio !== 'https://parlamento19.openpolis.it/votazioni/' + vote.openpolis_id) return false;
  const days = (now.getTime() - Date.parse(iso + 'T12:00:00Z')) / 86400000;
  return days >= -1 && days <= 120;
}
function newestByChamber(votes, now = new Date()) {
  const byChamber = new Map();
  for (const vote of votes) {
    if (!isRecentFinal(vote, now)) continue;
    const prev = byChamber.get(vote.camera);
    const orderKey = dateIso(vote.data_votazione) + ':' + String(voteOrder(vote)).padStart(12, '0');
    const prevKey = prev && dateIso(prev.data_votazione) + ':' + String(voteOrder(prev)).padStart(12, '0');
    if (!prev || orderKey > prevKey) byChamber.set(vote.camera, vote);
  }
  return [...byChamber.values()];
}
function matchUniqueMember(rep, members, allReps) {
  const firstLast = normalizeName(rep.nome + ' ' + rep.cognome);
  const lastFirst = normalizeName(rep.cognome + ' ' + rep.nome);
  if (!firstLast || !lastFirst) return null;
  const variants = new Set([firstLast, lastFirst]);
  // Ambiguous politician identity -> no notification.
  if (allReps.filter(other => {
    return variants.has(normalizeName(other.nome + ' ' + other.cognome)) ||
      variants.has(normalizeName(other.cognome + ' ' + other.nome));
  }).length !== 1) return null;
  const rows = members.filter(row => variants.has(normalizeName(row.name)));
  return rows.length === 1 && ALLOWED.has(rows[0].vote) ? rows[0] : null;
}
async function selectedRepresentatives(pool, chamber) {
  const selection = chamber === 'Camera' ? 'rappresentante_camera' :
    chamber === 'Senato' ? 'rappresentante_senato' : null;
  const office = chamber === 'Camera' ? 'C' : 'S';
  if (!selection) throw new Error('LATEST_VOTE_INVALID_CHAMBER');
  // The dynamic column is selected from two hard-coded safe identifiers.
  const sql = ('SELECT DISTINCT p.id, p.nome, p.cognome FROM users p ' +
    'JOIN users follower ON follower.__SELECTION__ = p.id ' +
    'WHERE p.nome IS NOT NULL AND p.cognome IS NOT NULL AND EXISTS (' +
    "SELECT 1 FROM political_mandates m WHERE m.user_id = p.id AND m.status = 'ACTIVE' " +
    'AND m.office_code = $1 AND m.starts_at <= NOW() ' +
    'AND (m.ends_at IS NULL OR m.ends_at > NOW()))').replace('__SELECTION__', selection);
  const { rows } = await pool.query(sql, [office]);
  return rows;
}
async function persistLatestForChamber(pool, vote, verified, reps) {
  if (verified.voteId !== vote.openpolis_id || verified.chamber !== vote.camera ||
      verified.date !== dateIso(vote.data_votazione) ||
      !verified.source?.url || !Array.isArray(verified.members) || verified.members.length < 120) {
    throw new Error('LATEST_VOTE_SOURCE_MISMATCH');
  }
  const matches = reps.map(rep => ({ rep, ballot: matchUniqueMember(rep, verified.members, reps) }))
    .filter(x => x.ballot);
  if (!matches.length) return { changed: 0, matched: 0 };
  const order = voteOrder(vote);
  const client = await pool.connect();
  let changed = 0;
  try {
    await client.query('BEGIN');
    for (const { rep, ballot } of matches) {
      const hash = crypto.createHash('sha256').update(String(rep.id) + ':' + vote.openpolis_id).digest('hex');
      const sql = 'INSERT INTO notifiche_voti_parlamento ' +
        '(id_utente, politico, camera, titolo, testo, voto, data, votazione_hash, openpolis_id, vote_order) ' +
        'VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8, $9, $10) ' +
        'ON CONFLICT (id_utente, camera) DO UPDATE SET ' +
        'politico=EXCLUDED.politico, titolo=EXCLUDED.titolo, testo=EXCLUDED.testo, ' +
        'voto=EXCLUDED.voto, data=EXCLUDED.data, votazione_hash=EXCLUDED.votazione_hash, ' +
        'openpolis_id=EXCLUDED.openpolis_id, vote_order=EXCLUDED.vote_order, ' +
        'data_creazione=CURRENT_TIMESTAMP, likes=0, dislikes=0 ' +
        'WHERE notifiche_voti_parlamento.data IS NULL ' +
        'OR notifiche_voti_parlamento.data < EXCLUDED.data ' +
        'OR (notifiche_voti_parlamento.data = EXCLUDED.data ' +
        'AND COALESCE(notifiche_voti_parlamento.vote_order, -1) < EXCLUDED.vote_order) ' +
        'RETURNING id';
      const result = await client.query(sql,
        [rep.id, String(rep.nome + ' ' + rep.cognome).trim(), vote.camera,
          vote.titolo, 'Stato da fonte verificata: ' + ballot.vote, ballot.vote,
          dateIso(vote.data_votazione), hash, vote.openpolis_id, order]);
      if (result.rows.length) {
        changed++;
        // Do not carry reactions from the superseded vote to the new one.
        await client.query('DELETE FROM reazioni WHERE comunicazione_id = $1', [String(result.rows[0].id)]);
      }
    }
    await client.query('COMMIT');
    return { changed, matched: matches.length };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
async function refreshLatestParliamentVoteNotifications(pool, options = {}) {
  // Disabled by default. Launch only after migration and release QA.
  if (process.env.PARLIAMENT_FINAL_NOTIFICATIONS_ENABLED !== 'true') {
    return { enabled: false, checked: 0, changed: 0 };
  }
  const { rows } = await pool.query(
    "SELECT openpolis_id, camera, titolo, url_dettaglio, esito, data_votazione " +
    "FROM openpolis_votazioni_finali_decisive " +
    "WHERE data_votazione >= CURRENT_DATE - INTERVAL '120 days' " +
    "AND camera IN ('Camera', 'Senato') ORDER BY data_votazione DESC LIMIT 50"
  );
  const votes = newestByChamber(rows);
  let changed = 0, checked = 0, unavailable = 0;
  for (const vote of votes) {
    try {
      const reps = await selectedRepresentatives(pool, vote.camera);
      if (!reps.length) continue;
      const verified = await (options.getVerifiedFinalBallots || getVerifiedFinalBallots)(vote);
      const result = await persistLatestForChamber(pool, vote, verified, reps);
      changed += result.changed;
      checked++;
    } catch {
      // Failure must not overwrite a verified vote. Report counts, not user IDs.
      unavailable++;
    }
  }
  return { enabled: true, checked, changed, unavailable };
}
module.exports = { normalizeName, voteOrder, isRecentFinal, newestByChamber,
  matchUniqueMember, selectedRepresentatives, persistLatestForChamber,
  refreshLatestParliamentVoteNotifications };
