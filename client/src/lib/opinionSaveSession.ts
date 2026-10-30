/**
 * Keep a confirmed political-opinion write attached to the authenticated
 * account and explicit consent epoch that originated it. This only reads
 * the existing in-memory /auth/me snapshot; it never causes a network GET.
 */
export type VerifiedOpinionSaveUser = {
  id: string;
  political_consent?: { granted: boolean; timestamp: string | null } | null;
};

export type OpinionSaveSession = Readonly<{
  ownerId: string;
  consentEpoch: string;
  token: string;
}>;

export function captureOpinionSaveSession(
  ownerId: string | null | undefined,
  consentEpoch: string | null | undefined,
  token: string | null | undefined,
  verifiedUser: VerifiedOpinionSaveUser | null | undefined,
): OpinionSaveSession | null {
  if (!ownerId || !token || typeof consentEpoch !== "string" ||
      !consentEpoch.trim() || verifiedUser?.id !== ownerId ||
      verifiedUser.political_consent?.granted !== true ||
      verifiedUser.political_consent.timestamp !== consentEpoch) {
    return null;
  }
  return { ownerId, consentEpoch, token };
}

export function matchesOpinionSaveSession(
  started: OpinionSaveSession,
  currentToken: string | null | undefined,
  verifiedUser: VerifiedOpinionSaveUser | null | undefined,
): boolean {
  if (currentToken !== started.token) return false;
  return captureOpinionSaveSession(
    started.ownerId, started.consentEpoch, currentToken, verifiedUser,
  ) !== null;
}
