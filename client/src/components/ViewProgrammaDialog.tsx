import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, AlertCircle } from "lucide-react";
import { CustomAvatar } from "@/components/CustomAvatar";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";

interface ViewProgrammaDialogProps {
  utenteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nome?: string;
  cognome?: string;
  avatarConfig?: string;
}

export function ViewProgrammaDialog({ utenteId, open, onOpenChange, nome, cognome, avatarConfig }: ViewProgrammaDialogProps) {
  const [proposte, setProposte] = useState<{proposta: string, url: string}[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !utenteId) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setProposte([]);
    const fetchProgramma = async () => {
      try {
        const response = await apiRequest("GET", `/api/programma/${utenteId}`);
        
        if (response.ok && response.data?.success && response.data.data) {
          const newProposte = [
            {proposta: response.data.data.proposta1 || "", url: response.data.data.url1 || ""},
            {proposta: response.data.data.proposta2 || "", url: response.data.data.url2 || ""},
            {proposta: response.data.data.proposta3 || "", url: response.data.data.url3 || ""},
            {proposta: response.data.data.proposta4 || "", url: response.data.data.url4 || ""},
            {proposta: response.data.data.proposta5 || "", url: response.data.data.url5 || ""},
          ];
          setProposte(newProposte);
          setError(null);
        } else {
          // Programma non trovato - non è un errore, semplicemente non c'è programma
          setProposte([
            {proposta: "", url: ""},
            {proposta: "", url: ""},
            {proposta: "", url: ""},
            {proposta: "", url: ""},
            {proposta: "", url: ""}
          ]);
          setError(null);
        }
      } catch (e: any) {
        // Gestisci errori 404 come "programma non trovato" invece di errore generico
        const errorMessage = e?.message || String(e);
        const isNotFound = errorMessage.includes('non trovato') || 
                          errorMessage.includes('404') || 
                          errorMessage.includes('Programma non trovato') ||
                          errorMessage.includes('HTTP 404') ||
                          e?.status === 404;
        
        if (isNotFound) {
          setProposte([
            {proposta: "", url: ""},
            {proposta: "", url: ""},
            {proposta: "", url: ""},
            {proposta: "", url: ""},
            {proposta: "", url: ""}
          ]);
          setError(null);
        } else {
          setError("Errore nel caricamento del programma elettorale.");
          setProposte([
            {proposta: "", url: ""},
            {proposta: "", url: ""},
            {proposta: "", url: ""},
            {proposta: "", url: ""},
            {proposta: "", url: ""}
          ]);
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchProgramma();
  }, [open, utenteId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-w-full bg-white">
        <DialogHeader className="bg-white">
          <DialogTitle>
            {nome && cognome ? `Programma di ${nome} ${cognome}` : "Programma Elettorale"}
          </DialogTitle>
          <DialogDescription>
            Visualizza le proposte elettorali personali di questo candidato.
          </DialogDescription>
        </DialogHeader>
        {avatarConfig && (
          <div className="flex justify-center mb-4">
            <CustomAvatar config={JSON.parse(avatarConfig)} size={64} />
          </div>
        )}
        <div className="bg-white">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Caricamento programma...</span>
            </div>
          ) : error ? (
            <div className="flex items-center text-red-600 gap-2">
              <AlertCircle className="h-5 w-5" />
              {error}
            </div>
          ) : (
             <div className="space-y-3 mt-2">
               {proposte.every(p => !p.proposta || p.proposta.trim() === '') ? (
                 <div className="text-center py-8">
                   <div className="text-gray-500 text-lg mb-2">📝</div>
                   <p className="text-gray-600 text-lg font-medium">L'utente non ha ancora inserito il suo programma personale.</p>
                   <p className="text-gray-500 text-sm mt-2">Le proposte elettorali verranno mostrate qui una volta inserite.</p>
                 </div>
              ) : (
                proposte
                  .map((p, idx) => ({ ...p, originalIndex: idx }))
                  .filter(p => p.proposta && p.proposta.trim() !== '')
                  .map((p, idx) => (
                    <div key={p.originalIndex} className="bg-purple-50 border border-purple-200 rounded-md p-3">
                      <div className="font-semibold text-purple-800 mb-1">Proposta {p.originalIndex + 1}:</div>
                      <div className="text-gray-800 mb-2 flex items-center gap-2">
                        <span>{p.proposta}</span>
                        {p.url && (
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center w-6 h-6 bg-blue-500 rounded-full hover:bg-blue-600 transition-colors"
                            title="Link alla proposta"
                          >
                            <span className="text-white text-sm font-bold">!</span>
                          </a>
                        )}
                      </div>
                    </div>
                  ))
              )}
             </div>
          )}
        </div>
        <div className="flex justify-end mt-4 bg-white">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Chiudi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 
