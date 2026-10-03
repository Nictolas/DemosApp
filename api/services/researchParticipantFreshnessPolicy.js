const MAX_INACTIVITY_DAYS = 365;
const MAX_INACTIVITY_MS = MAX_INACTIVITY_DAYS * 24 * 60 * 60 * 1000;

const computeResearchParticipantExpiry = (lastAccountActivity) => {
  const activity = new Date(lastAccountActivity);
  if (!Number.isFinite(activity.getTime())) throw new Error('Invalid account activity timestamp');
  return new Date(activity.getTime() + MAX_INACTIVITY_MS);
};

const isResearchContributionCurrent = ({ expiresAt, now = new Date() }) => {
  const expiry = new Date(expiresAt);
  const current = new Date(now);
  if (!Number.isFinite(expiry.getTime()) || !Number.isFinite(current.getTime())) return false;
  return expiry.getTime() > current.getTime();
};

const expireStaleResearchParticipants = async (client, { now = new Date() } = {}) => {
  if (!client || typeof client.query !== 'function') throw new Error('Research freshness sweep requires PostgreSQL client');
  const cutoff = new Date(now);
  if (!Number.isFinite(cutoff.getTime())) throw new Error('Invalid freshness sweep timestamp');
  return client.query(
    `UPDATE research.participants
     SET status = 'expired'
     WHERE status = 'active'
       AND expires_at IS NOT NULL
       AND expires_at <= $1
     RETURNING participant_id`,
    [cutoff]
  );
};

module.exports={MAX_INACTIVITY_DAYS,computeResearchParticipantExpiry,isResearchContributionCurrent,expireStaleResearchParticipants};
