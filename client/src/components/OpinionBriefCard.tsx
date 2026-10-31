import React from "react";
import { BookOpen, CheckCircle2, XCircle, ChevronDown, Info, ArrowRight } from "lucide-react";
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
      <div className="rounded-xl border border-sky-200 bg-sky-100 px-4 py-4 sm:px-5">
        <h3 className="mb-1 text-xs font-extrabold uppercase tracking-wide text-sky-900">In breve</h3>
        <p className="text-base font-bold leading-6 text-sky-950 sm:text-lg sm:leading-7">{brief.intro}</p>
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
