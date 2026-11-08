'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {profileCandidates,profileEvidence,preflightSelectedParliamentaryOffices,
  SELECTED_UNREVIEWED_SQL}=require('../services/parliamentSelectedOfficePreflightService');

function html(name,dob,role){
  const [y,m,d]=dob.split('-');
  const months=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
  return '<!doctype html><html><body><h1>'+name+'</h1> '+
    '<p>Nato il '+Number(d)+' '+months[Number(m)-1]+' '+y+' a Roma</p> '+
    '<p>'+role+' dal 13/10/2022</p> '+
    '<p>Regione di elezione: Lazio</p>' + ' '.repeat(200) + '</body></html>';
}
const url='https://parlamento19.openpolis.it/persone/benedetto-della-vedova-1962-04-03';

test('public source role mismatch is detected only with matching name and birthdate',()=>{
  const p={nome:'Benedetto',cognome:'Della Vedova',data_nascita:'1962-04-03'};
  const body=html('Benedetto Della Vedova','1962-04-03','Deputato');
  assert.deepEqual(profileEvidence(body,p,'it.senato',url),
    {state:'OFFICE_MISMATCH',office:'it.camera',profileUrl:url});
  assert.deepEqual(profileEvidence(body,p,'it.camera',url),
    {state:'CANDIDATE_ONLY',office:'it.camera',profileUrl:url});
  assert.equal(profileEvidence(body,{...p,data_nascita:'1962-04-04'},'it.senato',url).state,
    'DOB_MISMATCH','mismatching DOB must not be called a verified office discrepancy');
  assert.equal(profileEvidence(body,{...p,cognome:'Della Notte'},'it.senato',url).state,
    'NAME_MISMATCH');
  assert.equal(profileEvidence(body,{...p,data_nascita:null},'it.senato',url).state,
    'DOB_MISSING');
  assert.equal(profileEvidence(body,p,'it.senato','https://evil.example/persone/benedetto-della-vedova-1962-04-03').state,
    'UNAVAILABLE','untrusted remote URLs cannot provide evidence');
});

test('source date and office are independently verified; no grouping heuristics',()=>{
  const p={nome:'Claudio',cognome:'Borghi',data_nascita:'1970-06-06'};
  const u='https://parlamento19.openpolis.it/persone/claudio-borghi-1970-06-06';
  assert.equal(profileEvidence(html('Claudio Borghi','1970-06-06','Senatore'),p,'it.camera',u).state,
    'OFFICE_MISMATCH');
  assert.equal(profileEvidence(html('Claudio Borghi','1970-06-06','Senatore'),p,'it.senato',u).state,
    'CANDIDATE_ONLY');
  assert.equal(profileEvidence(html('Claudio Borghi','1970-06-06','Senatrice'),p,'it.senato',u).state,
    'OFFICE_UNAVAILABLE','unknown office wording is not positive evidence');
  assert.equal(profileEvidence(html('Claudio Borghi','1970-06-06','Senatore').replace('</body>',' <p>Deputato dal 13/10/2022</p></body>'),p,'it.senato',u).state,
    'OFFICE_UNAVAILABLE');
});

test('HTML nodes splitting the current-office label must still be recognized',()=>{
  const rep={nome:'Claudio',cognome:'Borghi',data_nascita:'1970-06-06'};
  const url='https://parlamento19.openpolis.it/persone/claudio-borghi-1970-06-06';
  const markup=html('Claudio Borghi','1970-06-06','Senatore')
    .replace('<p>Senatore dal 13/10/2022</p>',
      '<p><span>Senatore</span><span>dal 13/10/2022</span></p>');
  assert.equal(profileEvidence(markup,rep,'it.camera',url).state,'OFFICE_MISMATCH');
});

test('strict official Peppe/Giuseppe alias is accepted, no generic nickname guesses',()=>{
  const url='https://parlamento19.openpolis.it/persone/peppe-de-cristofaro-1971-06-26';
  const peppe={nome:'Peppe',cognome:'De Cristofaro',data_nascita:'1971-06-26'};
  const page=html('Giuseppe De Cristofaro','1971-06-26','Senatore');
  assert.deepEqual(profileEvidence(page,peppe,'it.senato',url),
    {state:'CANDIDATE_ONLY',office:'it.senato',profileUrl:url});
  assert.equal(profileEvidence(page,{...peppe,nome:'Peppo'},'it.senato',url).state,
    'NAME_MISMATCH');
});

test('profile candidates depend on public name and DOB and use safe limited HTTPS hosts',()=>{
  assert.deepEqual(profileCandidates({nome:'Claudio',cognome:'Borghi',data_nascita:'1970-06-06'}),[
    'https://parlamento19.openpolis.it/persone/claudio-borghi-1970-06-06',
    'https://parlamento19.openpolis.it/persone/claudio-borghi-none'
  ]);
  assert.deepEqual(profileCandidates({nome:'Claudio',cognome:'Borghi',data_nascita:null}),[]);
});

