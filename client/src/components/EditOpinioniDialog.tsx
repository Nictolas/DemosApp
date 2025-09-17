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
  { 
    value: "Favorevole", 
    color: "bg-green-100 border-green-500 hover:bg-green-200",
    selectedColor: "bg-green-600 border-green-700 text-white"
  },
  { 
    value: "Indeciso", 
    color: "bg-white border-yellow-500 hover:bg-yellow-50",
    selectedColor: "bg-yellow-400 border-yellow-600 text-black"
  },
  { 
    value: "Contrario", 
    color: "bg-red-100 border-red-500 hover:bg-red-200",
    selectedColor: "bg-red-600 border-red-700 text-white"
  }
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
        const response = await apiRequest("GET", "/api/opinioni/profile");
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
    if (open && utenteId) {
      if (questions.length > 0) {
        loadUserOpinions();
        loadFonti();
      } else {
        // Se non ci sono domande, carica comunque le opinioni dell'utente
        loadUserOpinions();
        loadFonti();
      }
    }
    // eslint-disable-next-line
  }, [open, utenteId, questions]);

  const loadUserOpinions = async () => {
    try {
      setIsLoadingOpinions(true);
      const response = await apiRequest("GET", `/api/users/${utenteId}/opinioni`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 DEBUG - Dati opinioni utente ricevuti:', data);
        
        if (data.success && data.data && data.data.opinioni) {
          // Converte le opinioni nel formato atteso
          const opinioniMap: Record<string, string> = {};
          data.data.opinioni.forEach((opinion: any) => {
            console.log('🔍 DEBUG - Processando opinione:', opinion);
            if (opinion.userAnswer && opinion.userAnswer !== 'Astenuto') {
              // Usa l'ID dell'opinione direttamente (senza prefisso del grado)
              const questionId = opinion.text.replace(/\s+/g, '_');
              opinioniMap[questionId] = opinion.userAnswer;
              console.log('🔍 DEBUG - Mappatura creata:', { questionId, userAnswer: opinion.userAnswer });
            }
          });
          console.log('🔍 DEBUG - Mappa opinioni creata:', opinioniMap);
          setOpinions(opinioniMap);
        } else {
          console.log('⚠️ Nessuna opinione trovata nei dati ricevuti');
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
        console.log('🔍 DEBUG - Dati fonti ricevuti:', data);
        
        if (data.success && data.data && data.data.fonti) {
          console.log('🔍 DEBUG - Fonti caricate:', data.data.fonti);
          console.log('🔍 DEBUG - Tipo fonti:', typeof data.data.fonti);
          console.log('🔍 DEBUG - Chiavi fonti:', Object.keys(data.data.fonti));
          
          // Mappa le fonti nel formato delle domande
          const fontiMap: Record<string, string> = {};
          if (data.data.opinioni) {
            data.data.opinioni.forEach((opinion: any) => {
              const questionId = opinion.text.replace(/\s+/g, '_');
              console.log('🔍 DEBUG - Cercando fonte per questionId:', questionId);
              console.log('🔍 DEBUG - Opinion ID:', opinion.id);
              console.log('🔍 DEBUG - Fonte disponibile per ID:', data.data.fonti[opinion.id]);
              console.log('🔍 DEBUG - Fonte disponibile per questionId:', data.data.fonti[questionId]);
              
              // Prova prima con l'ID dell'opinione, poi con questionId
              let fonte = data.data.fonti[opinion.id] || data.data.fonti[questionId];
              if (fonte) {
                fontiMap[questionId] = fonte;
                console.log('🔍 DEBUG - Fonte mappata:', { questionId, fonte });
              }
            });
          }
          
          console.log('🔍 DEBUG - Mappa fonti creata:', fontiMap);
          setFonti(fontiMap);
        } else {
          console.log('⚠️ Nessuna fonte trovata nei dati ricevuti');
          setFonti({});
        }
      } else {
        console.log('⚠️ Errore nel caricamento delle fonti');
        setFonti({});
      }
    } catch (error) {
      console.error('Errore nel caricamento delle fonti:', error);
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
      
      // Converti le opinioni dal formato domande al formato database
      const opinioniPerDatabase: Record<string, string> = {};
      const fontiPerDatabase: Record<string, string> = {};
      
      // Mappa delle opinioni per convertire gli ID
      const opinionMapping: Record<string, string> = {
        'energia_nucleare': 'energia_nucleare',
        'sperimentazione_animale': 'sperimentazione_animale',
        'legalizzazione_canapa': 'legalizzazione_canapa',
        'caccia': 'caccia',
        'eutanasia': 'eutanasia',
        'carne_coltivata': 'carne_coltivata',
        'cittadina_animale': 'cittadina_animale',
        'nato': 'nato',
        'matrimonio_gay': 'matrimonio_gay',
        'salario_minimo': 'salario_minimo',
        'case_chiuse': 'case_chiuse',
        'omobitransfobia': 'omobitransfobia',
        'cassonetti_intelligenti_con_tessera': 'cassonetti_intelligenti_con_tessera',
        'concessione_spazi_pubblici_a_centri_sociali_autogestiti': 'concessione_spazi_pubblici_a_centri_sociali_autogestiti',
        'divieto_di_nuovi_fast_food_nel_centro_storico': 'divieto_di_nuovi_fast_food_nel_centro_storico',
        'estensione_delle_zone_a_traffico_limitato': 'estensione_delle_zone_a_traffico_limitato',
        'finanziamento_eventi_culturali_gratuiti': 'finanziamento_eventi_culturali_gratuiti',
        'nuova_biblioteca_comunale': 'nuova_biblioteca_comunale',
        'nuove_case_popolari': 'nuove_case_popolari',
        'nuove_piste_ciclabili': 'nuove_piste_ciclabili',
        'nuovi_asili_nido_comunali': 'nuovi_asili_nido_comunali',
        'nuovo_stadio_comunale': 'nuovo_stadio_comunale',
        'parcheggi_gratuiti_per_residenti': 'parcheggi_gratuiti_per_residenti',
        'potenziamento_trasporto_pubblico': 'potenziamento_trasporto_pubblico',
        'riduzione_tasse_rifiuti': 'riduzione_tasse_rifiuti',
        'sicurezza_strade_scolastiche': 'sicurezza_strade_scolastiche',
        'sostegno_commercio_locale': 'sostegno_commercio_locale',
        'verde_pubblico_e_giardini': 'verde_pubblico_e_giardini',
        'nuovi_inceneritori': 'nuovi_inceneritori',
        'chiusura_ospedali_di_provincia': 'chiusura_ospedali_di_provincia',
        'raccolta_rifiuti_porta_a_porta': 'raccolta_rifiuti_porta_a_porta',
        'riduzione_dell_illuminazione_notturna_per_risparmio_energetico': 'riduzione_dell_illuminazione_notturna_per_risparmio_energetico',
        'sussidi_comunali_per_famiglie_numerose': 'sussidi_comunali_per_famiglie_numerose',
        'videosorveglianza_in_spazi_pubblici': 'videosorveglianza_in_spazi_pubblici',
        'riduzione_parcheggi_a_pagamento': 'riduzione_parcheggi_a_pagamento'
      };
      
      // Converti le opinioni
      Object.entries(opinions).forEach(([questionId, answer]) => {
        // L'ID della domanda è già nel formato corretto (senza prefisso del grado)
        const dbField = opinionMapping[questionId];
        if (dbField) {
          // Converti le risposte al formato database
          let dbAnswer = answer;
          if (answer === 'Favorevole') dbAnswer = 'Sì';
          else if (answer === 'Contrario') dbAnswer = 'No';
          else if (answer === 'Indeciso') dbAnswer = 'Indeciso';
          
          opinioniPerDatabase[dbField] = dbAnswer;
        }
      });
      
      // Converti le fonti
      Object.entries(fonti).forEach(([questionId, fonte]) => {
        const dbField = opinionMapping[questionId];
        if (dbField && fonte) {
          fontiPerDatabase[dbField] = fonte;
        }
      });
      
      console.log('🔍 DEBUG - Opinion per database:', opinioniPerDatabase);
      console.log('🔍 DEBUG - Fonti per database:', fontiPerDatabase);
      
      const response = await apiRequest("PUT", `/api/users/${utenteId}/opinioni`, {
        opinioni: opinioniPerDatabase,
        fonti: fontiPerDatabase
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
                        const selected = opinions[key] === option.value;
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
