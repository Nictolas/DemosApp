import React, { useEffect, useRef, useState } from "react";
import { useLocation, Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { PageContainer } from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, CheckCircle2, Loader2, Send } from "lucide-react";
import {
  SUBJECT_PROPOSAL_CATEGORIES,
  DEFAULT_SUBJECT_CATEGORY,
  categoryFromSearch,
  getProposalCategory,
  proposalReturnPathFromSearch,
  type ProposalCategory,
} from "@/config/subjectProposalCategories";

const initialCategory = (): ProposalCategory =>
  typeof window === "undefined" ? DEFAULT_SUBJECT_CATEGORY : categoryFromSearch(window.location.search);

export default function ProponiSoggetto() {
  const authReady = useAuthReady();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [category, setCategory] = useState<ProposalCategory>(initialCategory);
  const [returnPath, setReturnPath] = useState(() =>
    typeof window === "undefined" ? "/capo-stato" : proposalReturnPathFromSearch(window.location.search));
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<ProposalCategory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [myStatus, setMyStatus] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  // Invalidate an in-flight personal status read whenever its category changes.
  // Older results must never be shown under a different proposal category.
  const statusRequestVersion = useRef(0);

  // Contextual + from any of the five sections preselects a category.
  // No GET request is made on opening this page or changing the category.
  useEffect(() => {
    statusRequestVersion.current += 1;
    setCheckingStatus(false);
    const fromUrl = typeof window === "undefined" ? DEFAULT_SUBJECT_CATEGORY : categoryFromSearch(window.location.search);
    setCategory(fromUrl);
    setReturnPath(proposalReturnPathFromSearch(window.location.search));
    setTitle("");
    setDetails("");
    setSourceUrl("");
    setSubmitted(null);
    setError(null);
    setMyStatus(null);
    setStatusError(null);
  }, [location]);

  const chooseCategory = (next: ProposalCategory) => {
    if (submitting) return;
    statusRequestVersion.current += 1;
    setCheckingStatus(false);
    setCategory(next);
    setTitle("");
    setDetails("");
    setSourceUrl("");
    setSubmitted(null);
    setError(null);
    setMyStatus(null);
    setStatusError(null);
  };

  const config = getProposalCategory(category);
  const sourceIsValid = (() => {
    try {
      const url = new URL(sourceUrl.trim());
      return url.protocol === "https:" && !!url.hostname && !url.username && !url.password;
    } catch {
      return false;
    }
  })();
  const canSubmit = title.trim().length >= 3 &&
    title.trim().length <= 150 && sourceIsValid && sourceUrl.length <= (category === "grazia" ? 2000 : 2048) &&
    (category === "grazia" || details.length <= 1000) &&
    !submitting && submitted !== category;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !authReady || !user) return;
    setSubmitting(true);
    setError(null);
    try {
      // One form, two existing moderation workflows: Grazia uses richieste_grazia
      // (PR #495), all other categories use subject_proposals. Neither is published here.
      // Only one POST on submission and no proposal-specific GET on form mount.
      const response = category === "grazia"
        ? await apiRequest("POST", "/api/grazia", {
            nome: title.trim(),
            urlProva: sourceUrl.trim(),
          })
        : await apiRequest("POST", "/api/subject-proposals", {
            category,
            title: title.trim(),
            details: details.trim(),
            source_url: sourceUrl.trim(),
          });
      const recorded = category === "grazia"
        ? response?.status === 202 && response?.data?.richiesta?.status === "pending"
        : response?.status === 201 && response?.data?.status === "pending";
      if (!response?.data?.success || !recorded) {
        throw new Error("La proposta non è stata registrata.");
      }
      setSubmitted(category);
      setTitle("");
      setDetails("");
      setSourceUrl("");
      toast({
        title: "Proposta inviata",
        description: "La richiesta è in attesa della valutazione amministrativa.",
      });
    } catch (reason: any) {
      const status = reason?.status;
      const message = status === 409
        ? "Hai già una proposta in attesa per questa categoria oppure il soggetto è già stato proposto."
        : reason?.data?.message || reason?.data?.error || "Non è stato possibile registrare la proposta.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  // On-demand only: neither page mount nor category switching reads personal proposals.
  const checkMyStatus = async () => {
    if (checkingStatus || !authReady || !user) return;
    const requestVersion = ++statusRequestVersion.current;
    const requestedCategory = category;
    setCheckingStatus(true);
    setStatusError(null);
    setMyStatus(null);
    try {
      const response = requestedCategory === "grazia"
        ? await apiRequest("GET", "/api/grazia/mia-proposta")
        : await apiRequest("GET", "/api/subject-proposals/mine?category=" + encodeURIComponent(requestedCategory));
      if (statusRequestVersion.current !== requestVersion) return;
      if (!response?.data?.success) throw new Error("Impossibile verificare lo stato.");
      const latest = requestedCategory === "grazia" ? response.data.richiesta : response.data.latest;
      setMyStatus(latest?.status || "none");
    } catch (_) {
      if (statusRequestVersion.current === requestVersion)
        setStatusError("Stato temporaneamente non disponibile. Riprova.");
    } finally {
      if (statusRequestVersion.current === requestVersion)
        setCheckingStatus(false);
    }
  };

  const statusLabel: Record<string, string> = {
    none: "Nessuna proposta trovata per questa categoria.",
    pending: "La proposta è in attesa di valutazione.",
    approved: "La proposta è stata approvata.",
    rejected: "La proposta non è stata approvata.",
    withdrawn: "La pubblicazione della proposta è stata ritirata.",
  };

  if (!authReady || isAuthLoading) {
    return (
      <PageContainer className="items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin" aria-label="Caricamento" />
      </PageContainer>
    );
  }
  if (!user) return <Redirect to="/auth" />;

  return (
    <PageContainer className="overflow-hidden bg-gradient-to-b from-slate-50 to-blue-50/40">
      <header className="shrink-0 border-b bg-white/95 px-3 pb-3 pt-3 sm:px-5">
        <div className="mx-auto flex max-w-2xl items-start gap-3">
          <Button type="button" variant="ghost" size="icon"
            aria-label="Torna alla sezione" title="Torna alla sezione"
            onClick={() => navigate(returnPath)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Proponi</h1>
            <p className="mt-1 text-xs text-slate-600 sm:text-sm">
              Proponi persone, organizzazioni o norme. Le proposte saranno verificate prima della pubblicazione.
            </p>
          </div>
        </div>
      </header>

      <div className="app-page-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-8 pt-4 sm:px-5" role="region" aria-label="Modulo proposta" tabIndex={0}>
        <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="space-y-2">
            <label htmlFor="subject-category" className="text-sm font-semibold text-slate-800">Che cosa vuoi proporre?</label>
            <select
              id="subject-category"
              value={category}
              disabled={submitting}
              onChange={(event) => chooseCategory(event.target.value as ProposalCategory)}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {SUBJECT_PROPOSAL_CATEGORIES.map(item => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>

          <div className="mt-3 space-y-2">
            <Button type="button" variant="outline" onClick={checkMyStatus} disabled={checkingStatus}>
              {checkingStatus ? "Verifica in corso..." : "Verifica stato della mia proposta"}
            </Button>
            {myStatus && <p role="status" className="text-sm text-slate-700">{statusLabel[myStatus] || "Stato non riconosciuto. Contatta l'assistenza."}</p>}
            {statusError && <p role="alert" className="text-sm text-red-700">{statusError}</p>}
          </div>
          <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm leading-snug text-slate-700">
            {config.explanation}
          </p>

          {submitted === category ? (
            <div className="mt-5 space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4" role="status">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                <p className="text-sm font-medium text-emerald-900">
                  Proposta registrata. Prima di essere pubblicata dovrà essere approvata dall'amministratore.
                </p>
              </div>
              <p className="text-xs text-emerald-900">
                Puoi cambiare categoria dal menu per presentare un'altra proposta.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="subject-title" className="text-sm font-semibold text-slate-800">
                  {config.nameLabel}
                </label>
                <Input id="subject-title" required minLength={3} maxLength={150}
                  autoComplete="off" placeholder={config.placeholder}
                  value={title} onChange={e => setTitle(e.target.value)}
                  aria-describedby="subject-title-help" />
                <p id="subject-title-help" className="text-xs text-slate-500">Da 3 a 150 caratteri.</p>
              </div>

              {category !== "grazia" && (
                <div className="space-y-1.5">
                  <label htmlFor="subject-details" className="text-sm font-semibold text-slate-800">
                    Informazioni aggiuntive (facoltative)
                  </label>
                  <Textarea id="subject-details" maxLength={1000} rows={3}
                    placeholder="Scrivi solo informazioni pubbliche necessarie alla valutazione."
                    value={details} onChange={e => setDetails(e.target.value)} />
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="subject-source" className="text-sm font-semibold text-slate-800">
                  {config.sourceLabel}
                </label>
                <Input id="subject-source" required type="url" inputMode="url" maxLength={category === "grazia" ? 2000 : 2048}
                  autoComplete="off" placeholder="https://..."
                  value={sourceUrl} onChange={e => setSourceUrl(e.target.value)}
                  aria-describedby="subject-source-help" />
                <p id="subject-source-help" className="text-xs text-slate-500">
                  Inserisci solo una fonte pubblica accessibile tramite HTTPS. Non allegare documenti personali.
                </p>
              </div>

              <p className="text-xs leading-relaxed text-slate-600">
                L'invio non crea account e non rende automaticamente pubblico alcun nominativo.
                I dati saranno trattati secondo l'informativa privacy di DEMOS.
              </p>

              {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}

              <Button type="submit" className="min-h-11 w-full" disabled={!canSubmit}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {submitting ? "Invio in corso..." : "Invia per approvazione"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
