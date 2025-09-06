import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
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
  const [approfondimento, setApprofondimento] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  // Carica l'approfondimento esistente quando si apre il dialog
  useEffect(() => {
    if (open && opinione.id) {
      loadApprofondimento();
    }
  }, [open, opinione.id]);

  const loadApprofondimento = async () => {
    try {
      setIsLoading(true);
      const response = await apiRequest("GET", `/api/opinioni/${opinione.id}/approfondimento`);
      
      if (response.ok) {
        const data = await response.json();
        setApprofondimento(data.data.approfondimento || "");
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
      const response = await apiRequest("PUT", `/api/opinioni/${opinione.id}/approfondimento`, {
        approfondimento: approfondimento
      });
      
      if (response.ok) {
        toast({
          title: "Successo",
          description: "Approfondimento salvato con successo!",
          variant: "default",
        });
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Approfondimento: {opinione.text}</span>
            <span className="text-sm text-muted-foreground">({opinione.id})</span>
          </DialogTitle>
          <DialogDescription>
            Aggiungi informazioni dettagliate e approfondimenti per questa opinione. 
            Puoi utilizzare il formato Markdown per formattare il testo.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col">
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
                className="h-full overflow-y-auto p-4 border rounded-lg bg-gray-50 prose prose-sm max-w-none"
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
                className="h-full resize-none"
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
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
