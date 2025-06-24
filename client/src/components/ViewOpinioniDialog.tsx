import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CustomAvatar } from "@/components/CustomAvatar";

// Mappa colori per le risposte
const responseColors = {
  "Favorevole": "bg-green-100 text-green-800 border-green-500",
  "Indeciso": "bg-yellow-100 text-yellow-800 border-yellow-500",
  "Contrario": "bg-red-100 text-red-800 border-red-500"
};

interface ViewOpinioniDialogProps {
  utenteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nome?: string;
  cognome?: string;
  avatarConfig?: string;
}

export function ViewOpinioniDialog({ 
  utenteId, 
  open, 
  onOpenChange,
  nome,
  cognome,
  avatarConfig
}: ViewOpinioniDialogProps) {
  const { toast } = useToast();
  const [opinions, setOpinions] = useState<Record<string, string>>({});
  const [isLoadingOpinions, setIsLoadingOpinions] = useState(true);
  const [questions, setQuestions] = useState<{id: string, text: string}[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);

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
    }
    // eslint-disable-next-line
  }, [open, utenteId, questions]);

  const loadUserOpinions = async () => {
    try {
      setIsLoadingOpinions(true);
      const response = await fetch(`/api/opinioni/${utenteId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error('Errore nel caricamento delle opinioni');
      }
      
      const data = await response.json();
      
      if (data) {
        const filteredOpinions: Record<string, string> = {};
        questions.forEach(question => {
          if (data[question.id]) {
            filteredOpinions[question.id] = data[question.id];
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {nome && cognome ? `Le Opinioni di ${nome} ${cognome}` : "Opinioni Utente"}
          </DialogTitle>
          <DialogDescription>
            Visualizza le opinioni dell'utente su vari argomenti.
          </DialogDescription>
        </DialogHeader>
        {/* Avatar se disponibile */}
        {avatarConfig && (
          <div className="flex justify-center mb-4">
            <CustomAvatar config={JSON.parse(avatarConfig)} size={64} />
          </div>
        )}
        
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {isLoadingOpinions || isLoadingQuestions ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Caricamento opinioni...</span>
            </div>
          ) : Object.keys(opinions).length === 0 ? (
            <div className="text-center p-6 text-muted-foreground">
              Questo utente non ha ancora espresso opinioni.
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((question) => (
                <div key={question.id} className="border rounded-lg p-3 shadow-sm">
                  <h3 className="text-md font-semibold mb-2">{question.text}</h3>
                  {opinions[question.id] ? (
                    <div className={`rounded-md border px-3 py-2 ${responseColors[opinions[question.id] as keyof typeof responseColors] || 'bg-gray-100'}`}>
                      {opinions[question.id]}
                    </div>
                  ) : (
                    <div className="text-muted-foreground italic">Nessuna risposta</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex justify-end mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Chiudi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}