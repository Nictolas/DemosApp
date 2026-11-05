import React, { useEffect, useMemo, useRef, useState } from "react";
import { Redirect, useLocation, useParams } from "wouter";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { usePoliticalOpinionsConsent } from "@/hooks/usePoliticalOpinionsConsent";
import { useUnsavedOpinionsGuard } from "@/hooks/useUnsavedOpinionsGuard";
import { PoliticalOpinionsConsentModal } from "@/components/PoliticalOpinionsConsentModal";
import { ApprofondimentoButton } from "@/components/ApprofondimentoButton";
import { OpinionStatsBar } from "@/components/OpinionStatsBar";
import { OpinionActionsBar } from "@/components/OpinionActionsBar";
import { loadOpinionCategory, cacheConfirmedOpinionAnswers, type OpinionGrade } from "@/lib/encryptedOpinionCache";
import { OPINION_TOPIC_BY_ID, OPINION_TOPIC_DEFINITIONS } from "@/lib/opinionTopics";
import { OPINION_PROVINCIAL_IDS } from "@/lib/opinionProvincialIds";
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
type TopicGrade = OpinionGrade | "C" | "all";
// "C" is an additional thematic filter over the six published provincial IDs.
// Do NOT add "C" to grades: it is not a separate API query or geographic page.
const topicGradeFilters: readonly { id: TopicGrade; label: string }[] = [
  { id: "all", label: "Tutti" },
  { ...grades[0] },
  { ...grades[1] },
  { ...grades[2] },
  { id: "C", label: "Provinciale" },
  { ...grades[3] },
];
const answerOptions = [
  { value: "f", label: "Favorevole", selected: "bg-green-600 text-white" },
  { value: "i", label: "Indeciso", selected: "bg-yellow-500 text-white" },
  { value: "c", label: "Contrario", selected: "bg-red-600 text-white" },
] as const;
const normalize = (value: unknown) => value === "f" || value === "c" || value === "i" ? value : null;

