import { Archive, Building2, ChevronRight, Crown, FileText, Scale, UserRound, type LucideIcon } from "lucide-react";
import { Link } from "wouter";
import type { ProfileChosenVotes } from "../utils/encryptedProfileVault";

export type ChosenPreferencesStatus = "ready" | "loading" | "unavailable" | "consent-required";
type Row = { key: string; label: string; values: string[]; icon: LucideIcon; path: string };

const selectedNames = (values: string[] | undefined): string[] =>
  Array.isArray(values)
    ? values.filter((value): value is string => typeof value === "string" && !!value.trim()).map(value => value.trim())
    : [];

export function ProfileChosenPreferences({
  choices,
  status,
}: {
  choices: ProfileChosenVotes | null;
  status: ChosenPreferencesStatus;
}) {
  // All six choices are navigable even when the user has not yet voted.
  // Only display saved choices when the authenticated political consent is verified.
  const rows: Row[] = [
    { key: "capo", label: "Capo di Stato preferito", values: selectedNames(choices?.capoStato), icon: Crown, path: "/capo-di-stato" },
    { key: "grazia", label: "Grazia", values: selectedNames(choices?.grazia), icon: Scale, path: "/grazia" },
    { key: "amnistia", label: "Amnistia", values: selectedNames(choices?.amnistia), icon: Archive, path: "/amnistia" },
    { key: "iniziativa", label: "Iniziativa popolare", values: selectedNames(choices?.iniziativaPopolare), icon: FileText, path: "/vota-iniziativa-popolare" },
    { key: "attivista", label: "Attivista preferito", values: selectedNames(choices?.attivista?.nome ? [choices.attivista.nome] : []), icon: UserRound, path: "/attivisti" },
    { key: "organizzazione", label: "Organizzazione preferita", values: selectedNames(choices?.organizzazione?.nome ? [choices.organizzazione.nome] : []), icon: Building2, path: "/organizzazioni" },
  ];

  return (
    <section aria-label="Le mie altre scelte" className="overflow-hidden rounded-xl border border-indigo-100 bg-white shadow-sm">
      <h2 className="border-b border-indigo-100 px-4 py-3 text-base font-bold text-slate-900">
        Le mie altre scelte
      </h2>
      <div className="divide-y divide-slate-100 px-4">
        {rows.map(({ key, label, values, icon: Icon, path }) => (
          <Link key={key} href={path} className="flex min-w-0 items-center gap-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
            <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-indigo-600" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-indigo-700">{label}</p>
              {status === "ready" ? (
                values.length > 0 ? (
                  <div className="space-y-0.5">
                    {values.map((value, index) => (
                      <p key={index} className="break-words text-sm font-semibold text-slate-900">{value}</p>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    <span>Nessun voto selezionato</span>
                    {" · "}
                    <span className="font-semibold text-indigo-700">Scegli ora</span>
                  </p>
                )
              ) : (
                <p className="text-sm text-slate-500">
                  {status === "loading" ? "Caricamento scelte…" :
                   status === "consent-required" ? "Consenso politico necessario" :
                   "Scelte temporaneamente non disponibili"}
                </p>
              )}
            </div>
            <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" />
          </Link>
        ))}
      </div>
    </section>
  );
}
