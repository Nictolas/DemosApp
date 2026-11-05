'use strict';
// Static privacy regression: real hooks/public cards, no auth, external traffic or DB.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('Grazia GET and vote mutation never log full API responses, preferences or exceptions',()=>{
  const files=[
    'client/src/pages/Grazia/hooks/useGraziaData.ts',
    'client/src/pages/Grazia/hooks/useGraziaVoting.ts'
  ];
  for(const file of files){
    const source=read(file);
    assert.doesNotMatch(source,/\bconsole\s*\.\s*(?:log|info|debug|warn|error|trace)\s*\(/,
      'Grazia client must not print potentially sensitive nominations or personal preferences: '+file);
    assert.doesNotMatch(source,/JSON\.stringify\((?:voti|response|result|data)\)/);
    assert.doesNotMatch(source,/\b(?:localStorage|sessionStorage)\.setItem\s*\(/,
      'no additional persistence of private voting choices');
  }
});
test('removing debug output preserves personal GET, POST, voting feedback and confirmation flow',()=>{
  const data=read('client/src/pages/Grazia/hooks/useGraziaData.ts');
  const voting=read('client/src/pages/Grazia/hooks/useGraziaVoting.ts');
  assert.match(data,/apiRequest\("GET", "\/api\/grazia"\)/);
  assert.match(data,/apiRequest\("POST", "\/api\/grazia\/vota", \{ voti \}\)/);
  assert.match(data,/queryClient\.invalidateQueries\(\{ queryKey: \['graziaData', user\?\.id \?\? null\] \}\)/);
  assert.match(data,/getRemainingVotes\('grazia', variables\.length\)/);
  assert.match(data,/title: "Preferenze salvate"/);
  assert.match(data,/onError: \(/);
  assert.match(voting,/const removeLocal = \(nome: string\) => \{/);
  assert.match(voting,/if \(saveVotiMutation\.isPending\)/);
  assert.match(voting,/setVotoToRemove\(nome\)/);
  assert.match(voting,/setShowRemoveDialog\(true\)/);
  assert.match(voting,/const confirmRemove = \(\) => \{/);
});
test('approved subject directory offers an existing privacy contact without exposing subject title or ID in URL',()=>{
  const policy=read('client/src/pages/PrivacyPolicy.tsx');
  assert.match(policy,/privacy@demos\.community/,'must use published privacy contact');
  for(const file of ['client/src/pages/Attivisti.tsx','client/src/pages/Organizzazioni/index.tsx']){
    const source=read(file);
    const section=source.split(/<h2 className="text-lg font-semibold">(?:Attivisti|Organizzazioni) segnalat[ie] e approvat[ie]<\/h2>/)[1];
    assert.ok(section,'approved-subject section exists '+file);
    const privacy=section.slice(0,950);
    assert.match(privacy,/href="mailto:privacy@demos\.community"/);
    assert.match(privacy,/contestare una segnalazione/);
    assert.match(privacy,/chiedere una rettifica/);
    assert.match(privacy,/Non inviare documenti sensibili senza istruzioni/);
    assert.doesNotMatch(privacy,/mailto:[^"]*(?:subject\.id|subject\.title|encodeURIComponent)/,
      'do not expose subject identifiers or titles in mailto URL');
  }
});

test('Grazia classifica surfaces privacy rectification contact even with no published subjects',()=>{
  const source=read('client/src/pages/Grazia/components/ClassificaCarcerati.tsx');
  assert.match(source,/function PrivacyRectificationContact\(\)/);
  assert.match(source,/href="mailto:privacy@demos\.community"/);
  assert.match(source,/chiedere una rettifica/);
  assert.match(source,/Non inviare documenti sensibili senza istruzioni/);
  assert.equal((source.match(/<PrivacyRectificationContact \/>/g)||[]).length,2,
    'both empty and populated views must show the privacy contact');
  const neutralContact=source.split('function PrivacyRectificationContact()')[1].split('export const ClassificaCarcerati')[0];
  assert.doesNotMatch(neutralContact,/\b(?:nome|selectedVoti|item|classifica|subject)\b/);
  assert.doesNotMatch(neutralContact,/encodeURIComponent|\?subject=|\?body=/);
});

test('Grazia does not reflect arbitrary backend errors and keeps privacy link during failure',()=>{
  const hook=read('client/src/pages/Grazia/hooks/useGraziaData.ts');
  const page=read('client/src/pages/Grazia/index.tsx');
  assert.match(hook,/const GRAZIA_LOAD_ERROR =/);
  assert.match(hook,/const GRAZIA_SAVE_ERROR =/);
  assert.match(hook,/catch \{/);
  assert.match(hook,/description: GRAZIA_SAVE_ERROR/);
  assert.doesNotMatch(hook,/description: error\?\.message/);
  assert.doesNotMatch(hook,/throw new Error\((?:response|result)\.(?:error|message)/);
  assert.match(page,/<PrivacyRectificationContact \/>/);
  assert.match(page,/role="alert"/);
  assert.doesNotMatch(page,/\{error\.message\}/);
  assert.match(read('client/src/pages/Grazia/components/ClassificaCarcerati.tsx'),
    /export function PrivacyRectificationContact\(\)/);
});

test('Grazia voting form explicitly imports all components it renders',()=>{
  const form=read('client/src/pages/Grazia/components/GraziaForm.tsx');
  assert.match(form,/import \{[^}]*\bCardDescription\b[^}]*\} from "@\/components\/ui\/card"/);
  assert.match(form,/import \{[^}]*\bThumbsUp\b[^}]*\bInfo\b[^}]*\} from "lucide-react"/);
  for(const component of ['CardDescription','ThumbsUp','Info']){
    assert.match(form,new RegExp('<'+component+'\\b'),
      component+' must remain imported because missing JSX identifiers crash Grazia at runtime');
  }
});
