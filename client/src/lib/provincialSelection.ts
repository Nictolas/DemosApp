// Canonical provincial offices are directly elected only in the autonomous
// provinces. The frontend gate is advisory; API gates remain authoritative.
export const PROVINCIAL_UI_RELEASED = import.meta.env.VITE_DEMOS_PROVINCIAL_SELECTIONS_GO === "true";

export type ProvincialOffice = Readonly<{
  officeId: "it.provincial.trento" | "it.provincial.bolzano";
  category: "provinciale-trento" | "provinciale-bolzano";
  label: string;
}>;

const TRENTO: ProvincialOffice = Object.freeze({
  officeId: "it.provincial.trento",
  category: "provinciale-trento",
  label: "Consiglio provinciale di Trento",
});
const BOLZANO: ProvincialOffice = Object.freeze({
  officeId: "it.provincial.bolzano",
  category: "provinciale-bolzano",
  label: "Consiglio provinciale di Bolzano",
});

export function provincialOfficeFromCategory(value: string): ProvincialOffice | null {
  if (value === TRENTO.category) return TRENTO;
  if (value === BOLZANO.category) return BOLZANO;
  return null;
}

export function provincialOfficeFromResidence(profile: {
  paese_residenza?: string | null;
  provincia_residenza?: string | null;
} | null | undefined): ProvincialOffice | null {
  const country = String(profile?.paese_residenza || "").trim().toUpperCase();
  // No province alone can establish residence in Italy; reject unknown or
  // foreign country codes even if they happen to contain TN/BZ.
  if (!["IT", "ITALIA", "ITALY"].includes(country)) return null;
  const province = String(profile?.provincia_residenza || "").trim().toUpperCase();
  if (["TN", "TRENTO"].includes(province)) return TRENTO;
  if (["BZ", "BOLZANO", "BOZEN"].includes(province)) return BOLZANO;
  return null;
}
