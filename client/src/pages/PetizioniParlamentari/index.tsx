import React from "react";
import { Redirect } from "wouter";
import { ExternalLink, FilePenLine, Landmark, ShieldCheck } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";
import { useAuth } from "@/hooks/use-auth";

// Solo collegamenti istituzionali verificati: non esiste una fonte pubblica
// validata per attribuire a ogni petizione lo stato "sottoscrivibile".
const CAMERA_PETITIONS_URL = "https://petizionionline.camera.it/petizioni";
const CAMERA_PUBLIC_LIST_URL =
  "https://www.camera.it/leg19/468?idLegislatura=19&stile=odgGenerale%2FndxNumericoPetizioni&xml=petizioniNew";
const SENATO_INFO_URL =
  "https://www.senato.it/relazioni-con-i-cittadini/presentare-una-petizione/presentare-una-petizione";

const externalLinkClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:text-slate-950";

export default function PetizioniParlamentari() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <PageContainer className="overflow-hidden items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </PageContainer>
    );
  }

  if (!user) return <Redirect to="/auth" />;

  return (
    <PageContainer className="overflow-hidden">
      <div
        className="app-page-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5 sm:py-6"
        role="region"
        aria-label="Petizione parlamentare"
        tabIndex={0}
      >
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 pb-5">
          <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <Landmark className="h-8 w-8 shrink-0 text-indigo-700 dark:text-indigo-300" aria-hidden="true" />
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Petizione parlamentare
              </h1>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              Con una petizione puoi chiedere alla Camera o al Senato un intervento
              legislativo o segnalare una necessità di interesse generale (articolo 50
              della Costituzione). Non è una proposta di legge di iniziativa popolare.
            </p>
          </header>

          <section aria-labelledby="camera-petizioni" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 id="camera-petizioni" className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
              <FilePenLine className="h-5 w-5 text-indigo-700 dark:text-indigo-300" aria-hidden="true" />
              Camera dei deputati
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              Sul portale ufficiale puoi presentare una petizione e sottoscrivere
              quelle disponibili. Per accedere servono SPID o CIE. Non tutte le
              petizioni presenti nell'elenco pubblico sono sottoscrivibili.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a href={CAMERA_PETITIONS_URL} target="_blank" rel="noopener noreferrer" className={externalLinkClass}>
                Accedi alle petizioni online <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                href={CAMERA_PUBLIC_LIST_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                Elenco pubblico <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </section>

          <section aria-labelledby="senato-petizioni" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 id="senato-petizioni" className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
              <Landmark className="h-5 w-5 text-indigo-700 dark:text-indigo-300" aria-hidden="true" />
              Senato della Repubblica
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              Il Senato accetta petizioni anche tramite posta elettronica, seguendo
              le modalità ufficiali. Non è disponibile qui un elenco verificato di
              petizioni da sottoscrivere online.
            </p>
            <a href={SENATO_INFO_URL} target="_blank" rel="noopener noreferrer" className={externalLinkClass + " mt-4"}>
              Consulta le istruzioni del Senato <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          </section>

          <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Per le petizioni, DEMOS non raccoglie firme, documenti o credenziali e non verifica lo stato
            delle singole petizioni. Tutte le operazioni avvengono sui siti ufficiali.
          </p>
        </div>
      </div>
    </PageContainer>
  );
}