export default function OpinioniArgomento() {
  const { topicId } = useParams<{ topicId: string }>();
  const topic = OPINION_TOPIC_DEFINITIONS.find((item) => item.id === topicId);
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading, isSessionVerified, verifiedPoliticalConsent } = useAuth();
  const { hasConsent } = usePoliticalOpinionsConsent();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draftState, setDraftState] = useState<TopicDraftState | null>(null);
  const [showConsent, setShowConsent] = useState(false);
  const [viewState, setViewState] = useState<{
    scope: string | null;
    grade: TopicGrade;
    search: string;
  }>({ scope: null, grade: "all", search: "" });
  const authorized = !!user && isSessionVerified && hasConsent;
  // Search and geographic filter are also personal, in-memory UI context.
  // Never display an old owner's search/filter during an auth or consent change.
  const draftScope = authorized && user?.id && verifiedPoliticalConsent?.timestamp && topic
    ? JSON.stringify([user.id, verifiedPoliticalConsent.timestamp, topic.id]) : null;
  const levelFilter: TopicGrade = draftScope && viewState.scope === draftScope
    ? viewState.grade : "all";
  const searchTerm = draftScope && viewState.scope === draftScope
    ? viewState.search : "";
  const setLevelFilter = (grade: TopicGrade) => {
    if (draftScope) setViewState({ scope: draftScope, grade, search: searchTerm });
  };
  const setSearchTerm = (search: string) => {
    if (draftScope) setViewState({ scope: draftScope, grade: levelFilter, search });
  };

  // Reuse the same query keys, encrypted per-grade vault and verified consent as
  // existing geographical editors. No new endpoint or dedicated topic storage.
  const results = useQueries({
    queries: grades.map(({ id, label }) => ({
      queryKey: ["opinioniQuestions", user?.id, verifiedPoliticalConsent?.timestamp, label],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        loadOpinionCategory(user!.id, verifiedPoliticalConsent!.timestamp, id, signal),
      enabled: authorized && !!topic,
      staleTime: 0,
      gcTime: Infinity,
      refetchOnMount: "always" as const,
      refetchOnWindowFocus: false,
    })),
  });

  const [pE, pN, pR, pCO] = results.map((result) => result.data);
  const loading = authorized && results.some((result) => result.isPending || result.isFetching);
  const error = authorized && results.some((result) => result.isError);
  const questions = useMemo((): CachedOpinionQuestion[] => {
    if (!authorized || !topic || !pE || !pN || !pR || !pCO) return [];
    const unique = new Map<string, CachedOpinionQuestion>();
    for (const payload of [pE, pN, pR, pCO]) {
      for (const question of payload.data) {
        if (OPINION_TOPIC_BY_ID[question.id] === topic.id && !unique.has(question.id)) {
          unique.set(question.id, question);
        }
      }
    }
    return [...unique.values()].sort((a, b) =>
      (normalize(a.userAnswer) === null ? 0 : 1) - (normalize(b.userAnswer) === null ? 0 : 1) ||
      a.text.localeCompare(b.text, "it"));
  }, [authorized, topicId, pE, pN, pR, pCO]);

  // Grade is a SECOND independent dimension. Derive membership from the
  // already loaded geographical lists; never infer province C from municipality CO.
  const gradeMembership = useMemo(() => {
    const membership = new Map<string, Set<OpinionGrade>>();
    if (!authorized || !topic) return membership;
    const loaded = [
      ["E", pE], ["N", pN], ["R", pR], ["CO", pCO],
    ] as const;
    for (const [grade, payload] of loaded) {
      for (const question of payload?.data ?? []) {
        if (OPINION_TOPIC_BY_ID[question.id] !== topic.id) continue;
        const found = membership.get(question.id) ?? new Set<OpinionGrade>();
        found.add(grade);
        membership.set(question.id, found);
      }
    }
    return membership;
  }, [authorized, topicId, pE, pN, pR, pCO]);
  const visibleQuestions = useMemo(() => questions.filter((question) =>
    levelFilter === "all" ||
    (levelFilter === "C" ? OPINION_PROVINCIAL_IDS.has(question.id) : gradeMembership.get(question.id)?.has(levelFilter))
  ), [questions, levelFilter, gradeMembership]);
  // Entirely local search: no query, analytics event or storage write.
  const matchedQuestions = useMemo(() => {
    const search = searchTerm.trim().toLocaleLowerCase("it");
    return search
      ? visibleQuestions.filter(question => question.text.toLocaleLowerCase("it").includes(search))
      : visibleQuestions;
  }, [visibleQuestions, searchTerm]);
  useEffect(() => {
    // Effect also clears the old value in memory; the synchronous scope mask
    // above prevents a one-frame leak before this effect executes.
    setViewState({ scope: draftScope, grade: "all", search: "" });
  }, [draftScope]);

  // Scope local draft state to the authenticated owner, the server-verified
  // consent epoch and the current topic. This also masks prior-session RAM
  // synchronously, before an effect can execute after an account switch.
  const drafts = useMemo(() => {
    if (!draftScope) return {} as Record<string, string>;
    return draftState?.scope === draftScope
      ? draftState.drafts
      : rebaseTopicDrafts(null, draftScope, questions).drafts;
  }, [draftScope, draftState, questions]);

  useEffect(() => {
    if (!draftScope || loading || error || questions.length === 0) return;
    setDraftState((previous) => rebaseTopicDrafts(previous, draftScope, questions));
  }, [draftScope, loading, error, questions]);

  const selectDraft = (questionId: string, answer: "f" | "c" | "i") => {
    if (!draftScope || loading || error) return;
    setDraftState(previous => {
      const base = previous?.scope === draftScope
        ? previous
        : rebaseTopicDrafts(null, draftScope, questions);
      return { ...base, drafts: { ...base.drafts, [questionId]: answer } };
    });
  };

  // Navigation follows the current draft selections; completion and save
  // still use only the verified server answers, never these unsaved choices.
  const firstPending = matchedQuestions.find(question =>
    normalize(drafts[question.id]) === null
  );
  const continueFromFirstUnanswered = () => {
    if (!firstPending) return;
    const section = document.getElementById(`topic-question-${firstPending.id}`);
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
    section?.focus({ preventScroll: true });
  };

  const dirty = authorized && questions.some((question) =>
    normalize(drafts[question.id]) !== normalize(question.userAnswer));
  const saveRef = useRef<() => void>(() => {});
  const exitGuard = useUnsavedOpinionsGuard(dirty, navigate, () => saveRef.current());

  const saveMutation = useMutation({
    mutationFn: async (changes: Record<string, string>) => {
      const token = getAuthToken();
      const session = captureOpinionSaveSession(
        isSessionVerified ? user?.id : null, verifiedPoliticalConsent?.timestamp, token,
        token ? queryClient.getQueryData<VerifiedOpinionSaveUser>(["user", token]) : null,
      );
      if (!session) throw new Error("Sessione o consenso non verificati.");
      await saveAndVerifyOpinions("N", changes); // The existing POST accepts IDs from all grades.
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
      toast({ title: "Successo", description: "Le tue opinioni sono state salvate." });
      navigate(exitGuard.onSaveSuccess());
    },
    onError: () => {
      exitGuard.onSaveError();
      toast({ title: "Errore", description: "Salvataggio non confermato. Le modifiche sono ancora da salvare.", variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!authorized || loading || error || !topic) return;
    const changes = collectChangedOpinionAnswers(questions, drafts);
    if (!Object.keys(changes).length) {
      toast({ title: "Nessuna nuova modifica da salvare." });
      return;
    }
    saveMutation.mutate(changes);
  };
  saveRef.current = handleSave;

  const completed = questions.filter((question) => normalize(question.userAnswer)).length;

  if (authLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!user) return <Redirect to="/auth" />;
  if (!topic) return <Redirect to="/opinioni" />;

  return (
    <div className="opinioni-editor-page flex h-full min-h-0 flex-col bg-gradient-to-b from-sky-50 to-white">
      <header className="shrink-0 px-4 py-3 text-center">
        <h1 className="text-xl font-bold sm:text-2xl">{topic.title}</h1>
        <p className="text-sm text-slate-600">{topic.description}</p>
        {authorized && !loading && !error && questions.length > 0 && (
          <div className="mx-auto mt-2 max-w-xl" aria-label={`Completamento: ${completed} su ${questions.length}`}>
            <div className="mb-1 text-xs">{completed} / {questions.length} Opinioni salvate</div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full bg-blue-600" style={{ width: `${completed / questions.length * 100}%` }} />
            </div>
          </div>
        )}
        <div className="mx-auto mt-3 flex max-w-3xl gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtra per territorio">
          {topicGradeFilters.map((grade) => (
            <button key={grade.id} type="button" aria-pressed={levelFilter === grade.id}
              onClick={() => setLevelFilter(grade.id)}
              className={`shrink-0 rounded-full border px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${levelFilter === grade.id ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-700"}`}>
              {grade.label}
            </button>
          ))}
        </div>
        <div className="mx-auto mt-2 flex max-w-3xl gap-2">
          <input type="search" value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            placeholder="Cerca un'Opinione"
            aria-label="Cerca fra le Opinioni dell'argomento"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600" />
          <button type="button" onClick={continueFromFirstUnanswered}
            disabled={!authorized || loading || !!error || !firstPending}
            className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
            Continua
          </button>
        </div>
      </header>
      <main className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-3 pb-5 sm:px-4">
        {!isSessionVerified ? (
          <p className="py-8 text-center">Verifica della sessione in corso.</p>
        ) : !hasConsent ? (
          <div className="mx-auto max-w-md space-y-4 py-8 text-center">
            <p>Per esprimere opinioni politiche è necessario il consenso esplicito al trattamento di questi dati.</p>
            <button type="button" className="rounded-lg bg-primary px-4 py-2 text-white"
              onClick={() => setShowConsent(true)}>Leggi e scegli se dare il consenso</button>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-7 w-7 animate-spin" /></div>
        ) : error ? (
          <p role="alert" className="py-8 text-center">Non è stato possibile caricare le Opinioni. Riprova più tardi.</p>
        ) : questions.length === 0 ? (
          <p className="py-8 text-center">Nessuna Opinione per questo argomento.</p>
        ) : visibleQuestions.length === 0 ? (
          <p className="py-8 text-center">Nessuna Opinione di questo argomento al livello selezionato.</p>
        ) : matchedQuestions.length === 0 ? (
          <p className="py-8 text-center">Nessuna Opinione corrisponde alla ricerca.</p>
        ) : matchedQuestions.map((question) => {
          const alreadySaved = normalize(question.userAnswer) !== null;
          return (
            <section key={question.id} id={`topic-question-${question.id}`} tabIndex={-1}
              className={`mx-auto max-w-4xl space-y-3 rounded-xl border p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${alreadySaved ? "border-green-200 bg-green-50" : "border-blue-200 bg-blue-50"}`}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="min-w-0 font-semibold">{question.text}</h2>
                <ApprofondimentoButton opinionId={question.id} opinionText={question.text} />
              </div>
              <div role="group" aria-label={`La tua risposta: ${question.text}`} className="flex w-full">
                {answerOptions.map((option, index) => (
                  <button key={option.value} type="button" aria-pressed={normalize(drafts[question.id]) === option.value}
                    onClick={() => { vibrateShort(); selectDraft(question.id, option.value); }}
                    disabled={saveMutation.isPending}
                    className={`min-w-0 flex-1 border border-slate-200 px-1 py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 sm:text-base ${index === 0 ? "rounded-l-full" : index === 2 ? "rounded-r-full" : ""} ${normalize(drafts[question.id]) === option.value ? option.selected : "bg-white text-slate-700"}`}>
                    {option.label}
                  </button>
                ))}
              </div>
              <OpinionStatsBar opinionId={question.id} show={normalize(drafts[question.id]) !== null} />
            </section>
          );
        })}
      </main>
      <OpinionActionsBar onSave={handleSave} onBack={exitGuard.onBack}
        isSaving={saveMutation.isPending}
        saveDisabled={!authorized || loading || !!error || questions.length === 0 || !dirty} />
      {exitGuard.dialog}
      <PoliticalOpinionsConsentModal open={showConsent} onOpenChange={setShowConsent}
        onConsentGranted={() => { /* Revalidate /auth/me; do not automatically save. */ }} />
    </div>
  );
}
