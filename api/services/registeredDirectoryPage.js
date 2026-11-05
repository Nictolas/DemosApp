'use strict';

// Bound the public directory response to at most 100 registered profiles.
// Never encode registration timestamps: base64url is reversible. The cursor
// contains only the already-public UUID and supporter count; the database
// resolves the referenced profile's timestamp within the same SELECT. No user content is cached.
const LIMIT = 100;
const ID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
function decodeRegisteredCursor(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw !== 'string' || raw.length > 220 || !/^[A-Za-z0-9_-]+$/.test(raw))return false;
  try {
    const decoded=JSON.parse(Buffer.from(raw,'base64url').toString('utf8'));
    if (!Array.isArray(decoded)||decoded.length!==2)return false;
    const [count,id]=decoded;
    if (!Number.isSafeInteger(count)||count<0||count>2147483647||
        typeof id!=='string'||!ID.test(id))return false;
    return decoded;
  } catch {return false;}
}
function pageRegistered(rows) {
  const page=rows.slice(0,LIMIT);
  const last=page.at(-1);
  const members_next_cursor=rows.length>LIMIT&&last
    ? Buffer.from(JSON.stringify([last.supporters_count,last.id])).toString('base64url')
    : null;
  return {rows:page,members_next_cursor};
}
module.exports={LIMIT,decodeRegisteredCursor,pageRegistered};
