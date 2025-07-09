import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";

// Le domande ora sono dinamiche
const options = [
  { value: "Favorevole", color: "bg-green-100 border-green-500 hover:bg-green-200" },
  { value: "Indeciso", color: "bg-yellow-100 border-yellow-500 hover:bg-yellow-200" },
  { value: "Contrario", color: "bg-red-100 border-red-500 hover:bg-red-200" }
];

export default function Opinioni() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [opinions, setOpinions] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingOpinions, setIsLoadingOpinions] = useState(true);
  const [questions, setQuestions] = useState<{id: string, text: string}[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [, setLocation] = useLocation();

  // Carica le domande dinamiche
  useEffect(() => {
    const fetchQuestions = async () => {
      setIsLoadingQuestions(true);
      try {
        const res = await fetch("/api/opinioni-list");
        if (!res.ok) throw new Error();
        setQuestions(await res.json());
      } catch (e) {
        toast({
          title: "Errore",
          description: "Non è stato possibile caricare le domande.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingQuestions(false);
      }
    };
    fetchQuestions();
  }, []);

  // Carica le opinioni dell'utente quando la pagina viene caricata o cambiano le domande
  useEffect(() => {
    if (user && questions.length > 0) {
      loadUserOpinions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, questions]);

  const loadUserOpinions = async () => {
    try {
      setIsLoadingOpinions(true);
      
      // Carica i dati utente unificati che ora contengono anche le opinioni
      const response = await fetch(`/api/users/${encodeURIComponent(user.uid)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Errore nel caricamento dei dati utente');
      }
      
      const userData = await response.json();
      
      if (userData) {
        // Estrai le opinioni dai dati utente unificati
        const filteredOpinions: Record<string, string> = {};
        questions.forEach(question => {
          filteredOpinions[question.id] = userData[question.id] || '';
        });
        setOpinions(filteredOpinions);
      }
    } catch (error) {
      console.error('Errore nel caricamento delle opinioni:', error);
      toast({
        title: "Errore",
        description: "Non è stato possibile caricare le tue opinioni.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingOpinions(false);
    }
  };

  const handleOpinionChange = (questionId: string, value: string) => {
    setOpinions(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const saveOpinions = async () => {
    try {
      setIsSubmitting(true);
      
      // Verifica che tutte le domande abbiano una risposta
      const hasAllAnswers = questions.every(question => opinions[question.id]);
      
      if (!hasAllAnswers) {
        toast({
          title: "Attenzione",
          description: "Per favore, rispondi a tutte le domande prima di salvare.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      
      // Includiamo esplicitamente l'email dell'utente nel payload per garantire 
      // che sia sempre presente quando si salvano le opinioni
      const opinionPayload = {
        ...opinions,
        email: user?.email || (user as any)?.profile?.email // Includiamo l'email da dove disponibile
      };
      
      console.log('Invio dati opinioni con email:', opinionPayload);
      
      const response = await fetch('/api/opinioni', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(opinionPayload)
      });
      
      // Leggiamo la risposta anche se non è OK perché potrebbe contenere dati salvati temporaneamente
      const result = await response.json();
      
      console.log('Risposta dal server per il salvataggio delle opinioni:', result);
      
      if (result.error) {
        // Se c'è un errore ma i dati sono stati comunque salvati in memoria
        if (result.data) {
          toast({
            title: "Attenzione",
            description: "Le tue opinioni sono state salvate temporaneamente, ma non nel database. " + 
                         (result.note || "Sarà possibile accedervi fino alla fine della sessione."),
            variant: "destructive",
          });
          
          // Reindirizza comunque al menu dopo un po'
          setTimeout(() => {
            setLocation("/menu");
          }, 3000);
          return;
        }
        
        throw new Error(result.error);
      }
      
      if (result) {
        // Verifica se i dati sono stati salvati temporaneamente o permanentemente
        if (result.note && result.note.includes('memoria')) {
          toast({
            title: "Successo con limitazioni",
            description: "Le tue opinioni sono state salvate, ma solo temporaneamente: " + result.note,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Successo",
            description: "Le tue opinioni sono state salvate correttamente.",
            variant: "default",
          });
        }
        
        // Attendiamo un attimo per mostrare il toast, poi indirizziamo al menu
        setTimeout(() => {
          setLocation("/menu");
        }, 2000);
      }
    } catch (error) {
      console.error('Errore nel salvataggio delle opinioni:', error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il salvataggio delle opinioni: " + 
                    (error instanceof Error ? error.message : 'Errore sconosciuto'),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Redirect to auth page if not logged in
  if (!user && !isLoading) {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-blue-400">
      <div className="container mx-auto px-4 py-8">
        <Button 
          variant="ghost" 
          className="mb-4 flex items-center"
          onClick={() => setLocation("/menu")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Torna al Menu
        </Button>
        
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
              Le Tue Opinioni
            </CardTitle>
            <CardDescription>
              Rispondi alle seguenti domande selezionando l'opzione che rappresenta meglio la tua posizione.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-6">
            {isLoadingOpinions ? (
              <div className="flex justify-center items-center h-60">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">Caricamento opinioni...</span>
              </div>
            ) : (
              <>
                <div className="space-y-8 flex flex-col items-center">
                  {questions.map((question) => (
                    <div key={question.id} className="border rounded-lg p-4 shadow-sm w-full max-w-xl mx-auto flex flex-col items-center">
                      <h3 className="text-lg font-semibold mb-4 text-center w-full">{question.text}</h3>
                      <div className="w-full">
                        <div className="flex w-full rounded-full overflow-hidden border-2 border-gray-300 bg-white shadow-sm">
                          {["Favorevole", "Indeciso", "Contrario"].map((option, idx) => {
                            const isSelected = opinions[question.id] === option;
                            let base = "flex-1 py-3 text-center cursor-pointer font-semibold transition-colors ";
                            let color =
                              option === "Favorevole"
                                ? isSelected
                                  ? "bg-green-500 text-white"
                                  : "hover:bg-green-100 text-green-700"
                                : option === "Indeciso"
                                ? isSelected
                                  ? "bg-yellow-400 text-white"
                                  : "hover:bg-yellow-100 text-yellow-700"
                                : isSelected
                                ? "bg-red-500 text-white"
                                : "hover:bg-red-100 text-red-700";
                            // Bordo destro solo tra i bottoni
                            let border = idx < 2 ? "border-r border-gray-300" : "";
                            return (
                              <button
                                key={option}
                                type="button"
                                className={base + color + " " + border}
                                style={{ borderRadius: idx === 0 ? "9999px 0 0 9999px" : idx === 2 ? "0 9999px 9999px 0" : "0" }}
                                onClick={() => handleOpinionChange(question.id, option)}
                                aria-pressed={isSelected}
                              >
                                {option}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-8 flex justify-center">
                  <Button
                    onClick={saveOpinions}
                    disabled={isSubmitting}
                    className="w-full max-w-sm"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvataggio in corso...
                      </>
                    ) : (
                      "Salva Opinioni"
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}