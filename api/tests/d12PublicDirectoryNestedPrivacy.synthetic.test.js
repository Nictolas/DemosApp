'use strict';
// Synthetic public-directory contract: no real accounts, DB or external network.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const {PUBLIC_DIRECTORY_MEMBER_FIELDS,PUBLIC_ACTIVISM_TYPE_FIELDS,
  projectPublicDirectoryMembers}=require('../services/publicDirectoryMemberProjection');

test('public member projection rejects extra top-level and nested JSONB fields',()=>{
  const secret='private-person@synthetic.invalid';
  const jsonb=[{
    tipo:'ambiente',emoji:'🌱',nome:'Ambientalismo',
    descrizione:'Descrizione pubblica',colore:'verde',
    email:secret,
    note_private:'non pubblicare',
    reviewer:{id:'private-reviewer',token:'private'},
    personal_votes:[secret],
    extra_links:[{address:secret}]
  }];
  const raw={
    id:'11111111-1111-4111-8111-111111111111',
    nome:'Profilo sintetico',cognome:'Esempio',ruolo:'A',
    avatar_config:'{}',regione_residenza:'TO',
    tipologie_attivismo:jsonb,supporters_count:2,
    email:secret,genere:'F',data_nascita:'1995-02-03',
    comune_residenza:'Comune sintetico',proposer_user_id:secret,
    personal_votes:['synthetic-person'],moderation_note:'private',
  };
  const serializedBefore=JSON.stringify(raw);
  const [publicRow]=projectPublicDirectoryMembers([raw]);
  assert.deepEqual(Object.keys(publicRow).sort(),
    ['id','nome','cognome','ruolo','avatar_config','regione_residenza',
      'tipologie_attivismo','supporters_count'].sort());
  assert.equal(publicRow.tipologie_attivismo.length,1);
  assert.deepEqual(publicRow.tipologie_attivismo[0],{
    tipo:'ambiente',emoji:'🌱',nome:'Ambientalismo',
    descrizione:'Descrizione pubblica',colore:'verde'
  });
  assert.doesNotMatch(JSON.stringify(publicRow),/private-person|note_private|reviewer|personal_votes|data_nascita|moderation_note/);
  assert.equal(JSON.stringify(raw),serializedBefore,'projection must not mutate source');
  assert.notStrictEqual(publicRow.tipologie_attivismo,jsonb);
  assert.notStrictEqual(publicRow.tipologie_attivismo[0],jsonb[0]);
});

test('malformed or non-object activism types fail closed without removing public profiles',()=>{
  const bad={id:'profile',tipologie_attivismo:[null,{},42,'private',[],{tipo:'ambiente',
    nome:'Pubblico',email:'synthetic-secret',emoji:{private:'nested'},colore:null}]};
  const [projected]=projectPublicDirectoryMembers([bad]);
  assert.deepEqual(projected.tipologie_attivismo,[{},{tipo:'ambiente',nome:'Pubblico'}]);
  for(const value of [null,{},'private',123]){
    const [result]=projectPublicDirectoryMembers([{id:'test',tipologie_attivismo:value}]);
    assert.equal(result.tipologie_attivismo,null,'non-array values must not be re-emitted');
  }
});

test('both public directories apply the projector on initial, paged and legacy responses',()=>{
  for(const category of ['attivisti','organizzazioni']){
    const source=fs.readFileSync(path.join(root,'api/routes',category+'.js'),'utf8');
    const found=source.match(/data: projectPublicDirectoryMembers\((?:attivisti|organizzazioni)\)/g)||[];
    assert.equal(found.length,category==='attivisti'?2:1,
      'every registered directory HTTP response must whitelist nested data');
    assert.match(source,/const \{ projectPublicDirectoryMembers \} = require\('\.\.\/services\/publicDirectoryMemberProjection'\)/);
  }
  for(const field of ['email','genere','sesso','data_nascita','comune_residenza',
    'proposer_user_id','moderation_note']){
    assert.equal(PUBLIC_DIRECTORY_MEMBER_FIELDS.includes(field),false);
    assert.equal(PUBLIC_ACTIVISM_TYPE_FIELDS.includes(field),false);
  }
  assert.deepEqual(PUBLIC_ACTIVISM_TYPE_FIELDS,['tipo','emoji','nome','descrizione','colore']);
});
