'use strict';

// Feature-gated writer: one verified last FINAL vote per selected representative.
// No per-follower data, no AI calls, no push dispatch.
// Schema: api/database/20261103_latest_parliament_votes.sql
const crypto = require('node:crypto');
const { getVerifiedFinalBallots } = require('./parliamentVerifiedFinalBallotsService');
const { sendFinalBallotPush } = require('./parliamentFinalBallotPushService');
const { upsertVerifiedCurrentVote } = require('./institutionalCurrentNominalVotesService');

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
// Exact, source-confirmed parliamentary name aliases. This is NOT a general
// nickname heuristic: Peppe De Cristofaro is recorded by the Senate/Openpolis
// as Giuseppe De Cristofaro. Never change the public representative's name.
function memberNameVariants(rep) {
  const firstLast = normalizeName(rep.nome + ' ' + rep.cognome);
  const lastFirst = normalizeName(rep.cognome + ' ' + rep.nome);
  const variants = new Set([firstLast, lastFirst]);
  if (firstLast === 'peppe de cristofaro') {
    variants.add('giuseppe de cristofaro');
    variants.add('de cristofaro giuseppe');
  }
  return variants;
}

function officialCameraIdentityEvidence(rep) {
  // Camera's genuine final-vote roster has names but no person href. Only
  // a separate vetted official Camera person-ID bridge can disambiguate it.
  // A free-form name or a link from an unrelated website is insufficient.
  let identity, evidence;
  try {
    identity = new URL(rep.source_person_id);
    evidence = new URL(rep.evidence_url);
  } catch { return false; }
  const officialHosts = new Set(['www.camera.it','camera.it','dati.camera.it','documenti.camera.it']);
  return identity.protocol === 'https:' && evidence.protocol === 'https:' &&
    officialHosts.has(identity.hostname) && officialHosts.has(evidence.hostname) &&
    !identity.username && !identity.password && !identity.hash &&
    !evidence.username && !evidence.password && !evidence.hash &&
    /\/(?:deputat|ocd\/deputato)/i.test(identity.pathname);
}

function matchUniqueMember(rep, members, allReps, context = {}) {
  const sourcePersonId = rep?.source_person_id;
  if (typeof sourcePersonId !== 'string' || !sourcePersonId ||
      !Array.isArray(members) || !Array.isArray(allReps)) return null;
  if (allReps.filter(other => other.source_person_id === sourcePersonId).length !== 1)
    return null;
  const variants = memberNameVariants(rep);
  // One official source-person link in the actual ballot row is strongest.
  const byId = members.filter(row => row.sourcePersonId === sourcePersonId);
  if (byId.length > 1) return null;
  if (byId.length === 1) {
    return ALLOWED.has(byId[0].vote) && variants.has(normalizeName(byId[0].name))
      ? byId[0] : null;
  }
  // No fallback for Senate/EP or a conflicting nonempty person link.
  if (context.chamber !== 'Camera' || context.sourceType !== 'official' ||
      !officialCameraIdentityEvidence(rep)) return null;
  const matchedName = members.filter(row => variants.has(normalizeName(row.name)));
  if (matchedName.length !== 1 || !ALLOWED.has(matchedName[0].vote) ||
      matchedName[0].sourcePersonId) return null;
  // Reject any other mapped representative whose name or vetted alias could
  // fit the same name-only Camera row; only this one may be attributed.
  if (allReps.filter(other =>
    [...memberNameVariants(other)].some(name => variants.has(name))
  ).length !== 1) return null;
  return { ...matchedName[0], sourcePersonId, attributionMethod: 'vetted_camera_official_identity' };
}

