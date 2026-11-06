'use strict';

// Bound the public directory response to at most 100 registered profiles.
// Never encode registration timestamps: base64url is reversible. The cursor
// contains only the already-public UUID and supporter count; the database
// resolves the referenced profile's timestamp within the same SELECT. No user content is cached.
const LIMIT = 100;
// Old Android/web bundles do not have a Load more control. Preserve their
// historical full list until minimum supported client versions are verified.
// New clients explicitly opt into bounded pages on every request.
const isPagedRegisteredRequest = query => query?.members_paged === '1' || query?.members_cursor != null;
const ID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
function decodeRegisteredCursor(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw !== 'string' || raw.length > 220 || !/^[A-Za-z0-9_-]+$/.test(raw))return false;
  try {
    const bytes=Buffer.from(raw,'base64url');
    // Node's base64url decoder accepts non-canonical trailing bits. Reject
    // alternate spellings of the same cursor before reading its contents.
    if (bytes.toString('base64url') !== raw) return false;
    const decoded=JSON.parse(bytes.toString('utf8'));
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
module.exports={LIMIT,decodeRegisteredCursor,pageRegistered,isPagedRegisteredRequest};
