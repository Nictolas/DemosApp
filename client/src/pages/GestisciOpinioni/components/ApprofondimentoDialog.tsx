import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { Opinione } from "../types";
import { sanitizeRichHtml } from "@/lib/sanitize-html";
import { addCountryFlagsToMarkdown } from "@/lib/countryFlagsMarkdown";
import { getOpinionBrief } from "@/lib/opinionBriefs";
import { OpinionBriefCard } from "@/components/OpinionBriefCard";

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
  readOnly = true
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [approfondimento, setApprofondimento] = useState("");
  const brief = getOpinionBrief(opinionId || opinione?.id);
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
  
  const [descrizioneAbilitata, setDescrizioneAbilitata] = useState(false);
  const [descrizione, setDescrizione] = useState('');

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
      
      // Se non c'è ID, non carico nulla
      if (!currentOpinionId) {
        console.log('⚠️ DEBUG loadApprofondimento - Nessun ID disponibile');
        setIsLoading(false);
        return;
      }
      
      console.log('🔍 DEBUG loadApprofondimento - Caricamento per ID:', currentOpinionId);
      
      try {
        const response = await apiRequest("GET", `/api/opinioni/${currentOpinionId}/approfondimento`);

        // Normalizza il payload indipendentemente dalla forma restituita da apiRequest
        // Possibili forme:
        // - { success, data: {...} }
        // - { ok, data: { success, data: {...} } }
        const raw = (response as any)?.data ?? response;
        const payload = (raw && raw.data && raw.success !== undefined) ? raw.data : raw;

        console.log('🔍 DEBUG loadApprofondimento - payload approfondimento:', payload);
        
        if (payload) {
        // Carica i gradi della proposta
        if (payload.gradi_opinione && Array.isArray(payload.gradi_opinione)) {
          const gradi = {
            Europeo: payload.gradi_opinione.includes('E'),
            Nazionale: payload.gradi_opinione.includes('N'),
            Regionale: payload.gradi_opinione.includes('R'),
            Comunale: payload.gradi_opinione.includes('CO')
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
        const approfondimentoGenerale = payload.approfondimento || "";
        let approfondimentiSeparati = {
          Europeo: '',
          Nazionale: '',
          Regionale: '',
          Comunale: ''
        };
        
        let descrizioneTesto = '';
        let descrizioneAbilitataFlag = false;
        
        // Se l'approfondimento contiene sezioni con ## Proposta, separale
        if (approfondimentoGenerale.includes('## Proposta')) {
          const sezioni = approfondimentoGenerale.split('## Proposta');
          
          // La prima sezione (prima di "## Proposta") è la descrizione
          if (sezioni[0] && sezioni[0].trim()) {
            descrizioneTesto = sezioni[0].trim();
            descrizioneAbilitataFlag = descrizioneTesto.length > 0;
          }
          
          // Le altre sezioni sono per grado
          sezioni.slice(1).forEach(sezione => {
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
          // Se non ci sono sezioni, tutto il testo è la descrizione
          if (approfondimentoGenerale.trim()) {
            descrizioneTesto = approfondimentoGenerale.trim();
            descrizioneAbilitataFlag = true;
          }
        }
        
        setDescrizione(descrizioneTesto);
        setDescrizioneAbilitata(descrizioneAbilitataFlag);
        setApprofondimentiPerGrado(approfondimentiSeparati);
        
          // Mantieni anche l'approfondimento generale per compatibilità
        setApprofondimento(approfondimentoGenerale);
        } else {
          console.log('⚠️ DEBUG loadApprofondimento - Nessun dato nella risposta, inizializzo vuoto');
          setApprofondimento("");
          setDescrizione('');
          setDescrizioneAbilitata(false);
          setApprofondimentiPerGrado({
            Europeo: '',
            Nazionale: '',
            Regionale: '',
            Comunale: ''
          });
        }
      } catch (error: any) {
        // Se l'opinione non è stata trovata (404), è normale per opinioni "da approvare" nuove
        // Inizializza i dati vuoti e permette comunque il salvataggio
        if (error.message && error.message.includes('Opinione non trovata')) {
          console.log('⚠️ DEBUG loadApprofondimento - Opinione non trovata (404), inizializzo vuoto per nuova opinione');
          setApprofondimento("");
          setDescrizione('');
          setDescrizioneAbilitata(false);
          setApprofondimentiPerGrado({
            Europeo: '',
            Nazionale: '',
            Regionale: '',
            Comunale: ''
          });
          // Per opinioni "da approvare", inizializza i gradi dall'opinione se disponibile
          if (opinione?.gradi_opinione && Array.isArray(opinione.gradi_opinione)) {
            const gradi = {
              Europeo: opinione.gradi_opinione.includes('E'),
              Nazionale: opinione.gradi_opinione.includes('N'),
              Regionale: opinione.gradi_opinione.includes('R'),
              Comunale: opinione.gradi_opinione.includes('CO')
            };
            setGradiProposta(gradi);
          }
        } else {
          console.error('❌ Errore nel caricamento dell\'approfondimento:', error);
          setApprofondimento("");
          setDescrizione('');
          setDescrizioneAbilitata(false);
          setApprofondimentiPerGrado({
            Europeo: '',
            Nazionale: '',
            Regionale: '',
            Comunale: ''
          });
        }
      }
    } catch (error) {
      console.error('❌ Errore generale nel caricamento:', error);
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

  const handleSave = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    console.log('🔍 DEBUG handleSave - Inizio');
    
    if (readOnly) {
      console.log('⚠️ DEBUG handleSave - ReadOnly, esco');
      return;
    }
    
    try {
      setIsSaving(true);
      console.log('🔍 DEBUG handleSave - setIsSaving(true)');
      
      // Valida ID personalizzato per opinioni "da approvare"
      const isDaApprovare = opinione?.gradi_opinione?.includes('da approvare');
      console.log('🔍 DEBUG handleSave - isDaApprovare:', isDaApprovare, 'customId:', customId);
      
      if (isDaApprovare && !customId.trim()) {
        console.log('⚠️ DEBUG handleSave - ID personalizzato mancante');
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
      
      console.log('🔍 DEBUG handleSave - gradiProposta:', gradiProposta);
      console.log('🔍 DEBUG handleSave - gradiSelezionati:', gradiSelezionati);
      
      if (gradiSelezionati.length === 0) {
        console.log('⚠️ DEBUG handleSave - Nessun grado selezionato');
        toast({
          title: "Errore",
          description: "Seleziona almeno un grado per l'opinione.",
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }
      
      // Combina descrizione e approfondimenti in un unico testo
      let approfondimentoCombinato = '';
      
      // Aggiungi la descrizione se abilitata e con contenuto
      if (descrizioneAbilitata && descrizione.trim()) {
        approfondimentoCombinato = descrizione.trim();
      }
      
      // Aggiungi gli approfondimenti per grado
      const approfondimentiGrado = Object.entries(approfondimentiPerGrado)
        .filter(([grado, _]) => gradiProposta[grado as keyof typeof gradiProposta])
        .map(([grado, testo]) => `## Proposta ${grado}\n\n${testo}`)
        .join('\n\n');
      
      // Combina descrizione e approfondimenti per grado
      if (approfondimentoCombinato && approfondimentiGrado) {
        approfondimentoCombinato = `${approfondimentoCombinato}\n\n${approfondimentiGrado}`;
      } else if (approfondimentiGrado) {
        approfondimentoCombinato = approfondimentiGrado;
      }
      
      // Per opinioni "da approvare", invia l'ID vecchio nell'URL e il nuovo ID nel body
      const urlOpinionId = isDaApprovare ? (opinionId || opinione?.id) : (opinionId || opinione?.id);
      const body = {
        approfondimento: approfondimentoCombinato,
        gradi_opinione: gradiSelezionati,
        ...(isDaApprovare && customId.trim() && { customId: customId.trim() })
      };
      
      console.log('🔍 DEBUG handleSave - URL ID:', urlOpinionId);
      console.log('🔍 DEBUG handleSave - Body:', body);
      console.log('🔍 DEBUG handleSave - Invio richiesta API...');
      
      const data = await apiRequest("PUT", `/api/opinioni/${urlOpinionId}/approfondimento`, body);
      
      console.log('🔍 DEBUG handleSave - Risposta ricevuta:', data);
      
      // apiRequest ritorna già i dati parsati, quindi controlliamo se la risposta è valida
      if (data && (data.success !== false)) {
        toast({
          title: "Successo",
          description: "Approfondimento salvato con successo!",
          variant: "default",
        });
        
        // Invalida la cache per aggiornare la lista delle opinioni
        queryClient.invalidateQueries({ queryKey: ['opinioni'] });
        
        onOpenChange(false);
      } else {
        throw new Error(data.message || data.error || 'Errore nel salvataggio');
      }
    } catch (error) {
      console.error('Errore nel salvataggio dell\'approfondimento:', error);
      const errorMessage = error instanceof Error ? error.message : 'Impossibile salvare l\'approfondimento. Riprova più tardi.';
      toast({
        title: "Errore",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const renderMarkdown = (text: string) => {
    return text
      // Link stile pulsante
      .replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer" class="inline-flex items-center px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 no-underline">$1</a>'
      )
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="!fixed !inset-0 !left-0 !top-0 !flex !h-[100dvh] !max-h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 !flex-col !gap-0 !overflow-hidden !rounded-none !border-0 !bg-white !p-0 [&>button]:top-[calc(env(safe-area-inset-top)+1rem)]">
        <DialogHeader className="shrink-0 border-b bg-white px-4 pb-3 pr-14 pt-[calc(env(safe-area-inset-top)+1rem)] sm:px-6 sm:pr-14">
          <DialogTitle className="flex min-w-0 flex-wrap items-center gap-2 break-words text-base !leading-snug sm:text-lg">
            <span>Approfondimento: {opinionText || opinione?.text}</span>
            {!readOnly && (
              <span className="text-sm text-muted-foreground">
                ({opinionId || opinione?.id})
              </span>
            )}
          </DialogTitle>
          <DialogDescription className={readOnly ? "sr-only" : undefined}>
            {readOnly 
              ? "Visualizza le informazioni dettagliate e gli approfondimenti per questa opinione."
              : "Aggiungi informazioni dettagliate e approfondimenti per questa opinione. Puoi utilizzare il formato Markdown per formattare il testo."
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">

          {/* Campo ID personalizzato - Solo per opinioni "da approvare" (solo admin) */}
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

          {/* Contenuto */}
          <div className="min-h-0 flex-1 overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Caricamento approfondimento...</span>
              </div>
            ) : readOnly ? (
              <div className="h-full overflow-y-auto overscroll-contain px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:px-6 [-webkit-overflow-scrolling:touch]">
                {brief ? (
                  <OpinionBriefCard brief={brief} />
                ) : approfondimento && approfondimento.trim() ? (
                  <div className="prose max-w-none break-words text-gray-900"
                    dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(renderMarkdown(addCountryFlagsToMarkdown(approfondimento))) }}
                  />
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Nessun approfondimento disponibile per questa opinione.</p>
                  </div>
                )}
              </div>
            ) : (
              // Modalità admin: UI completa con descrizione e sezioni per grado
              <div className="h-full overflow-y-auto overscroll-contain space-y-6 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:px-6 [-webkit-overflow-scrolling:touch]">
                {(() => {
                  // Sezione Descrizione
                  const descrizioneSection = (
                    <div key="descrizione" className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="descrizione-checkbox"
                          checked={descrizioneAbilitata}
                          onCheckedChange={(checked) => {
                            setDescrizioneAbilitata(checked as boolean);
                            if (!checked) {
                              setDescrizione('');
                            }
                          }}
                        />
                        <label
                          htmlFor="descrizione-checkbox"
                          className="text-lg font-semibold text-gray-900"
                        >
                          Descrizione
                        </label>
                      </div>
                      <Textarea
                        value={descrizione}
                        onChange={(e) => {
                          setDescrizione(e.target.value);
                          if (e.target.value.trim()) {
                            setDescrizioneAbilitata(true);
                          }
                        }}
                        placeholder={`Inserisci qui la descrizione generale dell'opinione...

Esempi di formattazione Markdown:
# Titolo principale
## Sottotitolo
### Sezione

**Testo in grassetto**
*Testo in corsivo*

- Punto elenco 1
- Punto elenco 2

Puoi aggiungere:
- Contesto generale
- Dati statistici
- Pro e contro
- Impatto sociale
- Riferimenti normativi`}
                        className="min-h-[200px] resize-none bg-white"
                        disabled={!descrizioneAbilitata}
                      />
                    </div>
                  );

                  const gradiSections = Object.entries(approfondimentiPerGrado).map(([grado, testo]) => (
                    <div key={grado} className="space-y-3">
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
                    </div>
                  ));

                  return (
                    <>
                      {descrizioneSection}
                      {gradiSections}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {!readOnly && (
          <div className="flex shrink-0 justify-end gap-2 border-t bg-white px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:px-6">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button 
              type="button"
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
          <div className="flex shrink-0 justify-end gap-2 border-t bg-white px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:px-6">
            <Button onClick={() => onOpenChange(false)} className="min-w-[120px]">
              Chiudi
            </Button>
          </div>
        )}
      </DialogContent>
      </Dialog>


    </>
  );
};