async function selectedRepresentatives(pool, chamber) {
  const office = chamber === 'Camera' ? 'it.camera' :
    chamber === 'Senato' ? 'it.senato' : null;
  const mandateOffice = chamber === 'Camera' ? 'C' : 'S';
  if (!office) throw new Error('LATEST_VOTE_INVALID_CHAMBER');
  // FREE-TIER RULE: fetch current votes only for politicians selected by at
  // least one ACTIVE citizen. One politician row regardless of follower count.
  // Keep explicit approval and active mandate gates, and use EXISTS to avoid
  // multiplying rows for people followed by many citizens.
  // Also quarantine issue #396 cross-chamber duplicated legacy identities
  // until the currently selected mandate has independent official provenance.
  const sql =
    "SELECT p.id, p.nome, p.cognome, link.source_person_id, link.evidence_url, " +
    "TRUE AS has_followers " +
    "FROM users p JOIN public.institutional_nominal_identity_links link " +
    "ON link.representative_id = p.id AND link.institution = $3 " +
    "WHERE p.nome IS NOT NULL AND p.cognome IS NOT NULL " +
    "AND link.verified_at IS NOT NULL " +
    "AND link.review_state = 'VERIFIED' AND link.reviewed_by IS NOT NULL " +
    "AND link.reviewed_at IS NOT NULL " +
    "AND EXISTS (SELECT 1 FROM political_selections ps " +
    "JOIN users follower ON follower.id = ps.user_id AND lower(follower.status) = 'a' " +
    "WHERE ps.selected_user_id = p.id AND ps.selection_kind = 'representative' " +
    "AND ps.political_office_id = $1) " +
    "AND EXISTS (SELECT 1 FROM political_mandates m WHERE m.user_id = p.id " +
    "AND m.status = 'ACTIVE' AND m.office_code = $2 " +
    "AND m.starts_at <= NOW() AND (m.ends_at IS NULL OR m.ends_at > NOW())) " +
    // Issue #396: two different DEMOS accounts can describe one politician
    // with the same full name and DOB, with fictitious C/S ACTIVE mandates
    // created by legacy imports. A reviewed identity link ALONE must not
    // reactivate the wrong historic office. Require migration of the chosen
    // mandate to an officially verified source before it is eligible.
    "AND NOT EXISTS (SELECT 1 FROM public.users alt " +
    "JOIN public.political_mandates alt_m ON alt_m.user_id = alt.id " +
    "WHERE alt.id <> p.id AND p.data_nascita IS NOT NULL " +
    "AND alt.data_nascita = p.data_nascita " +
    "AND lower(trim(alt.nome)) = lower(trim(p.nome)) " +
    "AND lower(trim(alt.cognome)) = lower(trim(p.cognome)) " +
    "AND alt_m.office_code = CASE WHEN $2 = 'C' THEN 'S' ELSE 'C' END " +
    "AND alt_m.source = 'LEGACY_BACKFILL' AND alt_m.status = 'ACTIVE' " +
    "AND alt_m.starts_at <= NOW() AND (alt_m.ends_at IS NULL OR alt_m.ends_at > NOW()) " +
    "AND EXISTS (SELECT 1 FROM public.political_mandates legacy " +
    "WHERE legacy.user_id = p.id AND legacy.office_code = $2 " +
    "AND legacy.source = 'LEGACY_BACKFILL' AND legacy.status = 'ACTIVE' " +
    "AND legacy.starts_at <= NOW() " +
    "AND (legacy.ends_at IS NULL OR legacy.ends_at > NOW())))";
  const { rows } = await pool.query(sql, [office, mandateOffice, chamber]);
  return rows;
}
// Re-evaluate the selected representative INSIDE the write transaction.
// An active selection or identity review may have been revoked during an
// expensive official roll-call HTTP fetch. FOR SHARE of all five live rows
// serializes opt-out, mandate/review edits and the current-vote commit.
// It is not enough to trust an old has_followers:true value.
const LOCK_SELECTED_NOMINAL_ELIGIBILITY_SQL = [
  'SELECT p.id FROM public.political_selections ps',
  'JOIN public.users follower ON follower.id=ps.user_id',
  'JOIN public.users p ON p.id=ps.selected_user_id',
  'JOIN public.political_mandates m ON m.user_id=p.id',
  'JOIN public.institutional_nominal_identity_links l ON l.representative_id=p.id',
  'WHERE p.id=$1::uuid',
  "AND ps.selection_kind='representative'",
  'AND ps.political_office_id=$2',
  "AND lower(follower.status)='a'",
  'AND m.office_code=$3',
  "AND m.status='ACTIVE' AND m.starts_at<=now()",
  'AND (m.ends_at IS NULL OR m.ends_at>now())',
  'AND l.institution=$4 AND l.source_person_id=$5 AND l.evidence_url=$6',
  "AND l.review_state='VERIFIED'",
  'AND l.reviewed_by IS NOT NULL AND l.reviewed_at IS NOT NULL',
  'AND l.verified_at IS NOT NULL',
  'LIMIT 1 FOR SHARE OF ps,follower,p,m,l'
].join(' ');

