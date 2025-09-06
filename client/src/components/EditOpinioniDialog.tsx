import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth-neon";
import { apiRequest } from "@/lib/queryClient";



// Le domande ora sono dinamiche
const options = [
  { value: "Favorevole", color: "bg-green-100 border-green-500 hover:bg-green-200" },
  { value: "Indeciso", color: "bg-yellow-100 border-yellow-500 hover:bg-yellow-200" },
  { value: "Contrario", color: "bg-red-100 border-red-500 hover:bg-red-200" }
];

interface EditOpinioniDialogProps {
  utenteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpinioniUpdated: () => void;
}

export function EditOpinioniDialog({ 
  utenteId, 
  open, 
  onOpenChange, 
  onOpinioniUpdated 
}: EditOpinioniDialogProps) {
  const { toast } = useToast();
  const [opinions, setOpinions] = useState<Record<string, string>>({});
  const [isLoadingOpinions, setIsLoadingOpinions] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [questions, setQuestions] = useState<{id: string, text: string}[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [fonti, setFonti] = useState<Record<string, string>>({});
  const { user } = useAuth();

  // Carica le domande dinamiche
  useEffect(() => {
    const fetchQuestions = async () => {
      setIsLoadingQuestions(true);
      try {
        const response = await fetch('/api/opinioni/profile');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data && data.data.questions) {
            setQuestions(data.data.questions);
          } else {
            console.warn('Nessuna domanda trovata nella risposta API:', data);
            setQuestions([]);
          }
        } else {
          console.error('Errore nel caricamento delle domande:', response.status, response.statusText);
          toast({ title: "Errore", description: "Impossibile caricare le opinioni disponibili.", variant: "destructive" });
          setQuestions([]);
        }
      } catch (error) {
        console.error('Errore nel caricamento delle domande:', error);
        toast({ title: "Errore", description: "Impossibile caricare le opinioni disponibili.", variant: "destructive" });
        setQuestions([]);
      } finally {
        setIsLoadingQuestions(false);
      }
    };
    fetchQuestions();
  }, []);

  useEffect(() => {
    if (open && utenteId && questions.length > 0) {
      loadUserOpinions();
      loadFonti();
    }
    // eslint-disable-next-line
  }, [open, utenteId, questions]);

  const loadUserOpinions = async () => {
    try {
      setIsLoadingOpinions(true);
      const response = await apiRequest("GET", `/api/users/${utenteId}/opinioni`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data && data.data.opinioni) {
          // Converte le opinioni nel formato atteso
          const opinioniMap: Record<string, string> = {};
          data.data.opinioni.forEach((opinion: any) => {
            if (opinion.userAnswer && opinion.userAnswer !== 'Astenuto') {
              opinioniMap[opinion.id] = opinion.userAnswer;
            }
          });
          setOpinions(opinioniMap);
        }
      } else {
        throw new Error('Errore nel caricamento delle opinioni');
      }
    } catch (error) {
      console.error('Errore nel caricamento delle opinioni:', error);
      toast({
        title: "Errore",
        description: "Non è stato possibile caricare le opinioni dell'utente.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingOpinions(false);
    }
  };

  const loadFonti = async () => {
    try {
      const response = await apiRequest("GET", `/api/users/${utenteId}/opinioni`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data && data.data.fonti) {
          setFonti(data.data.fonti);
        } else {
          setFonti({});
        }
      } else {
        setFonti({});
      }
    } catch {
      setFonti({});
    }
  };

  const handleOpinionChange = (questionId: string, value: string) => {
    setOpinions(prev => {
      // Se la preferenza è già selezionata, la imposto a null (per eliminare il campo su Firestore)
      if (prev[questionId] === value) {
        return {
          ...prev,
          [questionId]: null
        };
      }
      // Altrimenti la imposto normalmente
      return {
        ...prev,
        [questionId]: value
      };
    });
  };

  const handleFonteChange = (questionId: string, value: string) => {
    setFonti(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const saveOpinions = async () => {
    try {
      setIsSubmitting(true);
      const response = await apiRequest("PUT", `/api/users/${utenteId}/opinioni`, {
        opinioni: opinions,
        fonti: fonti
      });
      
      if (response.ok) {
        toast({
          title: "Successo",
          description: "Le opinioni e le fonti dell'utente sono state aggiornate con successo.",
          variant: "default",
        });
        onOpinioniUpdated();
        onOpenChange(false);
      } else {
        throw new Error('Errore nel salvataggio');
      }
    } catch (error) {
      console.error('Errore nell\'aggiornamento delle opinioni:', error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'aggiornamento delle opinioni o delle fonti.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Modifica Opinioni Utente</DialogTitle>
          <DialogDescription>
            Modifica le opinioni dell'utente. Le modifiche saranno salvate solo quando fai clic su "Salva".
          </DialogDescription>
        </DialogHeader>
        
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {isLoadingOpinions || isLoadingQuestions ? (
            <div className="flex justify-center items-center h-60">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Caricamento opinioni...</span>
            </div>
          ) : questions.length === 0 ? (
            <div className="flex justify-center items-center h-60">
              <div className="text-center">
                <p className="text-gray-500 mb-2">Nessuna opinione disponibile</p>
                <p className="text-sm text-gray-400">Non ci sono opinioni configurate nel sistema</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {questions.map((question) => {
                const key = question.id;
                const label = question.text;
                return (
                  <div key={key} className="border rounded-lg p-4 shadow-sm">
                    <h3 className="text-lg font-semibold mb-2">{label}</h3>
                    <div className="flex gap-2 mb-2">
                      {options.map((option) => {
                        const selected = opinions[key] === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleOpinionChange(key, option.value)}
                            className={
                              "px-4 py-2 rounded-full border-2 font-semibold transition " +
                              (option.color + " ") +
                              (selected
                                ? " text-white ring-2 ring-offset-2 "
                                : " bg-white text-black opacity-80 hover:opacity-100 ")
                            }
                            style={{
                              borderColor: selected ? "#000" : undefined,
                            }}
                          >
                            {option.value}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-2">
                      <Label className="block text-sm mb-1">Fonte (URL)</Label>
                      <Input
                        type="text"
                        value={fonti[key] || ""}
                        onChange={e => handleFonteChange(key, e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        <div className="flex justify-end space-x-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Annulla
          </Button>
          <Button onClick={saveOpinions} disabled={isLoadingOpinions || isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvataggio...
              </>
            ) : (
              "Salva"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}