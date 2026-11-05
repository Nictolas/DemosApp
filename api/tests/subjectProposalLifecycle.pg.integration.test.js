'use strict';
// Runs real Express routes and the DRAFT migration on a disposable local PG17 service.
// Refuses production/staging connections; uses synthetic UUIDs and public example.org URLs only.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { Pool, Client } = require('pg');
const express = require('express');

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const ADMIN = '33333333-3333-4333-8333-333333333333';
const SCHEMA = 'subject_it';
function localDatabaseUrl() {
  const raw = process.env.CIVIC_TEST_DATABASE_URL;
  assert.equal(process.env.CIVIC_TEST_MODE, 'isolated-synthetic');
  assert.ok(raw, 'Refusing to run without temporary test database');
  const u = new URL(raw);
  assert.equal(u.protocol, 'postgres:');
  assert.equal(u.hostname, '127.0.0.1', 'Never connect to production or staging');
  assert.equal(u.port, '5432');
  assert.equal(u.pathname, '/demos_civic_ci');
  return raw;
}
async function request(base, url, who, method = 'GET', body) {
  const resp = await fetch(base + url, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(who ? {authorization: 'Bearer ' + who} : {})
    },
    ...(body === undefined ? {} : {body: JSON.stringify(body)})
  });
  return {status: resp.status, body: await resp.json()};
}
const proposal = (category, title, details = '') => ({
  category, title, details, source_url: 'https://example.org/fonte-pubblica'
});

