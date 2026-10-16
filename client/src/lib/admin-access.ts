export type AdminCapabilitySubject = {
  is_admin?: boolean | null;
};

export function hasAdminCapability(
  user: AdminCapabilitySubject | null | undefined,
): boolean {
  return user?.is_admin === true;
}
