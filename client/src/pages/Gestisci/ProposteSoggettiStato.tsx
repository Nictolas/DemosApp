import React from "react";
import { Link, Redirect } from "wouter";
import { ArrowLeft, ClipboardList, LockKeyhole } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { hasAdminCapability } from "@/lib/admin-access";
import { PageContainer } from "@/components/PageContainer";

/**
 * Safe production landing page while the private subject-proposal backend
 * and GDPR/data-retention gates are still unapproved. Do not make API calls
 * or claim that an empty list means there are no submitted proposals.
 *
 * The full moderation UI is retained in the dedicated DEMOS12 draft branch.
 */
export default function ProposteSoggettiStato() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <PageContainer className="items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" aria-label="Caricamento" />
      </PageContainer>
    );
  }

  if (!user) return <Redirect to="/auth" />;
  if (!hasAdminCapability(user)) return <Redirect to="/gestisci" />;

  return (
    <PageContainer className="overflow-y-auto bg-slate-50">
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
        <Link href="/gestisci" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Torna a Gestisci
        </Link>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
            <ClipboardList className="h-6 w-6 text-slate-700" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Proposte soggetti</h1>
          <p className="mt-3 text-slate-700" role="status">
            La gestione delle proposte non è ancora attiva sul sito pubblico di DEMOS.
          </p>
          <div className="mt-6 flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" aria-hidden="true" />
            <div className="text-sm leading-6 text-slate-700">
              <p>La coda delle proposte e i comandi di approvazione e rifiuto saranno disponibili dopo l'integrazione sicura del backend e del database.</p>
              <p className="mt-2">Questa pagina non legge né invia dati personali e non mostra un elenco vuoto che potrebbe essere scambiato per assenza di proposte.</p>
            </div>
          </div>
        </div>
      </main>
    </PageContainer>
  );
}