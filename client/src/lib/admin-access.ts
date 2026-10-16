export function hasAdminCapability(user: unknown): boolean {
  if (!user || typeof user !== "object") return false;

  return (user as { is_admin?: unknown }).is_admin === true;
}
