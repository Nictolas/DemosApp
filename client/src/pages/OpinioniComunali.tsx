import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth-neon';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { ApprofondimentoButton } from '@/components/ApprofondimentoButton';
import { usePoliticalOpinionsConsent } from '@/hooks/usePoliticalOpinionsConsent';
import { vibrateShort } from '@/utils/vibration';
import { PoliticalOpinionsConsentModal } from '@/components/PoliticalOpinionsConsentModal';
import { OpinionStatsBar } from '@/components/OpinionStatsBar';

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

export default function OpinioniComunali() {
  const [, setLocation] = useLocation();
  const { user, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [opinions, setOpinions] = useState<Record<string, string>>({});
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [pendingOpinionsToSave, setPendingOpinionsToSave] = useState<Record<string, string> | null>(null);
  
  // Controllo consenso opinioni politiche (GDPR Art. 9)
  const { hasConsent } = usePoliticalOpinionsConsent();

  // 1. Query per caricare le domande
  const { data: questionsData, isLoading: isLoadingQuestions } = useQuery({
    queryKey: ['opinioniQuestions', 'Comunale'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/opinioni-list?grado=CO");
      if (response.ok && response.data) {
        return response.data;
      }
      return { success: false, data: [] };
    },
    enabled: !!user
  });

  // Combina i dati
  const isLoading = isLoadingQuestions;
  const questions = (questionsData?.data && Array.isArray(questionsData.data)) ? questionsData.data : [];

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

  // Sincronizza le opinioni quando le domande vengono caricate
  useEffect(() => {
    if (questions && questions.length > 0) {
      const mappedOpinions: Record<string, string> = {};
      
      questions.forEach(question => {
        if (question.userAnswer && question.userAnswer !== null) {
          mappedOpinions[question.id] = question.userAnswer;
        }
      });
      
      setOpinions(mappedOpinions);
    }
  }, [questions]);

  // 2. Mutazione per salvare le opinioni
  const saveMutation = useMutation({
    mutationFn: (newOpinions: Record<string, string>) => apiRequest("POST", "/api/opinioni/salva", { opinioni: newOpinions }),
    onSuccess: () => {
      toast({ title: "Successo", description: "Le tue opinioni comunali sono state salvate." });
      queryClient.invalidateQueries({ queryKey: ['opinioniQuestions', 'Comunale'] });
      // Invalida anche la cache della pagina candidati per aggiornare le opinioni comuni
      queryClient.invalidateQueries({ queryKey: ['candidatiData'] });
      setTimeout(() => setLocation("/opinioni"), 1500);
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message || "Impossibile salvare le opinioni.", variant: "destructive" });
    }
  });

  const handleOpinionChange = (questionId: string, value: string) => {
    // Vibrazione quando si cambia opinione
    vibrateShort();
    setOpinions(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSave = () => {
    // Mappa le opinioni usando l'ID corretto per l'API
    const opinionsToSave: Record<string, string> = {};
    questions.forEach(question => {
      if (opinions[question.id] && opinions[question.id] !== 'Astenuto') {
        // Usa l'ID dell'opinione direttamente dal database
        opinionsToSave[question.id] = opinions[question.id];
      }
    });
    
    if (Object.keys(opinionsToSave).length === 0) {
      toast({ title: "Attenzione", description: "Seleziona almeno un'opinione prima di salvare.", variant: "destructive" });
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
    
    saveMutation.mutate(opinionsToSave);
  };

  // Funzione chiamata quando il consenso viene concesso
  const handleConsentGranted = async () => {
    // Dopo che il consenso è stato concesso, aggiorna la cache e poi salva le opinioni in attesa
    if (pendingOpinionsToSave) {
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
    <div className="flex flex-col bg-gradient-to-b from-blue-50 to-white page-with-navbar">
      <div className="container mx-auto px-4 py-8">
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold">Opinioni Comunali</CardTitle>
            <CardDescription>Esprimi la tua opinione su temi di rilevanza comunale per trovare rappresentanti con idee simili alle tue.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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

                <div className="flex justify-center pt-6">
                  <Button onClick={handleSave} disabled={saveMutation.isPending || blocco?.isBlocked} className="px-8 py-3 text-lg">
                    {saveMutation.isPending ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Salvando...</> : "Salva le mie opinioni"}
                  </Button>
                </div>
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

      {/* Dialog per il consenso alle opinioni politiche */}
      <PoliticalOpinionsConsentModal
        open={showConsentDialog}
        onOpenChange={setShowConsentDialog}
        onConsentGranted={handleConsentGranted}
      />
    </div>
  );
}
