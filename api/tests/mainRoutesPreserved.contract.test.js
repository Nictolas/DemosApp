'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('App preserves main Compasso and parliamentary finals alongside DEMOS12 moderation routes',()=>{
 const app=read('client/src/App.tsx');
 for(const route of ['/compasso-politico','/voti-politici','/gestisci/proposte-soggetti','/gestisci-grazia','/proponi-soggetto']){
   assert.ok(app.includes('path="'+route+'"'),route+' must remain routable');
 }
 assert.match(app,/import CompassoPolitico from "\.\/pages\/CompassoPolitico"/);
 assert.match(app,/import VotiPoliticiFinali from "\.\/pages\/VotiPoliticiFinali"/);
 assert.match(app,/import ProposteSoggetti from "\.\/pages\/Gestisci\/ProposteSoggetti"/);
 assert.match(app,/import GestisciGrazia from "\.\/pages\/GestisciGrazia"/);
 assert.doesNotMatch(app,/import VotiPolitici from "\.\/pages\/VotiPolitici"/);
 for(const mod of ['client/src/pages/CompassoPolitico.tsx','client/src/pages/VotiPoliticiFinali.tsx',
                   'client/src/pages/Profilo/components/PoliticalCompassPreview.tsx',
                   'client/src/lib/politicalCompassModel.ts'])
   assert.ok(read(mod).length>30,mod+' required by App');
});
