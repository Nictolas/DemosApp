const APPROVAL_GATE_VERSION = 'v0.25';
const APPROVAL_STATES = Object.freeze(['pending', 'approved', 'rejected', 'expired']);
const ALLOWED_ACTIONS = new Set(['investigate','escalate_human','propose_rate_limit','propose_session_revocation','propose_endpoint_isolation','propose_secret_rotation']);

function safeToken(value, max = 64) {
  return String(value ?? '').trim().replace(/[^a-zA-Z0-9:_-]/g, '_').slice(0, max);
}

class SecurityApprovalGate {
  constructor({ now = () => new Date(), ttlMs = 30 * 60 * 1000, maxRecords = 100 } = {}) {
    if (typeof now !== 'function') throw new TypeError('approval clock required');
    if (!Number.isInteger(ttlMs) || ttlMs < 60000 || ttlMs > 86400000) throw new Error('invalid approval ttl');
    if (!Number.isInteger(maxRecords) || maxRecords < 10 || maxRecords > 1000) throw new Error('invalid approval record limit');
    this.now = now; this.ttlMs = ttlMs; this.maxRecords = maxRecords; this.records = [];
    this.counters = { pending:0, approved:0, rejected:0, expired:0 };
    this.audit = [];
  }
  _audit(type, record, at = this.now()) {
    this.audit.unshift(Object.freeze({ at:at.toISOString(), type, approvalId:record.approvalId, action:record.action, priority:record.priority, state:record.state, executable:false }));
    if (this.audit.length > this.maxRecords) this.audit.length = this.maxRecords;
  }
  _expire(at = this.now()) {
    for (const record of this.records) {
      if (record.state === 'pending' && Date.parse(record.expiresAt) <= at.getTime()) {
        record.state = 'expired'; record.decidedAt = at.toISOString(); this.counters.pending -= 1; this.counters.expired += 1; this._audit('expired', record, at);
      }
    }
  }
  request({ action, reasonCode = 'HUMAN_APPROVAL_REQUIRED', priority = 'P3' } = {}) {
    if (!ALLOWED_ACTIONS.has(action)) throw new Error('APPROVAL_ACTION_NOT_ALLOWED');
    if (!['P0','P1','P2','P3'].includes(priority)) throw new Error('APPROVAL_PRIORITY_INVALID');
    const now = this.now();
    const record = { approvalId: `apr_${String(now.getTime())}_${String(this.records.length + 1)}`, action, reasonCode:safeToken(reasonCode), priority, state:'pending', requestedAt:now.toISOString(), expiresAt:new Date(now.getTime()+this.ttlMs).toISOString(), decidedAt:null, executable:false };
    this.records.push(record); this.counters.pending += 1; this._audit('requested', record, now);
    if (this.records.length > this.maxRecords) this.records.splice(0, this.records.length-this.maxRecords);
    return Object.freeze({ ...record });
  }
  decide(approvalId, decision) {
    this._expire();
    if (!['approved','rejected'].includes(decision)) throw new Error('APPROVAL_DECISION_INVALID');
    const id=safeToken(approvalId,96); const record=this.records.find(item=>item.approvalId===id);
    if (!record) throw new Error('APPROVAL_NOT_FOUND');
    if (record.state !== 'pending') throw new Error('APPROVAL_NOT_PENDING');
    const decidedAt=this.now(); record.state=decision; record.decidedAt=decidedAt.toISOString(); this.counters.pending-=1; this.counters[decision]+=1; this._audit(decision, record, decidedAt);
    return Object.freeze({ ...record, executable:false });
  }
  list({ limit=20 }={}) {
    this._expire(); const n=Number(limit); if(!Number.isInteger(n)||n<1||n>100) throw new Error('invalid approval limit');
    return Object.freeze(this.records.slice(-n).reverse().map(r=>Object.freeze({ ...r, executable:false })));
  }
  listAudit({ limit=20 }={}) {
    this._expire(); const n=Number(limit); if(!Number.isInteger(n)||n<1||n>100) throw new Error('invalid approval audit limit');
    return Object.freeze(this.audit.slice(0,n).map(item=>Object.freeze({ ...item, executable:false })));
  }
  simulateDecision(approvalId, decision) {
    return this.decide(approvalId, decision);
  }
  status() {
    this._expire();
    return Object.freeze({ version:APPROVAL_GATE_VERSION, mode:'shadow', actionRunnerAvailable:false, executionEnabled:false, simulationOnly:true, ttlMs:this.ttlMs, auditSize:this.audit.length, counters:Object.freeze({ ...this.counters }) });
  }
}
module.exports={ APPROVAL_GATE_VERSION, APPROVAL_STATES, SecurityApprovalGate };
