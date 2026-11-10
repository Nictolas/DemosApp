import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Redirect, useLocation } from "wouter";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { usePoliticalOpinionsConsent } from "@/hooks/usePoliticalOpinionsConsent";
import { useUnsavedOpinionsGuard } from "@/hooks/useUnsavedOpinionsGuard";
import { PoliticalOpinionsConsentModal } from "@/components/PoliticalOpinionsConsentModal";
import { ApprofondimentoButton } from "@/components/ApprofondimentoButton";
import { OpinionActionsBar } from "@/components/OpinionActionsBar";
import { loadOpinionCategory, cacheConfirmedOpinionAnswers, type OpinionGrade } from "@/lib/encryptedOpinionCache";
import { OPINION_TOPIC_BY_ID, OPINION_TOPIC_DEFINITIONS } from "@/lib/opinionTopics";
import { collectChangedOpinionAnswers } from "@/lib/opinionDelta";
import { rebaseTopicDrafts, type TopicDraftState } from "@/lib/opinionTopicDrafts";
import { saveAndVerifyOpinions } from "@/lib/saveAndVerifyOpinions";
import { getAuthToken } from "@/lib/auth-token";
import { captureOpinionSaveSession, matchesOpinionSaveSession, type VerifiedOpinionSaveUser } from "@/lib/opinionSaveSession";
import { vibrateShort } from "@/utils/vibration";
import type { CachedOpinionQuestion } from "@/lib/opinionPayload";

const grades: readonly { id: OpinionGrade; label: string }[] = [
  { id: "E", label: "Europeo" },
  { id: "N", label: "Nazionale" },
  { id: "R", label: "Regionale" },
  { id: "CO", label: "Comunale" },
];

const answerOptions = [
  { value: "f", label: "Favorevole", selected: "bg-green-600 text-white" },
  { value: "i", label: "Indeciso", selected: "bg-amber-500 text-white" },
  { value: "c", label: "Contrario", selected: "bg-red-600 text-white" },
] as const;

const normalize = (value: unknown): "f" | "c" | "i" | null =>
  value === "f" || value === "c" || value === "i" ? value : null;

const topicFor = (id: string) => OPINION_TOPIC_BY_ID[id];
const publishedCount = Object.keys(OPINION_TOPIC_BY_ID).length;

