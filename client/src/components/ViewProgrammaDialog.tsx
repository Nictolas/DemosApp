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
  console.log('🚨🚨🚨 ViewProgrammaDialog RENDERED! 🚨🚨🚨');
  console.log('🚨 Props:', { utenteId, open, nome, cognome });
  
  const [proposte, setProposte] = useState<{proposta: string, url: string}[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !utenteId) return;
    console.log('🚨🚨🚨 ViewProgrammaDialog useEffect TRIGGERED! 🚨🚨🚨');
    console.log('🚨 open:', open, 'utenteId:', utenteId);
    setIsLoading(true);
    setError(null);
    setProposte([]);
    const fetchProgramma = async () => {
      try {
        console.log('🔍 ViewProgrammaDialog: Caricamento programma per utenteId:', utenteId);
        const response = await apiRequest("GET", `/api/programma/${utenteId}`);
        console.log('🔍 ViewProgrammaDialog: Response status:', response.status);
        console.log('🔍 ViewProgrammaDialog: Response ok:', response.ok);
        
        if (response.ok) {
          const data = await response.json();
          console.log('🔍 ViewProgrammaDialog: Response data:', data);
          
          if (data.success && data.data) {
            console.log('🔍 ViewProgrammaDialog: Dati programma trovati:', data.data);
            const newProposte = [
              {proposta: data.data.proposta1 || "", url: data.data.url1 || ""},
              {proposta: data.data.proposta2 || "", url: data.data.url2 || ""},
              {proposta: data.data.proposta3 || "", url: data.data.url3 || ""},
              {proposta: data.data.proposta4 || "", url: data.data.url4 || ""},
              {proposta: data.data.proposta5 || "", url: data.data.url5 || ""},
            ];
            console.log('🔍 ViewProgrammaDialog: Nuove proposte da impostare:', newProposte);
            setProposte(newProposte);
          } else {
            console.log('🔍 ViewProgrammaDialog: Nessun programma trovato o success=false');
            setProposte([
              {proposta: "", url: ""},
              {proposta: "", url: ""},
              {proposta: "", url: ""},
              {proposta: "", url: ""},
              {proposta: "", url: ""}
            ]);
          }
        } else {
          console.log('🔍 ViewProgrammaDialog: Response non ok, status:', response.status);
          setProposte([
            {proposta: "", url: ""},
            {proposta: "", url: ""},
            {proposta: "", url: ""},
            {proposta: "", url: ""},
            {proposta: "", url: ""}
          ]);
        }
      } catch (e) {
        setError("Errore nel caricamento del programma elettorale.");
        setProposte([
          {proposta: "", url: ""},
          {proposta: "", url: ""},
          {proposta: "", url: ""},
          {proposta: "", url: ""},
          {proposta: "", url: ""}
        ]);
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
               {(() => {
                 console.log('🔍 ViewProgrammaDialog: Rendering proposte:', proposte);
                 console.log('🔍 ViewProgrammaDialog: Tutte vuote?', proposte.every(p => !p.proposta || p.proposta.trim() === ''));
                 return proposte.every(p => !p.proposta || p.proposta.trim() === '');
               })() ? (
                 <div className="text-center py-8">
                   <div className="text-gray-500 text-lg mb-2">📝</div>
                   <p className="text-gray-600 text-lg font-medium">L'utente non ha ancora inserito il suo programma personale.</p>
                   <p className="text-gray-500 text-sm mt-2">Le proposte elettorali verranno mostrate qui una volta inserite.</p>
                 </div>
               ) : (
                 proposte.map((p, idx) => (
                   <div key={idx} className="bg-purple-50 border border-purple-200 rounded-md p-3">
                     <div className="font-semibold text-purple-800 mb-1">Proposta {idx + 1}:</div>
                     <div className="text-gray-800 mb-2">
                       {p.proposta ? p.proposta : <span className="italic text-gray-400">Non specificata</span>}
                     </div>
                     {p.url && (
                       <div className="mt-2">
                         <a 
                           href={p.url} 
                           target="_blank" 
                           rel="noopener noreferrer"
                           className="text-blue-600 hover:text-blue-800 underline text-sm"
                         >
                           🔗 Link alla proposta
                         </a>
                       </div>
                     )}
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
