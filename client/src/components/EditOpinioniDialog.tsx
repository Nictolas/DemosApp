import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";

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
        const res = await fetch("/api/opinioni-list");
        if (!res.ok) throw new Error();
        setQuestions(await res.json());
      } catch {
        toast({ title: "Errore", description: "Impossibile caricare le opinioni disponibili.", variant: "destructive" });
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
      const response = await fetch(`/api/users/${utenteId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        throw new Error('Errore nel caricamento delle opinioni');
      }
      const data = await response.json();
      if (data) {
        // Prendi tutte le opinioni con valore valido
        const filteredOpinions: Record<string, string> = {};
        Object.keys(data).forEach(key => {
          if (["Favorevole", "Indeciso", "Contrario"].includes(data[key])) {
            filteredOpinions[key] = data[key];
          }
        });
        setOpinions(filteredOpinions);
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
      const response = await fetch(`/api/opinioni-fonti/${utenteId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setFonti(data || {});
    } catch {
      setFonti({});
    }
  };

  const handleOpinionChange = (questionId: string, value: string) => {
    setOpinions(prev => ({
      ...prev,
      [questionId]: value
    }));
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
      let responseOpinioni;
      // Se admin e sta modificando un altro utente, usa PUT su /api/opinioni/:utenteId
      if (user && user.ruolo === "Admin" && user.id !== utenteId) {
        responseOpinioni = await fetch(`/api/opinioni/${utenteId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(opinions)
        });
      } else {
        // Altrimenti POST su /api/opinioni
        responseOpinioni = await fetch(`/api/opinioni`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(opinions)
        });
      }
      if (!responseOpinioni.ok) {
        throw new Error('Errore nell\'aggiornamento delle opinioni');
      }
      // Poi salva le fonti
      const responseFonti = await fetch(`/api/opinioni-fonti/${utenteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fonti)
      });
      if (!responseFonti.ok) {
        throw new Error('Errore nell\'aggiornamento delle fonti');
      }
      toast({
        title: "Successo",
        description: "Le opinioni e le fonti dell'utente sono state aggiornate con successo.",
        variant: "default",
      });
      onOpinioniUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Errore nell\'aggiornamento delle opinioni/fonti:', error);
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
          ) : (
            <div className="space-y-6">
              {Object.keys(opinions).map((key) => {
                const question = questions.find(q => q.id === key);
                const label = question ? question.text : key;
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