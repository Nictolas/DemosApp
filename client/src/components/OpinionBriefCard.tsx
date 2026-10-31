import React from "react";
import { BookOpen, CheckCircle2, XCircle, ChevronDown, Info, ArrowRight, Globe2, BarChart3, ExternalLink } from "lucide-react";
import type { OpinionBrief } from "@/lib/opinionBriefs";

/**
 * A single accessible, responsive brief layout for all opt-in Opinion IDs.
 * No charts are fabricated: cards show only editorially sourced facts.
 */
export function OpinionBriefCard({ brief }: { brief: OpinionBrief }) {
  const isTransition = brief.comparisonMode === "transition" && brief.comparison.length === 2;
  return (
    <section
      data-testid="opinion-brief"
      aria-label="Approfondimento sintetico"
      className="mx-auto w-full max-w-3xl space-y-3 text-slate-900"
    >
      <div className="rounded-2xl border-2 border-sky-300 bg-sky-100 px-4 py-5 shadow-sm sm:px-5" data-testid="opinion-brief-intro">
        <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-sky-900">Di cosa si parla</h3>
        <p className="text-lg font-extrabold leading-7 text-sky-950 sm:text-xl sm:leading-8">{brief.intro}</p>
      </div>

      {brief.facts.length > 0 && (
      <div className={`grid gap-2 ${brief.facts.length === 3 ? "grid-cols-3" : "grid-cols-2"}`} aria-label="Dati chiave">
        {brief.facts.map((fact) => (
          <div key={fact.value} className="min-w-0 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-3">
            <p className="break-words text-base font-extrabold leading-tight tabular-nums text-indigo-950 sm:text-lg">
              {fact.value}
            </p>
            <p className="mt-1 text-xs leading-4 text-indigo-900">{fact.label}</p>
          </div>
        ))}
      </div>
      )}

      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-700">
          {isTransition ? "Oggi → proposta" : "Confronto"}
        </h3>
        <div
          data-testid="opinion-brief-comparison"
          className={isTransition
            ? "grid grid-cols-[minmax(0,1fr)_1.75rem_minmax(0,1fr)] items-stretch gap-1 sm:gap-2"
            : "grid grid-cols-2 gap-2"}
        >
          {brief.comparison.map((item, index) => (
            <React.Fragment key={item.title}>
              {isTransition && index === 1 && (
                <div className="flex items-center justify-center">
                  <span
                    data-testid="opinion-brief-transition-arrow"
                    role="img"
                    aria-label="Dalla situazione attuale alla modifica proposta"
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-indigo-300 bg-white text-indigo-800"
                  >
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
              )}
              <div className={isTransition && index === 1
                ? "min-w-0 rounded-xl border border-indigo-300 bg-indigo-50 p-2.5 sm:p-3"
                : "min-w-0 rounded-xl border border-cyan-200 bg-cyan-50 p-2.5 sm:p-3"}
              >
                <p className="text-[11px] font-bold leading-tight text-slate-700">{item.label}</p>
                <h4 className="mt-1 break-words text-sm font-extrabold leading-5 text-slate-900">{item.title}</h4>
                <p className="mt-1 text-xs leading-[1.4] text-slate-800">{item.text}</p>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {brief.legalStatuses && brief.legalStatuses.length > 0 && (
        <section data-testid="opinion-brief-legal-status" aria-label="Leggi nei diversi Paesi" className="space-y-2">
          <h3 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-slate-700">
            <Globe2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            Dove è consentita e dove no
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {brief.legalStatuses.map((place) => (
              <div
                data-testid="opinion-brief-country"
                data-legal-status={place.status}
                key={place.place}
                className={place.status === "regulated"
                  ? "min-w-0 rounded-xl border-2 border-emerald-300 bg-emerald-100 p-3"
                  : place.status === "limited"
                    ? "min-w-0 rounded-xl border-2 border-amber-300 bg-amber-100 p-3"
                    : "min-w-0 rounded-xl border-2 border-rose-300 bg-rose-100 p-3"}
              >
                <p className="text-sm font-extrabold text-slate-900">{place.place}</p>
                <p className={place.status === "regulated"
                  ? "my-1.5 inline-block rounded-md bg-emerald-200 px-2 py-1 text-[11px] font-bold text-emerald-950"
                  : place.status === "limited"
                    ? "my-1.5 inline-block rounded-md bg-amber-200 px-2 py-1 text-[11px] font-bold text-amber-950"
                    : "my-1.5 inline-block rounded-md bg-rose-200 px-2 py-1 text-[11px] font-bold text-rose-950"}
                >{place.label}</p>
                <p className="text-xs leading-[1.4] text-slate-700">{place.rule}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {brief.measuredResults && brief.measuredResults.length > 0 && (
        <section data-testid="opinion-brief-measured-results" aria-label="Risultati osservati nei Paesi" className="space-y-2">
          <h3 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-slate-700">
            <BarChart3 className="h-4 w-4 shrink-0" aria-hidden="true" />
            Risultati misurati
          </h3>
          <p className="text-xs leading-4 text-slate-600">Numeri reali, con luogo, periodo e fonte. Non sono previsioni per l'Italia.</p>
          <div className="grid grid-cols-2 gap-2">
            {brief.measuredResults.slice(0, 4).map((result) => (
              <div data-testid="opinion-brief-result" key={result.place + result.topic} className="min-w-0 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
                <p className="text-[11px] font-bold leading-4 text-indigo-900">{result.place} · {result.topic}</p>
                <p className="mt-1 break-words text-lg font-extrabold leading-6 tabular-nums text-indigo-950">{result.value}</p>
                <p className="mt-1 text-[11px] font-semibold leading-4 text-indigo-900">{result.period}</p>
                <p className="mt-1 text-xs leading-[1.4] text-slate-700">{result.meaning}</p>
                <a href={result.sourceUrl} rel="noopener noreferrer" target="_blank"
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-800 underline underline-offset-2">
                  Fonte <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </div>
            ))}
          </div>
          {brief.measuredResults.length > 4 && (
            <details className="rounded-lg border border-indigo-200 bg-indigo-50/40">
              <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-indigo-950">
                Altri dati e possibili criticità ({brief.measuredResults.length - 4})
              </summary>
              <div className="space-y-3 border-t border-indigo-200 p-3">
                {brief.measuredResults.slice(4).map((result) => (
                  <div key={result.place + result.topic} className="space-y-1 text-xs leading-4">
                    <p className="font-semibold text-slate-900">{result.place} · {result.topic}: {result.value}</p>
                    <p className="text-slate-600">{result.period}. {result.meaning}</p>
                    <a href={result.sourceUrl} rel="noopener noreferrer" target="_blank" className="font-medium text-blue-700 underline">Fonte ufficiale</a>
                  </div>
                ))}
              </div>
            </details>
          )}
          {brief.evidenceCaveat && (
            <p className="border-l-2 border-indigo-300 pl-3 text-xs leading-4 text-slate-700">
              {brief.evidenceCaveat}
            </p>
          )}
        </section>
      )}

      <div className="grid grid-cols-2 gap-2" aria-label="Argomenti a confronto">
        <section data-testid="opinion-brief-pro" className="min-w-0 rounded-xl border-2 border-emerald-300 bg-emerald-100 p-3">
          <h3 className="flex items-center gap-1.5 text-xs font-extrabold leading-4 text-emerald-950 sm:text-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-800" aria-hidden="true" />
            A favore
          </h3>
          <p className="mt-2 text-xs font-medium leading-[1.45] text-emerald-950">{brief.advantage}</p>
        </section>
        <section data-testid="opinion-brief-con" className="min-w-0 rounded-xl border-2 border-rose-300 bg-rose-100 p-3">
          <h3 className="flex items-center gap-1.5 text-xs font-extrabold leading-4 text-rose-950 sm:text-sm">
            <XCircle className="h-4 w-4 shrink-0 text-rose-800" aria-hidden="true" />
            Contro
          </h3>
          <p className="mt-2 text-xs font-medium leading-[1.45] text-rose-950">{brief.concern}</p>
        </section>
      </div>

      {brief.note && (
        <p className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-4 text-amber-950">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" aria-hidden="true" />
          <span>{brief.note}</span>
        </p>
      )}

      <details className="group rounded-xl border border-slate-200 bg-slate-50">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-3 text-sm font-medium text-slate-800 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
            Fonti ({brief.sources.length})
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <ul className="space-y-2 border-t border-slate-200 px-3 py-3">
          {brief.sources.map((source) => (
            <li key={source.url}>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="break-words text-xs font-medium leading-5 text-blue-700 underline underline-offset-2"
              >
                {source.label}
              </a>
            </li>
          ))}
        </ul>
        <p className="px-3 pb-3 text-[11px] text-slate-500">Informazioni verificate il {brief.verified}.</p>
      </details>
    </section>
  );
}
