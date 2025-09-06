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
  opinione: Opinione;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ApprofondimentoDialog: React.FC<ApprofondimentoDialogProps> = ({
  opinione,
  open,
  onOpenChange
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [approfondimento, setApprofondimento] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [gradiProposta, setGradiProposta] = useState({
    Europeo: false,
    Nazionale: false,
    Regionale: false,
    Comunale: false
  });

  // Carica l'approfondimento esistente quando si apre il dialog
  useEffect(() => {
    if (open && opinione.id) {
      // Inizializza i gradi dall'opinione corrente
      if (opinione.gradi_opinione && Array.isArray(opinione.gradi_opinione)) {
        const gradi = {
          Europeo: opinione.gradi_opinione.includes('Europeo'),
          Nazionale: opinione.gradi_opinione.includes('Nazionale'),
          Regionale: opinione.gradi_opinione.includes('Regionale'),
          Comunale: opinione.gradi_opinione.includes('Comunale')
        };
        setGradiProposta(gradi);
      }
      
      loadApprofondimento();
    }
  }, [open, opinione.id, opinione.gradi_opinione]);

  const loadApprofondimento = async () => {
    try {
      setIsLoading(true);
      const response = await apiRequest("GET", `/api/opinioni/${opinione.id}/approfondimento`);
      
      if (response.ok) {
        const data = await response.json();
        setApprofondimento(data.data.approfondimento || "");
        
        // Carica anche i gradi della proposta
        if (data.data.gradi_opinione && Array.isArray(data.data.gradi_opinione)) {
          const gradi = {
            Europeo: data.data.gradi_opinione.includes('Europeo'),
            Nazionale: data.data.gradi_opinione.includes('Nazionale'),
            Regionale: data.data.gradi_opinione.includes('Regionale'),
            Comunale: data.data.gradi_opinione.includes('Comunale')
          };
          setGradiProposta(gradi);
        }
      } else {
        console.error('Errore nel caricamento dell\'approfondimento');
        setApprofondimento("");
      }
    } catch (error) {
      console.error('Errore nel caricamento dell\'approfondimento:', error);
      setApprofondimento("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      // Prepara i gradi selezionati
      const gradiSelezionati = Object.entries(gradiProposta)
        .filter(([_, isSelected]) => isSelected)
        .map(([grado, _]) => grado);
      
      const response = await apiRequest("PUT", `/api/opinioni/${opinione.id}/approfondimento`, {
        approfondimento: approfondimento,
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
            <span>Approfondimento: {opinione.text}</span>
            <span className="text-sm text-muted-foreground">({opinione.id})</span>
          </DialogTitle>
          <DialogDescription>
            Aggiungi informazioni dettagliate e approfondimenti per questa opinione. 
            Puoi utilizzare il formato Markdown per formattare il testo.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col bg-white">
          {/* Sezione Gradi Proposta */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Gradi della Proposta</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(gradiProposta).map(([grado, isSelected]) => (
                <div key={grado} className="flex items-center space-x-2">
                  <Checkbox
                    id={`grado-${grado}`}
                    checked={isSelected}
                    onCheckedChange={(checked) => {
                      setGradiProposta(prev => ({
                        ...prev,
                        [grado]: checked as boolean
                      }));
                    }}
                  />
                  <label
                    htmlFor={`grado-${grado}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Proposta {grado}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              <Button
                variant={previewMode ? "outline" : "default"}
                size="sm"
                onClick={() => setPreviewMode(false)}
              >
                <span>Modifica</span>
              </Button>
              <Button
                variant={previewMode ? "default" : "outline"}
                size="sm"
                onClick={() => setPreviewMode(true)}
              >
                <Eye className="h-4 w-4 mr-2" />
                Anteprima
              </Button>
            </div>
            
            <div className="text-sm text-muted-foreground">
              {approfondimento.length} caratteri
            </div>
          </div>

          {/* Contenuto */}
          <div className="flex-1 overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Caricamento approfondimento...</span>
              </div>
            ) : previewMode ? (
              <div 
                className="h-full overflow-y-auto p-4 border rounded-lg bg-white prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ 
                  __html: approfondimento ? renderMarkdown(approfondimento) : '<p class="text-muted-foreground">Nessun contenuto da visualizzare</p>'
                }}
              />
            ) : (
              <Textarea
                value={approfondimento}
                onChange={(e) => setApprofondimento(e.target.value)}
                placeholder="Inserisci qui l'approfondimento per questa opinione...

Esempi di formattazione Markdown:
# Titolo principale
## Sottotitolo
### Sezione

**Testo in grassetto**
*Testo in corsivo*

- Punto elenco 1
- Punto elenco 2

Puoi aggiungere:
- Contesto storico
- Dati statistici
- Pro e contro
- Impatto sociale
- Riferimenti normativi"
                className="h-full resize-none bg-white"
              />
            )}
          </div>
        </div>

        {/* Footer */}
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
      </DialogContent>
    </Dialog>
  );
};
