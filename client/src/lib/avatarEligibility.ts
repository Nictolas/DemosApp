/**
 * Avatar is a public-figure affordance, never a citizen/elector feature.
 * Admin is a verified capability, not a role label. DPO-only accounts have
 * no avatar. Use the target profile's role (not the viewer's) on public pages.
 */
export function canHaveProfileAvatar(
  role: string | null | undefined,
  isVerifiedAdmin = false,
  isDpoOnly = false,
): boolean {
  if (isDpoOnly && !isVerifiedAdmin) return false;
  if (isVerifiedAdmin) return true;
  return ["P", "Politico", "C", "Candidato", "CP", "Candidato Politico"]
    .includes(String(role ?? ""));
}
