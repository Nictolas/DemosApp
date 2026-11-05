'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('Amnistia, Grazia and Capo di Stato compact fixed headers retain readable titles',()=>{
 for(const category of ['Amnistia','Grazia','CapodiStato']){
   const header=read('client/src/pages/'+category+'/components/Header.tsx');
   assert.match(header,/flex items-center justify-center gap-2 px-11 sm:px-12/);
   assert.match(header,/className="sr-only"/);
   assert.doesNotMatch(header,/text-3xl|mb-2 flex items-center/);
 }
});
test('Grazia and Capo di Stato keep their proposal actions in the compact fixed header',()=>{
 for(const [page,category] of [['Grazia','grazia'],['CapodiStato','capo_stato']]){
  const source=read('client/src/pages/'+page+'/index.tsx');
  assert.match(source,/fixed-header shrink-0 border-b border-slate-200 bg-white px-4 py-2 sm:px-6 sm:py-3/);
  assert.ok(source.includes('<ProposeSubjectButton category="'+category+'" />'));
  assert.match(source,/<Header \/>/);
 }
 const amnistia=read('client/src/pages/Amnistia/index.tsx');
 const votingForm=read('client/src/pages/Amnistia/components/AmnistiaForm.tsx');
 assert.match(amnistia,/<ProposeSubjectButton category="amnistia" \/>/);
 assert.match(votingForm,/Per proporre nuove voci usa il pulsante \\+/);
 assert.match(votingForm,/saranno valutate prima della pubblicazione/);
});
