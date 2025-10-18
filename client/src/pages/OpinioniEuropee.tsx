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

const options = [
  { value: 'Favorevole', color: 'bg-green-500 text-white' },
  { value: 'Indeciso', color: 'bg-yellow-500 text-white' },
  { value: 'Contrario', color: 'bg-red-500 text-white' }
];

// Funzione per normalizzare le risposte (gestisce sia valori compressi che non compressi)
const normalizeAnswer = (answer: string | undefined) => {
  if (!answer || answer === null || answer === undefined) return 'Astenuto';
  if (answer === 'Sì') return 'Favorevole';
  if (answer === 'No') return 'Contrario';
  if (answer === 'Indeciso') return 'Indeciso';
  if (answer === 'Favorevole') return 'Favorevole';
  if (answer === 'Contrario') return 'Contrario';
  if (answer === 'Astenuto') return 'Astenuto';
  // Gestione valori compressi
  if (answer === 'f') return 'Favorevole';
  if (answer === 'c') return 'Contrario';
  if (answer === 'i') return 'Indeciso';
  return 'Astenuto';
};

export default function OpinioniEuropee() {
  const [, setLocation] = useLocation();
  const { user, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [opinions, setOpinions] = useState<Record<string, string>>({});

  // 1. Query per caricare le domande
  const { data: questionsData, isLoading: isLoadingQuestions } = useQuery({
    queryKey: ['opinioniQuestions', 'Europeo'],
    queryFn: async () => {
      console.log('🔍 DEBUG - Caricamento opinioni europee...');
      const response = await apiRequest("GET", "/api/opinioni-list?grado=E");
      if (!response.ok) throw new Error("Errore nel caricamento delle domande.");
      const data = await response.json();
      console.log('🔍 DEBUG - Risposta API:', data);
      return data;
    },
    enabled: !!user
  });

  // Combina i dati
  const isLoading = isLoadingQuestions;
  const questions = questionsData?.data || [];
  
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
      return normalizedAnswer && ['Favorevole', 'Contrario', 'Indeciso'].includes(normalizedAnswer);
    })
    .sort((a, b) => a.text.localeCompare(b.text));
  
  const opinioniDaInserire = questions
    .filter(q => {
      const normalizedAnswer = normalizeAnswer(q.userAnswer);
      return !normalizedAnswer || normalizedAnswer === 'Astenuto' || !['Favorevole', 'Contrario', 'Indeciso'].includes(normalizedAnswer);
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
        
        if (question.userAnswer && question.userAnswer !== 'Astenuto' && question.userAnswer !== null) {
          mappedOpinions[question.id] = question.userAnswer;
          console.log(`✅ Mappata opinione esistente: ${question.id} = ${question.userAnswer}`);
        } else {
          mappedOpinions[question.id] = 'Astenuto';
          console.log(`ℹ️ Opinione senza risposta: ${question.id} (userAnswer: ${question.userAnswer}) -> impostato Astenuto`);
        }
      });
      
      console.log('🔍 DEBUG mappedOpinions:', mappedOpinions);
      setOpinions(mappedOpinions);
    }
  }, [questions]);

  // 2. Mutazione per salvare le opinioni
  const saveMutation = useMutation({
    mutationFn: (newOpinions: Record<string, string>) => apiRequest("POST", "/api/opinioni/salva", { opinioni: newOpinions }),
    onSuccess: () => {
      toast({ title: "Successo", description: "Le tue opinioni europee sono state salvate." });
      queryClient.invalidateQueries({ queryKey: ['opinioniQuestions', 'Europeo'] });
      setTimeout(() => setLocation("/opinioni"), 1500);
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message || "Impossibile salvare le opinioni.", variant: "destructive" });
    }
  });

  const handleOpinionChange = (questionId: string, value: string) => {
    setOpinions(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSave = () => {
    console.log('🔍 DEBUG handleSave:');
    console.log('  questions:', questions);
    console.log('  opinions:', opinions);
    
    // Mappa le opinioni usando l'ID corretto per l'API
    const opinionsToSave: Record<string, string> = {};
    questions.forEach(question => {
      console.log(`🔍 DEBUG question:`, {
        id: question.id,
        text: question.text,
        userAnswer: question.userAnswer,
        opinionValue: opinions[question.id]
      });
      
      if (opinions[question.id] && opinions[question.id] !== 'Astenuto') {
        // Usa l'ID dell'opinione come chiave per l'API
        opinionsToSave[question.id] = opinions[question.id];
        console.log(`✅ Aggiunta opinione: ${question.id} = ${opinions[question.id]}`);
      }
    });
    
    console.log('  opinionsToSave:', opinionsToSave);
    console.log('  Numero opinioni da salvare:', Object.keys(opinionsToSave).length);
    
    if (Object.keys(opinionsToSave).length === 0) {
      console.log('❌ DEBUG: Nessuna opinione da salvare');
      toast({ title: "Attenzione", description: "Seleziona almeno un'opinione prima di salvare.", variant: "destructive" });
      return;
    }
    
    console.log('✅ DEBUG: Procedo con il salvataggio');
    saveMutation.mutate(opinionsToSave);
  };

  if (isAuthLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!user) return <div>Redirecting...</div>;
  
  // Per ora non abbiamo il sistema di blocco, quindi sempre false
  const blocco = { isBlocked: false, unlockDate: null };
  const unlockDate = null;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-white page-with-navbar">
      <div className="container mx-auto px-4 py-8">
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold">Opinioni Europee</CardTitle>
            <CardDescription>Esprimi la tua opinione su temi di rilevanza europea per trovare rappresentanti con idee simili alle tue.</CardDescription>
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
                                {option.value}
                              </button>
                            ))}
                          </div>
                        </div>
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
                                {option.value}
                              </button>
                            ))}
                          </div>
                        </div>
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
    </div>
  );
}
