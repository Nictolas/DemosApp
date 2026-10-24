const { isIP } = require('node:net');

// The server does not download evidence. Only safe public HTTPS URL syntax
// is accepted; an admin must confirm that the source is institutional.
function validateEvidenceUrl(input) {
  if (typeof input !== 'string' || input.length > 2048 || !input.trim()) return null;
  try {
    const url = new URL(input.trim());
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (url.protocol !== 'https:' || url.username || url.password ||
        !host.includes('.') || host === 'localhost' || host.endsWith('.localhost') ||
        host.endsWith('.local') || host.includes(':') || isIP(host)) return null;
    return url.toString();
  } catch (_error) {
    return null;
  }
}
module.exports = { validateEvidenceUrl };
