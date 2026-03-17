import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { Referendum } from "../types";

interface ReferendumViewDialogProps {
  referendum: Referendum | null;
  onClose: () => void;
}

export const ReferendumViewDialog: React.FC<ReferendumViewDialogProps> = ({ referendum, onClose }) => {
  if (!referendum) return null;

  return (
    <Dialog open={!!referendum} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white">
        <DialogHeader className="bg-white">
          <DialogTitle className="text-2xl font-bold text-gray-900">
            {referendum.nome}
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            Dettagli del referendum abrogativo
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 bg-white">
          {referendum.descrizione && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Descrizione</h4>
              <p className="text-gray-700 whitespace-pre-wrap">
                {referendum.descrizione}
              </p>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {referendum.dataInizio && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Data Inizio</h4>
                <p className="text-gray-700">
                  {new Date(referendum.dataInizio).toLocaleDateString('it-IT')}
                </p>
              </div>
            )}
            
            {referendum.dataFine && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Data Fine</h4>
                <p className="text-gray-700">
                  {new Date(referendum.dataFine).toLocaleDateString('it-IT')}
                </p>
              </div>
            )}
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-900 mb-1">Firme Raccolte</h4>
            <p className="text-gray-700 text-lg font-semibold">
              {referendum.firme || 0}
            </p>
          </div>
          
          {referendum.sitoWeb && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Sito Web</h4>
              <a 
                href={referendum.sitoWeb.startsWith('http') ? referendum.sitoWeb : `https://${referendum.sitoWeb}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 underline"
              >
                <ExternalLink className="h-4 w-4" />
                Visita il sito
              </a>
            </div>
          )}
          
          <div className="pt-4 border-t">
            <a 
              href={referendum.sitoWeb?.startsWith('http') ? referendum.sitoWeb : `https://${referendum.sitoWeb}`} 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <Button className="w-full sm:w-auto shadow-md hover:shadow-lg bg-blue-600 hover:bg-blue-700 text-white border-blue-600 hover:border-blue-700" variant="default">
                Apri pagina referendum
              </Button>
            </a>
          </div>
        </div>
        
        <div className="flex justify-end mt-4 bg-white">
          <Button variant="outline" onClick={onClose}>Chiudi</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
