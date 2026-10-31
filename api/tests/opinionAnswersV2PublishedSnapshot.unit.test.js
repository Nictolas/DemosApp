'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {
  buildVersionedOpinionPublication,readVersionedOpinionPublication
}=require('../experiments/opinionAnswersV2PublishedSnapshotCandidate');
const opinionId='opinione_94';
const title='Domanda sintetica';
const rows=(national,regions)=>[
  {is_national:1,regione:null,...national},
  ...Object.entries(regions).map(([regione,counts])=>({
    is_national:0,regione,...counts
  }))
];
const format=(f,c,i=0)=>({favorevole:f,contrario:c,indeciso:i});
const build=(data,version='v1')=>buildVersionedOpinionPublication({
  opinionId,questionText:title,version,snapshotRows:data
});

test('immutable v1 public payload leaks no suppressed region counts',()=>{
  const input=rows(format(10,1),{
    TO:format(10,0),LA:format(0,1)
  });
  const publication=build(input);
  assert.deepEqual(Object.keys(publication).sort(),[
    'national','opinionId','regionsByCode','version'
  ]);
  assert.equal(Object.hasOwn(publication,'regions'),false);
  assert.equal(Object.hasOwn(publication,'nationalRaw'),false);
  assert.equal(Object.isFrozen(publication),true);
  assert.equal(Object.isFrozen(publication.national),true);
  const national=readVersionedOpinionPublication(publication,{
    version:'v1',opinionId
  });
  assert.deepEqual(national,{
    success:true,
    data:{suppressed:true,minimumCellSize:10,questionText:title}
  });
  assert.equal(Object.hasOwn(publication.national,'stats'),false);
  for(const regionCode of ['TO','LA']){
    const regional=readVersionedOpinionPublication(publication,{
      version:'v1',opinionId,regionCode
    });
    assert.equal(regional.data.suppressed,true);
    assert.equal(Object.hasOwn(regional.data,'stats'),false);
    assert.equal(Object.hasOwn(regional.data,'totaleUtenti'),false);
  }
  assert.equal(publication.regionsByCode.TO.regione,'Toscana');
  assert.equal(publication.regionsByCode.LA.regione,'Lazio');
  assert.equal(Object.keys(publication.regionsByCode).length,20);
});

test('one additional published region uses same v1 snapshot as national',()=>{
  const publication=build(rows(format(10,11),{
    TO:format(10,0),LO:format(0,10),LA:format(0,1)
  }));
  const regional=readVersionedOpinionPublication(publication,{
    version:'v1',opinionId,regionCode:'TO'
  });
  assert.deepEqual(regional,{
    success:true,
    data:{
      suppressed:false,minimumCellSize:10,questionText:title,
      regione:'Toscana',stats:format(10,0),totaleUtenti:10
    }
  });
  const lombardy=readVersionedOpinionPublication(publication,{
    version:'v1',opinionId,regionCode:'LO'
  });
  assert.equal(lombardy.data.suppressed,true);
  assert.equal(Object.hasOwn(lombardy.data,'stats'),false);
});

test('old cache version and wrong opinion IDs fail closed',()=>{
  const publication=build(rows(format(10,0),{TO:format(10,0)}),'version_4');
  assert.throws(()=>readVersionedOpinionPublication(publication,{
    version:'version_3',opinionId
  }),/VERSION_MISMATCH/);
  assert.throws(()=>readVersionedOpinionPublication(publication,{
    version:'version_4',opinionId:'opinione_0'
  }),/VERSION_MISMATCH/);
  assert.throws(()=>readVersionedOpinionPublication(publication,{
    version:'version_4',opinionId,regionCode:'UNKNOWN'
  }),/Unknown publication region/);
  assert.throws(()=>build(rows(format(10,0),{TO:format(10,0)}),'unsafe/../version'),
    /Immutable publication/);
});

test('snapshot inputs are cloned; later caller mutation cannot change public counts',()=>{
  const input=rows(format(10,0),{TO:format(10,0)});
  const publication=build(input);
  input[0].favorevole=777;
  input[1].favorevole=777;
  assert.equal(publication.national.stats.favorevole,10);
  assert.equal(publication.regionsByCode.TO.stats.favorevole,10);
  assert.throws(()=>build([
    {is_national:1,regione:null,...format(10,0)},
    {is_national:0,regione:'ZZ',...format(10,0)}
  ]),/Unknown/);
});

test('empty and inconsistent snapshots fail to become a public cache version',()=>{
  assert.throws(()=>build([]),/Missing national/);
  assert.throws(()=>build(rows(format(10,0),{TO:format(9,0)})),/inconsistent/);
  const empty=build(rows(format(0,0),{}));
  assert.deepEqual(readVersionedOpinionPublication(empty,{
    version:'v1',opinionId
  }),{
    success:true,data:{
      suppressed:true,minimumCellSize:10,questionText:title
    }
  });
  assert.equal(Object.hasOwn(empty.national,'stats'),false);
});


test('national 29f/1c must not publish a one-person minority response',()=>{
  const publication=build(rows(format(29,1),{
    TO:format(20,0),LO:format(9,1)
  }));
  const nation=readVersionedOpinionPublication(publication,{
    version:'v1',opinionId
  });
  assert.equal(nation.data.suppressed,true);
  assert.equal(Object.hasOwn(nation.data,'stats'),false);
  for(const regionCode of ['TO','LO']){
    const region=readVersionedOpinionPublication(publication,{
      version:'v1',opinionId,regionCode
    });
    assert.equal(region.data.suppressed,true);
  }
});

test('safe national 10f/10c and one 10f/10c region can be published',()=>{
  const publication=build(rows(format(10,10),{
    TO:format(10,10)
  }));
  assert.deepEqual(publication.national.stats,format(10,10));
  assert.equal(publication.regionsByCode.TO.suppressed,false);
  assert.deepEqual(publication.regionsByCode.TO.stats,format(10,10));
});
