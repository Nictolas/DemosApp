import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Save, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { Opinione } from "../types";

interface ApprofondimentoDialogProps {
  opinione?: Opinione;
  opinionId?: string;
  opinionText?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readOnly?: boolean;
}

export const ApprofondimentoDialog: React.FC<ApprofondimentoDialogProps> = ({
  opinione,
  opinionId,
  opinionText,
  open,
  onOpenChange,
  readOnly = false
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [approfondimento, setApprofondimento] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [customId, setCustomId] = useState(""); // ID personalizzato per nuove opinioni
  const [gradiProposta, setGradiProposta] = useState({
    Europeo: false,
    Nazionale: false,
    Regionale: false,
    Comunale: false
  });

  const [approfondimentiPerGrado, setApprofondimentiPerGrado] = useState({
    Europeo: '',
    Nazionale: '',
    Regionale: '',
    Comunale: ''
  });

  // Carica l'approfondimento esistente quando si apre il dialog
  useEffect(() => {
    if (open) {
      const currentOpinionId = opinionId || opinione?.id;
      if (currentOpinionId) {
        // Inizializza i gradi dall'opinione corrente (solo se non in modalità readOnly)
        if (!readOnly && opinione?.gradi_opinione && Array.isArray(opinione.gradi_opinione)) {
          const gradi = {
            Europeo: opinione.gradi_opinione.includes('E'),
            Nazionale: opinione.gradi_opinione.includes('N'),
            Regionale: opinione.gradi_opinione.includes('R'),
            Comunale: opinione.gradi_opinione.includes('CO')
          };
          setGradiProposta(gradi);
        }
        
        loadApprofondimento();
      }
    }
  }, [open, opinionId, opinione?.id, readOnly]);

  const loadApprofondimento = async () => {
    try {
      setIsLoading(true);
      const currentOpinionId = opinionId || opinione?.id;
      const response = await apiRequest("GET", `/api/opinioni/${currentOpinionId}/approfondimento`);
      
      if (response.ok) {
        const data = await response.json();
        
        // Carica i gradi della proposta
        if (data.data.gradi_opinione && Array.isArray(data.data.gradi_opinione)) {
          const gradi = {
            Europeo: data.data.gradi_opinione.includes('E'),
            Nazionale: data.data.gradi_opinione.includes('N'),
            Regionale: data.data.gradi_opinione.includes('R'),
            Comunale: data.data.gradi_opinione.includes('CO')
          };
          setGradiProposta(gradi);
        } else {
          // Se non ci sono gradi specifici, inizializza tutto a false
          setGradiProposta({
            Europeo: false,
            Nazionale: false,
            Regionale: false,
            Comunale: false
          });
        }
        
        // Separa l'approfondimento per grado se contiene sezioni
        const approfondimentoGenerale = data.data.approfondimento || "";
        let approfondimentiSeparati = {
          Europeo: '',
          Nazionale: '',
          Regionale: '',
          Comunale: ''
        };
        
        // Se l'approfondimento contiene sezioni con ## Proposta, separale
        if (approfondimentoGenerale.includes('## Proposta')) {
          const sezioni = approfondimentoGenerale.split('## Proposta');
          sezioni.forEach(sezione => {
            if (sezione.trim()) {
              const lines = sezione.trim().split('\n');
              const titolo = lines[0].trim();
              const contenuto = lines.slice(1).join('\n').trim();
              
              if (titolo.includes('Europeo')) {
                approfondimentiSeparati.Europeo = contenuto;
              } else if (titolo.includes('Nazionale')) {
                approfondimentiSeparati.Nazionale = contenuto;
              } else if (titolo.includes('Regionale')) {
                approfondimentiSeparati.Regionale = contenuto;
              } else if (titolo.includes('Comunale')) {
                approfondimentiSeparati.Comunale = contenuto;
              }
            }
          });
        } else {
          // Se non ci sono sezioni, metti l'approfondimento generale in tutti i gradi attivi
          const gradiAttivi = data.data.gradi_opinione || [];
          if (gradiAttivi.includes('E')) approfondimentiSeparati.Europeo = approfondimentoGenerale;
          if (gradiAttivi.includes('N')) approfondimentiSeparati.Nazionale = approfondimentoGenerale;
          if (gradiAttivi.includes('R')) approfondimentiSeparati.Regionale = approfondimentoGenerale;
          if (gradiAttivi.includes('CO')) approfondimentiSeparati.Comunale = approfondimentoGenerale;
        }
        
        setApprofondimentiPerGrado(approfondimentiSeparati);
        
        // Mantieni anche l'approfondimento generale per compatibilità
        setApprofondimento(approfondimentoGenerale);
      } else {
        console.error('Errore nel caricamento dell\'approfondimento');
        setApprofondimento("");
        setApprofondimentiPerGrado({
          Europeo: '',
          Nazionale: '',
          Regionale: '',
          Comunale: ''
        });
      }
    } catch (error) {
      console.error('Errore nel caricamento dell\'approfondimento:', error);
      setApprofondimento("");
      setApprofondimentiPerGrado({
        Europeo: '',
        Nazionale: '',
        Regionale: '',
        Comunale: ''
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (readOnly) return;
    
    try {
      setIsSaving(true);
      
      // Valida ID personalizzato per opinioni "da approvare"
      const isDaApprovare = opinione?.gradi_opinione?.includes('da approvare');
      if (isDaApprovare && !customId.trim()) {
        toast({
          title: "Errore",
          description: "Inserisci un ID personalizzato per l'opinione.",
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }
      
      // Prepara i gradi selezionati (conversione da nomi a codici)
      const gradoCodeMap = {
        'Europeo': 'E',
        'Nazionale': 'N',
        'Regionale': 'R',
        'Comunale': 'CO'
      };
      const gradiSelezionati = Object.entries(gradiProposta)
        .filter(([_, isSelected]) => isSelected)
        .map(([grado, _]) => gradoCodeMap[grado as keyof typeof gradoCodeMap]);
      
      if (gradiSelezionati.length === 0) {
        toast({
          title: "Errore",
          description: "Seleziona almeno un grado per l'opinione.",
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }
      
      // Combina tutti gli approfondimenti in un unico testo
      const approfondimentoCombinato = Object.entries(approfondimentiPerGrado)
        .filter(([grado, _]) => gradiProposta[grado as keyof typeof gradiProposta])
        .map(([grado, testo]) => `## Proposta ${grado}\n\n${testo}`)
        .join('\n\n');
      
      // Usa customId se presente, altrimenti usa l'ID corrente
      const currentOpinionId = (isDaApprovare && customId.trim()) ? customId.trim() : (opinionId || opinione?.id);
      const response = await apiRequest("PUT", `/api/opinioni/${currentOpinionId}/approfondimento`, {
        approfondimento: approfondimentoCombinato,
        gradi_opinione: gradiSelezionati
      });
      
      if (response.ok) {
        toast({
          title: "Successo",
          description: "Approfondimento salvato con successo!",
          variant: "default",
        });
        
        // Invalida la cache per aggiornare la lista delle opinioni
        queryClient.invalidateQueries({ queryKey: ['opinioni'] });
        
        onOpenChange(false);
      } else {
        const data = await response.json();
        throw new Error(data.message || 'Errore nel salvataggio');
      }
    } catch (error) {
      console.error('Errore nel salvataggio dell\'approfondimento:', error);
      toast({
        title: "Errore",
        description: "Impossibile salvare l'approfondimento. Riprova più tardi.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const renderMarkdown = (text: string) => {
    // Semplice renderer markdown per preview
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>')
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mt-4 mb-2">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>')
      .replace(/^\* (.*$)/gim, '<li class="ml-4">$1</li>')
      .replace(/^- (.*$)/gim, '<li class="ml-4">$1</li>');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col bg-white">
        <DialogHeader className="bg-white">
          <DialogTitle className="flex items-center gap-2">
            <span>Approfondimento: {opinionText || opinione?.text}</span>
            <span className="text-sm text-muted-foreground">({opinionId || opinione?.id})</span>
          </DialogTitle>
          <DialogDescription>
            {readOnly 
              ? "Visualizza le informazioni dettagliate e gli approfondimenti per questa opinione."
              : "Aggiungi informazioni dettagliate e approfondimenti per questa opinione. Puoi utilizzare il formato Markdown per formattare il testo."
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col bg-white">

          {/* Campo ID personalizzato - Solo per opinioni "da approvare" */}
          {!readOnly && opinione?.gradi_opinione?.includes('da approvare') && (
            <div className="space-y-2 mb-4">
              <label htmlFor="customId" className="text-sm font-medium">
                ID personalizzato per l'opinione (obbligatorio):
              </label>
              <input
                id="customId"
                type="text"
                value={customId}
                onChange={(e) => setCustomId(e.target.value)}
                placeholder="es. club_scolastici"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground">
                Questo ID verrà usato sia come riga in opinioni_domande che come colonna in opinioni_risposte
              </p>
            </div>
          )}

          {/* Contenuto - 4 Sezioni Separate */}
          <div className="flex-1 overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Caricamento approfondimento...</span>
              </div>
            ) : (
              <div className="h-full overflow-y-auto space-y-6">
                {(() => {
                  const gradiAttivi = Object.entries(approfondimentiPerGrado)
                    .filter(([grado, _]) => {
                      // In modalità readOnly, mostra solo i gradi spuntati
                      if (readOnly) {
                        return gradiProposta[grado as keyof typeof gradiProposta];
                      }
                      // In modalità admin, mostra tutti i gradi
                      return true;
                    });

                  // Se in modalità readOnly e non ci sono gradi attivi, mostra un messaggio
                  if (readOnly && gradiAttivi.length === 0) {
                    return (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>Nessun approfondimento disponibile per questa opinione.</p>
                      </div>
                    );
                  }

                  return gradiAttivi.map(([grado, testo]) => {
                    // Mappa delle emoji per ogni grado
                    const emojiMap = {
                      'Europeo': '🌍',
                      'Nazionale': '🏛️',
                      'Regionale': '🗺️',
                      'Comunale': '🏠'
                    };

                    return (
                      <div key={grado} className="space-y-3">
                        {readOnly ? (
                          // Modalità readOnly: mostra solo emoji e contenuto
                          <div className="flex items-start space-x-3">
                            <span className="text-2xl mt-1">{emojiMap[grado as keyof typeof emojiMap]}</span>
                            <div className="flex-1">
                              <div className="bg-gray-50 p-4 rounded-lg border">
                                <div className="whitespace-pre-wrap text-gray-900">
                                  {testo || 'Nessun contenuto disponibile.'}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          // Modalità admin: mostra checkbox e controlli
                          <>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`grado-${grado}`}
                                checked={gradiProposta[grado as keyof typeof gradiProposta]}
                                onCheckedChange={(checked) => {
                                  setGradiProposta(prev => ({
                                    ...prev,
                                    [grado]: checked as boolean
                                  }));
                                }}
                              />
                              <label
                                htmlFor={`grado-${grado}`}
                                className="text-lg font-semibold text-gray-900"
                              >
                                Proposta {grado}
                              </label>
                            </div>
                            <Textarea
                              value={testo}
                              onChange={(e) => {
                                setApprofondimentiPerGrado(prev => ({
                                  ...prev,
                                  [grado]: e.target.value
                                }));
                              }}
                              placeholder={`Inserisci qui l'approfondimento per la Proposta ${grado}...

Esempi di formattazione Markdown:
# Titolo principale
## Sottotitolo
### Sezione

**Testo in grassetto**
*Testo in corsivo*

- Punto elenco 1
- Punto elenco 2

Puoi aggiungere:
- Contesto specifico per ${grado}
- Dati statistici
- Pro e contro
- Impatto sociale
- Riferimenti normativi`}
                              className="min-h-[200px] resize-none bg-white"
                              disabled={!gradiProposta[grado as keyof typeof gradiProposta]}
                            />
                          </>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {!readOnly && (
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t bg-white">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={isSaving || isLoading}
              className="min-w-[120px]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Salvataggio...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salva
                </>
              )}
            </Button>
          </div>
        )}
        
        {readOnly && (
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t bg-white">
            <Button onClick={() => onOpenChange(false)} className="min-w-[120px]">
              Chiudi
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
