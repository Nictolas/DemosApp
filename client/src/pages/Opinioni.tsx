import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";
import { collection, getDocs, doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

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

  // Carica le domande dinamiche da Firebase
  useEffect(() => {
    const fetchQuestions = async () => {
      setIsLoadingQuestions(true);
      try {
        const opinioniRef = collection(db, "opinioni");
        const snapshot = await getDocs(opinioniRef);
        const questions = snapshot.docs.map(doc => ({ id: doc.id, text: doc.data().text }));
        setQuestions(questions);
      } catch (error) {
        console.error("Errore nel caricamento delle opinioni:", error);
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
      
      // Carica i dati utente direttamente da Firebase
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // Estrai le opinioni dai dati utente
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
      
      // Salva le opinioni direttamente in Firebase
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, opinions);
      
      toast({
        title: "Successo",
        description: "Le tue opinioni sono state salvate correttamente.",
        variant: "default",
      });
      
      // Attendiamo un attimo per mostrare il toast, poi indirizziamo al menu
      setTimeout(() => {
        setLocation("/menu");
      }, 2000);
      
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
            <CardTitle className="text-3xl font-bold mb-2">Le tue Opinioni</CardTitle>
            <CardDescription>
              Esprimi la tua opinione su temi importanti. Le tue risposte aiuteranno a trovare rappresentanti e candidati con idee simili alle tue.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {isLoadingQuestions ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">Caricamento domande...</span>
              </div>
            ) : questions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Nessuna domanda disponibile al momento.</p>
              </div>
            ) : (
              <>
                {questions.map((question) => (
                  <div key={question.id} className="space-y-4">
                    <h3 className="text-lg font-semibold">{question.text}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {options.map((option) => (
                        <Button
                          key={option.value}
                          variant={opinions[question.id] === option.value ? "default" : "outline"}
                          className={`h-12 ${opinions[question.id] === option.value ? option.color : ""}`}
                          onClick={() => handleOpinionChange(question.id, option.value)}
                        >
                          {option.value}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
                
                <div className="flex justify-center pt-6">
                  <Button
                    onClick={saveOpinions}
                    disabled={isSubmitting}
                    className="px-8 py-3 text-lg"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      "Salva le mie opinioni"
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