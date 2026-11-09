"use strict";

const {assertPreferenceChangeAllowed,recordPreferenceChange,sendCooldownError} = require("./preferenceCooldownService");
const {getLockedPoliticalConsentForWrite} = require("./politicalConsentService");
const normalizeSql = column => "lower(btrim(regexp_replace(normalize(" + column + ", NFC), '[[:space:]]+', ' ', 'g')))";

function cleanName(value) {
  if (typeof value !== "string") return null;
  const name = value.normalize("NFC").trim().replace(/\s+/gu, " ");
  if (name.length < 3 || name.length > 150 ||
      /[\u0000-\u001f\u007f-\u009f\u00ad\u034f\u061c\u180e\u200b\u200e-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/u.test(name)) return null;
  return name;
}
async function findPending(db,name) {
  return db.query("SELECT id,title FROM subject_proposals WHERE category='capo_stato' AND status='pending' AND "+
    normalizeSql("title")+"="+normalizeSql("$1::text")+" LIMIT 1",[name]);
}
async function isVotable(db,name) {
  const r=await db.query("SELECT EXISTS(SELECT 1 FROM voti_capo_stato WHERE "+
    normalizeSql("nome")+"="+normalizeSql("$1::text")+
    " UNION ALL SELECT 1 FROM capo_stato_soggetti_approvati WHERE active=TRUE AND "+
    normalizeSql("nome")+"="+normalizeSql("$1::text")+") AS votable",[name]);
  return r.rows[0]?.votable === true;
}
async function changeChoice(db,{userId,name,kind,isAdmin=false}) {
  const client=await db.connect();
  try {
    await client.query("BEGIN");
    const account=await client.query("SELECT id FROM users WHERE id=$1 AND lower(status)='a' FOR UPDATE",[userId]);
    if(!account.rowCount){const e=new Error("Account non attivo");e.status=401;throw e;}
    const consent=await getLockedPoliticalConsentForWrite(client,userId);
    if(!consent.exists || !consent.granted){
      const e=new Error("Consenso politico necessario");e.status=403;throw e;
    }
    const r=await client.query("SELECT nome,tipo,changed_at FROM capo_stato_scelte WHERE user_id=$1 FOR UPDATE",[userId]);
    const old=r.rows[0] || null;
    const pending=name?await findPending(client,name):{rowCount:0};
    if(name && kind==="voto" && (pending.rowCount || !(await isVotable(client,name)))) {
      const e=new Error("Nome non votabile: usa Proponi");e.status=422;throw e;
    }
    if(name && kind==="proposta" && !pending.rowCount && await isVotable(client,name)) {
      const e=new Error("Nome gia votabile: selezionalo dalla classifica");e.status=409;throw e;
    }
    const same=old?.tipo===kind &&
      old.nome.normalize("NFC").trim().toLocaleLowerCase("it") === (name||"").normalize("NFC").trim().toLocaleLowerCase("it");
    if(same || (!old && !name)){
      await client.query("COMMIT");
      return {success:true,changed:false,name:old?.nome||null,kind:old?.tipo||null};
    }
    await assertPreferenceChangeAllowed(client,{userId,scope:"capo-stato:preferenza",
      fallbackChangedAt:old?.changed_at||null,isAdmin});
    if(kind==="proposta" && !pending.rowCount){
      await client.query("INSERT INTO subject_proposals (proposer_user_id,category,title,details,source_url,status,submission_notification_sent) "+
        "VALUES($1,'capo_stato',$2,'',NULL,'pending',FALSE) ON CONFLICT DO NOTHING",[userId,name]);
      if(!(await findPending(client,name)).rowCount) {
        const e=new Error("Proposta non disponibile");e.status=409;throw e;
      }
    }
    if(name) {
      await client.query("INSERT INTO capo_stato_scelte(user_id,nome,tipo,changed_at) VALUES($1,$2,$3,now()) "+
        "ON CONFLICT(user_id) DO UPDATE SET nome=EXCLUDED.nome,tipo=EXCLUDED.tipo,changed_at=EXCLUDED.changed_at",
        [userId,name,kind]);
    } else {
      await client.query("DELETE FROM capo_stato_scelte WHERE user_id=$1",[userId]);
    }
    // Current preference replaces the user's old selection, not another user's vote.
    await client.query("DELETE FROM voti_capo_stato WHERE userid=$1",[userId]);
    if(kind==="voto" && name){
      await client.query("INSERT INTO voti_capo_stato(id,userid,nome,timestamp) VALUES(gen_random_uuid(),$1,$2,now())",[userId,name]);
    }
    await recordPreferenceChange(client,{userId,scope:"capo-stato:preferenza"});
    await client.query("COMMIT");
    return {success:true,changed:true,name:name||null,kind:kind||null};
  }catch(error){
    try{await client.query("ROLLBACK");}catch(_){}
    throw error;
  }finally{client.release();}
}
async function proposalRanking(db){
  const r=await db.query("SELECT p.title AS nome, count(DISTINCT u.id)::int AS sostenitori "+
    "FROM subject_proposals p LEFT JOIN capo_stato_scelte c ON c.tipo='proposta' AND "+
    normalizeSql("c.nome")+"="+normalizeSql("p.title")+
    " LEFT JOIN users u ON u.id=c.user_id AND lower(u.status)='a' "+
    "WHERE p.category='capo_stato' AND p.status='pending' "+
    "GROUP BY p.id,p.title ORDER BY sostenitori DESC,p.title ASC");
  return r.rows;
}
module.exports={cleanName,changeChoice,proposalRanking,normalizeSql,sendCooldownError};