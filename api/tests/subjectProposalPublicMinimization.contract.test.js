'use strict';
// DRAFT-only static contracts for the public directory entry points.
// The PostgreSQL 17 integration suite independently checks actual /approved JSON.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..');
const file = p => fs.readFileSync(path.join(root,p),'utf8');

test('modern and legacy public directory filters require active registered accounts', () => {
  for (const route of ['api/routes/attivisti.js','api/routes/organizzazioni.js']) {
    const src=file(route);
    const definitions=Array.from(src.matchAll(
      /const (?:MODERN|LEGACY)_(?:ACTIVIST|ORGANIZATION)_FILTER = ([^;]+);/g
    ));
    assert.equal(definitions.length,2,
      'both capability-model and legacy role filters must exist: '+route);
    for (const def of definitions) {
      assert.match(def[1],/u\.status\s*=\s*'a'/,
        'inactive/deleted/suspended account must not appear in public directory: '+route);
    }
    assert.match(src,/sqlTemplate\.replace\('__ACCOUNT_FILTER__'/,
      'public listing and statistics must apply the active-account predicate');
  }
});

test('all three public catalogue endpoints share a minimal approved projection', () => {
  const shared=file('api/services/publicApprovedSubjectPage.js');
  assert.match(shared,/SELECT id, title,/);
  assert.match(shared,/WHERE category=\$1 AND status='approved'/);
  assert.match(shared,/rows\.map\(\(\{id,title\}\)=>\(\{id,title\}\)\)/);
  assert.doesNotMatch(shared,/\b(?:source_url|details|proposer_user_id|review_note)\b/,
    'no private columns or original evidence in public SQL');
  for(const p of ['api/routes/subject-proposals.js','api/routes/attivisti.js','api/routes/organizzazioni.js'])
    assert.match(file(p),/readApprovedPage\(pool,/,'shared reader in '+p);
});

test('moderation still reads original evidence internally and remains Admin-protected', () => {
  const source = file('api/routes/subject-proposals.js');
  assert.match(source, /router\.get\('\/admin', verifyToken, requireAdmin/);
  assert.match(source, /SELECT id, category, title, details, source_url, created_at,\s+EXTRACT\(EPOCH FROM created_at\)/);
  assert.match(source, /router\.post\('\/admin\/:id\/decision', verifyToken, requireAdmin/);
  assert.match(source, /SELECT \* FROM subject_proposals WHERE id=\$1 AND status='pending' FOR UPDATE/);
});

test('both approved-catalogue cards only show title and are not presented as verified DEMOS accounts', () => {
  for (const p of ['client/src/pages/Attivisti.tsx','client/src/pages/Organizzazioni/index.tsx']) {
    const s=file(p);
    assert.match(s, /subject\.title/,'must preserve approved subject label in ' + p);
    assert.doesNotMatch(s, /subject\.details|subject\.source_url/,
      'public catalogue cannot render private narrative or source in ' + p);
    assert.match(s, /non (?:è ancora un profilo|un account) DEMOS verificato/i,
      'never imply public nomination is a verified DEMOS account');
  }
});

test('Admin withdrawal UI never treats a notification outage as failed unpublishing', () => {
  const api = file('api/routes/subject-proposals.js');
  const ui = file('client/src/pages/Gestisci/ProposteSoggetti.tsx');
  const withdrawal = api.split("router.post('/admin/:id/withdraw'")[1]
    .split("// Atomic review:")[0];
  assert.ok(withdrawal, 'withdrawal route exists');
  assert.ok(withdrawal.indexOf("await client.query('COMMIT')") <
    withdrawal.indexOf('await notify(noticeClient,'),
    'emergency database withdrawal must commit BEFORE independent notification');
  assert.match(withdrawal,/notification_sent: notificationSent/);
  assert.match(withdrawal,/await noticeClient\.query\('BEGIN'\)/);
  assert.match(withdrawal,/await notify\(noticeClient,/);
  assert.match(withdrawal,/UPDATE subject_proposals SET withdraw_notification_sent=TRUE/);
  assert.match(withdrawal,/await noticeClient\.query\('COMMIT'\)/);
  assert.match(withdrawal,/withdraw_notification_sent=FALSE WHERE id=\$1/);
  assert.match(ui,/result\.notification_sent !== true/);
  assert.match(ui,/setUndeliveredNotification\(true\)/);
  assert.match(ui,/role="alert"/);
  assert.match(ui,/Verificarle con il DPO|Segnalare al DPO/i);
});

test('unconfirmed withdrawal notification audit is Admin-only, minimal and read on demand', () => {
  const api = file('api/routes/subject-proposals.js');
  const ui = file('client/src/pages/Gestisci/ProposteSoggetti.tsx');
  assert.match(api, /router\.get\('\/admin\/withdraw-notifications', verifyToken, requireAdmin/);
  assert.match(api, /SELECT p\.id, p\.category, p\.withdrawn_at, \(p\.proposer_user_id IS NULL/);
  assert.match(api, /LEFT JOIN users u ON u\.id=p\.proposer_user_id/);
  assert.match(api, /withdraw_notification_sent IS DISTINCT FROM TRUE/);
  assert.match(api, /Cache-Control', 'private, no-store'/);
  const auditSql = api.split("router.get('/admin/withdraw-notifications'")[1]
    .split("router.post('/admin/:id/withdraw'")[0];
  assert.match(auditSql, /AS recipient_unavailable/);
  assert.doesNotMatch(auditSql, /AS proposer_user_id|AS title|AS source_url|AS withdraw_note/,
    'the audit returns a derived boolean, never the personal source columns');
  assert.match(ui, /item\.recipient_unavailable/,
    'Admin must distinguish missing recipient from a delivery outage');
  assert.match(ui, /const switchUndelivered = \(\) => \{/);
  assert.match(ui, /void refreshUndelivered\(\)/);
  assert.match(ui, /"\/api\/subject-proposals\/admin\/withdraw-notifications"/);
  assert.match(ui, /Avvisi da verificare/);
  assert.match(ui, /non verranno reinviate automaticamente/);
});


test('public activist and organization lists never log personal search filters or raw SQL errors', () => {
  for (const p of ['api/routes/attivisti.js', 'api/routes/organizzazioni.js']) {
    const source = file(p);
    assert.doesNotMatch(source, /console\.log\s*\(/,
      'search terms, user IDs, SQL parameters and list entries must not appear in debug logs: ' + p);
    assert.doesNotMatch(source, /console\.error\s*\([^;]*,\s*error\s*\)/,
      'raw database errors can contain personal SQL values: ' + p);
    assert.match(source, /'Cache-Control': 'no-cache, no-store, must-revalidate'/,
      'public list with third-party approved titles must not be cached: ' + p);
    assert.match(source, /readApprovedPage\(pool, '(?:attivisti|organizzazioni)'\)/,
      'only minimal approved titles exposed in directory: ' + p);
  }
  const org = file('client/src/pages/Organizzazioni/index.tsx');
  assert.match(org, /fetch\(url, \{ signal: controller\.signal, cache: 'no-store' \}\)/,
    'client must not reuse an outdated organization response after a withdrawal');
  const activist = file('client/src/pages/Attivisti.tsx');
  assert.match(activist, /const url = getApiUrl\(`\/api\/attivisti/,
    'activist must use the configured API host');
  assert.match(activist, /fetch\(url, \{ signal: controller\.signal, cache: 'no-store' \}\)/,
    'active directory GET must not re-use stale personal results');
});

test('public directory SQL omits unnecessary profile PII while preserving visible card fields', () => {
  // Check every SELECT projection, including the alternate activist /tipologia route.
  const forbidden = /\b(?:u\.)?(?:email|status|created_at|updated_at|genere|data_nascita|cittadinanza|paese_residenza|provincia_residenza|comune_residenza)\b/i;
  for (const endpoint of ['api/routes/attivisti.js', 'api/routes/organizzazioni.js']) {
    const source = file(endpoint);
    const sqlTemplates = Array.from(source.matchAll(/\bquery(?:Activists|Organizations)\(\s*`([\s\S]*?)`/g), match => match[1]);
    const projections = sqlTemplates.flatMap(sql => Array.from(sql.matchAll(/\bSELECT\s+([\s\S]*?)\s+FROM users u\b/g), match => match[1]));
    assert.ok(projections.length >= (endpoint.includes('attivisti') ? 2 : 1),
      'expected all public directory SELECT statements: ' + endpoint);
    for (const projection of projections) {
      assert.doesNotMatch(projection, forbidden, 'public projection must not read private profile columns: ' + endpoint);
    }
    assert.match(source, /u\.regione_residenza/, 'public region filter must remain usable');
    assert.match(source, /supporters_count/, 'supporter counts remain available');
    assert.match(source, /u\.avatar_config/, 'public avatar remains available');
    assert.match(source, /u\.tipologie_attivismo/, 'public activism tags remain available');
  }
  const activist = file('client/src/pages/Attivisti.tsx');
  const organization = file('client/src/pages/Organizzazioni/index.tsx');
  const modal = file('client/src/components/OrganizzazioneModal.tsx');
  for (const source of [activist, organization, modal]) {
    assert.doesNotMatch(source, /^\s*(?:email|genere|data_nascita|cittadinanza|paese_residenza|provincia_residenza|comune_residenza|created_at|updated_at|status)\??:\s*string;/m,
      'UI types should not advertise fields removed from the public contract');
  }
});

test('submission and Admin decision commit before fallible private notifications', () => {
  const route = file('api/routes/subject-proposals.js');
  const submission = route.slice(route.indexOf("router.post('/', verifyToken"), route.indexOf("router.get('/admin'"));
  const decision = route.slice(route.indexOf("router.post('/admin/:id/decision'"));
  assert.ok(submission.indexOf("await client.query('COMMIT')") >= 0);
  assert.ok(submission.indexOf("await client.query('COMMIT')") < submission.indexOf("INSERT INTO notifiche_demos"));
  assert.ok(decision.indexOf("await client.query('COMMIT')") < decision.indexOf("await notify(noticeClient"));
  assert.match(submission, /notification_sent: notificationSent/);
  assert.match(decision, /notification_sent: notificationSent/);
  // No pool starvation: release committed transactions before acquiring
  // another connection for optional notifications, even with pool max=1.
  for (const handler of [submission, decision]) {
    assert.match(handler, /await client\.query\('COMMIT'\);[\s\S]{0,250}?client\.release\(\);\s*client = null;/);
  }
  for (const handler of [submission, decision]) {
    assert.match(handler, /let client;/);
    assert.match(handler, /client = await pool\.connect\(\)/);
    assert.match(handler, /client\?\.release\(\)/);
  }
});

test('submission and review notices have minimal durable audit without re-sending', () => {
  const migration=file('api/migrations/20261031_subject_proposals_review_gate.sql');
  const readiness=file('api/scripts/check-proposals-schema-readiness.js');
  const rollback=file('api/migrations/20261104_subject_proposal_notice_flags_rollback.sql');
  assert.match(rollback,/BEGIN;/);
  assert.match(rollback,/submission_notification_sent IS NOT NULL OR review_notification_sent IS NOT NULL/);
  assert.match(rollback,/RAISE EXCEPTION 'Cannot drop recorded notification states/);
  assert.match(rollback,/COMMIT;/);
  const route=file('api/routes/subject-proposals.js');
  const ui=file('client/src/pages/Gestisci/ProposteSoggetti.tsx');
  for (const col of ['submission_notification_sent','review_notification_sent']) {
    assert.match(migration,new RegExp('ADD COLUMN IF NOT EXISTS '+col+' boolean'));
    assert.ok(readiness.includes("'"+col+"'"), 'preflight must fail closed if audit column absent: '+col);
    assert.match(route,new RegExp(col+'=TRUE WHERE id=\\$1'));
    assert.match(route,new RegExp(col+'=FALSE'));
  }
  assert.match(route,/router\.get\('\/admin\/notification-audit', verifyToken, requireAdmin/);
  const audit=route.slice(route.indexOf("router.get('/admin/notification-audit'"),route.indexOf('// Emergency unpublish'));
  assert.match(audit,/private, no-store/);
  assert.match(audit,/IS DISTINCT FROM TRUE/);
  assert.match(audit,/AS recipient_unavailable/);
  assert.doesNotMatch(audit,/SELECT\s+(?:p\.)?(?:proposer_user_id|title|details|source_url|review_note)\b|AS\s+(?:proposer_user_id|title|details|source_url|review_note)\b/i,
    'derived recipient flag may inspect private state but must not return it');
  assert.match(ui,/\/api\/subject-proposals\/admin\/notification-audit/);
  assert.match(ui,/result\.notification_sent !== true/);
  assert.match(ui,/Verificare con il DPO/);
  const mount=ui.slice(ui.indexOf('useEffect(() =>'),ui.indexOf('const refreshApproved'));
  assert.doesNotMatch(mount,/notification-audit|withdraw-notifications/);
  assert.doesNotMatch(route,/setTimeout\(|setInterval\(/);
});

test('Capo di Stato and Amnistia withdrawal hides catalogue entries but never deletes historic votes', () => {
  const route=file('api/routes/subject-proposals.js');
  const capo=file('api/routes/capo-stato.js');
  const amnistia=file('api/routes/amnistia.js');
  const ui=file('client/src/pages/Gestisci/ProposteSoggetti.tsx');
  const withdrawal=route.split("router.post('/admin/:id/withdraw'")[1].split('// Atomic review:')[0];
  assert.match(withdrawal,/category IN \('capo_stato','amnistia','attivisti','organizzazioni'\)/);
  assert.match(withdrawal,/UPDATE capo_stato_soggetti_approvati SET active=FALSE WHERE source_proposal_id=\$1/);
  assert.match(withdrawal,/UPDATE amnistia SET attiva=FALSE WHERE id::text=\$1/);
  assert.match(withdrawal,/deactivated\.rowCount !== 1/);
  assert.ok(withdrawal.indexOf('UPDATE capo_stato_soggetti_approvati SET active=FALSE') <
    withdrawal.indexOf("UPDATE subject_proposals SET status='withdrawn'"));
  assert.ok(withdrawal.indexOf('UPDATE amnistia SET attiva=FALSE') <
    withdrawal.indexOf("UPDATE subject_proposals SET status='withdrawn'"));
  assert.doesNotMatch(withdrawal,/\b(?:DELETE|TRUNCATE)\s+(?:FROM\s+)?(?:voti_capo_stato|voti_amnistia|voti_grazia)/i);
  assert.match(capo,/WHERE NOT EXISTS \(\s*SELECT 1 FROM subject_proposals p/);
  assert.match(capo,/AND NOT EXISTS \(\s*SELECT 1 FROM subject_proposals p/);
  assert.match(capo,/p\.status = 'withdrawn'/);
  assert.match(amnistia,/SELECT \* FROM amnistia WHERE attiva = true/);
  assert.match(amnistia,/SELECT id FROM amnistia WHERE legge = \$1 AND attiva = true/);
  assert.match(route,/FROM subject_proposals\s+WHERE status='approved' AND category IN \('capo_stato','amnistia','attivisti','organizzazioni'\)/);
  assert.match(ui,/gli eventuali voti storici resteranno conservati/);
  assert.doesNotMatch(withdrawal,/richieste_grazia|grazia_carcerati/,'Grazia has separate approval and withdrawal');
});

test('withdrawal retains private catalogue reference while public directory excludes withdrawn names', () => {
  const route=file('api/routes/subject-proposals.js');
  const withdraw=route.split("router.post('/admin/:id/withdraw'")[1].split("// Atomic review:")[0];
  const directory=route.split("router.get('/approved'")[1].split("// One outstanding proposal")[0];
  const admin=route.split("router.get('/admin/approved'")[1].split("// Audit-only review")[0];
  assert.match(withdraw,/UPDATE subject_proposals SET status='withdrawn', withdrawn_at=now\(\)/);
  assert.doesNotMatch(withdraw,/published_ref\s*=\s*NULL/,
    'do not destroy the private source-to-catalogue audit link');
  assert.match(directory,/readApprovedPage\(pool, category, req.query.cursor\)/);
  assert.match(file('api/services/publicApprovedSubjectPage.js'),/WHERE category=\$1 AND status='approved'/);
  assert.doesNotMatch(directory,/published_ref/,
    'historic catalogue pointer must not be sent to public clients');
  assert.doesNotMatch(admin,/SELECT[^\n]*published_ref/,
    'Admin quick listings retain minimized fields');
});

test('notifications for reviewed nominations require a still-active proposer', () => {
  const api = file('api/routes/subject-proposals.js');
  const notify = api.split('async function notify(')[1].split('// Fetch only on click')[0];
  assert.match(notify,/if \(!userId\) throw new Error\('NO_ACTIVE_RECIPIENT'\)/,
    'account-deleted nominations must not create an orphan notification');
  assert.match(notify,/INSERT INTO notifiche_demos \(id_utente, titolo, testo\)\s+SELECT id, \$2, \$3 FROM users/);
  assert.match(notify,/lower\(status\)='a' FOR KEY SHARE/,
    'only active recipients, locked against concurrent erasure, can be notified');
  assert.match(notify,/inserted\.rowCount !== 1/,
    'a zero-row insertion must not report success');
  const review = api.split("router.post('/admin/:id/decision'")[1];
  const withdraw = api.split("router.post('/admin/:id/withdraw'")[1].split('// Atomic review:')[0];
  for (const route of [review,withdraw]) {
    assert.match(route,/await notify\(noticeClient,/);
    assert.match(route,/notification_sent: notificationSent/);
    assert.match(route,/await noticeClient\.query\('ROLLBACK'\)/,
      'failure to insert an actual recipient notice must roll back its flag');
  }
});

test('Admin may page through all published subjects without exposing owner or source data', () => {
  const source=file('api/routes/subject-proposals.js');
  const admin=source.split("router.get('/admin/approved'")[1].split('// Audit-only review')[0];
  const ui=file('client/src/pages/Gestisci/ProposteSoggetti.tsx');
  const migration=file('api/migrations/20261031_subject_proposals_review_gate.sql');
  assert.match(source,/function parseAdminPageCursor\(raw\)/);
  assert.match(admin,/verifyToken, requireAdmin/);
  assert.match(admin,/LIMIT 101/);
  assert.match(admin,/COALESCE\(reviewed_at, created_at\) DESC, id DESC/);
  assert.match(admin,/next_cursor/);
  assert.match(admin,/page\.map\(\(\{ cursor_epoch, \.\.\.proposal \}\) => proposal\)/,
    'internal pagination timestamp must not escape in Admin JSON');
  assert.doesNotMatch(admin,/SELECT[^\n]*proposer_user_id|SELECT[^\n]*source_url/,
    'never return proposer account ID or unreviewed source');
  assert.match(migration,/subject_proposals_admin_approved_cursor_idx/);
  assert.match(ui,/Carica altre pubblicazioni/);
  assert.match(ui,/loadMoreApproved/);
  assert.match(ui,/approvedCursor/);
  assert.match(ui,/encodeURIComponent\(approvedCursor\)/);
  assert.doesNotMatch(ui.slice(ui.indexOf('useEffect(() =>'),ui.indexOf('const refreshApproved')),
    /admin\/approved/, 'approved records must only load when Admin requests them');
});

test('Admin pending moderation pages beyond 100 while preserving private queue scope', () => {
  const api=file('api/routes/subject-proposals.js');
  const ui=file('client/src/pages/Gestisci/ProposteSoggetti.tsx');
  const migration=file('api/migrations/20261031_subject_proposals_review_gate.sql');
  const pending=api.split("router.get('/admin',")[1].split("// Approved nominations")[0];
  assert.match(pending,/verifyToken, requireAdmin/);
  assert.match(pending,/parseAdminPageCursor\(req.query.cursor\)/);
  assert.match(pending,/status='pending' AND category IN \('capo_stato','amnistia','attivisti','organizzazioni'\)/);
  assert.match(pending,/ORDER BY created_at ASC, id ASC LIMIT 101/);
  assert.match(pending,/next_cursor/);
  assert.match(pending,/page.map\(\(\{ cursor_epoch, \.\.\.proposal \}\) => proposal\)/);
  assert.match(migration,/subject_proposals_admin_pending_cursor_idx/);
  assert.match(ui,/Carica altre richieste/);
  assert.match(ui,/loadMorePending/);
  assert.match(ui,/pendingCursor/);
  assert.match(ui,/encodeURIComponent\(pendingCursor\)/);
  assert.doesNotMatch(pending,/SELECT[^\n]*proposer_user_id|SELECT[^\n]*review_note/,
    'private account IDs and internal review notes must not appear in Admin queue JSON');
});

test('both Admin notification audits page past 100 with minimal private payloads', () => {
  const api=file('api/routes/subject-proposals.js');
  const ui=file('client/src/pages/Gestisci/ProposteSoggetti.tsx');
  const sql=file('api/migrations/20261031_subject_proposals_review_gate.sql');
  for (const [route, next] of [
    ["/admin/withdraw-notifications", "/admin/notification-audit"],
    ["/admin/notification-audit", "// Emergency unpublish"]
  ]) {
    const begin=api.indexOf("router.get('"+route+"'");
    const finish=api.indexOf(next === "// Emergency unpublish" ? next : "router.get('"+next+"'", begin+1);
    assert.ok(begin>=0 && finish>begin,'audit route must remain present and isolated');
    const block=api.slice(begin,finish);
    assert.match(block,/verifyToken, requireAdmin/);
    assert.match(block,/parseAdminPageCursor\(req.query.cursor\)/);
    assert.match(block,/LIMIT 101/);
    assert.match(block,/next_cursor/);
    assert.match(block,/page.map\(\(\{ cursor_epoch, \.\.\.item \}\) => item\)/);
    assert.match(block,/Cache-Control', 'private, no-store'/);
    assert.doesNotMatch(block,/SELECT\s+(?:p\.)?(?:proposer_user_id|title|details|source_url|review_note)\b/i);
  }
  assert.match(sql,/subject_proposals_admin_withdraw_notice_cursor_idx/);
  assert.match(sql,/subject_proposals_admin_notice_audit_cursor_idx/);
  assert.match(ui,/withdrawalAuditCursor/);
  assert.match(ui,/proposalAuditCursor/);
  assert.match(ui,/loadMoreUndelivered/);
  assert.match(ui,/Carica altri avvisi da verificare/);
  assert.match(ui,/encodeURIComponent\(withdrawalAuditCursor\)/);
  assert.match(ui,/encodeURIComponent\(proposalAuditCursor\)/);
  assert.doesNotMatch(ui.slice(ui.indexOf('useEffect(() =>'),ui.indexOf('const refreshApproved')),
    /withdraw-notifications|notification-audit/,
    'notification audits must only load on explicit Admin request');
});

test('active activist page and its modal do not type or present private account metadata', () => {
  const sources=[
    file('client/src/pages/Attivisti.tsx'),
    file('client/src/components/AttivistaModal.tsx')
  ];
  const forbidden=/^\s*(?:email|status|created_at|updated_at|genere|data_nascita|cittadinanza|paese_residenza|provincia_residenza|comune_residenza)\??:\s*string;/m;
  for (const source of sources) {
    assert.doesNotMatch(source,forbidden,
      'the public activist directory and modal must not advertise private fields');
  }
  assert.match(sources[1],/avatar_config\?: string;/);
});

test('mounted public profile directories keep only explicitly declared visible fields in state', () => {
  for (const [p,setter,filtered] of [
    ['client/src/pages/Attivisti.tsx','setAttivisti','setFilteredAttivisti'],
    ['client/src/pages/Organizzazioni/index.tsx','setOrganizzazioni','setFilteredOrganizzazioni']
  ]) {
    const source=file(p);
    assert.match(source,/const publicRows = Array\.isArray\(data\.data\)/);
    assert.match(source,/\.filter\(item => item && typeof item\.id === 'string'/);
    assert.match(source,/\.map\(item => \(\{/);
    for(const field of ['id','nome','cognome','ruolo','avatar_config','regione_residenza',
      'tipologie_attivismo','supporters_count']){
      assert.match(source,new RegExp('^\\s*'+field+': item\\.'+field+',\\s*$','m'),
        'only expected public profile data in '+p);
    }
    assert.ok(source.includes(setter+'(publicRows)'));
    assert.ok(source.includes(filtered+'(publicRows)'));
    assert.doesNotMatch(source,new RegExp(setter+'\\(data\\.data as any\\)'));
    assert.doesNotMatch(source,new RegExp(filtered+'\\(data\\.data as any\\)'));
    assert.match(source,/publicRows\.forEach\(\(a\) =>/);
    assert.doesNotMatch(source,/\.map\(item => \(\{\s*\.\.\.item/,
      'public projection must not spread unrecognized private fields');
  }
});

test('public directories display controlled errors and never expose API diagnostics to visitors', () => {
  const pages=[
    ['client/src/pages/Attivisti.tsx','Non è stato possibile caricare gli attivisti. Riprova più tardi.'],
    ['client/src/pages/Organizzazioni/index.tsx','Non è stato possibile caricare le organizzazioni. Riprova più tardi.']
  ];
  for(const [p,notice] of pages){
    const source=file(p);
    assert.ok(source.includes("setErrorMessage('"+notice+"')"),p);
    assert.doesNotMatch(source,/setErrorMessage\(\s*error instanceof Error/);
    assert.doesNotMatch(source,/throw new Error\(data\.message/);
    assert.doesNotMatch(source,/response\.statusText/);
    assert.doesNotMatch(source,/description:\s*data\.error/);
    assert.doesNotMatch(source,/description:\s*error\?\.message/);
    assert.doesNotMatch(source,/console\.(?:error|warn|log)\([^\n]*,\s*error\s*\)/);
  }
});


test('public avatar visual projection discards private or URL-bearing values', () => {
  const { projectPublicAvatarConfig, projectPublicDirectoryMembers } =
    require('../services/publicDirectoryMemberProjection');
  const valid = {
    skinColor:'#FDBCB4',hairColor:'#8B4513',hairStyle:'short',
    mustacheStyle:'none',mustacheColor:'#2C1810',beardStyle:'none',
    beardColor:'#2C1810',noseStyle:'normal',suitColor:'#2C3E50',
    tieColor:'#E74C3C',glassesStyle:'none',glassesColor:'#333333'
  };
  assert.deepEqual(JSON.parse(projectPublicAvatarConfig(JSON.stringify(valid))),valid,
    'the current twelve displayed avatar properties must remain compatible');
  const polluted={
    ...valid,
    skinColor:'url(https://example.invalid/private)',
    hairColor:'#ABCDE', // not a valid CSS hexadecimal colour
    noseStyle:'private contact details',
    glassesStyle:'about:blank',
    privateNotes:'synthetic private notes',
    email:'synthetic@example.invalid'
  };
  const output=JSON.parse(projectPublicAvatarConfig(JSON.stringify(polluted)));
  for(const key of ['skinColor','hairColor','noseStyle','glassesStyle','privateNotes','email']){
    assert.equal(Object.hasOwn(output,key),false,'must not disclose invalid/private '+key);
  }
  assert.equal(output.hairStyle,'short');
  assert.equal(output.suitColor,'#2C3E50');
  const rows=projectPublicDirectoryMembers([{
    id:'public-fixture',nome:'Soggetto',cognome:'Sintetico',ruolo:'A',
    avatar_config:JSON.stringify(JSON.stringify(polluted)),
    email:'synthetic-private@example.invalid',birthDate:'1970-01-01'
  }]);
  assert.equal(rows.length,1);
  assert.equal(Object.hasOwn(rows[0],'email'),false);
  assert.equal(Object.hasOwn(rows[0],'birthDate'),false);
  assert.equal(JSON.stringify(rows).includes('synthetic-private'),false);
  assert.equal(JSON.stringify(rows).includes('private contact'),false);
  assert.equal(JSON.stringify(rows).includes('example.invalid/private'),false);
  assert.equal(projectPublicAvatarConfig(JSON.stringify({
    skinColor:'not a valid color',hairStyle:'unrecognized-private-string'
  })),null,'no accepted visual fields should trigger the client default avatar');
  for(const color of ['#abc','#abcd','#abcdef','#abcdef12']){
    assert.equal(JSON.parse(projectPublicAvatarConfig(JSON.stringify({skinColor:color}))).skinColor,
      color,'valid CSS hex visual colour should survive: '+color);
  }
});


test('public directory invalid query filters fail closed before SQL', () => {
  const {isValidRegisteredDirectoryFilters: valid} =
    require('../services/registeredDirectoryPage');
  const uuid='11111111-1111-4111-8111-111111111111';
  for (const query of [
    {},
    {search:'Persona',regione:'Toscana',tipologia:'animalismo'},
    {exclude_user_id:uuid},
    {exclude_user_id:''},
    {search:'',members_paged:'1'},
    {members_paged:'0'}
  ]) assert.equal(valid(query),true,'legitimate filter request must remain supported');
  for (const query of [
    null, [],
    {search:['a','b']}, {regione:{nested:'value'}},
    {tipologia:['animali']}, {exclude_user_id:['a','b']},
    {search:12}, {search:null}, {search:'a'.repeat(257)},
    {exclude_user_id:'not-a-uuid'}, {exclude_user_id:uuid+'extra'},
    {members_paged:['1','0']}, {members_paged:{nested:'1'}},
    {members_paged:'true'}, {members_paged:''}
  ]) assert.equal(valid(query),false,'unsafe filter must be rejected: '+JSON.stringify(query));

  for (const filePath of ['api/routes/attivisti.js','api/routes/organizzazioni.js']) {
    const source=file(filePath);
    const validation=source.indexOf('if (!isValidRegisteredDirectoryFilters(req.query))');
    const filters=source.indexOf('const { search, regione, tipologia, exclude_user_id } = req.query;');
    const sql=source.indexOf('const result = await query');
    assert.ok(validation>=0&&filters>validation&&sql>filters,
      'filter types must be checked before search, SQL or user data: '+filePath);
    const reject=source.slice(validation,filters);
    assert.match(reject,/res\.status\(400\)/,
      'malformed filters must yield an HTTP 400: '+filePath);
    assert.match(reject,/no-store/,
      'reject responses must not be cached: '+filePath);
  }
});
