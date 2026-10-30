import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseOpinionQuestions } from '../src/lib/opinionPayload.ts';

test('canonical code catalog ID survives text changes and remains the answer key',()=>{
  const id='abbattimento_cinghiali';
  const before=parseOpinionQuestions([{id,text:'Testo vecchio',userAnswer:'f',grado:['R']}]);
  const after=parseOpinionQuestions([{id,text:'Nuovo testo',userAnswer:'c',grado:['R']}]);
  assert.equal(before[0].id,id);
  assert.equal(after[0].id,id);
  assert.equal(after[0].userAnswer,'c');
});

test('valid empty or multi-grade response requires no extra server lookup',()=>{
  assert.deepEqual(parseOpinionQuestions([]),[]);
  assert.deepEqual(parseOpinionQuestions([
    {id:'foo_bar',text:'Domanda',userAnswer:null,grado:['N','R']},
    {id:'next',text:'Domanda 2',userAnswer:'i'}
  ]),[
    {id:'foo_bar',text:'Domanda',userAnswer:null,grado:['N','R']},
    {id:'next',text:'Domanda 2',userAnswer:'i'}
  ]);
});

test('invalid legacy text-derived IDs are refused rather than cached',()=>{
  for(const id of ['Il tema dell’opinione','tema-à','-strange',
    'UPPERCASE','foo/bar','foo%20bar','','__proto__','foo.bar',
    'a'.repeat(64)]){
    assert.throws(()=>parseOpinionQuestions([{id,text:'Contenuto',userAnswer:'f'}]),
      /ID o testo/);
  }
});

test('duplicate IDs cannot produce ambiguous cached answers',()=>{
  assert.throws(()=>parseOpinionQuestions([
    {id:'same_id',text:'Prima',userAnswer:'f'},
    {id:'same_id',text:'Seconda',userAnswer:'c'}
  ]),/ID o testo/);
});

test('malformed payloads and empty texts fail before persistence',()=>{
  for(const payload of [
    null,{},'invalid',Array(501).fill(null),
    [null],[{id:'ok',text:'  ',userAnswer:'f'}],
    [{id:'ok',text:2,userAnswer:'f'}],[['ok','question']]
  ]) assert.throws(()=>parseOpinionQuestions(payload));
});

test('unrecognized answers become unanswered, never a fourth political position',()=>{
  const result=parseOpinionQuestions([
    {id:'first',text:'A',userAnswer:'Favorevole',secret:'must not persist'},
    {id:'second',text:'B',userAnswer:false},
    {id:'third',text:'C',userAnswer:'i'}
  ]);
  assert.deepEqual(result,[
    {id:'first',text:'A',userAnswer:null},
    {id:'second',text:'B',userAnswer:null},
    {id:'third',text:'C',userAnswer:'i'}
  ]);
});

test('warm and cold cache paths both validate IDs, with no new query for valid cache',()=>{
  const source=fs.readFileSync(
    new URL('../src/lib/encryptedOpinionCache.ts',import.meta.url),'utf8');
  assert.match(source,/parseOpinionQuestions\(cached\.questions\)/);
  assert.match(source,/parseOpinionQuestions\(response\.data\?\.data\)/);
  assert.match(source,/return \{ success: true, data: questions/);
  assert.match(source,/const response = await apiRequest\("GET", `\/api\/opinioni-list/);
  assert.match(source,/apiRequest\("GET", `\/api\/opinioni-list\?grado=\$\{grade\}`, undefined, undefined, signal\)/);
  assert.doesNotMatch(source,/sanitiseQuestions/);
});
