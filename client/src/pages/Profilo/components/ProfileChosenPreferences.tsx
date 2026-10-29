import { Archive, Building2, Crown, FileText, Scale, UserRound, type LucideIcon } from "lucide-react";
import { Link } from "wouter";
import type { ProfileChosenVotes } from "../utils/encryptedProfileVault";

type Row = { key: string; label: string; text: string; icon: LucideIcon; path: string };

export function ProfileChosenPreferences({
  choices,
}: {
  choices: ProfileChosenVotes | null;
}) {
  if (!choices) return null;
  const rows: Row[] = [];
  const add = (key: string, label: string, values: string[] | undefined, icon: LucideIcon, path: string) => {
    for (const [index, value] of (values || []).entries()) {
      if (typeof value === "string" && value.trim()) {
        rows.push({ key: key + index, label, text: value.trim(), icon, path });
      }
    }
  };
  add("capo", "Capo di Stato preferito", choices.capoStato, Crown, "/capo-di-stato");
  add("grazia", "Grazia", choices.grazia, Scale, "/grazia");
  add("amnistia", "Amnistia", choices.amnistia, Archive, "/amnistia");
  add("iniziativa", "Iniziativa popolare", choices.iniziativaPopolare, FileText, "/vota-iniziativa-popolare");
  if (choices.attivista?.nome) rows.push({
    key: "attivista", label: "Attivista preferito",
    text: choices.attivista.nome, icon: UserRound, path: "/attivisti",
  });
  if (choices.organizzazione?.nome) rows.push({
    key: "organizzazione", label: "Organizzazione preferita",
    text: choices.organizzazione.nome, icon: Building2, path: "/organizzazioni",
  });
  // Never display empty categories or an empty panel.
  if (!rows.length) return null;

  return (
    <section aria-label="Le mie altre scelte" className="overflow-hidden rounded-xl border border-indigo-100 bg-white shadow-sm">
      <h2 className="border-b border-indigo-100 px-4 py-3 text-base font-bold text-slate-900">
        Le mie altre scelte
      </h2>
      <div className="divide-y divide-slate-100 px-4">
        {rows.map(({ key, label, text, icon: Icon, path }) => (
          <Link key={key} href={path} className="flex min-w-0 items-start gap-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
            <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600"/>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-indigo-700">{label}</p>
              <p className="break-words text-sm font-semibold text-slate-900">{text}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
