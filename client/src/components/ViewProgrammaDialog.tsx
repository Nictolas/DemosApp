import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, AlertCircle } from "lucide-react";
import { CustomAvatar } from "@/components/CustomAvatar";


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
  const [proposte, setProposte] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !utenteId) return;
    setIsLoading(true);
    setError(null);
    setProposte([]);
    const fetchProgramma = async () => {
      try {
        const ref = doc(db, "programmi", utenteId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setProposte([
            data.proposta1 || "",
            data.proposta2 || "",
            data.proposta3 || "",
            data.proposta4 || "",
            data.proposta5 || "",
          ]);
        } else {
          setProposte(["", "", "", "", ""]);
        }
      } catch (e) {
        setError("Errore nel caricamento del programma elettorale.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchProgramma();
  }, [open, utenteId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-w-full">
        <DialogHeader>
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
            {proposte.map((p, idx) => (
              <div key={idx} className="bg-purple-50 border border-purple-200 rounded-md p-3">
                <span className="font-semibold text-purple-800">Proposta {idx + 1}:</span>
                <span className="ml-2 text-gray-800">{p ? p : <span className="italic text-gray-400">Non specificata</span>}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Chiudi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 
