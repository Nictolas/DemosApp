import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { Iniziativa } from "../types";

interface IniziativaViewDialogProps {
  iniziativa: Iniziativa | null;
  onClose: () => void;
}

export const IniziativaViewDialog: React.FC<IniziativaViewDialogProps> = ({ iniziativa, onClose }) => {
  if (!iniziativa) return null;

  // Debug: log dei dati ricevuti
  console.log('🔍 DEBUG IniziativaViewDialog - Dati iniziativa:', iniziativa);

  return (
    <Dialog open={!!iniziativa} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white">
        <DialogHeader className="bg-white">
          <DialogTitle className="text-2xl font-bold text-gray-900">
            {iniziativa.nome}
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            Dettagli dell'iniziativa popolare
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 bg-white">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Descrizione</h4>
            <p className="text-gray-700 whitespace-pre-wrap">
              {iniziativa.descrizione || 'Descrizione non disponibile'}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {iniziativa.dataInizio && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Data Inizio</h4>
                <p className="text-gray-700">
                  {new Date(iniziativa.dataInizio).toLocaleDateString('it-IT')}
                </p>
              </div>
            )}
            
            {iniziativa.dataFine && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Data Fine</h4>
                <p className="text-gray-700">
                  {new Date(iniziativa.dataFine).toLocaleDateString('it-IT')}
                </p>
              </div>
            )}
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-900 mb-1">Firme Raccolte</h4>
            <p className="text-gray-700 text-lg font-semibold">
              {iniziativa.firme || 0}
            </p>
          </div>
          
          {iniziativa.sitoWeb && (
            <div className="pt-4 border-t">
              <a 
                href={iniziativa.sitoWeb.startsWith('http') ? iniziativa.sitoWeb : `https://${iniziativa.sitoWeb}`} 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Button className="w-full sm:w-auto shadow-md hover:shadow-lg bg-blue-600 hover:bg-blue-700 text-white border-blue-600 hover:border-blue-700" variant="default">
                  Apri pagina iniziativa
                </Button>
              </a>
            </div>
          )}
        </div>
        
        <div className="flex justify-end mt-4 bg-white">
          <Button variant="outline" onClick={onClose}>Chiudi</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
