let counters={attempted:0,mirrored:0,failed:0};
const recordActivityMirrorOutcome=({mirrored})=>{counters.attempted+=1;mirrored===true?counters.mirrored+=1:counters.failed+=1;};
const getActivityMirrorMetrics=()=>({...counters});
const resetActivityMirrorMetricsForTests=()=>{counters={attempted:0,mirrored:0,failed:0};};
module.exports={recordActivityMirrorOutcome,getActivityMirrorMetrics,resetActivityMirrorMetricsForTests};
