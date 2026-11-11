import { Link } from "wouter";
import { ArrowLeft, Compass } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";
import { isPlainNavigationClick, useSmoothNavigation } from "@/hooks/useSmoothNavigation";
import { PoliticalCompassPreview } from "./Profilo/components/PoliticalCompassPreview";
import { CompleteOpinionsCallout } from "./Profilo/components/CompleteOpinionsCallout";
import { CLOSED_PROFILE_PANELS, useProfileData } from "./Profilo/hooks/useProfileData";

// Solo il titolare del profilo, dopo verifica del consenso politico,
// puo caricare e visualizzare le sue risposte. Il punteggio resta in RAM.
export default function CompassoPolitico() {
  const navigateSmoothly = useSmoothNavigation();
  const {
    userOpinions,
    opinionQuestions,
    opinionsError,
    consentChecked,
    consentGranted,
    isLoading,
    isLoadingInfo,
    sectionsLoading,
    error,
  } = useProfileData(undefined, { ...CLOSED_PROFILE_PANELS, opinions: true });

  const loading = isLoading || isLoadingInfo || !consentChecked ||
    (consentGranted && sectionsLoading.opinions);

  return (
    <PageContainer className="demos-compass-page bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
        <header className="shrink-0 border-b border-slate-200 bg-white/95 px-4 py-3">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <a
              href="/profilo"
              aria-label="Torna al Profilo cittadino"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              onClick={(event) => {
                if (!isPlainNavigationClick(event)) return;
                event.preventDefault();
                navigateSmoothly("/profilo", "back");
              }}
            >
              <ArrowLeft aria-hidden="true" className="h-5 w-5" />
            </a>
            <div className="demos-compass-destination flex min-w-0 items-center gap-2 rounded-lg px-1 py-1">
              <Compass aria-hidden="true" className="h-6 w-6 shrink-0 text-indigo-700" />
              <h1 className="text-lg font-bold text-slate-900 sm:text-xl">Compasso politico</h1>
            </div>
          </div>
        </header>
        <main
          className="app-page-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-8 pt-4 sm:px-4"
          aria-label="Compasso politico personale"
          tabIndex={0}
        >
          <div className="demos-compass-content mx-auto max-w-3xl space-y-3">
            {loading ? (
              <div role="status" className="demos-compass-skeleton space-y-3">
                <span className="sr-only">Caricamento delle tue Opinioni…</span>
                <div aria-hidden="true" className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-4 h-5 w-44 max-w-full animate-pulse rounded bg-slate-200" />
                  <div className="h-40 animate-pulse rounded-lg bg-slate-100" />
                </div>
                <div aria-hidden="true" className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 h-4 w-2/3 animate-pulse rounded bg-slate-200" />
                  <div className="mb-3 h-3 w-full animate-pulse rounded bg-slate-100" />
                  <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            ) : error ? (
              <p role="alert" className="rounded-xl border border-red-200 bg-white p-4 text-sm text-red-800">
                Non è stato possibile caricare il profilo. Torna al Profilo e riprova.
              </p>
            ) : opinionsError ? (
              <p role="alert" className="rounded-xl border border-red-200 bg-white p-4 text-sm text-red-800">
                Non è stato possibile recuperare le tue risposte. Il Compasso non può calcolare un risultato. Torna al Profilo e riprova.
              </p>
            ) : !consentGranted ? (
              <div className="rounded-xl border border-amber-200 bg-white p-4 text-sm text-slate-800">
                Per visualizzare il compasso è necessario il consenso al trattamento delle Opinioni politiche.
                <Link href="/profilo" className="mt-3 block font-semibold text-indigo-700 underline">
                  Torna al Profilo
                </Link>
              </div>
            ) : (
              <>
                <PoliticalCompassPreview answers={userOpinions} standalone />
                <CompleteOpinionsCallout answers={userOpinions} questions={opinionQuestions} visible={opinionQuestions.length > 0} />
                <Link href="/opinioni" className="block rounded-xl border border-indigo-200 bg-white px-4 py-3 text-center text-sm font-semibold text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                  Esprimi o modifica le tue Opinioni
                </Link>
              </>
            )}
          </div>
        </main>
      </div>
    </PageContainer>
  );
}