test('feature switch off makes no DB/HTTP requests; when enabled scans only selected rows',async()=>{
  const old=process.env.PARLIAMENT_IDENTITY_PREFLIGHT_ENABLED;
  delete process.env.PARLIAMENT_IDENTITY_PREFLIGHT_ENABLED;
  const db={query:async()=>{throw Error('disabled DB read')}};
  try{
    assert.deepEqual(await preflightSelectedParliamentaryOffices(db),
      {enabled:false,checked:0,officeMismatches:0,birthDateMismatches:0,candidates:0,unresolved:0});
    process.env.PARLIAMENT_IDENTITY_PREFLIGHT_ENABLED='true';
    const queries=[];
    const reps=[
      {nome:'Benedetto',cognome:'Della Vedova',data_nascita:'1962-04-03',expected_office:'it.senato'},
      {nome:'Claudio',cognome:'Borghi',data_nascita:'1970-06-06',expected_office:'it.camera'},
      {nome:'Marco',cognome:'Grimaldi',data_nascita:'1980-11-08',expected_office:'it.camera'},
      {nome:'Senza',cognome:'Data',data_nascita:null,expected_office:'it.senato'}
    ];
    const data={
      'benedetto-della-vedova':html('Benedetto Della Vedova','1962-04-03','Deputato'),
      'claudio-borghi':html('Claudio Borghi','1970-06-06','Senatore'),
      'marco-grimaldi':html('Marco Grimaldi','1980-11-08','Deputato')
    };
    let fetched=0;
    const result=await preflightSelectedParliamentaryOffices({
      query:async sql=>{queries.push(sql);return {rows:reps};}
    },{fetchPage:async url=>{
      fetched++;
      const name=Object.keys(data).find(k=>url.includes('/'+k+'-'));
      if(!name)throw Error('untrusted path');
      return data[name];
    }});
    assert.deepEqual(result,
      {enabled:true,checked:4,officeMismatches:2,birthDateMismatches:0,candidates:1,unresolved:1});
    assert.equal(queries.length,1);
    assert.equal(fetched,3,'no HTTP for missing birthdate');
    assert.match(queries[0],/political_selections/);
    assert.match(queries[0],/follower\.status/);
    assert.match(queries[0],/review_state IS DISTINCT FROM 'VERIFIED'/);
    assert.match(queries[0],/LIMIT 12/);
    assert.doesNotMatch(queries[0],/\b(INSERT|UPDATE|DELETE|TRUNCATE|MERGE|DROP|ALTER)\b/i);
    assert.equal(SELECTED_UNREVIEWED_SQL,queries[0]);
  }finally{
    if(old===undefined)delete process.env.PARLIAMENT_IDENTITY_PREFLIGHT_ENABLED;
    else process.env.PARLIAMENT_IDENTITY_PREFLIGHT_ENABLED=old;
  }
});

test('wrong legacy DOB is counted without granting VERIFIED or writing personal data',async()=>{
  const old=process.env.PARLIAMENT_IDENTITY_PREFLIGHT_ENABLED;
  process.env.PARLIAMENT_IDENTITY_PREFLIGHT_ENABLED='true';
  const expected={nome:'Carlo',cognome:'Calenda',
    data_nascita:'1973-09-04',expected_office:'it.senato'};
  let calls=0;
  try{
    const result=await preflightSelectedParliamentaryOffices({
      query:async(sql)=>{assert.match(sql,/SELECT DISTINCT p.id/);return {rows:[expected]};},
      connect:()=>{throw Error('identity preflight must not open write transaction');}
    },{fetchPage:async()=>{
      calls++;
      return html('Carlo Calenda','1973-04-09','Senatore');
    }});
    assert.deepEqual(result,{
      enabled:true,checked:1,officeMismatches:0,birthDateMismatches:1,
      candidates:0,unresolved:0
    });
    assert.equal(calls,1);
  }finally{
    if(old===undefined)delete process.env.PARLIAMENT_IDENTITY_PREFLIGHT_ENABLED;
    else process.env.PARLIAMENT_IDENTITY_PREFLIGHT_ENABLED=old;
  }
});

test('bounded identity-office screening rotates to later selected MPs rather than starving them',async()=>{
  const before=process.env.PARLIAMENT_IDENTITY_PREFLIGHT_ENABLED;
  process.env.PARLIAMENT_IDENTITY_PREFLIGHT_ENABLED='true';
  const offsets=[];
  const rows=Array.from({length:13},(_,i)=>({
    nome:'Persona',cognome:'Selezionata '+i,data_nascita:null,expected_office:'it.camera'
  }));
  const pool={query:async (sql,params)=>{
    offsets.push(params[0]);
    return {rows:rows.slice(params[0],params[0]+12)};
  }};
  try{
    const first=await preflightSelectedParliamentaryOffices(pool,{
      fetchPage:()=>{throw Error('invalid: no DOB means zero remote requests');}
    });
    const second=await preflightSelectedParliamentaryOffices(pool,{
      fetchPage:()=>{throw Error('invalid: no DOB means zero remote requests');}
    });
    assert.equal(first.checked,12);
    assert.equal(second.checked,1);
    assert.deepEqual(offsets,[0,12]);
  }finally{
    if(before===undefined)delete process.env.PARLIAMENT_IDENTITY_PREFLIGHT_ENABLED;
    else process.env.PARLIAMENT_IDENTITY_PREFLIGHT_ENABLED=before;
  }
});
