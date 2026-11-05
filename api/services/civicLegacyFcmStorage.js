'use strict';

// Avoid PostgreSQL 42703 in a transaction when users.fcm_tokens is absent.
// to_jsonb checks the selected row without referring to an optional SQL
// identifier; one read returns only tokens and a schema-presence boolean.
async function getLegacyTokens(userId,db) {
  if(!userId||!db||typeof db.query!=='function')
    throw new TypeError('CIVIC_LEGACY_FCM_CONTEXT_REQUIRED');
  const result=await db.query(`
    SELECT (to_jsonb(u) ? 'fcm_tokens') AS legacy_column_present,
           ARRAY(SELECT jsonb_array_elements_text(
             CASE WHEN jsonb_typeof(to_jsonb(u)->'fcm_tokens')='array'
               THEN to_jsonb(u)->'fcm_tokens' ELSE '[]'::jsonb END
           )) AS fcm_tokens
    FROM users AS u WHERE u.id = $1`,[userId]);
  if(!result||!Array.isArray(result.rows))
    throw new Error('CIVIC_LEGACY_FCM_READ_UNCONFIRMED');
  if(result.rows.length===0)return null;
  const row=result.rows[0];
  if(result.rows.length!==1||typeof row.legacy_column_present!=='boolean'||
      !Array.isArray(row.fcm_tokens))
    throw new Error('CIVIC_LEGACY_FCM_SCHEMA_UNCONFIRMED');
  return {tokens:row.fcm_tokens,hasColumn:row.legacy_column_present};
}

async function updateLegacyTokens(userId,tokens,db,hasColumn){
  if(!userId||!Array.isArray(tokens)||!db||typeof db.query!=='function'||
      typeof hasColumn!=='boolean')
    throw new TypeError('CIVIC_LEGACY_FCM_UPDATE_CONTEXT_REQUIRED');
  if(!hasColumn)return false;
  const result=await db.query(
    'UPDATE users SET fcm_tokens = $1, updated_at = NOW() WHERE id = $2',
    [tokens,userId]);
  if(!result||result.rowCount!==1)
    throw new Error('CIVIC_LEGACY_FCM_UPDATE_UNCONFIRMED');
  return true;
}

module.exports={getLegacyTokens,updateLegacyTokens};
