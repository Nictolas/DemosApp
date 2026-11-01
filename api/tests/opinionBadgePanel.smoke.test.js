"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const componentFile = path.join(root, "client/src/pages/Profilo/components/OpinionBadgesPanel.tsx");
const source = fs.readFileSync(componentFile, "utf8");

test("il pannello e isolato, senza accessi di rete, storage o log", () => {
  assert.doesNotMatch(source, /\b(fetch|apiRequest|localStorage|sessionStorage|indexedDB|postMessage|console\.log)\b/);
  const app = fs.readFileSync(path.join(root, "client/src/App.tsx"), "utf8");
  const profile = fs.readFileSync(path.join(root, "client/src/pages/Profilo/index.tsx"), "utf8");
  assert.doesNotMatch(app, /OpinionBadgesPanel/);
  assert.doesNotMatch(profile, /OpinionBadgesPanel/);
  assert.match(source, /approved === true/);
  assert.match(source, /evaluateOpinionBadge\(rule, answers, access\)/);
});

const moduleFile = process.env.BADGE_PANEL_BUNDLE;
const runtime = moduleFile ? test : test.skip;
const React = moduleFile ? require(path.join(root, "client/node_modules/react")) : null;
const render = moduleFile ? require(path.join(root, "client/node_modules/react-dom/server")).renderToStaticMarkup : null;
const Panel = moduleFile ? require(path.resolve(moduleFile)) : null;
const access = Object.freeze({
  isOwner: true,
  politicalConsentVerified: true,
  badgeConsentVerified: true,
  releaseGateApproved: true,
});

runtime("nessun markup per persone senza accesso, consenso o gate di rilascio", () => {
  const denied = [
    { ...access, isOwner: false },
    { ...access, politicalConsentVerified: false },
    { ...access, badgeConsentVerified: false },
    { ...access, releaseGateApproved: false },
  ];
  const unreadable = new Proxy({}, {get() { throw new Error("Answers accessed before consent"); }});
  for (const a of denied) {
    const html = render(React.createElement(Panel.OpinionBadgesPanel,{answers:unreadable,access:a}));
    assert.equal(html,"");
  }
});

runtime("niente markup anche con tutti i permessi finche tutte le mappature sono disabilitate", () => {
  const unreadable = new Proxy({}, {get() { throw new Error("Answers accessed without approved badge"); }});
  const html = render(React.createElement(Panel.OpinionBadgesPanel,{answers:unreadable,access}));
  assert.equal(html,"");
});

runtime("la card esemplificativa spiega uno score coerente senza dedurre una identita", () => {
  const rule={id:"B01",label:"Tutela animale",approved:true,questions:[
    {opinionId:"caccia",supportsBadge:"c",topic:"caccia"},
    {opinionId:"corrida",supportsBadge:"c",topic:"spettacoli"},
    {opinionId:"allevamenti_intensivi",supportsBadge:"c",topic:"allevamento"},
  ]};
  const result={badgeId:"B01",version:"test",eligible:true,decisive:3,coherent:2,contradictory:1,
    undecided:0,missing:0,coverage:1,coherence:2/3,distinctTopics:3,evidence:[
      {opinionId:"caccia",answer:"c",supportsBadge:true,topic:"caccia"},
      {opinionId:"corrida",answer:"c",supportsBadge:true,topic:"spettacoli"},
      {opinionId:"allevamenti_intensivi",answer:"f",supportsBadge:false,topic:"allevamento"}
    ]};
  const html=render(React.createElement(Panel.OpinionBadgeEvidenceCard,{rule,result,
      opinionLabels:{caccia:"Caccia",corrida:"Corrida",allevamenti_intensivi:"Allevamenti intensivi"}}));
  assert.match(html,/Tutela animale/);
  assert.match(html,/Indicazione tematica disponibile/);
  assert.match(html,/coerente/);
  assert.match(html,/discordante/);
  assert.match(html,/Contrario/);
  assert.match(html,/Favorevole/);
  assert.match(html,/Perché vedo questo risultato/);
  assert.match(html,/non definiscono la tua identità/);
  assert.doesNotMatch(html,/66[.,]7% animalista/);
});

runtime("la card senza risposte nette non emette etichette e spiega lo stato insufficiente", () => {
  const rule={id:"B02",label:"Ambiente e natura",approved:true,questions:[
    {opinionId:"nuove_aree_naturali_protette",supportsBadge:"f",topic:"biodiversita"}
  ]};
  const result={badgeId:"B02",version:"test",eligible:false,decisive:0,coherent:0,contradictory:0,
    undecided:1,missing:0,coverage:0,coherence:null,distinctTopics:0,evidence:[]};
  const html=render(React.createElement(Panel.OpinionBadgeEvidenceCard,{rule,result}));
  assert.match(html,/Risposte insufficienti o discordanti/);
  assert.match(html,/1 indecise/);
  assert.match(html,/Non ci sono risposte nette da mostrare/);
});

runtime("le etichette delle Opinioni sono escaped e non possono introdurre markup", () => {
  const rule={id:"B01",label:"Tutela animale",approved:true,questions:[
    {opinionId:"caccia",supportsBadge:"c",topic:"caccia"}]};
  const result={badgeId:"B01",version:"test",eligible:false,decisive:1,coherent:1,
    contradictory:0,undecided:0,missing:0,coverage:1,coherence:1,
    distinctTopics:1,evidence:[{opinionId:"caccia",answer:"c",supportsBadge:true,topic:"caccia"}]};
  const html=render(React.createElement(Panel.OpinionBadgeEvidenceCard,{rule,result,
    opinionLabels:{caccia:'<img src=x onerror="alert(1)">'}}));
  assert.doesNotMatch(html,/<img/);
  assert.match(html,/&lt;img/);
});
