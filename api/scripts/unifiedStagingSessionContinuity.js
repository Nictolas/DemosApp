'use strict';

// Read-only probe of *frontend connection* continuity across separate
// transactions. This is not a test of application advisory locks, which require
// the separately authorized staging runtime role and application E2E checks.
const {randomBytes}=require('node:crypto');

const INSPECT = "SELECT pg_backend_pid() AS pid, current_setting('application_name') AS app_name";
const SET = "SELECT set_config('application_name', $1, false) AS applied";
function valid(row) {
  return row && Number.isInteger(row.pid) && row.pid > 0 &&
    typeof row.app_name === 'string';
}
async function inspect(client) {
  const result=await client.query(INSPECT);
  return result?.rows?.[0];
}

async function observeReadOnlySessionContinuity(client, {
  makeMarker=()=> 'demos-staging-readonly-' + randomBytes(12).toString('hex'),
  rounds=4,
}={}) {
  if (!client || typeof client.query!=='function' ||
      !Number.isInteger(rounds) || rounds < 3 || rounds > 8) {
    throw new Error('STAGING_SESSION_CONTINUITY_INVALID_PROBE');
  }
  const original=await inspect(client);
  if (!valid(original)) return false;
  const marker=makeMarker();
  if (typeof marker!=='string' || !/^demos-staging-readonly-[a-f0-9]{24}$/.test(marker)) {
    throw new Error('STAGING_SESSION_CONTINUITY_INVALID_MARKER');
  }
  let configured=false;
  try {
    const applied=await client.query(SET,[marker]);
    configured=true;
    if (applied?.rows?.[0]?.applied!==marker) return false;

    // A transaction pooler only guarantees continuity INSIDE a transaction.
    // Check session state AND backend PID on both sides of several separate
    // BEGIN READ ONLY/ROLLBACK boundaries on the same frontend connection.
    for(let i=0;i<rounds;i++) {
      await client.query('BEGIN READ ONLY');
      let row;
      try {row=await inspect(client);}
      finally {await client.query('ROLLBACK');}
      if(!valid(row) || row.pid!==original.pid || row.app_name!==marker) return false;
      const after=await inspect(client);
      if(!valid(after) || after.pid!==original.pid || after.app_name!==marker) return false;
    }
    return true;
  } finally {
    // This changes session-local application_name only; it writes no table,
    // sequence or advisory lock. The connection is closed by the caller.
    if(configured) await client.query(SET,[original.app_name]);
  }
}

module.exports={observeReadOnlySessionContinuity};
