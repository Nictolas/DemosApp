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
import { vibrateShort } from "@/utils/vibration";



// Le domande ora sono dinamiche
const options = [
  { 
    value: "f", 
    color: "bg-green-100 border-green-500 hover:bg-green-200",
    selectedColor: "bg-green-600 border-green-700 text-white",
    label: "Favorevole"
  },
  { 
    value: "i", 
    color: "bg-yellow-200 border-yellow-500 hover:bg-yellow-300",
    selectedColor: "bg-yellow-400 border-yellow-600 text-black",
    label: "Indeciso"
  },
  { 
    value: "c", 
    color: "bg-red-100 border-red-500 hover:bg-red-200",
    selectedColor: "bg-red-600 border-red-700 text-white",
    label: "Contrario"
  }
];

// Funzione per normalizzare le risposte (usa direttamente i valori compressi)
const normalizeAnswer = (answer: string | undefined) => {
  if (!answer || answer === null || answer === undefined) return null;
  // Usa direttamente i valori compressi
  if (answer === 'f' || answer === 'c' || answer === 'i') return answer;
  return null;
};

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

  // Carica le domande e le opinioni dell'utente insieme quando il dialog si apre
  useEffect(() => {
    if (open && utenteId) {
      loadUserOpinionsAndQuestions();
    }
    // eslint-disable-next-line
  }, [open, utenteId]);

  const loadUserOpinionsAndQuestions = async () => {
    try {
      setIsLoadingOpinions(true);
      setIsLoadingQuestions(true);
      // apiRequest restituisce già il JSON parsato, non un Response
      const data = await apiRequest("GET", `/api/users/${utenteId}/opinioni`);
      console.log('🔍 DEBUG - Dati opinioni utente ricevuti:', data);
      
      if (data.success && data.data && data.data.opinioni) {
        // Filtra le opinioni escludendo quelle con "da approvare" in gradi_opinione
        const validOpinions = data.data.opinioni.filter((opinion: any) => {
          const gradi = opinion.grado || opinion.gradi_opinione || [];
          return Array.isArray(gradi) && !gradi.includes('da approvare');
        });
        
        console.log('🔍 DEBUG - Opinion totali:', data.data.opinioni.length);
        console.log('🔍 DEBUG - Opinion valide (senza "da approvare"):', validOpinions.length);
        
        // Estrai le domande dalle opinioni valide
        const questionsList = validOpinions.map((opinion: any) => ({
          id: opinion.id,
          text: opinion.text
        }));
        setQuestions(questionsList);
        console.log('🔍 DEBUG - Domande caricate:', questionsList.length);
        
        // Converte le opinioni nel formato atteso (solo quelle valide)
        const opinioniMap: Record<string, string> = {};
        validOpinions.forEach((opinion: any) => {
          console.log('🔍 DEBUG - Processando opinione:', opinion);
          // Usa sempre l'ID reale dell'opinione (ora sempre presente)
          if (!opinion.id) {
            console.warn('⚠️ Opinione senza ID:', opinion);
            return;
          }
          
          const questionId = opinion.id;
          
          // Includi tutte le opinioni con risposta
          if (opinion.userAnswer) {
            // Mantieni i valori compressi ('f', 'c', 'i') come si aspetta normalizeAnswer
            // Converti solo i valori legacy se presenti
            let answer = opinion.userAnswer;
            if (answer === 'Favorevole' || answer === 'Sì') answer = 'f';
            else if (answer === 'Contrario' || answer === 'No') answer = 'c';
            else if (answer === 'Indeciso') answer = 'i';
            // Se è già 'f', 'c', 'i' o null, mantienilo così
            
            opinioniMap[questionId] = answer;
            console.log('🔍 DEBUG - Mappatura creata:', { 
              questionId, 
              userAnswer: answer, 
              originalAnswer: opinion.userAnswer,
              text: opinion.text 
            });
          }
        });
        console.log('🔍 DEBUG - Mappa opinioni creata:', opinioniMap);
        console.log('🔍 DEBUG - Chiavi nella mappa opinioni:', Object.keys(opinioniMap));
        setOpinions(opinioniMap);
        
        // Carica anche le fonti dai dati già ricevuti (solo per opinioni valide)
        if (data.data.fonti) {
          console.log('🔍 DEBUG - Fonti caricate:', data.data.fonti);
          console.log('🔍 DEBUG - Tipo fonti:', typeof data.data.fonti);
          console.log('🔍 DEBUG - Chiavi fonti:', Object.keys(data.data.fonti));
          
          // Mappa le fonti usando gli ID reali delle opinioni (solo quelle valide)
          const fontiMap: Record<string, string> = {};
          validOpinions.forEach((opinion: any) => {
            // Usa sempre l'ID reale dell'opinione
            if (!opinion.id) {
              console.warn('⚠️ Opinione senza ID per fonte:', opinion);
              return;
            }
            
            const questionId = opinion.id;
            // Le fonti sono già mappate per ID nell'oggetto fonti
            const fonte = data.data.fonti[questionId];
            if (fonte && fonte !== 'unknown') {
              fontiMap[questionId] = fonte;
              console.log('🔍 DEBUG - Fonte mappata:', { questionId, fonte });
            }
          });
          
          console.log('🔍 DEBUG - Mappa fonti creata:', fontiMap);
          setFonti(fontiMap);
        } else {
          console.log('⚠️ Nessuna fonte trovata nei dati ricevuti');
          setFonti({});
        }
      } else {
        console.log('⚠️ Nessuna opinione trovata nei dati ricevuti');
        setQuestions([]);
        setFonti({});
      }
    } catch (error) {
      console.error('Errore nel caricamento delle opinioni:', error);
      toast({
        title: "Errore",
        description: "Non è stato possibile caricare le opinioni dell'utente.",
        variant: "destructive",
      });
      setQuestions([]);
    } finally {
      setIsLoadingOpinions(false);
      setIsLoadingQuestions(false);
    }
  };



  const handleOpinionChange = (questionId: string, value: string) => {
    // Vibrazione quando si cambia opinione
    vibrateShort();
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
      
      // Converti le opinioni - usa direttamente gli ID reali (non serve più mapping)
      const opinioniPerDatabase: Record<string, string> = {};
      const fontiPerDatabase: Record<string, string> = {};
      
      // Converti le opinioni - gli ID sono già quelli reali dalla tabella opinioni_domande
      Object.entries(opinions).forEach(([questionId, answer]) => {
        // Converti le risposte al formato database se necessario
        let dbAnswer = answer;
        if (answer === 'Favorevole') dbAnswer = 'f';
        else if (answer === 'Contrario') dbAnswer = 'c';
        else if (answer === 'Indeciso') dbAnswer = 'i';
        // Se è già 'f', 'c', 'i' o null, mantienilo così
        
        opinioniPerDatabase[questionId] = dbAnswer;
        console.log(`✅ Mappata opinione: ${questionId} = ${dbAnswer}`);
      });
      
      // Converti le fonti - usa direttamente gli ID reali
      Object.entries(fonti).forEach(([questionId, fonte]) => {
        if (fonte && fonte.trim() !== '') {
          fontiPerDatabase[questionId] = fonte;
          console.log(`✅ Mappata fonte: ${questionId} = ${fonte}`);
        }
      });
      
      console.log('🔍 DEBUG - Opinion per database:', opinioniPerDatabase);
      console.log('🔍 DEBUG - Fonti per database:', fontiPerDatabase);
      
      const response = await apiRequest("PUT", `/api/users/${utenteId}/opinioni`, {
        opinioni: opinioniPerDatabase,
        fonti: fontiPerDatabase
      });
      
      if (response && response.success) {
        toast({
          title: "Successo",
          description: "Le opinioni e le fonti dell'utente sono state aggiornate con successo.",
          variant: "default",
        });
        onOpinioniUpdated();
        onOpenChange(false);
      } else {
        throw new Error(response?.error || 'Errore nel salvataggio');
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-white">
        <DialogHeader className="bg-white">
          <DialogTitle>Modifica Opinioni Utente</DialogTitle>
          <DialogDescription>
            Modifica le opinioni dell'utente. Le modifiche saranno salvate solo quando fai clic su "Salva".
          </DialogDescription>
        </DialogHeader>
        
        <div className="max-h-[60vh] overflow-y-auto pr-1 bg-white">
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
                  <div key={key} className="border rounded-lg p-4 shadow-sm bg-white">
                    <h3 className="text-lg font-semibold mb-2">{label}</h3>
                    <div className="flex gap-2 mb-2">
                      {options.map((option) => {
                        const selected = normalizeAnswer(opinions[key]) === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleOpinionChange(key, option.value)}
                            className={
                              "px-4 py-2 rounded-full border-2 font-semibold transition " +
                              (selected ? option.selectedColor : option.color) +
                              (selected ? " ring-2 ring-offset-2 " : " ")
                            }
                            style={{
                              borderColor: selected ? "#000" : undefined,
                            }}
                          >
                            {option.label}
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
        
        <div className="flex justify-end space-x-2 mt-4 bg-white">
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
