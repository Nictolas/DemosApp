'use strict';
const assert = require('node:assert/strict');
const { fetchVerifiedFinalBallots, parseVerifiedFinalBallots } = require('../services/parliamentVerifiedFinalBallotsService');

async function run() {
  const examples = [
    {openpolis_id:'vs19_730_097', camera:'Camera', data_votazione:'2026-10-21', expectedMin:380},
    {openpolis_id:'19-469-3', camera:'Senato', data_votazione:'2026-10-28', expectedMin:200}
  ];
  for(const vote of examples) {
    const data = await fetchVerifiedFinalBallots(vote);
    assert.equal(data.voteId, vote.openpolis_id);
    assert.equal(data.date, vote.data_votazione);
    assert.equal(data.chamber, vote.camera);
    assert.ok(data.members.length >= vote.expectedMin);
    assert.ok(data.members.every(m=>m.name && m.group && m.vote));
    const types = {};
    for (const m of data.members) types[m.vote] = (types[m.vote] || 0) + 1;
    if (vote.camera === 'Camera') {
      assert.equal(data.source.type, 'official');
      assert.equal(types.Favorevole, 137);
      assert.equal(types.Astensione, 94);
    } else {
      assert.equal(data.source.type, 'openpolis');
      assert.equal(types.Favorevole, 75);
      assert.equal(types.Contrario, 52);
    }
    console.log('VERIFIED_FINAL_BALLOTS',JSON.stringify({
      id: vote.openpolis_id,
      source: data.source.label,
      memberCount: data.members.length,
      voteTypes: types,
      sampledNames: data.members.slice(0,2).map(m=>m.name)
    }));
  }
  const fail = parseVerifiedFinalBallots;
  assert.throws(()=>fail('', examples[0]), /VOTE_SOURCE_INVALID_INPUT/);
}
run().catch(err=>{
  console.error('VERIFIED_FINAL_BALLOTS_FAIL',err.message);
  process.exitCode=1;
});
