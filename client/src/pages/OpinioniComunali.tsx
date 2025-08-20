import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface Question {
  id: string;
  text: string;
  grado_opinione: string;
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
  { value: "Favorevole", color: "bg-green-600 text-white" },
  { value: "Indeciso", color: "bg-yellow-500 text-white" },
  { value: "Contrario", color: "bg-red-600 text-white" }
];

// Mappatura degli ID delle opinioni ai loro argomenti
const getOpinionTopic = (id: string, questionText: string): string => {
  // Mappatura per le opinioni base
  const baseOpinionsMap: Record<string, string> = {
    'energia_nucleare': 'Energia Nucleare',
    'sperimentazione_animale': 'Sperimentazione Animale',
    'legalizzazione_canapa': 'Legalizzazione Canapa',
    'caccia': 'Caccia',
    'cittadina_animale': 'Cittadinanza Animale',
    'eutanasia': 'Eutanasia',
    'case_chiuse': 'Case Chiuse',
    'salario_minimo': 'Salario Minimo',
    'matrimonio_gay': 'Matrimonio Gay',
    'nato': 'NATO',
    'omobitransfobia': 'Legge contro l\'omobitransfobia'
  };
  
  // Se è un'opinione base, usa la mappatura
  if (baseOpinionsMap[id]) {
    return baseOpinionsMap[id];
  }
  
  // Per le opinioni dinamiche, estrai l'argomento dalla domanda
  if (questionText) {
    // Rimuovi "Sei favorevole a" o "Sei favorevole alla" dall'inizio
    let topic = questionText.replace(/^Sei favorevole (a|alla) /i, '');
    
    // Rimuovi il punto interrogativo alla fine
    topic = topic.replace(/\?$/, '');
    
    // Capitalizza la prima lettera
    topic = topic.charAt(0).toUpperCase() + topic.slice(1);
    
    return topic;
  }
  
  // Fallback: usa l'ID
  return id;
};

export default function OpinioniComunali() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [opinions, setOpinions] = useState<Record<string, string>>({});

  // 1. Caricamento domande comunali con React Query
  const { data: questionsData, isLoading: isLoadingQuestions } = useQuery<{success: boolean, data: Question[]}>({
    queryKey: ['opinioniComunali'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/opinioni-list?grado=Comunale");
      if (!response.ok) throw new Error("Errore nel caricamento delle domande comunali.");
      return response.json();
    },
    enabled: !!user
  });

  // 2. Caricamento risposte utente con React Query
  const { data: userAnswersData, isLoading: isLoadingUserAnswers } = useQuery<{success: boolean, data: Record<string, string>}>({
    queryKey: ['userOpinions'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/opinioni/user-answers");
      if (!response.ok) throw new Error("Errore nel caricamento delle risposte.");
      return response.json();
    },
    enabled: !!user,
    onSuccess: (fetchedData) => {
      // Inizializza lo stato locale con le risposte dell'utente
      setOpinions(fetchedData.data || {});
    }
  });

  // Combina i dati
  const isLoading = isLoadingQuestions || isLoadingUserAnswers;
  const questions = questionsData?.data || [];
  const userAnswers = userAnswersData?.data || {};

  // Sincronizza le opinioni quando userAnswers è disponibile
  useEffect(() => {
    if (userAnswers && Object.keys(userAnswers).length > 0) {
      setOpinions(userAnswers);
    }
  }, [userAnswers]);

  // 2. Mutazione per salvare le opinioni
  const saveMutation = useMutation({
    mutationFn: (newOpinions: Record<string, string>) => apiRequest("POST", "/api/opinioni/salva", { opinions: newOpinions }),
    onSuccess: () => {
      toast({ title: "Successo", description: "Le tue opinioni comunali sono state salvate." });
      queryClient.invalidateQueries({ queryKey: ['userOpinions'] });
      setTimeout(() => setLocation("/menu"), 1500);
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message || "Impossibile salvare le opinioni.", variant: "destructive" });
    }
  });

  const handleOpinionChange = (questionId: string, value: string) => {
    setOpinions(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSave = () => {
    console.log('🔍 DEBUG handleSave Opinioni Comunali:');
    console.log('  questions:', questions);
    console.log('  opinions:', opinions);
    
    // Filtra solo le opinioni che hanno un valore (non null/undefined)
    const opinionsToSave = Object.fromEntries(
      Object.entries(opinions).filter(([key, value]) => value !== null && value !== undefined)
    );
    
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
  if (!user) return <Redirect to="/auth" />;
  
  // Per ora non abbiamo il sistema di blocco, quindi sempre false
  const blocco = { isBlocked: false, unlockDate: null };
  const unlockDate = null;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-teal-50 to-white" style={{ paddingBottom: '80px' }}>
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
              <div className="text-center py-8">
                <p className="text-muted-foreground">Nessuna opinione comunale disponibile al momento.</p>
                <p className="text-sm text-muted-foreground mt-2">Le opinioni comunali verranno aggiunte dagli amministratori.</p>
              </div>
            ) : (
              <>
                {questions.map((question) => (
                  <div key={question.id} className="space-y-4">
                    <h3 className="text-lg font-semibold text-center">{getOpinionTopic(question.id, question.text)}</h3>
                    <div className="flex justify-center">
                      <div className="flex w-full max-w-md">
                        {options.map((option, idx) => (
                          <button
                            key={option.value} type="button"
                            className={`flex-1 py-3 text-base font-medium transition-transform duration-150 focus:outline-none border border-gray-200 ${idx === 0 ? 'rounded-l-full' : ''} ${idx === options.length - 1 ? 'rounded-r-full' : ''} ${opinions[question.id] === option.value ? option.color + ' scale-95 z-10' : 'bg-white hover:bg-gray-100 z-0'}`}
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
                <div className="flex justify-center pt-6">
                  <Button onClick={handleSave} disabled={saveMutation.isPending || blocco?.isBlocked} className="px-8 py-3 text-lg">
                    {saveMutation.isPending ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Salvando...</> : "Salva le mie opinioni comunali"}
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
