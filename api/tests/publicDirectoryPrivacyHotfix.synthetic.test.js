'use strict';
// Synthetic privacy contract for the isolated main-branch directory hotfix.
// No real users, database connection, HTTP call or personal information.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const {
  PUBLIC_DIRECTORY_MEMBER_FIELDS, projectPublicDirectoryMembers,
  projectPublicAvatarConfig
} = require('../services/publicDirectoryMemberProjection');

test('both directory member responses strip private top-level and nested attributes', () => {
  const marker = 'fictional-contact@synthetic.invalid';
  const [publicRow] = projectPublicDirectoryMembers([{
    id: 'synthetic-id', nome: 'Persona', cognome: 'Fittizia', ruolo: 'A',
    regione_residenza: 'TO', supporters_count: 5,
    email: marker, data_nascita: '1999-01-01', cittadinanza: 'XX',
    paese_residenza: 'XX', provincia_residenza: 'YY', comune_residenza: 'ZZ',
    genere: 'X', status: 'a', created_at: '2026-01-01',
    moderation_note: marker, proposer_user_id: marker,
    tipologie_attivismo: [{tipo:'ambiente', nome:'Sintetico', email:marker, private_note:marker}],
    avatar_config: JSON.stringify({hairStyle:'short',hairColor:'#123456',privateEmail:marker})
  }]);
  assert.deepEqual(Object.keys(publicRow).sort(), [
    'id','nome','cognome','ruolo','regione_residenza','supporters_count',
    'tipologie_attivismo','avatar_config'
  ].sort());
  assert.deepEqual(publicRow.tipologie_attivismo,[{tipo:'ambiente',nome:'Sintetico'}]);
  assert.deepEqual(JSON.parse(publicRow.avatar_config),{hairColor:'#123456',hairStyle:'short'});
  assert.equal(JSON.stringify(publicRow).includes(marker),false);
});

test('projection fails closed for invalid nested avatar and preserves public client fields', () => {
  assert.equal(projectPublicAvatarConfig(JSON.stringify({hairColor:'url(unsafe)'})),null);
  for (const name of ['id','nome','cognome','ruolo','regione_residenza','avatar_config',
                     'supporters_count','facebook_url','twitter_url','instagram_url',
                     'linkedin_url','telegram_url','website_url','twitch_url','youtube_url']) {
    assert.ok(PUBLIC_DIRECTORY_MEMBER_FIELDS.includes(name),name);
  }
  for (const name of ['email','status','genere','data_nascita','cittadinanza',
                     'paese_residenza','provincia_residenza','comune_residenza',
                     'created_at','updated_at']) {
    assert.equal(PUBLIC_DIRECTORY_MEMBER_FIELDS.includes(name),false,name);
  }
});

test('each mounted public directory route uses the projector and active-account filters', () => {
  for (const [name, expected] of [['attivisti',2],['organizzazioni',1]]) {
    const src = fs.readFileSync(path.join(root,'api/routes',name+'.js'),'utf8');
    assert.equal((src.match(/data:\s*projectPublicDirectoryMembers\(/g)||[]).length,expected,name);
    assert.doesNotMatch(src,/console\.log\(/,'public directory must not log query values');
    assert.doesNotMatch(src,/console\.error\([^\n]*,\s*error\)/,'raw SQL errors must not be logged');
    assert.match(src,/const\s+MODERN_\w+_FILTER\s*=\s*[^;]*u\.status = 'a'/);
    assert.match(src,/const\s+LEGACY_\w+_FILTER\s*=\s*[^;]*u\.status = 'a'/);
    for (const privateCol of ['email','genere','data_nascita','cittadinanza',
      'paese_residenza','provincia_residenza','comune_residenza','status','updated_at']) {
      assert.doesNotMatch(src,new RegExp('\\bu\\.'+privateCol+'\\s*,'),
        name+' must not SELECT private column '+privateCol);
    }
  }
});
