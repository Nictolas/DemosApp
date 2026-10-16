const ADMIN_ONLY_EXACT_PATHS = new Set([
  "/violations-dashboard",
  "/security-dashboard",
  "/legal-documents",
  "/backup-dashboard",
  "/rate-limiting-dashboard",
  "/validation-dashboard",
  "/logging-dashboard",
  "/audit-dashboard",
  "/notifiche-totali",
  "/utenti",
  "/test-ministero",
  "/statistiche-utenti",
]);

function normalizePath(path: string): string {
  const pathname = path.split(/[?#]/, 1)[0] || "/";
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function hasAdminCapability(user: unknown): boolean {
  if (!user || typeof user !== "object") return false;

  return (user as { is_admin?: unknown }).is_admin === true;
}

export function isAdminOnlyPath(path: string): boolean {
  const normalized = normalizePath(path);

  if (ADMIN_ONLY_EXACT_PATHS.has(normalized)) return true;
  if (normalized === "/admin" || normalized.startsWith("/admin/")) return true;
  if (
    normalized === "/gestisci" ||
    normalized.startsWith("/gestisci/") ||
    normalized.startsWith("/gestisci-")
  ) {
    return true;
  }
  if (
    normalized === "/monitoring-dashboard" ||
    normalized.startsWith("/monitoring-dashboard/")
  ) {
    return true;
  }

  return false;
}
