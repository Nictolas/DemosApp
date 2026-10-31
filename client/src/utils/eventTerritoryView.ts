import { ITALY_DATA } from "@/data/italyData";
import { decompressProvinciaEvento, decompressRegioneEvento } from "@/utils/eventiGeographicUtils";

// Solo dati geografici già contenuti nell'app; nessuna API di geocodifica
// e nessuna lettura Supabase per associare città a province e regioni.
export type EventTerritory = { provincia: string | null; regione: string | null };
export type EventRecord = {
  id: string;
  nome_evento?: string | null;
  comune_evento?: string | null;
  provincia_evento?: string | null;
  regione_evento?: string | null;
  giorno_inizio?: string | null;
  orario_inizio?: string | null;
  feed_priority?: number;
  feed_reason?: string;
  external_import?: boolean;
  [field: string]: unknown;
};

const normalize = (value: unknown): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("it-IT")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

type Area = { provincia: string; regione: string };
const cities = new Map<string, Area | null>();
const provinces = new Map<string, string | null>();
let initialized = false;

function addArea(map: Map<string, Area | null>, key: string, area: Area) {
  const existing = map.get(key);
  if (existing === undefined) {
    map.set(key, area);
  } else if (existing && (existing.provincia !== area.provincia || existing.regione !== area.regione)) {
    // Comuni omonimi in province differenti: non indovinare il territorio.
    map.set(key, null);
  }
}

function initGeography() {
  if (initialized) return;
  initialized = true;
  for (const region of ITALY_DATA.Italia.regioni) {
    for (const province of region.province) {
      const area = { provincia: province.nome, regione: region.nome };
      const provinceKey = normalize(province.nome);
      const previousRegion = provinces.get(provinceKey);
      if (previousRegion === undefined) provinces.set(provinceKey, region.nome);
      else if (previousRegion !== region.nome) provinces.set(provinceKey, null);
      for (const city of province.comuni) addArea(cities, normalize(city), area);
    }
  }
}

// Accetta codici compressi del DB (es. PI e TO) e nomi completi.
const nameProvince = (value: unknown) => decompressProvinciaEvento(String(value ?? "")) || "";
const nameRegion = (value: unknown) => decompressRegioneEvento(String(value ?? "")) || "";

export function territoryOfEvent(event: EventRecord): EventTerritory {
  initGeography();
  const cityArea = cities.get(normalize(event.comune_evento));
  const province = nameProvince(event.provincia_evento) || cityArea?.provincia || "";
  const region = nameRegion(event.regione_evento) ||
    (province ? provinces.get(normalize(province)) : "") || cityArea?.regione || "";
  return { provincia: province || null, regione: region || null };
}

export function isInEventProvince(event: EventRecord, territory: EventTerritory): boolean {
  const expected = normalize(nameProvince(territory.provincia));
  if (!expected) return false;
  return normalize(territoryOfEvent(event).provincia) === expected;
}

export function isInEventRegion(event: EventRecord, territory: EventTerritory): boolean {
  const expected = normalize(nameRegion(territory.regione));
  if (!expected) return false;
  return normalize(territoryOfEvent(event).regione) === expected;
}

function dateKey(event: EventRecord): string {
  const day = String(event.giorno_inizio || "").slice(0, 10) || "9999-12-31";
  return day + "T" + String(event.orario_inizio || "00:00").slice(0, 5);
}

// La data prevale sulla priorità del feed: l'evento più vicino è sempre in cima.
export function sortEventsByStartDate(events: EventRecord[]): EventRecord[] {
  return [...events].sort((a, b) => dateKey(a).localeCompare(dateKey(b)) ||
    String(a.id).localeCompare(String(b.id)));
}

export function composeTerritorialEvents(
  personal: EventRecord[],
  publicApproved: EventRecord[],
  territory: EventTerritory,
  view: "personal" | "regional" | "global",
): EventRecord[] {
  if (view === "global") return sortEventsByStartDate(publicApproved);
  if (view === "regional") return sortEventsByStartDate(
    publicApproved.filter((event) => isInEventRegion(event, territory))
  );

  // Mantiene gli eventi dei soggetti seguiti e le elezioni pertinenti del feed
  // personale; aggiunge TUTTI gli eventi pubblici della provincia, non solo del comune.
  const byId = new Map<string, EventRecord>();
  for (const event of personal) byId.set(String(event.id), event);
  for (const event of publicApproved) {
    if (isInEventProvince(event, territory) && !byId.has(String(event.id))) {
      byId.set(String(event.id), { ...event, feed_reason: "TERRITORY", feed_priority: 1 });
    }
  }
  return sortEventsByStartDate([...byId.values()]);
}
