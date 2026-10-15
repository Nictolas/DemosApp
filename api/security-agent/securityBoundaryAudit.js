const VERSION='v0.35';
class BoundaryAudit {
 constructor({maxRecords=100,now=()=>new Date()}={}){if(!Number.isInteger(maxRecords)||maxRecords<10||maxRecords>1000)throw new Error('AUDIT_LIMIT_INVALID');this.maxRecords=maxRecords;this.now=now;this.records=[];}
 record(boundary={},validation={}){const at=this.now();if(!(at instanceof Date)||Number.isNaN(at.getTime()))throw new Error('AUDIT_CLOCK_INVALID');const item=Object.freeze({at:at.toISOString(),action:String(boundary.action||'').slice(0,64),validationOk:validation.ok===true,issueCount:Number.isInteger(validation.issueCount)?Math.max(0,validation.issueCount):0,authorized:false,executable:false,actionRunnerAvailable:false});this.records.unshift(item);if(this.records.length>this.maxRecords)this.records.length=this.maxRecords;return item;}
 list({limit=20}={}){if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('AUDIT_READ_LIMIT_INVALID');return Object.freeze(this.records.slice(0,limit));}
 status(){return Object.freeze({version:VERSION,mode:'shadow',recordCount:this.records.length,authorized:false,executable:false,actionRunnerAvailable:false});}
}
module.exports={VERSION,BoundaryAudit};