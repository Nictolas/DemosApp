import { saveAndVerifyOpinions } from "@/lib/saveAndVerifyOpinions";
import { collectChangedOpinionAnswers } from "@/lib/opinionDelta";
import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { ApprofondimentoButton } from '@/components/ApprofondimentoButton';
import { usePoliticalOpinionsConsent } from '@/hooks/usePoliticalOpinionsConsent';
import { vibrateShort } from '@/utils/vibration';
import { PoliticalOpinionsConsentModal } from '@/components/PoliticalOpinionsConsentModal';
import { OpinionStatsBar } from '@/components/OpinionStatsBar';
import { useUnsavedOpinionsGuard } from "@/hooks/useUnsavedOpinionsGuard";
import { OpinionActionsBar } from "@/components/OpinionActionsBar";

const options = [
  { value: 'f', color: 'bg-green-500 text-white', label: 'Favorevole' },
  { value: 'i', color: 'bg-yellow-500 text-white', label: 'Indeciso' },
  { value: 'c', color: 'bg-red-500 text-white', label: 'Contrario' }
];

// Funzione per normalizzare le risposte (usa direttamente i valori compressi)
const normalizeAnswer = (answer: string | undefined) => {
  if (!answer || answer === null || answer === undefined) return null;
  // Usa direttamente i valori compressi
  if (answer === 'f' || answer === 'c' || answer === 'i') return answer;
  return null;
};

export default function OpinioniEuropee() {
  const [, setLocation] = useLocation();
  const { user, isLoading: isAuthLoading, isSessionVerified, verifiedPoliticalConsent } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [opinions, setOpinions] = useState<Record<string, string>>({});
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [pendingOpinionsToSave, setPendingOpinionsToSave] = useState<Record<string, string> | null>(null);
  
  // Controllo consenso opinioni politiche (GDPR Art. 9)
  const { hasConsent } = usePoliticalOpinionsConsent();

  // 1. Query per caricare le domande
  const { data: questionsData, isLoading: isLoadingQuestions } = useQuery({
    queryKey: ['opinioniQuestions', user?.id, verifiedPoliticalConsent?.timestamp, 'Europeo'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/opinioni-list?grado=E");
      if (response.ok && response.data) {
        return response.data;
      }
      return { success: false, data: [] };
    },
    enabled: !!user && isSessionVerified && verifiedPoliticalConsent?.granted === true
  });

  // Combina i dati
  const isLoading = isLoadingQuestions;
  const questions = (questionsData?.data && Array.isArray(questionsData.data)) ? questionsData.data : [];
  
  // Debug
  useEffect(() => {
    console.log('🔍 DEBUG - questionsData:', questionsData);
    console.log('🔍 DEBUG - questions:', questions);
    console.log('🔍 DEBUG - questions.length:', questions.length);
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
    console.log('🔍 DEBUG - opinioniEspresse:', opinioniEspresse);
    console.log('🔍 DEBUG - opinioniDaInserire:', opinioniDaInserire);
    console.log('🔍 DEBUG - opinioniEspresse.length:', opinioniEspresse.length);
    console.log('🔍 DEBUG - opinioniDaInserire.length:', opinioniDaInserire.length);
  }, [opinioniEspresse, opinioniDaInserire]);

  // Sincronizza le opinioni quando le domande vengono caricate
  useEffect(() => {
    if (questions && questions.length > 0) {
      console.log('🔍 DEBUG useEffect - questions ricevute:', questions);
      const mappedOpinions: Record<string, string> = {};
      
      questions.forEach(question => {
        console.log(`🔍 DEBUG question:`, {
          id: question.id,
          text: question.text,
          userAnswer: question.userAnswer
        });
        
        if (question.userAnswer && question.userAnswer !== null) {
          mappedOpinions[question.id] = question.userAnswer;
          console.log(`✅ Mappata opinione esistente: ${question.id} = ${question.userAnswer}`);
        } else {
          // Non impostare nulla per opinioni senza risposta - rimangono undefined
          console.log(`ℹ️ Opinione senza risposta: ${question.id} (userAnswer: ${question.userAnswer}) -> non impostata`);
        }
      });
      
      console.log('🔍 DEBUG mappedOpinions:', mappedOpinions);
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
    mutationFn: (newOpinions: Record<string, string>) => saveAndVerifyOpinions("E", newOpinions),
    onSuccess: (_data, savedOpinions) => {
      toast({ title: "Successo", description: "Le tue opinioni europee sono state salvate." });
      queryClient.setQueryData(
        ['opinioniQuestions', user?.id, verifiedPoliticalConsent?.timestamp, 'Europeo'],
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
      setTimeout(() => setLocation(nextPage), 1500);
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
    console.log('🔍 DEBUG handleSave:');
    console.log('  questions:', questions);
    console.log('  opinions:', opinions);
    
    // Only changed IDs: never overwrite positions from another device.
    const opinionsToSave = collectChangedOpinionAnswers(questions, opinions);

    if (Object.keys(opinionsToSave).length === 0) {
      console.log('❌ DEBUG: Nessuna opinione da salvare');
      toast({ title: "Attenzione", description: "Non ci sono nuove opinioni da salvare.", variant: "destructive" });
      return;
    }
    
    // Verifica consenso opinioni politiche (GDPR Art. 9)
    if (!hasConsent) {
      // Salva le opinioni da salvare in uno stato temporaneo
      setPendingOpinionsToSave(opinionsToSave);
      // Apri il dialog del consenso
      setShowConsentDialog(true);
      return;
    }
    
    console.log('✅ DEBUG: Procedo con il salvataggio');
    saveMutation.mutate(opinionsToSave);
  };

  saveHandlerRef.current = handleSave;

  // Funzione chiamata quando il consenso viene concesso
  const handleConsentGranted = async () => {
    // Dopo che il consenso è stato concesso, aggiorna la cache e poi salva le opinioni in attesa
    if (pendingOpinionsToSave) {
      console.log('✅ DEBUG: Consenso concesso, aggiorno la cache e procedo con il salvataggio delle opinioni');
      // Aggiorna la cache del consenso per assicurarsi che sia aggiornata
      await queryClient.refetchQueries({ queryKey: ['political-opinions-consent'] });
      // Aspetta un breve momento per assicurarsi che la cache sia aggiornata
      setTimeout(() => {
        saveMutation.mutate(pendingOpinionsToSave);
        setPendingOpinionsToSave(null);
      }, 300);
    }
  };

  if (isAuthLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!user) return <div>Redirecting...</div>;
  
  // Per ora non abbiamo il sistema di blocco, quindi sempre false
  const blocco = { isBlocked: false, unlockDate: null };
  const unlockDate = null;

  return (
    <div className="opinioni-editor-page flex h-full min-h-0 flex-col bg-gradient-to-b from-blue-50 to-white">
      <div className="min-h-0 flex-1 px-3 pb-2 pt-3 sm:px-4 sm:pt-6">
        <Card className="mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col">
          <CardHeader className="opinioni-editor-page__header shrink-0 text-center">
            <CardTitle className="text-3xl font-bold">Opinioni Europee</CardTitle>
            <CardDescription>Esprimi la tua opinione su temi di rilevanza europea per trovare rappresentanti con idee simili alle tue.</CardDescription>
          </CardHeader>
          <CardContent className="opinioni-editor-page__list min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain pb-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="ml-2">Caricamento...</span></div>
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
