import React from "react";
import { Redirect } from "wouter";
import { BookOpen, ExternalLink, FilePenLine, Landmark, PenLine, ShieldCheck } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";
import { useAuth } from "@/hooks/use-auth";

// Solo destinazioni ufficiali. Nessun elenco locale di petizioni "firmabili":
// non è disponibile una fonte pubblica verificata con lo stato delle sottoscrizioni.
const CAMERA_PETITIONS_URL = "https://petizionionline.camera.it/petizioni/web/home.html";
const CAMERA_PUBLIC_LIST_URL =
  "https://www.camera.it/leg19/468?idLegislatura=19&stile=odgGenerale%2FndxNumericoPetizioni&xml=petizioniNew";
const SENATO_INFO_URL =
  "https://www.senato.it/relazioni-con-i-cittadini/presentare-una-petizione/presentare-una-petizione";

const sectionClass =
  "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-700 dark:bg-slate-900";
const actionBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-3 text-center text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900";
const primaryActionClass =
  actionBase + " bg-amber-400 text-slate-950 hover:bg-amber-300 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300";
const secondaryActionClass =
  actionBase + " border border-amber-500 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-400 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-900/50";
const outlineActionClass =
  actionBase + " border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700";

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
          <header className={sectionClass}>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                <Landmark className="h-7 w-7" aria-hidden="true" />
              </span>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  Petizione Parlamentare
                </h1>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Chiedi al Parlamento di intervenire su un tema.
                </p>
              </div>
            </div>
          </header>

          <section aria-labelledby="cosa-sono-petizioni" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-slate-900 sm:p-5">
            <h2 id="cosa-sono-petizioni" className="text-base font-bold text-amber-950 dark:text-amber-100">
              Cos'è una petizione parlamentare?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
              Ogni cittadino italiano può chiedere alla Camera o al Senato un intervento
              legislativo o segnalare una necessità di interesse generale (articolo 50
              della Costituzione). Basta anche una sola persona: non servono le 50.000
              firme previste per le iniziative legislative popolari.
            </p>
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-800 dark:text-slate-200">
              Il Parlamento non è obbligato ad accogliere la richiesta.
            </p>
          </section>

          <section aria-labelledby="camera-petizioni" className={sectionClass}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="camera-petizioni" className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
                <FilePenLine className="h-5 w-5 text-amber-700 dark:text-amber-300" aria-hidden="true" />
                Camera dei deputati
              </h2>
              <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                SPID o CIE
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              Puoi presentare una nuova petizione oppure sottoscriverne una disponibile.
              Per entrambe le operazioni accedi alla piattaforma ufficiale con SPID o CIE.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <a
                href={CAMERA_PETITIONS_URL}
                target="_blank" rel="noopener noreferrer"
                className={primaryActionClass}
              >
                <PenLine className="h-4 w-4" aria-hidden="true" />
                Presenta una petizione
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                href={CAMERA_PETITIONS_URL}
                target="_blank" rel="noopener noreferrer"
                className={secondaryActionClass}
              >
                <FilePenLine className="h-4 w-4" aria-hidden="true" />
                Sottoscrivi una petizione
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Entrambi i pulsanti aprono lo stesso portale: dopo l'accesso scegli l'operazione.
              Non tutte le petizioni nell'elenco pubblico sono sottoscrivibili.
            </p>
            <a
              href={CAMERA_PUBLIC_LIST_URL}
              target="_blank" rel="noopener noreferrer"
              className={outlineActionClass + " mt-3"}
            >
              Consulta l'elenco pubblico <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          </section>

          <section aria-labelledby="senato-petizioni" className={sectionClass}>
            <h2 id="senato-petizioni" className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
              <Landmark className="h-5 w-5 text-amber-700 dark:text-amber-300" aria-hidden="true" />
              Senato della Repubblica
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              Puoi presentare una petizione anche via email. Il Senato richiede
              un documento con firma digitale valida oppure la scansione della
              petizione firmata a mano, accompagnata dalla copia di un documento
              d'identità valido. Verifica tutte le modalità sul sito ufficiale.
            </p>
            <a
              href={SENATO_INFO_URL}
              target="_blank" rel="noopener noreferrer"
              className={outlineActionClass + " mt-4"}
            >
              Istruzioni per presentarla <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              DEMOS non presenta un elenco verificato di petizioni del Senato da sottoscrivere online.
            </p>
          </section>

          <section aria-labelledby="guida-petizione" className={sectionClass}>
            <h2 id="guida-petizione" className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
              <BookOpen className="h-5 w-5 text-amber-700 dark:text-amber-300" aria-hidden="true" />
              Come preparare una petizione
            </h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              <li>Scegli un problema di interesse generale, non una questione esclusivamente personale.</li>
              <li>Scrivi una richiesta concreta e spiega brevemente perché è necessaria.</li>
              <li>Seleziona Camera o Senato e segui le istruzioni ufficiali per presentarla.</li>
            </ol>
            <p className="mt-3 border-t border-slate-200 pt-3 text-sm leading-relaxed text-slate-600 dark:border-slate-700 dark:text-slate-400">
              Dopo la presentazione, la petizione viene annunciata e trasmessa
              alla Commissione competente. Questo non garantisce che sia accolta.
            </p>
          </section>

          <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
            Per le petizioni, DEMOS non raccoglie firme, documenti o credenziali e non verifica lo stato
            delle singole petizioni. Tutte le operazioni avvengono sui siti ufficiali.
          </p>
        </div>
      </div>
    </PageContainer>
  );
}
