'use strict';

// Feature-gated writer: one verified last FINAL vote per selected representative.
// No per-follower data, no AI calls, no push dispatch.
// Schema: api/database/20261103_latest_parliament_votes.sql
const crypto = require('node:crypto');
const { getVerifiedFinalBallots } = require('./parliamentVerifiedFinalBallotsService');
const { sendFinalBallotPush } = require('./parliamentFinalBallotPushService');

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
  // Never publish a future-dated ballot, even if an upstream clock is wrong.
  if (iso > now.toISOString().slice(0, 10)) return false;
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
  const office = chamber === 'Camera' ? 'it.camera' :
    chamber === 'Senato' ? 'it.senato' : null;
  const mandateOffice = chamber === 'Camera' ? 'C' : 'S';
  if (!office) throw new Error('LATEST_VOTE_INVALID_CHAMBER');
  // Authoritative current choices: do not read stale legacy TEXT projections
  // or create one copy per follower. Active follower + active politician mandate.
  const sql =
    "SELECT DISTINCT p.id, p.nome, p.cognome " +
    "FROM users p JOIN political_selections ps ON ps.selected_user_id = p.id " +
    "JOIN users follower ON follower.id = ps.user_id AND lower(follower.status) = 'a' " +
    "WHERE ps.selection_kind = 'representative' AND ps.political_office_id = $1 " +
    "AND p.nome IS NOT NULL AND p.cognome IS NOT NULL " +
    "AND EXISTS (SELECT 1 FROM political_mandates m WHERE m.user_id = p.id " +
    "AND m.status = 'ACTIVE' AND m.office_code = $2 " +
    "AND m.starts_at <= NOW() AND (m.ends_at IS NULL OR m.ends_at > NOW()))";
  const { rows } = await pool.query(sql, [office, mandateOffice]);
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
  if (!matches.length) return { changed: 0, matched: 0, updated: [] };
  const order = voteOrder(vote);
  const client = await pool.connect();
  let changed = 0;
  const updated = [];
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
        updated.push({ representativeId: rep.id, status: ballot.vote });
        // Do not carry reactions from the superseded vote to the new one.
        await client.query('DELETE FROM reazioni WHERE comunicazione_id = $1', [String(result.rows[0].id)]);
      }
    }
    await client.query('COMMIT');
    return { changed, matched: matches.length, updated };
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
      // pg returns DATE columns as Date objects; source validation requires ISO YYYY-MM-DD.
      const verified = await (options.getVerifiedFinalBallots || getVerifiedFinalBallots)({
        ...vote, data_votazione: dateIso(vote.data_votazione)
      });
      const result = await persistLatestForChamber(pool, vote, verified, reps);
      changed += result.changed;
      checked++;
      // Delivery happens only after a committed change and is independently gated.
      for (const updated of result.updated) {
        try {
          await sendFinalBallotPush(pool, {
            representativeId: updated.representativeId,
            chamber: vote.camera, openpolisId: vote.openpolis_id,
            title: vote.titolo, status: updated.status
          });
        } catch {
          // Best effort: the in-app notification remains the durable record.
        }
      }
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
