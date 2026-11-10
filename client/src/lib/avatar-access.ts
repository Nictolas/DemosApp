/** Avatar editor is reserved for Admin and public political profiles.
 * Always use the verified /auth/me capabilities, never local profile labels.
 */
export function canEditPersonalAvatar(user: {
  status?: string;
  is_admin?: boolean;
  is_dpo?: boolean;
  is_politician?: boolean;
  is_candidate?: boolean;
} | null | undefined): boolean {
  return Boolean(
    user &&
    user.status === "a" &&
    user.is_dpo !== true &&
    (user.is_admin === true ||
      user.is_politician === true ||
      user.is_candidate === true)
  );
}

/** Only politicians and candidates have public avatars. */
export function isPublicAvatarRole(role: string | undefined): boolean {
  return role === "P" || role === "C" || role === "CP" ||
    role === "Politico" || role === "Candidato" || role === "Candidato Politico";
}