/** The selected list follows confirmed answers; a local draft never counts as saved. */
export default function OpinioniDaCompletare() {
  const { user, isLoading: authLoading, isSessionVerified, verifiedPoliticalConsent } = useAuth();
  const { hasConsent } = usePoliticalOpinionsConsent();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draftState, setDraftState] = useState<TopicDraftState | null>(null);
  const [showConsent, setShowConsent] = useState(false);
  const [viewState, setViewState] = useState<{ scope: string | null; topic: string }>({ scope: null, topic: "all" });

  const authorized = !!user && isSessionVerified && hasConsent;
  const draftScope = authorized && user?.id && verifiedPoliticalConsent?.timestamp
    ? JSON.stringify([user.id, verifiedPoliticalConsent.timestamp, "opinioni-da-completare"]) : null;
  const selectedTopic = draftScope && viewState.scope === draftScope ? viewState.topic : "all";

  // Identical query keys and encrypted per-grade cache as the existing editors:
  // no personal-data endpoint, new storage, or parallel answer table.
  const results = useQueries({
    queries: grades.map(({ id, label }) => ({
      queryKey: ["opinioniQuestions", user?.id, verifiedPoliticalConsent?.timestamp, label],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        loadOpinionCategory(user!.id, verifiedPoliticalConsent!.timestamp, id, signal),
      enabled: authorized,
      staleTime: 0,
      gcTime: Infinity,
      refetchOnMount: "always" as const,
      refetchOnWindowFocus: false,
    })),
  });
  const [pE, pN, pR, pCO] = results.map(result => result.data);
  const loading = authorized && results.some(result => result.isPending || result.isFetching);
  const loadError = authorized && results.some(result => result.isError);

  const questions = useMemo((): CachedOpinionQuestion[] => {
    if (!authorized || !pE || !pN || !pR || !pCO) return [];
    const unique = new Map<string, CachedOpinionQuestion>();
    for (const payload of [pE, pN, pR, pCO]) {
      for (const question of payload.data) {
        if (Object.prototype.hasOwnProperty.call(OPINION_TOPIC_BY_ID, question.id) && !unique.has(question.id)) {
          unique.set(question.id, question);
        }
      }
    }
    return [...unique.values()];
  }, [authorized, pE, pN, pR, pCO]);

  // A partial catalog must never be displayed as a misleading completion count.
  const catalogReady = questions.length === publishedCount;
  const unresolved = useMemo(() => {
    if (!catalogReady) return [];
    return questions
      .filter(question => {
        const saved = normalize(question.userAnswer);
        return saved === null || saved === "i";
      })
      .sort((a, b) => {
        const firstTopic = OPINION_TOPIC_DEFINITIONS.findIndex(topic => topic.id === topicFor(a.id));
        const secondTopic = OPINION_TOPIC_DEFINITIONS.findIndex(topic => topic.id === topicFor(b.id));
        return firstTopic - secondTopic || a.text.localeCompare(b.text, "it");
      });
  }, [questions, catalogReady]);

  const missingCount = unresolved.filter(question => normalize(question.userAnswer) === null).length;
  const undecidedCount = unresolved.length - missingCount;
  const visible = selectedTopic === "all"
    ? unresolved
    : unresolved.filter(question => topicFor(question.id) === selectedTopic);
  const topicOptions = OPINION_TOPIC_DEFINITIONS.filter(topic =>
    unresolved.some(question => topicFor(question.id) === topic.id));

  // Scope drafts and UI filter to an owner AND server-verified consent epoch.
  // Rebase after confirmed saves; never keep earlier account drafts.
  const drafts = useMemo(() => {
    if (!draftScope) return {} as Readonly<Record<string, string>>;
    return draftState?.scope === draftScope
      ? draftState.drafts
      : rebaseTopicDrafts(null, draftScope, questions).drafts;
  }, [draftScope, draftState, questions]);

  useEffect(() => {
    setViewState({ scope: draftScope, topic: "all" });
  }, [draftScope]);

  useEffect(() => {
    if (!draftScope || loading || loadError || !catalogReady) return;
    setDraftState(previous => rebaseTopicDrafts(previous, draftScope, questions));
  }, [draftScope, loading, loadError, catalogReady, questions]);

  const selectDraft = (id: string, answer: "f" | "c" | "i") => {
    if (!draftScope || loading || loadError || !catalogReady) return;
    setDraftState(previous => {
      const base = previous?.scope === draftScope
        ? previous
        : rebaseTopicDrafts(null, draftScope, questions);
      return { ...base, drafts: { ...base.drafts, [id]: answer } };
    });
  };

  const dirty = authorized && catalogReady && questions.some(question =>
    normalize(drafts[question.id]) !== normalize(question.userAnswer));
  const saveRef = useRef<() => void>(() => {});
  const exitGuard = useUnsavedOpinionsGuard(dirty, navigate, () => saveRef.current(), {
    backPath: "/profilo",
    stayAfterSave: true,
  });

  const saveMutation = useMutation({
    mutationFn: async (changes: Record<string, string>) => {
      const token = getAuthToken();
      const session = captureOpinionSaveSession(
        isSessionVerified ? user?.id : null, verifiedPoliticalConsent?.timestamp, token,
        token ? queryClient.getQueryData<VerifiedOpinionSaveUser>(["user", token]) : null,
      );
      if (!session) throw new Error("Sessione o consenso non verificati.");
      await saveAndVerifyOpinions("N", changes); // Existing POST accepts IDs from all grades.
      return session;
    },
    onSuccess: async (session, changes) => {
      const current = () => matchesOpinionSaveSession(
        session, getAuthToken(),
        queryClient.getQueryData<VerifiedOpinionSaveUser>(["user", session.token]),
      );
      if (!current()) return;
      await cacheConfirmedOpinionAnswers(session.ownerId, session.consentEpoch, changes);
      if (!current()) return;
      await queryClient.cancelQueries({
        queryKey: ["opinioniQuestions", session.ownerId, session.consentEpoch],
      });
      if (!current()) return;
      queryClient.setQueriesData(
        { queryKey: ["opinioniQuestions", session.ownerId, session.consentEpoch] },
        (previous: any) => previous && Array.isArray(previous.data)
          ? { ...previous, data: previous.data.map((question: CachedOpinionQuestion) =>
              Object.prototype.hasOwnProperty.call(changes, question.id)
                ? { ...question, userAnswer: changes[question.id] } : question) }
          : previous,
      );
      queryClient.invalidateQueries({ queryKey: ["candidatiData"] });
      toast({ title: "Opinioni salvate", description: "Le risposte definitive sono state rimosse dall'elenco." });
      const destination = exitGuard.onSaveSuccess();
      if (destination) navigate(destination); // Only when the user chose "Salva ed esci".
    },
    onError: () => {
      exitGuard.onSaveError();
      toast({
        title: "Errore",
        description: "Salvataggio non confermato. Le risposte selezionate non sono state perse.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!authorized || loading || loadError || !catalogReady || saveMutation.isPending) return;
    const changes = collectChangedOpinionAnswers(questions, drafts);
    if (!Object.keys(changes).length) return;
    saveMutation.mutate(changes);
  };
  saveRef.current = handleSave;

  if (authLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!user) return <Redirect to="/auth" />;

  return (
    <div className="opinioni-editor-page flex h-full min-h-0 flex-col bg-gradient-to-b from-amber-50 to-white" data-testid="opinioni-da-completare">
      <header className="shrink-0 border-b border-amber-100 bg-white px-3 py-3 sm:px-4">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <button type="button" onClick={exitGuard.onBack} aria-label="Torna al Profilo"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-slate-900 sm:text-xl">Opinioni da completare</h1>
            <p className="text-sm text-slate-600">
              {authorized && !loading && !loadError && catalogReady
                ? `${unresolved.length} ancora da completare · ${missingCount} senza risposta · ${undecidedCount} indecise`
                : "Le tue opinioni personali"}
            </p>
          </div>
        </div>
        {authorized && !loading && !loadError && catalogReady && topicOptions.length > 1 && (
          <div className="mx-auto mt-3 max-w-4xl">
            <label htmlFor="filtro-opinioni-da-completare" className="mb-1 block text-xs font-semibold text-slate-600">Filtra per argomento</label>
            <select id="filtro-opinioni-da-completare" value={selectedTopic}
              onChange={event => setViewState({ scope: draftScope, topic: event.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600">
              <option value="all">Tutti gli argomenti ({unresolved.length})</option>
              {topicOptions.map(topic => (
                <option key={topic.id} value={topic.id}>
                  {topic.title} ({unresolved.filter(question => topicFor(question.id) === topic.id).length})
                </option>
              ))}
            </select>
          </div>
        )}
      </header>

      <main className="app-page-scroll min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4" aria-label="Elenco delle opinioni da completare">
        {!isSessionVerified ? (
          <p role="status" className="py-8 text-center text-sm text-slate-700">Verifica della sessione in corso.</p>
        ) : !hasConsent ? (
          <div className="mx-auto max-w-md space-y-4 py-8 text-center">
            <p>Per visualizzare le opinioni personali serve il consenso esplicito al trattamento dei dati politici.</p>
            <button type="button" onClick={() => setShowConsent(true)}
              className="rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white">
              Leggi e scegli se dare il consenso
            </button>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-7 w-7 animate-spin" /></div>
        ) : loadError || !catalogReady ? (
          <div role="alert" className="mx-auto max-w-md rounded-xl border border-red-200 bg-white p-4 text-sm text-red-800">
            Non è stato possibile caricare l'elenco completo delle Opinioni. Riprova più tardi.
          </div>
        ) : unresolved.length === 0 ? (
          <div role="status" className="mx-auto max-w-md space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-700" aria-hidden="true" />
            <h2 className="font-semibold text-slate-900">Hai completato tutte le Opinioni!</h2>
            <Link href="/profilo" className="inline-block text-sm font-semibold text-blue-700 underline">Torna al Profilo</Link>
          </div>
        ) : visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-600">Nessuna Opinione da completare per questo argomento.</p>
        ) : visible.map((question, index) => {
          const currentTopic = topicFor(question.id);
          const showHeading = index === 0 || topicFor(visible[index - 1].id) !== currentTopic;
          const label = OPINION_TOPIC_DEFINITIONS.find(topic => topic.id === currentTopic)?.title;
          const saved = normalize(question.userAnswer);
          return (
            <div key={question.id} className="mx-auto max-w-4xl">
              {showHeading && <h2 className="mb-2 mt-3 text-sm font-bold text-slate-700">{label}</h2>}
              <section className="space-y-3 rounded-xl border border-amber-200 bg-white p-4 shadow-sm" data-opinion-id={question.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold leading-snug text-slate-900">{question.text}</h3>
                    <p className="mt-1 text-xs text-slate-600">{saved === "i" ? "Indeciso" : "Senza risposta"}</p>
                  </div>
                  <ApprofondimentoButton opinionId={question.id} opinionText={question.text} />
                </div>
                <div role="group" aria-label={`La tua risposta: ${question.text}`} className="flex w-full">
                  {answerOptions.map((option, optionIndex) => (
                    <button key={option.value} type="button" aria-pressed={normalize(drafts[question.id]) === option.value}
                      onClick={() => { vibrateShort(); selectDraft(question.id, option.value); }}
                      disabled={saveMutation.isPending}
                      className={`min-w-0 flex-1 border border-slate-200 px-1 py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600 sm:text-base ${optionIndex === 0 ? "rounded-l-full" : optionIndex === 2 ? "rounded-r-full" : ""} ${normalize(drafts[question.id]) === option.value ? option.selected : "bg-white text-slate-700"}`}>
                      {option.label}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          );
        })}
      </main>

      <OpinionActionsBar onSave={handleSave} onBack={exitGuard.onBack}
        isSaving={saveMutation.isPending}
        saveDisabled={!authorized || loading || !!loadError || !catalogReady || !dirty} />
      {exitGuard.dialog}
      <PoliticalOpinionsConsentModal open={showConsent} onOpenChange={setShowConsent}
        onConsentGranted={() => { /* /auth/me re-verifies the consent epoch. */ }} />
    </div>
  );
}
