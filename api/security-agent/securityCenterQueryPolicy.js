const VERSION='v0.43';
const LIMIT_KEYS=new Set(['limit','recentLimit']); const FILTER_KEYS=new Set(['status','severity']);
function scalar(value,name){if(value===undefined)return undefined;if(Array.isArray(value)||value===null||typeof value==='object')throw new Error('INVALID_QUERY');const s=String(value);if(s.length>64)throw new Error('INVALID_QUERY');return s;}
function boundedInt(value,name,{min=1,max=200,fallback}={}){if(value===undefined)return fallback;const s=scalar(value,name);if(!/^[0-9]{1,3}$/.test(s))throw new Error('INVALID_QUERY');const n=Number(s);if(!Number.isInteger(n)||n<min||n>max)throw new Error('INVALID_QUERY');return n;}
function query(req,allowed=[]){const q=req&&req.query&&typeof req.query==='object'?req.query:{};for(const k of Object.keys(q))if(!allowed.includes(k))throw new Error('UNEXPECTED_QUERY');return q;}
function readLimit(req,key='limit',fallback){const q=query(req,[key]);return boundedInt(q[key],key,{fallback});}
function readIncidents(req){const q=query(req,['status','severity','limit']);return {status:scalar(q.status,'status'),severity:scalar(q.severity,'severity'),limit:boundedInt(q.limit,'limit',{fallback:100})};}
module.exports={VERSION,scalar,boundedInt,query,readLimit,readIncidents};