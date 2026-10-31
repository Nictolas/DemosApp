import React from "react";
import { BookOpen, CheckCircle2, XCircle, ChevronDown } from "lucide-react";
import type { OpinionBrief } from "@/lib/opinionBriefs";

/**
 * A single accessible, responsive brief layout for all opt-in Opinion IDs.
 * No charts are fabricated: cards show only editorially sourced facts.
 */
export function OpinionBriefCard({ brief }: { brief: OpinionBrief }) {
  return (
    <section
      data-testid="opinion-brief"
      aria-label="Approfondimento sintetico"
      className="mx-auto w-full max-w-3xl space-y-3 text-slate-900"
    >
      <div className="rounded-xl bg-slate-100 px-3 py-3 sm:px-4">
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">In breve</h3>
        <p className="text-sm font-medium leading-5 sm:text-base">{brief.intro}</p>
      </div>

      <div className={`grid gap-2 ${brief.facts.length === 3 ? "grid-cols-3" : "grid-cols-2"}`} aria-label="Dati chiave">
        {brief.facts.map((fact) => (
          <div key={fact.value} className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3">
            <p className="break-words text-base font-bold leading-tight tabular-nums text-slate-900 sm:text-lg">
              {fact.value}
            </p>
            <p className="mt-1 text-xs leading-4 text-slate-600">{fact.label}</p>
          </div>
        ))}
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Confronto</h3>
        <div className="grid grid-cols-2 gap-2">
          {brief.comparison.map((item) => (
            <div key={item.title} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-medium leading-tight text-slate-600">{item.label}</p>
              <h4 className="mt-1 break-words text-sm font-bold leading-5 text-slate-900">{item.title}</h4>
              <p className="mt-1 text-xs leading-[1.4] text-slate-700">{item.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <section className="min-w-0 rounded-xl border border-slate-200 p-3">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold leading-4">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
            Possibili vantaggi
          </h3>
          <p className="mt-1.5 text-xs leading-[1.4] text-slate-700">{brief.advantage}</p>
        </section>
        <section className="min-w-0 rounded-xl border border-slate-200 p-3">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold leading-4">
            <XCircle className="h-4 w-4 shrink-0 text-rose-700" aria-hidden="true" />
            Criticità
          </h3>
          <p className="mt-1.5 text-xs leading-[1.4] text-slate-700">{brief.concern}</p>
        </section>
      </div>

      {brief.note && (
        <p className="border-l-2 border-slate-300 pl-2.5 text-xs leading-4 text-slate-600">{brief.note}</p>
      )}

      <details className="group rounded-xl border border-slate-200 bg-white">
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
