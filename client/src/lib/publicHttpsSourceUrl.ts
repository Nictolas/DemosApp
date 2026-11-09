/** Public HTTPS source syntax only; the source is never fetched by DEMOS. */
export function isPublicHttpsSourceUrl(input: string): boolean {
  if (!input || input.length > 2048) return false;
  try {
    const url = new URL(input.trim());
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (url.protocol !== "https:" || url.username || url.password ||
        !host.includes(".") || host.startsWith(".") || host.endsWith(".") ||
        !host.split(".").every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) ||
        host.includes(":") ||
        /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return false;
    return ![".localhost", ".local", ".internal", ".lan", ".home",
      ".test", ".invalid", ".example", ".onion"].some(suffix => host.endsWith(suffix));
  } catch {
    return false;
  }
}
