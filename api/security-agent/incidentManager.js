const crypto = require('crypto');

const OPEN_STATUSES = new Set(['open', 'acknowledged']);
const SEVERITY_RANK = Object.freeze({ info: 0, low: 1, medium: 2, high: 3, critical: 4 });

class IncidentManager {
  constructor() {
    this.incidents = new Map();
    this.findingIndex = new Map();
  }

  ingest(findings, now = new Date()) {
    if (!Array.isArray(findings)) throw new TypeError('findings must be an array');
    const changed = [];

    for (const finding of findings) {
      const existingId = this.findingIndex.get(finding.findingId);
      if (existingId) {
        const existing = this.incidents.get(existingId);
        if (existing && OPEN_STATUSES.has(existing.status)) {
          existing.lastSeen = finding.lastSeen;
          existing.count = Math.max(existing.count, finding.count);
          const currentRank = SEVERITY_RANK[existing.severity] ?? -1;
          const incomingRank = SEVERITY_RANK[finding.severity] ?? -1;
          if (incomingRank > currentRank) existing.severity = finding.severity;
          existing.updatedAt = now.toISOString();
          changed.push({ ...existing });
          continue;
        }
      }

      const incidentId = crypto.randomUUID();
      const incident = {
        incidentId,
        findingId: finding.findingId,
        ruleId: finding.ruleId,
        title: finding.title,
        severity: finding.severity,
        status: 'open',
        count: finding.count,
        firstSeen: finding.firstSeen,
        lastSeen: finding.lastSeen,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };
      this.incidents.set(incidentId, incident);
      this.findingIndex.set(finding.findingId, incidentId);
      changed.push({ ...incident });
    }

    return changed;
  }

  list({ status } = {}) {
    return Array.from(this.incidents.values())
      .filter(incident => !status || incident.status === status)
      .map(incident => ({ ...incident }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  acknowledge(incidentId, now = new Date()) {
    return this.#transition(incidentId, 'acknowledged', now);
  }

  resolve(incidentId, now = new Date()) {
    return this.#transition(incidentId, 'resolved', now);
  }

  #transition(incidentId, status, now) {
    const incident = this.incidents.get(incidentId);
    if (!incident) return null;
    incident.status = status;
    incident.updatedAt = now.toISOString();
    return { ...incident };
  }
}

module.exports = { IncidentManager };
