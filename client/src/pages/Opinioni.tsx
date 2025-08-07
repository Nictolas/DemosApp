import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
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

export default function Opinioni() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [opinions, setOpinions] = useState<Record<string, string>>({});

  // 1. Caricamento dati con React Query
  const { data, isLoading } = useQuery<UserOpinionsData>({
    queryKey: ['opinioniData'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/opinioni/utente");
      if (!response.ok) throw new Error("Errore nel caricamento delle opinioni.");
      return response.json();
    },
    enabled: !!user,
    onSuccess: (fetchedData) => {
      // Inizializza lo stato locale con le risposte dell'utente
      setOpinions(fetchedData.userAnswers || {});
    }
  });

  // 2. Mutazione per salvare le opinioni
  const saveMutation = useMutation({
    mutationFn: (newOpinions: Record<string, string>) => apiRequest("POST", "/api/opinioni/salva", { opinions: newOpinions }),
    onSuccess: () => {
      toast({ title: "Successo", description: "Le tue opinioni sono state salvate." });
      queryClient.invalidateQueries({ queryKey: ['opinioniData'] });
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
    if (data?.questions.some(q => !opinions[q.id])) {
      toast({ title: "Attenzione", description: "Per favore, rispondi a tutte le domande.", variant: "destructive" });
      return;
    }
    saveMutation.mutate(opinions);
  };

  if (isAuthLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!user) return <Redirect to="/auth" />;
  
  const { questions = [], blocco } = data || {};
  const unlockDate = blocco?.unlockDate ? new Date(blocco.unlockDate).toLocaleString('it-IT') : null;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-white" style={{ paddingBottom: '80px' }}>
      <div className="container mx-auto px-4 py-8">
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold">Le tue Opinioni</CardTitle>
            <CardDescription>Esprimi la tua opinione su temi importanti per trovare rappresentanti con idee simili alle tue.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="ml-2">Caricamento...</span></div>
            ) : questions.length === 0 ? (
              <div className="text-center py-8"><p className="text-muted-foreground">Nessuna domanda disponibile.</p></div>
            ) : (
              <>
                {questions.map((question) => (
                  <div key={question.id} className="space-y-4">
                    <h3 className="text-lg font-semibold text-center">{question.text}</h3>
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