test('actual draft SQL and Express proposal API: unique pending, Admin review, publish, DSAR and no Grazia clone', async () => {
  const connectionString = localDatabaseUrl();
  // The test database target has been checked above; the release gate now
  // requires an explicit opt-in even for isolated CI. Restore on exit.
  const oldNominationFlag=process.env.DEMOS_THIRD_PARTY_NOMINATIONS_ENABLED;
  process.env.DEMOS_THIRD_PARTY_NOMINATIONS_ENABLED='true';
  const setup = new Client({connectionString});
  let pool, server;
  await setup.connect();
  try {
    // CI database is disposable. All app tables are isolated from other CI suites.
    await setup.query('CREATE SCHEMA ' + SCHEMA);
    await setup.query("CREATE TABLE " + SCHEMA + ".users (id uuid PRIMARY KEY, is_admin boolean NOT NULL DEFAULT false, ruolo text NOT NULL DEFAULT 'U', status text NOT NULL DEFAULT 'a')");
    await setup.query("CREATE TABLE " + SCHEMA + ".notifiche_demos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), id_utente uuid, titolo text, testo text NOT NULL)");
    await setup.query("CREATE TABLE " + SCHEMA + ".amnistia (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), legge text, articolo text, descrizione text, fonte_url text, attiva boolean)");
    await setup.query("CREATE TABLE " + SCHEMA + ".voti_capo_stato (id serial PRIMARY KEY, nome text NOT NULL)");
    await setup.query("CREATE TABLE " + SCHEMA + ".voti_amnistia (id serial PRIMARY KEY, legge text NOT NULL)");
    await setup.query("INSERT INTO " + SCHEMA + ".users(id,is_admin) VALUES ($1,false),($2,false),($3,true)", [A,B,ADMIN]);
    // Supabase roles are ordinarily present; provision them ONLY in ephemeral CI.
    await setup.query("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF; IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF; END $$");
    const migration = fs.readFileSync(path.join(__dirname, '../migrations/20261031_subject_proposals_review_gate.sql'), 'utf8');
    assert.match(migration, /CREATE TABLE IF NOT EXISTS public.subject_proposals/);
    // Only the schema qualifier is replaced; constraints, indexes and RLS are unmodified.
    const migratedSql = migration.replaceAll('public.', SCHEMA + '.');
    await setup.query(migratedSql);

    // Simulate the old staging CHECK (five categories) and a legacy Grazia row.
    // Re-running the migration must fail closed without deleting that row.
    await setup.query('ALTER TABLE ' + SCHEMA + '.subject_proposals DROP CONSTRAINT subject_proposals_category_check');
    await setup.query("ALTER TABLE " + SCHEMA + ".subject_proposals ADD CONSTRAINT subject_proposals_category_check CHECK (category IN ('capo_stato','grazia','amnistia','attivisti','organizzazioni'))");
    await setup.query("INSERT INTO " + SCHEMA + ".subject_proposals(proposer_user_id,category,title,source_url) VALUES($1,'grazia','Persona sintetica legacy','https://example.org')",[A]);
    await assert.rejects(setup.query(migratedSql), e => /migration blocked: Grazia rows/.test(e.message),
      'legacy third-party rows must block the migration instead of being erased');
    const stillThere=await setup.query("SELECT COUNT(*)::integer n FROM " + SCHEMA + ".subject_proposals WHERE category='grazia'");
    assert.equal(stillThere.rows[0].n,1,'failed migration preserves legacy rows');
    // Only disposable fixture data is removed here; production migrations never DELETE.
    await setup.query("DELETE FROM " + SCHEMA + ".subject_proposals WHERE category='grazia'");
    await setup.query(migratedSql);
    const categoryCheck=await setup.query(
      "SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid=$1::regclass AND conname='subject_proposals_category_check'",
      [SCHEMA+'.subject_proposals']
    );
    assert.equal(categoryCheck.rows.length,1);
    assert.doesNotMatch(categoryCheck.rows[0].definition,/grazia/i,
      'reapplied migration must narrow the old staging CHECK');
    const rel = await setup.query("SELECT relrowsecurity FROM pg_class WHERE oid = $1::regclass", [SCHEMA+'.subject_proposals']);
    assert.equal(rel.rows[0].relrowsecurity, true);
    const rights = await setup.query("SELECT has_table_privilege('anon',$1,'SELECT') anon_can_read, has_table_privilege('authenticated',$1,'SELECT') auth_can_read", [SCHEMA+'.subject_proposals']);
    assert.equal(rights.rows[0].anon_can_read, false);
    assert.equal(rights.rows[0].auth_can_read, false);

    pool = new Pool({connectionString,max:16,options:'-c search_path=' + SCHEMA + ',public'});
    const dbPath = require.resolve('../config/database');
    const authPath = require.resolve('../middleware/auth');
    require.cache[dbPath] = {id:dbPath,filename:dbPath,loaded:true,exports:{getPool:() => pool}};
    const verifyToken = (req,res,next) => {
      const raw=req.headers.authorization;
      const id=raw==='Bearer a'?A:raw==='Bearer b'?B:raw==='Bearer admin'?ADMIN:null;
      if(!id) return res.status(401).json({success:false,error:'Unauthorized'});
      req.user={id,isAdmin:id===ADMIN};next();
    };
    const requireAdmin = (req,res,next) => req.user?.isAdmin?next():res.status(403).json({success:false});
    require.cache[authPath] = {id:authPath,filename:authPath,loaded:true,exports:{verifyToken,requireAdmin}};
    const app=express();app.use(express.json());
    app.use('/api/subject-proposals',require('../routes/subject-proposals'));
    server=http.createServer(app);
    await new Promise(done=>server.listen(0,'127.0.0.1',done));
    const base='http://127.0.0.1:'+server.address().port;
    const req=(uri,who,method,body)=>request(base,uri,who,method,body);

    assert.equal((await req('/api/subject-proposals',null,'POST',proposal('attivisti','Attivista sintetica'))).status,401);
    assert.equal((await req('/api/subject-proposals','a','POST',proposal('grazia','Persona sintetica'))).status,409);
    assert.equal((await req('/api/subject-proposals/mine?category=grazia','a')).status,409);
    assert.equal((await req('/api/subject-proposals','a','POST',{...proposal('attivisti','Persona sintetica'),source_url:'http://non-sicuro.example.org'})).status,400);
    const capo=proposal('capo_stato','Candidata sintetica approvabile');
    const concurrent=await Promise.all(Array.from({length:8},()=>req('/api/subject-proposals','a','POST',capo)));
    assert.equal(concurrent.filter(x=>x.status===201).length,1,'only one accepted concurrently');
    assert.equal(concurrent.filter(x=>x.status===409).length,7,'duplicates must fail atomically');
    const capoId=concurrent.find(x=>x.status===201).body.proposal.id;
    assert.equal((await req('/api/subject-proposals','a','POST',proposal('capo_stato','Altro candidato sintetico'))).status,409);
    assert.equal((await req('/api/subject-proposals','b','POST',capo)).status,409,'cross-user duplicate subject rejected');
    const own=await req('/api/subject-proposals/mine?category=capo_stato','a');
    const other=await req('/api/subject-proposals/mine?category=capo_stato','b');
    assert.equal(own.body.pending.id,capoId);
    assert.equal(other.body.pending,null);
    assert.equal((await req('/api/subject-proposals/admin','a')).status,403);
    const pending=await req('/api/subject-proposals/admin','admin');
    assert.equal(pending.status,200);
    assert.equal(pending.body.proposals.length,1);
    assert.equal(pending.body.proposals[0].id,capoId);
    assert.equal(Object.hasOwn(pending.body.proposals[0],'proposer_user_id'),false,'admin listing must not send proposer UUID');
    assert.equal(pending.body.proposals[0].title,capo.title,'review information is still available');
    const notices=await pool.query('SELECT id_utente,testo FROM notifiche_demos');
    assert.equal(notices.rows.length,1,'one Admin notification for one accepted proposal');
    assert.equal(notices.rows[0].id_utente,ADMIN);
    assert.equal(notices.rows[0].testo.includes(capo.title),false,'no third-party name leaked to preview');
    const notPublished=await pool.query('SELECT count(*)::integer n FROM capo_stato_soggetti_approvati');
    assert.equal(notPublished.rows[0].n,0,'pending not public');
    const approval=await req('/api/subject-proposals/admin/'+capoId+'/decision','admin','POST',{decision:'approve'});
    assert.equal(approval.status,200,JSON.stringify(approval.body));
    assert.equal(approval.body.status,'approved');
    const confirmed=await pool.query(
      'SELECT submission_notification_sent,review_notification_sent FROM subject_proposals WHERE id=$1',[capoId]
    );
    assert.equal(confirmed.rows[0].submission_notification_sent,true);
    assert.equal(confirmed.rows[0].review_notification_sent,true);
    assert.equal((await req('/api/subject-proposals/admin/'+capoId+'/decision','admin','POST',{decision:'approve'})).status,409);
    const publicCapo=await pool.query('SELECT nome,active,source_proposal_id FROM capo_stato_soggetti_approvati');
    assert.equal(publicCapo.rows.length,1);
    assert.equal(publicCapo.rows[0].nome,capo.title);
    assert.equal(publicCapo.rows[0].active,true);
    assert.equal(publicCapo.rows[0].source_proposal_id,capoId);
    assert.equal((await req('/api/subject-proposals','a','POST',proposal('capo_stato','Nuovo candidato sintetico'))).status,201,'new pending allowed after review');

    const amnistia=await req('/api/subject-proposals','a','POST',proposal('amnistia','Norma sintetica numero uno','Descrizione pubblica'));
    assert.equal(amnistia.status,201);
    const approvedAmnistia=await req('/api/subject-proposals/admin/'+amnistia.body.proposal.id+'/decision','admin','POST',{decision:'approve'});
    assert.equal(approvedAmnistia.status,200,JSON.stringify(approvedAmnistia.body));
    const active=await pool.query("SELECT legge,attiva FROM amnistia WHERE legge='Norma sintetica numero uno'");
    assert.equal(active.rows.length,1);
    assert.equal(active.rows[0].attiva,true);

    const org=await req('/api/subject-proposals','b','POST',proposal('organizzazioni','Organizzazione sintetica'));
    assert.equal(org.status,201);
    const publishedBefore=await req('/api/subject-proposals/approved?category=organizzazioni');
    assert.equal(publishedBefore.body.data.length,0);
    assert.equal((await req('/api/subject-proposals/admin/'+org.body.proposal.id+'/decision','admin','POST',{decision:'approve'})).status,200);
    const publishedAfter=await req('/api/subject-proposals/approved?category=organizzazioni');
    assert.equal(publishedAfter.body.data.length,1);
    assert.equal(publishedAfter.body.data[0].title,'Organizzazione sintetica');
    assert.deepEqual(Object.keys(publishedAfter.body.data[0]).sort(),['id','title'],
      'public approved listing must not disclose optional narratives, source URLs or proposer identities');

    // Test actual unpublishing via authorized route and its transaction on PG17.
    const orgId=org.body.proposal.id;
    assert.equal((await req('/api/subject-proposals/admin/approved','a')).status,403);
    assert.equal((await req('/api/subject-proposals/admin/approved',null)).status,401);
    const adminPublished=await req('/api/subject-proposals/admin/approved','admin');
    assert.equal(adminPublished.status,200);
    assert.deepEqual(Object.keys(adminPublished.body.proposals[0]).sort(),['category','id','reviewed_at','title'],
      'approved Admin listing must not return proponent UUID or narrative');
    assert.equal(adminPublished.body.proposals[0].id,orgId);
    assert.equal((await req('/api/subject-proposals/admin/'+orgId+'/withdraw','b','POST',{note:'Ritiro cautelativo'})).status,403);
    assert.equal((await req('/api/subject-proposals/admin/'+orgId+'/withdraw','admin','POST',{note:''})).status,400);
    // Capo di Stato: a legacy vote must survive, but cannot resurrect
    // the withdrawn name in the ranking or authorize a fresh vote.
    await pool.query('INSERT INTO voti_capo_stato(nome) VALUES($1)',[capo.title]);
    await pool.query('INSERT INTO voti_amnistia(legge) VALUES($1)',[amnistia.body.proposal.title]);
    const capoRouteSource = fs.readFileSync(path.join(__dirname, '../routes/capo-stato.js'), 'utf8');
    const rankingSql = capoRouteSource.match(/const classificaQuery = `([\s\S]*?)`;/)?.[1];
    const whitelistSql = capoRouteSource.match(/const allowed = await pool\.query\(\s*`([\s\S]*?)`/)?.[1];
    assert.ok(rankingSql && whitelistSql, 'test must execute the actual Capo di Stato SQL');
    assert.equal((await pool.query(rankingSql)).rows.some(x=>x.nome===capo.title),true);
    assert.equal((await pool.query(whitelistSql,[capo.title])).rows.length,1);
    const capoWithdraw=await req('/api/subject-proposals/admin/'+capoId+'/withdraw',
      'admin','POST',{note:'Ritiro cautelativo'});
    assert.equal(capoWithdraw.status,200,JSON.stringify(capoWithdraw.body));
    assert.equal((await req('/api/subject-proposals/admin/'+capoId+'/withdraw',
      'admin','POST',{note:'Ritiro ripetuto'})).status,409);
    const capoHidden=await pool.query(
      'SELECT active FROM capo_stato_soggetti_approvati WHERE source_proposal_id=$1',[capoId]);
    assert.equal(capoHidden.rows[0].active,false);
    assert.equal((await pool.query(rankingSql)).rows.some(x=>x.nome===capo.title),false,
      'old votes cannot resurrect the withdrawn candidate');
    assert.equal((await pool.query(whitelistSql,[capo.title])).rows.length,0,
      'old votes cannot whitelist a withdrawn candidate');
    assert.equal((await pool.query('SELECT count(*)::integer n FROM voti_capo_stato WHERE nome=$1',
      [capo.title])).rows[0].n,1, 'historic Capo vote is preserved');
    assert.equal((await req('/api/subject-proposals','b','POST',capo)).status,409,
      'withdrawn Capo title remains protected from re-proposal');

    // Amnistia: deactivate only the proposal-linked catalogue row and
    // preserve original preference rows; prevent a repeated withdrawal.
    const amnistiaId=amnistia.body.proposal.id;
    const amnistiaWithdraw=await req('/api/subject-proposals/admin/'+amnistiaId+'/withdraw',
      'admin','POST',{note:'Ritiro cautelativo'});
    assert.equal(amnistiaWithdraw.status,200,JSON.stringify(amnistiaWithdraw.body));
    assert.equal((await req('/api/subject-proposals/admin/'+amnistiaId+'/withdraw',
      'admin','POST',{note:'Ritiro ripetuto'})).status,409);
    const amnistiaHidden=await pool.query('SELECT attiva FROM amnistia WHERE id::text=$1',
      [approvedAmnistia.body.published_ref]);
    assert.equal(amnistiaHidden.rows[0].attiva,false);
    assert.equal((await pool.query('SELECT id FROM amnistia WHERE attiva=true AND legge=$1',
      [amnistia.body.proposal.title])).rows.length,0);
    assert.equal((await pool.query('SELECT count(*)::integer n FROM voti_amnistia WHERE legge=$1',
      [amnistia.body.proposal.title])).rows[0].n,1,'historic Amnistia vote is preserved');
    assert.equal((await req('/api/subject-proposals','b','POST',
      proposal('amnistia',amnistia.body.proposal.title))).status,409);
    for (const id of [capoId,amnistiaId]) {
      const audit=await pool.query(
        'SELECT status,withdrawn_by,withdrawn_at,withdraw_note,reviewed_by,reviewed_at,published_ref FROM subject_proposals WHERE id=$1',
        [id]);
      assert.equal(audit.rows[0].status,'withdrawn');
      assert.equal(audit.rows[0].withdrawn_by,ADMIN);
      assert.ok(audit.rows[0].withdrawn_at);
      assert.equal(audit.rows[0].withdraw_note,'Ritiro cautelativo');
      assert.equal(audit.rows[0].reviewed_by,ADMIN);
      assert.ok(audit.rows[0].reviewed_at);
      assert.equal(audit.rows[0].published_ref,
        id===capoId ? approval.body.published_ref : approvedAmnistia.body.published_ref,
        'withdrawn voting catalogue keeps its original private publication reference');
    }
    const beforeWithdraw=await pool.query(
      'SELECT reviewed_at,reviewed_by,review_note FROM subject_proposals WHERE id=$1',[orgId]
    );
    const concurrentWithdraw=await Promise.all(Array.from({length:3},
      ()=>req('/api/subject-proposals/admin/'+orgId+'/withdraw','admin','POST',{note:'Ritiro cautelativo'})));
    assert.equal(concurrentWithdraw.filter(x=>x.status===200).length,1,
      'exactly one concurrent withdrawal may commit');
    assert.equal(concurrentWithdraw.filter(x=>x.status===409).length,2,
      'repeat withdrawals must not change the audit record');
    assert.equal(concurrentWithdraw.find(x=>x.status===200).body.status,'withdrawn');
    const afterWithdraw=await pool.query(
      'SELECT status,withdrawn_at,withdrawn_by,withdraw_note,published_ref,reviewed_at,reviewed_by,review_note FROM subject_proposals WHERE id=$1',[orgId]
    );
    const withdrawn=afterWithdraw.rows[0];
    assert.equal(withdrawn.status,'withdrawn');
    assert.ok(withdrawn.withdrawn_at);
    assert.equal(withdrawn.withdrawn_by,ADMIN);
    assert.equal(withdrawn.withdraw_note,'Ritiro cautelativo');
    assert.equal(withdrawn.published_ref,orgId,
      'private historical reference is preserved without restoring the public directory');
    assert.deepEqual({
      reviewed_at:withdrawn.reviewed_at,
      reviewed_by:withdrawn.reviewed_by,
      review_note:withdrawn.review_note
    },beforeWithdraw.rows[0],'original approval audit is not overwritten');
    const afterWithdrawDirectory=await req('/api/subject-proposals/approved?category=organizzazioni');
    assert.equal(afterWithdrawDirectory.status,200);
    assert.deepEqual(afterWithdrawDirectory.body.data,[],'withdrawn name must vanish from public directory');
    assert.equal((await req('/api/subject-proposals/admin/approved','admin')).body.proposals.some(p=>p.id===orgId),false);
    const afterWithdrawNotices=await pool.query(
      "SELECT testo FROM notifiche_demos WHERE id_utente=$1 AND testo LIKE 'La pubblicazione%'",[B]
    );
    assert.equal(afterWithdrawNotices.rows.length,1,'proponent notified privately only once');
    assert.equal(afterWithdrawNotices.rows[0].testo.includes(org.title),false,'withdrawal notice has no public third-party name');
    const successfulNotice=await pool.query(
      "SELECT withdraw_notification_sent FROM subject_proposals WHERE id=$1",[orgId]
    );
    assert.equal(successfulNotice.rows[0].withdraw_notification_sent,true,
      'successful notification transaction must durably mark the withdrawn proposal');
    assert.equal((await req('/api/subject-proposals/admin/withdraw-notifications',null)).status,401);
    assert.equal((await req('/api/subject-proposals/admin/withdraw-notifications','b')).status,403);
    const emptyNoticeAudit=await req('/api/subject-proposals/admin/withdraw-notifications','admin');
    assert.equal(emptyNoticeAudit.status,200);
    assert.deepEqual(emptyNoticeAudit.body.withdrawals,[],
      'delivered notifications must not be flagged for manual review');

    // Privacy: withdrawing a person or organization must NOT allow a second
    // account to bring the same title straight back into the moderation queue.
    // A corrected nomination requires an explicit DPO/Admin process, not a new POST.
    const rePropose=await req('/api/subject-proposals','b','POST',proposal('organizzazioni',org.body.proposal.title));
    assert.equal(rePropose.status,409,'withdrawn title must remain protected');
    assert.equal((await req('/api/subject-proposals','a','POST',
      proposal('organizzazioni',org.body.proposal.title.toUpperCase()))).status,409,
      'different account and case must not bypass a withdrawn title');
    // Unicode: U+00E8 and e + U+0300 must not create separate records.
    // Whitespace: do not allow direct database writers to bypass the API trim.
    const unicode=await req('/api/subject-proposals','b','POST',
      proposal('attivisti','Comunità Caffè'));
    assert.equal(unicode.status,201);
    assert.equal((await req('/api/subject-proposals/admin/'+unicode.body.proposal.id+'/decision',
      'admin','POST',{decision:'approve'})).status,200);
    assert.equal((await req('/api/subject-proposals/admin/'+unicode.body.proposal.id+'/withdraw',
      'admin','POST',{note:'Ritiro sintetico'})).status,200);
    const decomposed='Comunita\u0300 Caffe\u0300';
    assert.equal((await req('/api/subject-proposals','a','POST',
      proposal('attivisti',decomposed))).status,409,
      'canonical Unicode variants cannot re-submit a withdrawn title');
    const unicodeGuard=await pool.query(
      "SELECT indexdef FROM pg_indexes WHERE schemaname=$1 AND indexname='subject_proposals_no_duplicate_open_titles'",
      [SCHEMA]
    );
    assert.match(unicodeGuard.rows[0].indexdef,/normalize\s*\(/i);
    assert.match(unicodeGuard.rows[0].indexdef,/regexp_replace\s*\(/i);
    await assert.rejects(pool.query(
      "INSERT INTO subject_proposals(proposer_user_id,category,title,source_url) VALUES($1,'attivisti',$2,'https://example.org')",
      [A,'Comunità    Caffè']
    ),e=>e.code==='23505','raw SQL repeated whitespace must not bypass the withdrawn title');
    await assert.rejects(pool.query(
      "INSERT INTO subject_proposals(proposer_user_id,category,title,source_url) VALUES($1,'attivisti',$2,'https://example.org')",
      [A,decomposed]
    ),e=>e.code==='23505','raw SQL decomposed accents must not bypass the withdrawn title');
    const freshOrg=await req('/api/subject-proposals','b','POST',
      proposal('organizzazioni','Nuova organizzazione sintetica distinta'));
    assert.equal(freshOrg.status,201,'unrelated nomination can still proceed');

    // Safety: an outage in notifiche_demos must NOT undo an urgent public
    // unpublish. Raise a synthetic error only for withdrawal notifications.
    const emergency=await req('/api/subject-proposals','a','POST',
      proposal('organizzazioni','Organizzazione con notifica non disponibile'));
    assert.equal(emergency.status,201,'independent proposer can create a distinct nomination');
    const emergencyId=emergency.body.proposal.id;
    assert.equal((await req('/api/subject-proposals/admin/'+emergencyId+'/decision',
      'admin','POST',{decision:'approve'})).status,200);
    await setup.query(
      "CREATE FUNCTION "+SCHEMA+".reject_withdraw_notice() RETURNS trigger LANGUAGE plpgsql AS $notice$ BEGIN IF NEW.testo LIKE 'La pubblicazione%' THEN RAISE EXCEPTION 'synthetic notice outage'; END IF; RETURN NEW; END $notice$"
    );
    await setup.query(
      "CREATE TRIGGER reject_withdraw_notice BEFORE INSERT ON "+SCHEMA+
      ".notifiche_demos FOR EACH ROW EXECUTE FUNCTION "+SCHEMA+".reject_withdraw_notice()"
    );
    const emergencyWithdrawal=await req('/api/subject-proposals/admin/'+emergencyId+
      '/withdraw','admin','POST',{note:'Ritiro urgente sintetico'});
    assert.equal(emergencyWithdrawal.status,200,'an unavailable notification must not block unpublishing');
    assert.equal(emergencyWithdrawal.body.status,'withdrawn');
    assert.equal(emergencyWithdrawal.body.notification_sent,false,
      'Admin must know the proponent was not notified');
    const emergencyRow=await pool.query(
      'SELECT status, withdrawn_at, withdrawn_by FROM subject_proposals WHERE id=$1',[emergencyId]
    );
    assert.equal(emergencyRow.rows[0].status,'withdrawn','database withdrawal must remain committed');
    assert.ok(emergencyRow.rows[0].withdrawn_at);
    assert.equal(emergencyRow.rows[0].withdrawn_by,ADMIN);
    const durableFlag=await pool.query(
      'SELECT withdraw_notification_sent FROM subject_proposals WHERE id=$1',[emergencyId]
    );
    assert.equal(durableFlag.rows[0].withdraw_notification_sent,false,
      'unconfirmed notification must persist on the existing withdrawal row');
    const manualAudit=await req('/api/subject-proposals/admin/withdraw-notifications','admin');
    assert.equal(manualAudit.status,200);
    const reviewItem=manualAudit.body.withdrawals.find(x=>x.id===emergencyId);
    assert.ok(reviewItem,'Admin can recover undelivered notice after any new GET/session');
    assert.deepEqual(Object.keys(reviewItem).sort(),['category','id','recipient_unavailable','withdrawn_at'],
      'review list returns only a derived recipient flag, not name, account UUID or source narrative');
    assert.equal(reviewItem.recipient_unavailable,false,
      'temporary notification outage for an active recipient still requires manual review');
    assert.equal(reviewItem.category,'organizzazioni');
    assert.equal((await req('/api/subject-proposals/admin/withdraw-notifications','a')).status,403);

    const emergencyDirectory=await req('/api/subject-proposals/approved?category=organizzazioni');
    assert.equal(emergencyDirectory.status,200);
    assert.equal(emergencyDirectory.body.data.some(x=>x.id===emergencyId),false,
      'name must be hidden even when recipient notification cannot be inserted');
    assert.equal((await req('/api/subject-proposals/admin/'+emergencyId+
      '/withdraw','admin','POST',{note:'Ritiro di nuovo'})).status,409,
      'failed notification must never permit reapplying a committed withdrawal');
    await setup.query('DROP TRIGGER reject_withdraw_notice ON '+SCHEMA+'.notifiche_demos');
    await setup.query('DROP FUNCTION '+SCHEMA+'.reject_withdraw_notice()');

    // Separate synthetic notification outage: original proposal/review transactions
    // must persist while the two minimal recovery flags remain FALSE.
    await setup.query(
      "CREATE FUNCTION "+SCHEMA+".reject_generic_notice() RETURNS trigger LANGUAGE plpgsql AS $notice$ BEGIN IF NEW.testo LIKE 'Nuova proposta ricevuta%' OR NEW.testo LIKE 'La tua proposta in%' THEN RAISE EXCEPTION 'synthetic generic notice outage'; END IF; RETURN NEW; END $notice$"
    );
    await setup.query(
      "CREATE TRIGGER reject_generic_notice BEFORE INSERT ON "+SCHEMA+
      ".notifiche_demos FOR EACH ROW EXECUTE FUNCTION "+SCHEMA+".reject_generic_notice()"
    );
    const failedNotice=await req('/api/subject-proposals','a','POST',
      proposal('attivisti','Attivista sintetica con avvisi non disponibili'));
    assert.equal(failedNotice.status,201,'inbox failure cannot roll back an accepted proposal');
    assert.equal(failedNotice.body.notification_sent,false);
    const failedId=failedNotice.body.proposal.id;
    const failedPending=await pool.query(
      'SELECT status,submission_notification_sent FROM subject_proposals WHERE id=$1',[failedId]
    );
    assert.equal(failedPending.rows[0].status,'pending');
    assert.equal(failedPending.rows[0].submission_notification_sent,false);
    const failedReview=await req('/api/subject-proposals/admin/'+failedId+'/decision',
      'admin','POST',{decision:'reject'});
    assert.equal(failedReview.status,200);
    assert.equal(failedReview.body.status,'rejected');
    assert.equal(failedReview.body.notification_sent,false);
    const failedReviewed=await pool.query(
      'SELECT status,review_notification_sent FROM subject_proposals WHERE id=$1',[failedId]
    );
    assert.equal(failedReviewed.rows[0].status,'rejected');
    assert.equal(failedReviewed.rows[0].review_notification_sent,false);
    assert.equal((await req('/api/subject-proposals/admin/notification-audit','a')).status,403);
    assert.equal((await req('/api/subject-proposals/admin/notification-audit',null)).status,401);
    const genericAudit=await req('/api/subject-proposals/admin/notification-audit','admin');
    assert.equal(genericAudit.status,200);
    const unconfirmed=genericAudit.body.proposals.find(x=>x.id===failedId);
    assert.ok(unconfirmed,'Admin recovers a failed private notification after a new GET');
    assert.equal(unconfirmed.submission_notification_sent,false);
    assert.equal(unconfirmed.review_notification_sent,false);
    assert.deepEqual(Object.keys(unconfirmed).sort(),
      ['category','created_at','id','recipient_unavailable','review_notification_sent','reviewed_at','status','submission_notification_sent'].sort(),
      'notice audit must omit title, proposer identity, review notes and source');
    await setup.query('DROP TRIGGER reject_generic_notice ON '+SCHEMA+'.notifiche_demos');
    await setup.query('DROP FUNCTION '+SCHEMA+'.reject_generic_notice()');

    const guardedIndex=await setup.query(
      "SELECT indexdef FROM pg_indexes WHERE schemaname=$1 AND indexname='subject_proposals_no_duplicate_open_titles'",
      [SCHEMA]
    );
    assert.equal(guardedIndex.rows.length,1);
    assert.match(guardedIndex.rows[0].indexdef,/withdrawn/i,'withdrawn gate must be enforced by PostgreSQL');

    const activist=await req('/api/subject-proposals','b','POST',proposal('attivisti','Attivista sintetica rifiutata'));
    assert.equal(activist.status,201);
    assert.equal((await req('/api/subject-proposals/admin/'+activist.body.proposal.id+'/decision','a','POST',{decision:'approve'})).status,403);
    assert.equal((await req('/api/subject-proposals/admin/'+activist.body.proposal.id+'/decision','admin','POST',{decision:'reject'})).status,200);
    const rejectedDirectory=await req('/api/subject-proposals/approved?category=attivisti');
    assert.equal(rejectedDirectory.body.data.length,0);

    // The CHECK prevents Grazia even if the API is bypassed.
    await assert.rejects(pool.query(
      "INSERT INTO subject_proposals(proposer_user_id,category,title,source_url) VALUES($1,'grazia','Persona sintetica','https://example.org')",[B]
    ), e=>e.code==='23514');

    // A previously published subject can be withdrawn even after its
    // proposer deletes their account. No message must be inserted for the
    // deleted account or reported as successfully sent.
    const postErasure=await req('/api/subject-proposals','a','POST',
      proposal('organizzazioni','Organizzazione sintetica dopo cancellazione'));
    assert.equal(postErasure.status,201);
    const ownerlessId=postErasure.body.proposal.id;
    const ownerlessApproval=await req('/api/subject-proposals/admin/'+ownerlessId+
      '/decision','admin','POST',{decision:'approve'});
    assert.equal(ownerlessApproval.status,200);

    // Direct FK safety: deleting an account must never CASCADE through an
    // approved/withdrawn proposal and erase the catalogue's audit link.
    // The canonical account-delete service separately erases pending/rejected.
    const proposerFk=await pool.query(
      "SELECT confdeltype FROM pg_constraint WHERE conrelid='subject_proposals'::regclass AND conname='subject_proposals_proposer_user_id_fkey'"
    );
    assert.equal(proposerFk.rows[0].confdeltype,'n','ON DELETE SET NULL is required for published audit');
    await pool.query('DELETE FROM users WHERE id=$1',[A]);
    const deleted=await pool.query('SELECT count(*)::integer n FROM subject_proposals WHERE proposer_user_id=$1',[A]);
    assert.equal(deleted.rows[0].n,0);
    const historic=await pool.query('SELECT status,proposer_user_id,published_ref FROM subject_proposals WHERE id=$1',[capoId]);
    assert.equal(historic.rows.length,1,'withdrawn proposal must survive account deletion');
    assert.equal(historic.rows[0].status,'withdrawn');
    assert.equal(historic.rows[0].proposer_user_id,null,'deleted owner must be unlinked');
    const publicAfterDeletion=await pool.query('SELECT source_proposal_id,active FROM capo_stato_soggetti_approvati WHERE nome=$1',[capo.title]);
    assert.equal(publicAfterDeletion.rows[0].source_proposal_id,capoId,
      'catalogue-to-proposal audit link must survive deletion of the former proposer');
    assert.equal(publicAfterDeletion.rows[0].active,false,'withdrawn catalogue stays unpublished');
    const noOwner=await pool.query(
      'SELECT status,proposer_user_id FROM subject_proposals WHERE id=$1',[ownerlessId]
    );
    assert.equal(noOwner.rows[0].status,'approved');
    assert.equal(noOwner.rows[0].proposer_user_id,null,'account erasure unlinks the published nomination');
    const withdrawalNoOwner=await req('/api/subject-proposals/admin/'+ownerlessId+
      '/withdraw','admin','POST',{note:'Ritiro dopo cancellazione account'});
    assert.equal(withdrawalNoOwner.status,200,'Admin can unpublish an ownerless subject');
    assert.equal(withdrawalNoOwner.body.status,'withdrawn');
    assert.equal(withdrawalNoOwner.body.notification_sent,false,
      'no active recipient means no notification was inserted or confirmed');
    const withdrawalAudit=await req('/api/subject-proposals/admin/withdraw-notifications','admin');
    assert.equal(withdrawalAudit.status,200);
    const orphanAudit=withdrawalAudit.body.withdrawals.find(item=>item.id===ownerlessId);
    assert.ok(orphanAudit,'unconfirmed ownerless withdrawal must remain available for audit');
    assert.equal(orphanAudit.recipient_unavailable,true,'deleted proposer has no active destination');
    assert.equal(Object.hasOwn(orphanAudit,'proposer_user_id'),false,'no account ID in Admin audit');
    assert.equal(Object.hasOwn(orphanAudit,'title'),false,'no third-party name in Admin audit');
    const orphanNotices=await pool.query(
      'SELECT count(*)::integer n FROM notifiche_demos WHERE id_utente IS NULL'
    );
    assert.equal(orphanNotices.rows[0].n,0,'never insert orphan inbox messages');

    // A suspended/inactive recipient cannot receive review notifications.
    // Review must still commit and preserve a durable FALSE audit flag.
    const inactiveId=freshOrg.body.proposal.id;
    await pool.query("UPDATE users SET status='x' WHERE id=$1",[B]);
    try {
      const inactiveReview=await req('/api/subject-proposals/admin/'+inactiveId+
        '/decision','admin','POST',{decision:'reject'});
      assert.equal(inactiveReview.status,200);
      assert.equal(inactiveReview.body.status,'rejected');
      assert.equal(inactiveReview.body.notification_sent,false);
      const inactiveAudit=await pool.query(
        'SELECT status,review_notification_sent FROM subject_proposals WHERE id=$1',[inactiveId]
      );
      assert.equal(inactiveAudit.rows[0].status,'rejected');
      assert.equal(inactiveAudit.rows[0].review_notification_sent,false);
      const reviewAudit=await req('/api/subject-proposals/admin/notification-audit','admin');
      assert.equal(reviewAudit.status,200);
      const inactiveItem=reviewAudit.body.proposals.find(item=>item.id===inactiveId);
      assert.ok(inactiveItem);
      assert.equal(inactiveItem.recipient_unavailable,true,
        'suspended recipient must not be mixed with a delivery outage');
      assert.equal(Object.hasOwn(inactiveItem,'proposer_user_id'),false);
    } finally {
      await pool.query("UPDATE users SET status='a' WHERE id=$1",[B]);
    }

    // More than 100 approved subjects must remain reachable for urgent
    // Admin unpublishing. Timestamps differ only by microseconds, which
    // catches cursors that accidentally truncate precision to JS millis.
    await pool.query(
      `INSERT INTO subject_proposals
         (proposer_user_id,category,title,source_url,status,reviewed_at)
       SELECT $1,'attivisti','Attivista paginazione ' || gs,
              'https://example.org/pagination','approved',
              now() - (gs * INTERVAL '1 microsecond')
       FROM generate_series(1,105) gs`,
      [B]
    );
    const totalApproved=Number((await pool.query(
      "SELECT count(*)::integer n FROM subject_proposals WHERE status='approved' AND category IN ('capo_stato','amnistia','attivisti','organizzazioni')"
    )).rows[0].n);
    assert.ok(totalApproved > 100 && totalApproved < 200);
    assert.equal((await req('/api/subject-proposals/admin/approved','b')).status,403);
    assert.equal((await req('/api/subject-proposals/admin/approved?cursor=invalid','admin')).status,400);
    const firstPage=await req('/api/subject-proposals/admin/approved','admin');
    assert.equal(firstPage.status,200);
    assert.equal(firstPage.body.proposals.length,100);
    assert.ok(typeof firstPage.body.next_cursor==='string' && firstPage.body.next_cursor.length>10);
    assert.deepEqual(Object.keys(firstPage.body.proposals[0]).sort(),
      ['category','id','reviewed_at','title'],
      'Admin approved page must not expose the internal cursor or proposer personal information');
    const secondPage=await req('/api/subject-proposals/admin/approved?cursor='+
      encodeURIComponent(firstPage.body.next_cursor),'admin');
    assert.equal(secondPage.status,200);
    assert.equal(secondPage.body.proposals.length,totalApproved-100);
    assert.equal(secondPage.body.next_cursor,null);
    const allIds=[...firstPage.body.proposals,...secondPage.body.proposals].map(x=>x.id);
    assert.equal(new Set(allIds).size,totalApproved,
      'keyset pagination must reach every approved row exactly once, even within a millisecond');
    const oldPublication=secondPage.body.proposals.find(p=>p.title.startsWith('Attivista paginazione '));
    assert.ok(oldPublication,'old approved subjects must remain available for emergency unpublish');
    const oldWithdraw=await req('/api/subject-proposals/admin/'+oldPublication.id+
      '/withdraw','admin','POST',{note:'Ritiro sintetico di archivio'});
    assert.equal(oldWithdraw.status,200);
    assert.equal(oldWithdraw.body.status,'withdrawn');
    assert.equal((await pool.query('SELECT status FROM subject_proposals WHERE id=$1',
      [oldPublication.id])).rows[0].status,'withdrawn');

    // 105 synthetic accounts each contribute one pending nomination. Keep
    // their timestamps only 1µs apart to detect cursor precision loss.
    await pool.query(
      `INSERT INTO users(id,is_admin)
       SELECT ('40000000-0000-4000-8000-' || lpad(gs::text,12,'0'))::uuid,false
       FROM generate_series(1,105) gs`
    );
    await pool.query(
      `INSERT INTO subject_proposals(proposer_user_id,category,title,source_url,status,created_at)
       SELECT ('40000000-0000-4000-8000-' || lpad(gs::text,12,'0'))::uuid,
              'attivisti','Attivista in attesa paginazione ' || gs,
              'https://example.org/pending','pending',
              now() - INTERVAL '1 minute' + gs * INTERVAL '1 microsecond'
       FROM generate_series(1,105) gs`
    );
    const pendingTotal=Number((await pool.query(
      "SELECT count(*)::integer n FROM subject_proposals WHERE status='pending' AND category IN ('capo_stato','amnistia','attivisti','organizzazioni')"
    )).rows[0].n);
    assert.ok(pendingTotal>100 && pendingTotal<200);
    assert.equal((await req('/api/subject-proposals/admin','b')).status,403);
    assert.equal((await req('/api/subject-proposals/admin?cursor=invalid','admin')).status,400);
    const firstPending=await req('/api/subject-proposals/admin','admin');
    assert.equal(firstPending.status,200);
    assert.equal(firstPending.body.proposals.length,100);
    assert.ok(firstPending.body.next_cursor);
    assert.deepEqual(Object.keys(firstPending.body.proposals[0]).sort(),
      ['category','created_at','details','id','source_url','title'],
      'no proposer ID or internal pagination metadata in Admin pending queue');
    const secondPending=await req('/api/subject-proposals/admin?cursor='+
      encodeURIComponent(firstPending.body.next_cursor),'admin');
    assert.equal(secondPending.status,200);
    assert.equal(secondPending.body.proposals.length,pendingTotal-100);
    assert.equal(secondPending.body.next_cursor,null);
    const ids=[...firstPending.body.proposals,...secondPending.body.proposals].map(x=>x.id);
    assert.equal(new Set(ids).size,pendingTotal,
      'every pending nomination must be reachable exactly once');
    const newestPending=secondPending.body.proposals.find(p=>p.title.startsWith('Attivista in attesa paginazione '));
    assert.ok(newestPending,'Admin can reach and review a newer pending proposal on page two');
    const reviewed=await req('/api/subject-proposals/admin/'+newestPending.id+
      '/decision','admin','POST',{decision:'reject'});
    assert.equal(reviewed.status,200);
    assert.equal(reviewed.body.status,'rejected');
    assert.equal((await pool.query('SELECT status FROM subject_proposals WHERE id=$1',
      [newestPending.id])).rows[0].status,'rejected');

    // Both private notification-audit lists must reach records beyond page 1.
    // Synthetic rows only; ensure PostgreSQL microseconds survive the cursor.
    await pool.query(
      `INSERT INTO subject_proposals(proposer_user_id,category,title,source_url,status,created_at,withdrawn_at,withdraw_notification_sent)
       SELECT ('40000000-0000-4000-8000-' || lpad(gs::text,12,'0'))::uuid,
              'organizzazioni','Organizzazione ritiro audit ' || gs,
              'https://example.org/audit','withdrawn',
              now() - INTERVAL '3 minutes',
              now() - INTERVAL '2 minutes' + gs * INTERVAL '1 microsecond',FALSE
       FROM generate_series(1,105) gs`
    );
    for (const [endpoint, bodyKey, whereSql, expectedKeys] of [
      ['/api/subject-proposals/admin/withdraw-notifications','withdrawals',
        "status='withdrawn' AND category IN ('capo_stato','amnistia','attivisti','organizzazioni') AND withdraw_notification_sent IS DISTINCT FROM TRUE",
        ['category','id','recipient_unavailable','withdrawn_at']],
      ['/api/subject-proposals/admin/notification-audit','proposals',
        "submission_notification_sent IS DISTINCT FROM TRUE OR (status IN ('approved','rejected','withdrawn') AND review_notification_sent IS DISTINCT FROM TRUE)",
        ['category','created_at','id','recipient_unavailable','review_notification_sent','reviewed_at','status','submission_notification_sent']]
    ]) {
      const expected=Number((await pool.query(
        'SELECT count(*)::integer n FROM subject_proposals WHERE '+whereSql
      )).rows[0].n);
      assert.ok(expected>100,'fixture needs more than 100 audit records');
      assert.equal((await req(endpoint,'b')).status,403,'audit remains Admin-only');
      assert.equal((await req(endpoint+'?cursor=invalid','admin')).status,400);
      let cursor=null, all=[], pages=0;
      do {
        const response=await req(endpoint+(cursor?'?cursor='+encodeURIComponent(cursor):''),'admin');
        assert.equal(response.status,200);
        assert.equal(response.body[bodyKey].length<=100,true);
        if(response.body[bodyKey].length) {
          assert.deepEqual(Object.keys(response.body[bodyKey][0]).sort(),expectedKeys,
            'cursor metadata and owner/source fields must not leak');
        }
        all.push(...response.body[bodyKey].map(x=>x.id));
        cursor=response.body.next_cursor;
        pages++;
        assert.ok(pages<10,'audit cursor must eventually terminate');
      } while(cursor);
      assert.ok(pages>=2,'audit must expose older records past first 100');
      assert.equal(all.length,expected,'all audit records must be reachable');
      assert.equal(new Set(all).size,expected,
        'withdrawal audit keyset reaches each record once without duplication');
    }
  } finally {
    if(server?.listening) await new Promise(done=>server.close(done));
    if(pool) await pool.end();
    await setup.end();
    if(oldNominationFlag===undefined)delete process.env.DEMOS_THIRD_PARTY_NOMINATIONS_ENABLED;
    else process.env.DEMOS_THIRD_PARTY_NOMINATIONS_ENABLED=oldNominationFlag;
  }
});
