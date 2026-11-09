'use strict';
const axios = require('axios');
const base='https://data.europarl.europa.eu/api/v2';
const tests=[
  ['meetings-2026',base+'/meetings?year=2026&offset=0&limit=250'],
  ['meps-current-small',base+'/meps/show-current?offset=0&limit=3'],
  ['meps-filter-italy',base+'/meps/show-current?country=IT&offset=0&limit=3']
];
(async()=>{
 for(const [name,url] of tests){
  try{
   const res=await axios.get(url,{timeout:18000,maxContentLength:7*1024*1024,maxRedirects:0,proxy:false,headers:{Accept:'application/ld+json'}});
   const obj=res.data;
   const rows=Array.isArray(obj)?obj:Array.isArray(obj?.data)?obj.data:obj?.['@graph']||[];
   const ids=rows.map(x=>x.activity_id||x.id||x.meeting_id||'').filter(Boolean);
   const dates=ids.filter(x=>/^MTG-PL-20\d\d-\d\d-\d\d$/.test(x)).sort();
   const sample=rows[0]||{};
   console.log('EP_DISCOVERY_SHAPE',JSON.stringify({name,status:res.status,
     total:rows.length,rootKeys:Object.keys(obj||{}).slice(0,15),
     firstKeys:Object.keys(sample).slice(0,40),
     idSample:ids.slice(0,3),lastDatedIds:dates.slice(-5),
     pastSittingIds:dates.filter(x=>x.slice(7)<=new Date().toISOString().slice(0,10)).slice(-8),
     countrySamples:rows.slice(0,3).map(x=>x['api:country-of-representation']??null),
     countryMemberTypes:rows.slice(0,3).map(x=>typeof x['api:country-of-representation']),
     type:sample.type||null,
     isCountryData:Array.isArray(sample.citizenship) || Boolean(sample.citizenship||sample.country_code),
     countryShape:typeof (sample.citizenship||sample.country_code||sample.country),
     timeShape:typeof (sample.activity_start_date||sample.meeting_start_date||sample.activity_date)
   }));
  }catch(e){
   console.log('EP_DISCOVERY_ERROR',JSON.stringify({name,status:e.response?.status||null,code:e.code||null}));
   process.exitCode=1;
  }
 }
})().catch(e=>{console.log('EP_DISCOVERY_UNEXPECTED',String(e.message).slice(0,80));process.exitCode=1;});
