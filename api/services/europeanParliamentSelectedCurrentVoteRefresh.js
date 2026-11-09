'use strict';

/**
 * PROD-041 / PR #635: selected-only EP importer handoff.
 * Reuses the existing Openpolis 6-hour job; never schedules another cron.
 * No history, per-follower copies, group data, or automatic identity approvals.
 * The PR #633 writer performs a second atomic VERIFIED identity/selection
 * check at the actual UPSERT. This module is dormant until an explicit GO.
 */
const {
  prepareSelectedEuropeanCurrentOnlyPreview
}=require('./europeanParliamentSelectedCurrentOnlyReader');

async function refreshSelectedEuropeanCurrentVote(db, options={}) {
  // Critically, OFF means no database connection, SELECT, HTTP, or writing.
  if(process.env.PARLIAMENT_EP_CURRENT_REFRESH_ENABLED!=='true')
    return {enabled:false,prepared:0,changed:0,skipped:0};

  if(!db || typeof db.query!=='function' ||
     (typeof db.connect!=='function' && !options.writeClient))
    throw Error('EP_CURRENT_PERSIST_DATABASE_REQUIRED');

  const preview=await prepareSelectedEuropeanCurrentOnlyPreview(db,options.previewOptions||{});
  if(!preview || !Array.isArray(preview.candidates) ||
     !Number.isSafeInteger(preview.prepared) ||
     preview.prepared!==preview.candidates.length ||
     preview.prepared<0 || preview.prepared>100 ||
     !Number.isSafeInteger(preview.vettedLinks) ||
     preview.vettedLinks!==preview.prepared ||
     preview.writesPerformed!==0)
    throw Error('EP_CURRENT_PERSIST_PREVIEW_INVALID');

  // Zero VERIFIED followed identities means zero official HTTP and zero DML.
  if(preview.prepared===0)
    return {enabled:true,prepared:0,changed:0,skipped:0};

  // Both PRs must have been integrated before enabling this flag.
  // The import is delayed until here so the Draft branch remains testable
  // and an OFF release never requires the not-yet-integrated writer module.
  const writeVote=options.upsertVote ||
    require('./institutionalCurrentNominalVotesService').upsertVerifiedCurrentVote;
  if(typeof writeVote!=='function')
    throw Error('EP_CURRENT_PERSIST_WRITER_UNAVAILABLE');

  const ownsClient=!options.writeClient;
  const client=options.writeClient || await db.connect();
  if(!client || typeof client.query!=='function')
    throw Error('EP_CURRENT_PERSIST_CLIENT_UNAVAILABLE');
  let began=false,changed=0,skipped=0;
  try{
    await client.query('BEGIN');
    began=true;
    for(const candidate of preview.candidates){
      // The canonical PR #633 writer rechecks live review, mandate and
      // follower selection under PostgreSQL row locks, not only preview.
      const result=await writeVote(client,candidate);
      if(result?.changed===true)changed++;
      else if(result?.changed===false)skipped++;
      else throw Error('EP_CURRENT_PERSIST_WRITER_RESULT_INVALID');
    }
    await client.query('COMMIT');
    began=false;
    return {enabled:true,prepared:preview.prepared,changed,skipped};
  }catch(error){
    if(began)await client.query('ROLLBACK').catch(()=>{});
    throw error;
  }finally{
    if(ownsClient && typeof client.release==='function')client.release();
  }
}

module.exports={refreshSelectedEuropeanCurrentVote};
