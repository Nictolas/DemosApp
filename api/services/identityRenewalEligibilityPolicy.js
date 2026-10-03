const MAX_INACTIVITY_DAYS = 365;
const MAX_INACTIVITY_MS = MAX_INACTIVITY_DAYS * 24 * 60 * 60 * 1000;

const assertIdentityRenewalEligible = ({
  eligibilityStatus,
  eligible,
  lastAccountActivityAt,
  now = new Date()
}) => {
  if (eligible !== true || eligibilityStatus !== 'active') throw new Error('Account is not eligible for Research renewal');
  const activity = new Date(lastAccountActivityAt);
  const current = new Date(now);
  if (!Number.isFinite(activity.getTime()) || !Number.isFinite(current.getTime())) throw new Error('Invalid account activity timestamp');
  if (activity.getTime() > current.getTime()) throw new Error('Future account activity timestamp');
  if (current.getTime() - activity.getTime() >= MAX_INACTIVITY_MS) throw new Error('Account inactivity limit reached');
  return true;
};

const issueRenewalCredentialOnce = async (client, { accountId, epoch, lastAccountActivityAt, now = new Date() }) => {
  if (!client || typeof client.query !== 'function') throw new Error('Identity renewal issuance requires PostgreSQL client');
  if (!accountId) throw new Error('Missing credential issuance account');
  const eligibility = await client.query(
    `SELECT eligible, status
     FROM identity.participation_eligibility
     WHERE account_id = $1`,
    [accountId]
  );
  const row = eligibility.rows?.[0];
  assertIdentityRenewalEligible({
    eligible: row?.eligible,
    eligibilityStatus: row?.status,
    lastAccountActivityAt,
    now
  });
  const { issueCredentialOnce } = require('./identityCredentialIssuanceStore');
  return issueCredentialOnce(client, { accountId, purpose: 'renew', epoch });
};

module.exports={MAX_INACTIVITY_DAYS,assertIdentityRenewalEligible,issueRenewalCredentialOnce};
