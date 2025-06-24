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

  // Funzione per categorizzare le opinioni come nel profilo
  const categorizeOpinions = (opinions: Record<string, string>) => {
    const opinionLabels: Record<string, string> = {
      energia_nucleare: "Energia Nucleare",
      sperimentazione_animale: "Sperimentazione Animale",
      legalizzazione_canapa: "Legalizzazione Canapa",
      caccia: "Caccia",
      unione_europea: "Unione Europea"
    };
    const favorevoli: string[] = [];
    const indecisi: string[] = [];
    const contrari: string[] = [];
    Object.entries(opinions).forEach(([key, value]) => {
      if (key in opinionLabels) {
        const label = opinionLabels[key];
        if (value === "Favorevole") favorevoli.push(label);
        else if (value === "Indeciso") indecisi.push(label);
        else if (value === "Contrario") contrari.push(label);
      }
    });
    return { favorevoli, indecisi, contrari };
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Colonna Favorevoli - Verde */}
              <div className="space-y-3">
                <div className="bg-green-100 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    Favorevole
                  </h3>
                  <div className="space-y-2">
                    {categorizeOpinions(opinions).favorevoli.length > 0 ? (
                      categorizeOpinions(opinions).favorevoli.map((opinion, index) => (
                        <div key={index} className="bg-green-50 border border-green-200 rounded-md p-3">
                          <span className="text-green-800 font-medium">{opinion}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-green-600 text-sm italic">
                        Nessuna opinione favorevole
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* Colonna Indecisi - Giallo */}
              <div className="space-y-3">
                <div className="bg-yellow-100 border border-yellow-200 rounded-lg p-4">
                  <h3 className="font-semibold text-yellow-800 mb-3 flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    Indeciso
                  </h3>
                  <div className="space-y-2">
                    {categorizeOpinions(opinions).indecisi.length > 0 ? (
                      categorizeOpinions(opinions).indecisi.map((opinion, index) => (
                        <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                          <span className="text-yellow-800 font-medium">{opinion}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-yellow-600 text-sm italic">
                        Nessuna opinione indecisa
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* Colonna Contrari - Rosso */}
              <div className="space-y-3">
                <div className="bg-red-100 border border-red-200 rounded-lg p-4">
                  <h3 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    Contrario
                  </h3>
                  <div className="space-y-2">
                    {categorizeOpinions(opinions).contrari.length > 0 ? (
                      categorizeOpinions(opinions).contrari.map((opinion, index) => (
                        <div key={index} className="bg-red-50 border border-red-200 rounded-md p-3">
                          <span className="text-red-800 font-medium">{opinion}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-red-600 text-sm italic">
                        Nessuna opinione contraria
                      </div>
                    )}
                  </div>
                </div>
              </div>
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