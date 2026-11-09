'use strict';
// Targeted parse and privacy regression for three pre-existing TypeScript
// syntax blockers; this does not claim whole-repository typecheck success.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require(path.resolve(__dirname,'../../client/node_modules/typescript'));

const root=path.resolve(__dirname,'../../client/src');
const targets=[
  ['components/auth/Phase3Location.tsx',ts.ScriptKind.TSX],
  ['components/reclama-profilo/claimData.ts',ts.ScriptKind.TS],
  ['pages/ReclamaProfilo/constants/index.ts',ts.ScriptKind.TS],
];
for(const [relative,kind] of targets){
  test('TypeScript parser accepts '+relative,()=>{
    const filename=path.join(root,relative);
    const source=fs.readFileSync(filename,'utf8');
    const parsed=ts.createSourceFile(filename,source,ts.ScriptTarget.Latest,true,kind);
    assert.equal(parsed.parseDiagnostics.length,0,
      parsed.parseDiagnostics.map(x=>ts.flattenDiagnosticMessageText(x.messageText,'\\n')).join('\\n'));
  });
}
test('registration municipality dropdown maps actual public string values and does not log location',()=>{
  const source=fs.readFileSync(path.join(root,'components/auth/Phase3Location.tsx'),'utf8');
  assert.match(source,/comuniDisponibili\.map\(\(comune\) => \(/);
  assert.match(source,/SelectItem key=\{comune\} value=\{comune\}/);
  assert.doesNotMatch(source,/console\.(log|debug|info|warn|error)/);
  assert.doesNotMatch(source,/comune\.nome/);
});
test('premium icon data keeps the same icon components and CSS classes without JSX in .ts',()=>{
  const files=[
    'components/reclama-profilo/claimData.ts',
    'pages/ReclamaProfilo/constants/index.ts'
  ];
  for(const file of files){
    const source=fs.readFileSync(path.join(root,file),'utf8');
    for(const icon of ['Crown','BarChart3','MessageCircle','Users']){
      assert.match(source,new RegExp('createElement\\('+icon+', \\{ className:'));
    }
    assert.doesNotMatch(source,/<(Crown|BarChart3|MessageCircle|Users)\b/);
  }
});
