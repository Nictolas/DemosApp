import { ChevronDown, Crown } from "lucide-react";
import { Link } from "wouter";

// A recognizable emoji for each government portfolio. Keep the mapping in
// one place so labels and visuals remain consistent in the profile.
const emojiPerMinistero: Record<string, string> = {
  primo_ministro: "👑",
  difesa: "🛡️",
  economia: "💶",
  esteri: "🌍",
  giustizia: "⚖️",
  interno: "🏛️",
  istruzione: "📚",
  lavoro: "💼",
  salute: "🩺",
  trasporti: "🚆",
  ambiente: "🌱",
  ambiente_sicurezza_energetica: "⚡",
  cultura: "🎭",
  sport: "🏅",
};

const emojiMinistero = (categoria: string): string =>
  emojiPerMinistero[categoria.trim().toLowerCase().replace(/[\s-]+/g, "_")] ?? "📋";

interface ProfileGovernoIdealeProps {
  governoIdeale: Record<string, string>;
  canEdit?: boolean;
}

export const ProfileGovernoIdeale = ({ governoIdeale, canEdit = true }: ProfileGovernoIdealeProps) => {
  const entries = Object.entries(governoIdeale || {}).filter(([, nome]) => Boolean(nome));
  const readableRole = (role: string) =>
    role.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

  return (
    <details className="group overflow-hidden rounded-xl border border-indigo-100 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 [&::-webkit-details-marker]:hidden">
        <Crown aria-hidden="true" className="h-4 w-4 shrink-0 text-purple-600" />
        <span className="min-w-0 flex-1 text-sm font-semibold text-slate-900">Il tuo Governo ideale</span>
        <span className="text-xs text-slate-500">{entries.length} incarichi</span>
        <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-indigo-100 px-4 pb-4 pt-3">
        {entries.length === 0 ? (
          <p className="text-sm text-slate-500">Nessun ministro selezionato.</p>
        ) : (
          <dl className="divide-y divide-slate-100">
            {entries.map(([categoria, nome]) => (
              <div key={categoria} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-2 py-2 text-sm">
                <dt className="flex min-w-0 items-center gap-1.5 font-medium text-indigo-700">
                  <span
                    aria-hidden="true"
                    className="inline-flex w-5 shrink-0 items-center justify-center text-base leading-none"
                  >
                    {emojiMinistero(categoria)}
                  </span>
                  <span className="break-words">{readableRole(categoria)}</span>
                </dt>
                <dd className="min-w-0 break-words font-semibold text-slate-900">{nome}</dd>
              </div>
            ))}
          </dl>
        )}
        {canEdit && (
          <Link href="/governo" className="mt-3 inline-flex text-sm font-semibold text-blue-700 hover:underline">
            Scegli ministri
          </Link>
        )}
      </div>
    </details>
  );
};
