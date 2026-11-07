import type { OpinionTopicId } from "./opinionTopics";

// Colori decorativi e stabili: nessuna relazione con le risposte politiche.
// Le 11 chiavi sono verificate a livello TypeScript rispetto al catalogo dei temi.
export type OpinionTopicColor = Readonly<{
  primary: string;
  softBg: string;
  border: string;
}>;

export const OPINION_TOPIC_COLORS = {
  economia_lavoro_fisco:       { primary: "#2563EB", softBg: "#EFF6FF", border: "#BFDBFE" },
  diritti_societa:             { primary: "#BE185D", softBg: "#FDF2F8", border: "#FBCFE8" },
  ambiente_energia:            { primary: "#15803D", softBg: "#F0FDF4", border: "#BBF7D0" },
  animali_alimentazione:       { primary: "#C2410C", softBg: "#FFF7ED", border: "#FED7AA" },
  sanita_scuola_famiglia:      { primary: "#7C3AED", softBg: "#F5F3FF", border: "#DDD6FE" },
  sicurezza_giustizia:         { primary: "#B91C1C", softBg: "#FEF2F2", border: "#FECACA" },
  trasporti_mobilita:          { primary: "#0284C7", softBg: "#F0F9FF", border: "#BAE6FD" },
  immigrazione_cittadinanza:   { primary: "#0F766E", softBg: "#F0FDFA", border: "#99F6E4" },
  istituzioni_democrazia:      { primary: "#475569", softBg: "#F8FAFC", border: "#CBD5E1" },
  esteri_difesa:               { primary: "#4338CA", softBg: "#EEF2FF", border: "#C7D2FE" },
  citta_cultura_servizi:       { primary: "#B45309", softBg: "#FFFBEB", border: "#FDE68A" },
} as const satisfies Record<OpinionTopicId, OpinionTopicColor>;
