const revokeResearchParticipant = async (client, { participantPublicKey, participantSignatureVerified }) => {
  if (!client || typeof client.query !== 'function') throw new Error('Research revocation requires PostgreSQL client');
  if (!participantPublicKey || participantSignatureVerified !== true) throw new Error('Verified pseudonymous participant proof required');
  const result = await client.query(
    `UPDATE research.participants
     SET status = 'revoked', expires_at = LEAST(expires_at, NOW())
     WHERE participant_public_key = $1
       AND status <> 'revoked'
     RETURNING participant_id`,
    [participantPublicKey]
  );
  return { revoked: result.rows.length === 1 };
};
module.exports={revokeResearchParticipant};
