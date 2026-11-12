import type { EventTerritory } from "@/utils/eventTerritoryView";

// La preferenza è conservata soltanto sul dispositivo, separatamente per account.
// Non salviamo coordinate GPS né inviamo nuove informazioni a DEMOS.
export type LocalEventArea = { comune: string; provincia: string; regione: string };
export type LocalEventMode = "residenza" | "altro" | "entrambi";
export type LocalEventPreferences = {
  mode: LocalEventMode;
  area: LocalEventArea | null;
  onboardingSeen: boolean;
};
export const DEFAULT_LOCAL_EVENT_PREFERENCES: LocalEventPreferences = {
  mode: "residenza",
  area: null,
  onboardingSeen: false,
};

function key(userId: string) {
  return `demos:eventi-localita:v1:${userId}`;
}

export function readLocalEventPreferences(userId?: string | null): LocalEventPreferences {
  if (!userId || typeof window === "undefined") return { ...DEFAULT_LOCAL_EVENT_PREFERENCES };
  try {
    const raw = window.localStorage.getItem(key(userId));
    if (!raw) return { ...DEFAULT_LOCAL_EVENT_PREFERENCES };
    const parsed = JSON.parse(raw);
    const area = parsed?.area;
    const validArea = area && typeof area.comune === "string" && area.comune.trim() &&
      typeof area.provincia === "string" && area.provincia.trim() &&
      typeof area.regione === "string" && area.regione.trim();
    const mode: LocalEventMode =
      parsed?.mode === "altro" || parsed?.mode === "entrambi" ? parsed.mode : "residenza";
    return {
      mode: validArea ? mode : "residenza",
      area: validArea ? { comune: area.comune, provincia: area.provincia, regione: area.regione } : null,
      onboardingSeen: parsed?.onboardingSeen === true,
    };
  } catch {
    return { ...DEFAULT_LOCAL_EVENT_PREFERENCES };
  }
}

export function writeLocalEventPreferences(userId: string, preferences: LocalEventPreferences): boolean {
  try {
    window.localStorage.setItem(key(userId), JSON.stringify(preferences));
    return true;
  } catch {
    return false;
  }
}

export function territoryFromArea(area: LocalEventArea | null): EventTerritory | null {
  return area ? { provincia: area.provincia, regione: area.regione } : null;
}

type Centroid = [string, string, string, number, number];
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) *
    Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Scarica soltanto file STATICI inclusi nell'app. Le coordinate restano nella
// memoria del browser durante la ricerca, mai in localStorage, query o log.
// Centroidi dei municipi: stima indicativa, non geocodifica dei confini comunali.
export async function approximateMunicipalityOnDevice(
  lat: number, lng: number
): Promise<LocalEventArea | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) ||
      lat < 35 || lat > 48.5 || lng < 6 || lng > 19.5) return null;
  const modules = await Promise.all([
    import("@/data/municipalityCentroids-1.json"),
    import("@/data/municipalityCentroids-2.json"),
    import("@/data/municipalityCentroids-3.json"),
    import("@/data/municipalityCentroids-4.json"),
  ]);
  let nearest: Centroid | null = null;
  let minDistance = Number.POSITIVE_INFINITY;
  for (const file of modules) {
    const rows = file.default as unknown as Centroid[];
    for (const row of rows) {
      // Riduce il lavoro: esclude i municipi chiaramente lontani.
      if (Math.abs(row[3] - lat) > 0.9 || Math.abs(row[4] - lng) > 1.2) continue;
      const distance = distanceKm(lat, lng, row[3], row[4]);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = row;
      }
    }
  }
  if (!nearest || minDistance > 60) return null;
  return { comune: nearest[0], provincia: nearest[1], regione: nearest[2] };
}
