'use strict';

// Public category-scoped keyset pagination. The internal microsecond cursor
// never leaves the server except as an opaque token; JSON contains only id/title.
const PAGE_SIZE = 100;
const CURSOR_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function parseCursor(raw) {
  if (raw == null) return null;
  if (typeof raw !== 'string' || raw.length > 240 || !/^[A-Za-z0-9_-]+$/.test(raw)) return false;
  try {
    const value = JSON.parse(Buffer.from(raw,'base64url').toString('utf8'));
    if (!Array.isArray(value) || value.length !== 2) return false;
    const [epoch,id] = value;
    if (typeof epoch !== 'string' || !/^\d{1,11}(?:\.\d{1,6})?$/.test(epoch) ||
        Number(epoch) > 4102444800 || typeof id !== 'string' || !CURSOR_UUID.test(id)) return false;
    return [epoch,id];
  } catch (_) { return false; }
}
async function readApprovedPage(pool,category,rawCursor=null) {
  const cursor=parseCursor(rawCursor);
  if (cursor===false) return null;
  const result=await pool.query(
    `SELECT id, title,
        EXTRACT(EPOCH FROM COALESCE(reviewed_at,created_at))::text AS cursor_epoch
       FROM subject_proposals
      WHERE category=$1 AND status='approved'
        AND ($2::numeric IS NULL OR (COALESCE(reviewed_at,created_at),id) <
            (to_timestamp($2::numeric),$3::uuid))
      ORDER BY COALESCE(reviewed_at,created_at) DESC,id DESC
      LIMIT 101`,
    [category,cursor?.[0]??null,cursor?.[1]??null]
  );
  const rows=result.rows.slice(0,PAGE_SIZE);
  const last=rows[rows.length-1];
  return {
    data:rows.map(({id,title})=>({id,title})),
    next_cursor:result.rows.length>PAGE_SIZE
      ?Buffer.from(JSON.stringify([last.cursor_epoch,last.id])).toString('base64url')
      :null,
  };
}
module.exports={readApprovedPage,parseCursor};