async function persistLatestForChamber(pool, vote, verified, reps) {
  const expectedSourceType = vote.camera === 'Camera' ? 'official' : 'openpolis';
  if (verified?.source?.type !== expectedSourceType ||
      verified.voteId !== vote.openpolis_id || verified.chamber !== vote.camera ||
      verified.date !== dateIso(vote.data_votazione) ||
      !verified.source?.url || !Array.isArray(verified.members) || verified.members.length < 120) {
    throw new Error('LATEST_VOTE_SOURCE_MISMATCH');
  }
  // Never write an unfollowed representative even if a caller supplies
  // arbitrary rows instead of using selectedRepresentatives().
  const selected = reps.filter(rep => rep.has_followers === true);
  const matches = selected.map(rep => ({ rep, ballot: matchUniqueMember(rep, verified.members, selected, {chamber:vote.camera,sourceType:verified.source.type}) }))
    .filter(x => x.ballot);
  if (!matches.length) return { changed: 0, matched: 0, updated: [] };
  const order = voteOrder(vote);
  const client = await pool.connect();
  let changed = 0;
  const updated = [];
  try {
    await client.query('BEGIN');
    // The selection read before network I/O is never an authorization to
    // write. Repeat the complete selected-only + duplicate-backfill gate
    // at commit time, then lock the actual eligible rows until COMMIT.
    const currentSelected = await selectedRepresentatives(client, vote.camera);
    const eligibleNow = new Map(currentSelected.map(item => [String(item.id), item]));
    for (const { rep, ballot } of matches) {
      const fresh = eligibleNow.get(String(rep.id));
      if (!fresh || fresh.source_person_id !== rep.source_person_id ||
          fresh.evidence_url !== rep.evidence_url) continue;
      // A newly followed/approved politician could compete for a name-only
      // Camera row while the source was being fetched. Re-do unique roster
      // attribution against the FRESH full selected set before any write.
      const rechecked = matchUniqueMember(fresh, verified.members, currentSelected,
        {chamber:vote.camera,sourceType:verified.source.type});
      if (!rechecked || rechecked.vote !== ballot.vote ||
          rechecked.sourcePersonId !== ballot.sourcePersonId) continue;
      const office = vote.camera === 'Camera' ? 'it.camera' : 'it.senato';
      const mandateOffice = vote.camera === 'Camera' ? 'C' : 'S';
      const lock = await client.query(LOCK_SELECTED_NOMINAL_ELIGIBILITY_SQL,
        [rep.id, office, mandateOffice, vote.camera, rep.source_person_id, rep.evidence_url]);
      if (lock.rows.length !== 1) continue;
      // A single stable DEMOS representative UUID; verified source attribution
      // must already have passed the unique-member fail-closed guard above.
      // Both current state and in-app notification commit in this transaction.
      const currentResult = await upsertVerifiedCurrentVote(client, {
        institution: vote.camera,
        representativeKey: 'demos:' + String(rep.id),
        sourcePersonId: ballot.sourcePersonId || null,
        ballotId: vote.openpolis_id,
        voteDate: dateIso(vote.data_votazione),
        ballotOrder: order,
        status: ballot.vote,
        ballotTitle: vote.titolo,
        ballotOutcome: vote.esito,
        sourceUrl: verified.source.url,
        sourceType: vote.camera === 'Camera' ? 'camera_ufficiale' : 'senato_openpolis',
        verified: true
      });
      // An old cross-chamber retry must not create a second current event
      // in the notification feed if the canonical latest vote was unchanged.
      if (!currentResult.changed) continue;
      changed++;
      const hash = crypto.createHash('sha256').update(String(rep.id) + ':' + vote.openpolis_id).digest('hex');
      const sql = 'INSERT INTO notifiche_voti_parlamento ' +
        '(id_utente, politico, camera, titolo, testo, voto, data, votazione_hash, openpolis_id, vote_order) ' +
        'VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8, $9, $10) ' +
        'ON CONFLICT (id_utente) DO UPDATE SET ' +
        'politico=EXCLUDED.politico, camera=EXCLUDED.camera, titolo=EXCLUDED.titolo, testo=EXCLUDED.testo, ' +
        'voto=EXCLUDED.voto, data=EXCLUDED.data, votazione_hash=EXCLUDED.votazione_hash, ' +
        'openpolis_id=EXCLUDED.openpolis_id, vote_order=EXCLUDED.vote_order, ' +
        'data_creazione=CURRENT_TIMESTAMP, likes=0, dislikes=0 ' +
        'WHERE notifiche_voti_parlamento.data IS NULL ' +
        'OR notifiche_voti_parlamento.data < EXCLUDED.data ' +
        'OR (notifiche_voti_parlamento.data = EXCLUDED.data ' +
        'AND notifiche_voti_parlamento.camera = EXCLUDED.camera ' +
        'AND COALESCE(notifiche_voti_parlamento.vote_order, -1) < EXCLUDED.vote_order) ' +
        'RETURNING id';
      const result = await client.query(sql,
        [rep.id, String(rep.nome + ' ' + rep.cognome).trim(), vote.camera,
          vote.titolo, 'Stato da fonte verificata: ' + ballot.vote, ballot.vote,
          dateIso(vote.data_votazione), hash, vote.openpolis_id, order]);
      if (result.rows.length) {
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
// A global LIMIT 50 can starve the quieter chamber.
// Load up to 50 verified final-ballot candidates per chamber (100 total),
// with numeric parliamentary sequence ordering. No new DB table or service.
const LATEST_FINAL_BALLOTS_SQL = [
  "WITH ranked AS (",
  "SELECT openpolis_id, camera, titolo, url_dettaglio, esito,",
  "to_char(data_votazione, 'YYYY-MM-DD') AS data_votazione,",
  "ROW_NUMBER() OVER (PARTITION BY camera ORDER BY data_votazione DESC NULLS LAST,",
  "COALESCE(NULLIF(regexp_replace(split_part(openpolis_id, CASE WHEN camera = 'Camera' THEN '_' ELSE '-' END, 2), '[^0-9]', '', 'g'), '')::integer, 0) DESC,",
  "COALESCE(NULLIF(regexp_replace(split_part(openpolis_id, CASE WHEN camera = 'Camera' THEN '_' ELSE '-' END, 3), '[^0-9]', '', 'g'), '')::integer, 0) DESC) AS chamber_rank",
  "FROM openpolis_votazioni_finali_decisive",
  "WHERE data_votazione >= CURRENT_DATE - INTERVAL '120 days'",
  "AND camera IN ('Camera', 'Senato')",
  ") SELECT openpolis_id, camera, titolo, url_dettaglio, esito, data_votazione",
  "FROM ranked WHERE chamber_rank <= 50",
  "ORDER BY data_votazione DESC, camera, chamber_rank"
].join(' ');

async function refreshLatestParliamentVoteNotifications(pool, options = {}) {
  // Disabled by default. Launch only after migration and release QA.
  if (process.env.PARLIAMENT_FINAL_NOTIFICATIONS_ENABLED !== 'true') {
    return { enabled: false, checked: 0, changed: 0 };
  }
  // Cheap selection checks first. If no verified followed representatives
  // exist, do not even read candidate roll calls or make network requests.
  const allByChamber = new Map();
  const pendingByChamber = new Map();
  for (const chamber of ['Camera', 'Senato']) {
    const reps = await selectedRepresentatives(pool, chamber);
    allByChamber.set(chamber, reps);
    pendingByChamber.set(chamber, new Map(reps.map(rep => [String(rep.id), rep])));
  }
  if (![...pendingByChamber.values()].some(pending => pending.size > 0))
    return { enabled: true, checked: 0, changed: 0, unavailable: 0 };
  const { rows } = await pool.query(LATEST_FINAL_BALLOTS_SQL);
  // Latest is per selected representative. An individual absent from the
  // newest roll-call may appear in an earlier verified final ballot.
  const votes = rows.filter(vote => isRecentFinal(vote))
    .sort((a, b) => {
      const date = dateIso(b.data_votazione).localeCompare(dateIso(a.data_votazione));
      return date || voteOrder(b) - voteOrder(a);
    });
  let changed = 0, checked = 0, unavailable = 0;
  for (const vote of votes) {
    const pending = pendingByChamber.get(vote.camera);
    if (!pending?.size) continue;
    try {
      const verified = await (options.getVerifiedFinalBallots || getVerifiedFinalBallots)({
        ...vote, data_votazione: dateIso(vote.data_votazione)
      });
      // Avoid misattributing two same-name MPs to one ballot. A missing
      // member/status remains unresolved and may be found in an older final.
      const allReps = allByChamber.get(vote.camera);
      const matched = [...pending.values()].filter(rep =>
        matchUniqueMember(rep, verified.members || [], allReps, {chamber:vote.camera,sourceType:verified.source?.type})
      );
      if (!matched.length) {
        checked++;
        continue;
      }
      const result = await persistLatestForChamber(pool, vote, verified, matched);
      changed += result.changed;
      checked++;
      for (const rep of matched) pending.delete(String(rep.id));
      for (const updated of result.updated) {
        try {
          await sendFinalBallotPush(pool, {
            representativeId: updated.representativeId,
            chamber: vote.camera, openpolisId: vote.openpolis_id,
            title: vote.titolo, status: updated.status
          });
        } catch {
          // Only real committed changes are eligible; failure does not
          // erase the in-app notification.
        }
      }
    } catch {
      // A failed source stays unresolved; an older verified final vote may
      // still be shown, but its date and source remain explicit.
      unavailable++;
    }
  }
  return { enabled: true, checked, changed, unavailable };
}
module.exports = { LOCK_SELECTED_NOMINAL_ELIGIBILITY_SQL, LATEST_FINAL_BALLOTS_SQL, normalizeName, memberNameVariants, voteOrder, isRecentFinal, newestByChamber,
  matchUniqueMember, selectedRepresentatives, persistLatestForChamber,
  refreshLatestParliamentVoteNotifications };
