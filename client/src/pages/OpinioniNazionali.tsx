import { saveAndVerifyOpinions } from "@/lib/saveAndVerifyOpinions";
import { getAuthToken } from "@/lib/auth-token";
import {
  captureOpinionSaveSession, matchesOpinionSaveSession,
  type VerifiedOpinionSaveUser,
} from "@/lib/opinionSaveSession";
import { collectChangedOpinionAnswers } from "@/lib/opinionDelta";
import { loadOpinionCategory, cacheConfirmedOpinionAnswers } from "@/lib/encryptedOpinionCache";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ApprofondimentoButton } from "@/components/ApprofondimentoButton";
import { usePoliticalOpinionsConsent } from "@/hooks/usePoliticalOpinionsConsent";
import { vibrateShort } from "@/utils/vibration";
import { PoliticalOpinionsConsentModal } from "@/components/PoliticalOpinionsConsentModal";
import { OpinionStatsBar } from "@/components/OpinionStatsBar";
import { useUnsavedOpinionsGuard } from "@/hooks/useUnsavedOpinionsGuard";
import { OpinionActionsBar } from "@/components/OpinionActionsBar";

interface Question {
  id: string;
  text: string;
  grado: string[];
  userAnswer: string | null;
}

interface UserOpinionsData {
  questions: Question[];
  userAnswers: Record<string, string>;
  blocco: {
    isBlocked: boolean;
    unlockDate?: string;
  };
}

const options = [
  { value: "f", color: "bg-green-600 text-white", label: "Favorevole" },
  { value: "i", color: "bg-yellow-500 text-white", label: "Indeciso" },
  { value: "c", color: "bg-red-600 text-white", label: "Contrario" }
];

// Funzione per normalizzare le risposte (usa direttamente i valori compressi)
const normalizeAnswer = (answer: string | undefined) => {
  if (!answer || answer === null || answer === undefined) return null;
  // Usa direttamente i valori compressi
  if (answer === 'f' || answer === 'c' || answer === 'i') return answer;
  return null;
};



