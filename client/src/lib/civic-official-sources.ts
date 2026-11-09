// Registry links are fixed to official authorities. Never trust arbitrary URLs
// from a proposal or a scraped feed as the destination of a civic push detail.
export type CivicSourceCategory =
  | "iniziative_popolari"
  | "referendum_abrogativi"
  | "eci";

const IT_REGISTRY = "https://firmereferendum.giustizia.it/referendum/open";
const EU_REGISTRY = "https://citizens-initiative.europa.eu/index_it";

export const CIVIC_SOURCE_LABELS: Record<CivicSourceCategory, string> = {
  iniziative_popolari: "Ministero della Giustizia",
  referendum_abrogativi: "Ministero della Giustizia",
  eci: "Commissione europea",
};

export function civicOfficialSourceUrl(
  category: CivicSourceCategory,
  officialId?: string | number | null,
  sourceUrl?: string | null,
): string | null {
  if (category === "eci") {
    if (sourceUrl) {
      try {
        const url = new URL(sourceUrl);
        if (url.protocol === "https:" &&
            ["citizens-initiative.europa.eu", "eci.ec.europa.eu"].includes(url.hostname) &&
            !url.username && !url.password) {
          return url.toString();
        }
      } catch { /* Fall back to the Commission's official registry. */ }
    }
    return EU_REGISTRY;
  }

  if (officialId === undefined || officialId === null) return null;
  const id = String(officialId).trim();
  if (!id) return null;
  // Italian Ministry record IDs are numerical. A non-numerical ID must not
  // become a guessed record URL; fall back to the official public register.
  if (/^\d{1,14}$/.test(id)) {
    return `${IT_REGISTRY}/dettaglio-open/${encodeURIComponent(id)}`;
  }
  return IT_REGISTRY;
}