export default function OpinioniNazionali() {
  // Controllo consenso opinioni politiche (GDPR Art. 9)
  const { hasConsent } = usePoliticalOpinionsConsent();
  const { user, isLoading: isAuthLoading, isSessionVerified, verifiedPoliticalConsent } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [opinions, setOpinions] = useState<Record<string, string>>({});
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [pendingOpinionsToSave, setPendingOpinionsToSave] = useState<{
    ownerId: string;
    answers: Record<string, string>;
  } | null>(null);
  const [grantConfirmed, setGrantConfirmed] = useState(false);

  // 1. Caricamento domande con React Query
  const { data: questionsData, isLoading: isLoadingQuestions, isFetching: isRefreshingQuestions } = useQuery<{success: boolean, data: Question[], grado: string, total: number}>({
    queryKey: ['opinioniQuestions', user?.id, verifiedPoliticalConsent?.timestamp, 'Nazionale'],
    queryFn: ({ signal }) => loadOpinionCategory(user!.id, verifiedPoliticalConsent!.timestamp, "N", signal) as any,
    enabled: !!user && isSessionVerified && hasConsent,
    // Re-run the cheap catalog check on each visit. Valid encrypted answers
    // still avoid database reads; a changed release never stays permanently stale.
    staleTime: 0,
    gcTime: Infinity,
    refetchOnMount: "always",
    refetchOnWindowFocus: false
  });

  // Combina i dati
  const isLoading = isLoadingQuestions || isRefreshingQuestions;
  // A disabled query can still hold data in RAM: never render it after revocation.
  const canReadOpinions = !!user && isSessionVerified && hasConsent;
  const questions = canReadOpinions && questionsData?.data && Array.isArray(questionsData.data)
    ? questionsData.data : [];
  const userAnswers = questionsData?.userAnswers || {};
  
  // Debug
  useEffect(() => {
  }, [questionsData, questions]);

  // Dividi le opinioni in due sezioni (usando la funzione di normalizzazione)
    const opinioniEspresse = questions
      .filter(q => {
        const normalizedAnswer = normalizeAnswer(q.userAnswer);
        return normalizedAnswer && ['f', 'c', 'i'].includes(normalizedAnswer);
      })
      .sort((a, b) => a.text.localeCompare(b.text));
  
  const opinioniDaInserire = questions
    .filter(q => {
      const normalizedAnswer = normalizeAnswer(q.userAnswer);
      return !normalizedAnswer || !['f', 'c', 'i'].includes(normalizedAnswer);
    })
    .sort((a, b) => a.text.localeCompare(b.text));

  // Debug per vedere le sezioni
  useEffect(() => {
  }, [opinioniEspresse, opinioniDaInserire]);

  // Sincronizza le opinioni quando le domande vengono caricate
  useEffect(() => {
    if (questions && questions.length > 0) {
      // Mappa le risposte dell'utente usando userAnswer da ogni opinione
      const mappedOpinions: Record<string, string> = {};
      questions.forEach(question => {
        if (question.userAnswer && question.userAnswer !== null) {
          mappedOpinions[question.id] = question.userAnswer;
        } else {
          // Non impostare nulla per opinioni senza risposta - rimangono undefined
        }
      });
      setOpinions(mappedOpinions);
    }
  }, [questions]);

  // Avvisa soltanto in presenza di risposte nuove o modificate.
  const isDirty = questions.some((question) =>
    normalizeAnswer(opinions[question.id]) !== normalizeAnswer(question.userAnswer ?? undefined)
  );
  const saveHandlerRef = React.useRef<() => void>(() => {});
  const exitGuard = useUnsavedOpinionsGuard(isDirty, setLocation, () => saveHandlerRef.current());

  // 2. Mutazione per salvare le opinioni
  const saveMutation = useMutation({
    mutationFn: async (newOpinions: Record<string, string>) => {
      const token = getAuthToken();
      const savedSession = captureOpinionSaveSession(
        isSessionVerified ? user?.id : null,
        verifiedPoliticalConsent?.timestamp, token,
        token ? queryClient.getQueryData<VerifiedOpinionSaveUser>(['user', token]) : null,
      );
      if (!savedSession) {
        throw new Error("Sessione o consenso non verificati: impossibile salvare.");
      }
      await saveAndVerifyOpinions("N", newOpinions);
      return savedSession;
    },
    onSuccess: async (savedSession, savedOpinions) => {
      // A successful server ACK belongs only to the session that sent it.
      // Fail closed on account switches or revocations, without another GET.
      const stillCurrent = () => matchesOpinionSaveSession(
        savedSession, getAuthToken(),
        queryClient.getQueryData<VerifiedOpinionSaveUser>(['user', savedSession.token]),
      );
      if (!stillCurrent()) return;
      // ACK commit has completed: persist all shared encrypted grade caches.
      await cacheConfirmedOpinionAnswers(savedSession.ownerId, savedSession.consentEpoch, savedOpinions);
      if (!stillCurrent()) return;
      // An older in-flight GET must not restore the pre-save snapshot.
      await queryClient.cancelQueries({
        queryKey: ['opinioniQuestions', savedSession.ownerId, savedSession.consentEpoch, 'Nazionale'],
      });
      if (!stillCurrent()) return;
      toast({ title: "Successo", description: "Le tue opinioni nazionali sono state salvate." });
      queryClient.setQueryData(
        ['opinioniQuestions', savedSession.ownerId, savedSession.consentEpoch, 'Nazionale'],
        (previous: any) => previous && Array.isArray(previous.data) ? ({
          ...previous,
          data: previous.data.map((question: any) =>
            Object.prototype.hasOwnProperty.call(savedOpinions, question.id)
              ? { ...question, userAnswer: savedOpinions[question.id] }
              : question),
        }) : previous,
      );
      // Invalida anche la cache della pagina candidati per aggiornare le opinioni comuni
      queryClient.invalidateQueries({ queryKey: ['candidatiData'] });
      const nextPage = exitGuard.onSaveSuccess();
      setTimeout(() => { if (stillCurrent()) setLocation(nextPage); }, 1500);
    },
    onError: (error: any) => {
      exitGuard.onSaveError();
      toast({ title: "Errore", description: error.message || "Impossibile salvare le opinioni.", variant: "destructive" });
    }
  });

  const handleOpinionChange = (questionId: string, value: string) => {
    // Vibrazione quando si cambia opinione
    vibrateShort();
    setOpinions(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSave = () => {
    
    // Only changed IDs: never overwrite positions from another device.
    const opinionsToSave = collectChangedOpinionAnswers(questions, opinions);

    if (Object.keys(opinionsToSave).length === 0) {
      toast({ title: "Attenzione", description: "Non ci sono nuove opinioni da salvare.", variant: "destructive" });
      return;
    }
    
    // Verifica consenso opinioni politiche (GDPR Art. 9)
    if (!hasConsent) {
      // Salva le opinioni da salvare in uno stato temporaneo
      setPendingOpinionsToSave({ ownerId: user!.id, answers: opinionsToSave });
      setGrantConfirmed(false);
      // Apri il dialog del consenso
      setShowConsentDialog(true);
      return;
    }
    
    saveMutation.mutate(opinionsToSave);
  };

  saveHandlerRef.current = handleSave;

  // A consent grant does not authorize an automatic save until /auth/me
  // confirms the new epoch, the vault wipe is complete, and the new
  // category snapshot is loaded. No arbitrary timeouts or consent GETs.
  const handleConsentGranted = () => {
    // Opening the consent form without draft answers does not request an auto-save.
    if (pendingOpinionsToSave) setGrantConfirmed(true);
  };

  useEffect(() => {
    if (!grantConfirmed || !pendingOpinionsToSave) return;
    if (pendingOpinionsToSave.ownerId !== user?.id ||
        (isSessionVerified && verifiedPoliticalConsent?.granted !== true)) {
      setGrantConfirmed(false);
      setPendingOpinionsToSave(null);
      return;
    }
    if (!isSessionVerified || !hasConsent || !canReadOpinions ||
        isLoading || questions.length === 0 || saveMutation.isPending) return;
    const toSave = collectChangedOpinionAnswers(
      questions,
      { ...opinions, ...pendingOpinionsToSave.answers },
    );
    setGrantConfirmed(false);
    setPendingOpinionsToSave(null);
    if (Object.keys(toSave).length > 0) {
      // Keep the just-consented draft visible even if the first POST fails.
      // This updates React RAM only; the server still receives delta-only data.
      setOpinions((previous) => ({ ...previous, ...toSave }));
      saveMutation.mutate(toSave);
    }
  }, [
    grantConfirmed, pendingOpinionsToSave, user?.id, isSessionVerified,
    verifiedPoliticalConsent?.granted, hasConsent, canReadOpinions,
    isLoading, questions, opinions, saveMutation.isPending,
  ]);

  if (isAuthLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!user) return <Redirect to="/auth" />;
  
  // Per ora non abbiamo il sistema di blocco, quindi sempre false
  const blocco = { isBlocked: false, unlockDate: null };
  const unlockDate = null;

  return (
    <div className="opinioni-editor-page flex h-full min-h-0 flex-col bg-gradient-to-b from-green-50 to-white">
      <div className="min-h-0 flex-1 px-3 pb-2 pt-3 sm:px-4 sm:pt-6">
        <Card className="mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col">
          <CardHeader className="opinioni-editor-page__header shrink-0 text-center">
            <CardTitle className="text-3xl font-bold">Opinioni Nazionali</CardTitle>
            <CardDescription>Esprimi la tua opinione su temi di rilevanza nazionale per trovare rappresentanti con idee simili alle tue.</CardDescription>
          </CardHeader>
          <CardContent className="opinioni-editor-page__list min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain pb-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="ml-2">Caricamento...</span></div>
            ) : isSessionVerified && !hasConsent ? (
              <div className="mx-auto max-w-md space-y-4 px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Per esprimere opinioni politiche puoi scegliere se prestare il consenso
                  esplicito al trattamento di questi dati. Il consenso è facoltativo.
                </p>
                <button
                  type="button"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  onClick={() => setShowConsentDialog(true)}
                >
                  Leggi e scegli se dare il consenso
                </button>
              </div>
            ) : questions.length === 0 ? (
              <div className="text-center py-8"><p className="text-muted-foreground">Nessuna domanda disponibile.</p></div>
            ) : (
              <>
                {/* Opinioni da Inserire */}
                {opinioniDaInserire.length > 0 && (
                  <div className="space-y-6">
                    <h2 className="text-xl font-bold text-blue-700 border-b-2 border-blue-200 pb-2">
                      📝 Opinion da Inserire ({opinioniDaInserire.length})
                    </h2>
                    {opinioniDaInserire.map((question) => (
                      <div key={question.id} className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-center gap-3">
                          <h3 className="text-lg font-semibold">{question.text}</h3>
                          <ApprofondimentoButton 
                            opinionId={question.id} 
                            opinionText={question.text}
                          />
                        </div>
                        <div className="flex justify-center">
                          <div className="flex w-full max-w-md">
                            {options.map((option, idx) => (
                              <button
                                key={option.value} type="button"
                                className={`flex-1 py-3 text-base font-medium transition-transform duration-150 focus:outline-none border border-gray-200 ${idx === 0 ? 'rounded-l-full' : ''} ${idx === options.length - 1 ? 'rounded-r-full' : ''} ${normalizeAnswer(opinions[question.id]) === option.value ? option.color + ' scale-95 z-10' : 'bg-white hover:bg-gray-10 z-0'}`}
                                onClick={() => handleOpinionChange(question.id, option.value)}
                                disabled={blocco?.isBlocked}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <OpinionStatsBar
                          opinionId={question.id}
                          show={normalizeAnswer(opinions[question.id]) !== null}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Opinioni Espresse */}
                {opinioniEspresse.length > 0 && (
                  <div className="space-y-6">
                    <h2 className="text-xl font-bold text-green-700 border-b-2 border-green-200 pb-2">
                      ✅ Opinioni Espresse ({opinioniEspresse.length})
                    </h2>
                    {opinioniEspresse.map((question) => (
                      <div key={question.id} className="space-y-4 p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center justify-center gap-3">
                          <h3 className="text-lg font-semibold">{question.text}</h3>
                          <ApprofondimentoButton 
                            opinionId={question.id} 
                            opinionText={question.text}
                          />
                        </div>
                        <div className="flex justify-center">
                          <div className="flex w-full max-w-md">
                            {options.map((option, idx) => (
                              <button
                                key={option.value} type="button"
                                className={`flex-1 py-3 text-base font-medium transition-transform duration-150 focus:outline-none border border-gray-200 ${idx === 0 ? 'rounded-l-full' : ''} ${idx === options.length - 1 ? 'rounded-r-full' : ''} ${normalizeAnswer(opinions[question.id]) === option.value ? option.color + ' scale-95 z-10' : 'bg-white hover:bg-gray-10 z-0'}`}
                                onClick={() => handleOpinionChange(question.id, option.value)}
                                disabled={blocco?.isBlocked}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <OpinionStatsBar
                          opinionId={question.id}
                          show={normalizeAnswer(opinions[question.id]) !== null}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {blocco?.isBlocked && (
                  <div className="mt-4 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 rounded text-center">
                    <b>Hai già modificato le opinioni questa settimana.</b><br />
                    Potrai farlo di nuovo dal: {unlockDate || "-"}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
      <OpinionActionsBar
        onSave={handleSave}
        onBack={exitGuard.onBack}
        isSaving={saveMutation.isPending}
        saveDisabled={isLoading || questions.length === 0 || blocco.isBlocked}
      />

      {/* Dialog per il consenso alle opinioni politiche */}
      {exitGuard.dialog}
      <PoliticalOpinionsConsentModal
        open={showConsentDialog}
        onOpenChange={setShowConsentDialog}
        onConsentGranted={handleConsentGranted}
      />
    </div>
  );
}
