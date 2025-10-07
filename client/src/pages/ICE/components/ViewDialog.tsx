import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ViewDialogProps } from "../types";

export const ViewDialog: React.FC<ViewDialogProps> = ({ ice, onClose }) => {
  if (!ice) return null;

  return (
    <Dialog open={!!ice} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-w-full bg-white">
        <DialogHeader className="bg-white">
          <DialogTitle>{ice.nome}</DialogTitle>
          <DialogDescription>Dettagli dell'iniziativa dei cittadini europei</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 bg-white">
          <div>
            <div className="text-sm text-gray-500">Quorum</div>
            <div className={
              ice.quorum === 'ok' ? 'text-green-700' : ice.quorum === 'pending' ? 'text-yellow-700' : 'text-red-700'
            }>
              {ice.quorum === 'ok' ? 'Raggiunto' : ice.quorum === 'pending' ? 'In corso' : 'Non raggiunto'}
              {ice.quorum === 'ok' && ice.esito && (
                <span className="ml-2 text-gray-600">
                  - Esito: {ice.esito === 'Attuata' ? '🟢 Attuata' : ice.esito === 'In Attesa' ? '🟡 In Attesa' : ice.esito === 'Non Accolta' ? '🔴 Non Accolta' : ice.esito}
                </span>
              )}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Firme raccolte</div>
            <div className="text-gray-800 font-medium">
              {ice.firme ? ice.firme.toLocaleString('it-IT') : '0'}
            </div>
          </div>
          {ice.descrizione && (
            <div>
              <div className="text-sm text-gray-500">Descrizione</div>
              <div className="text-gray-800">{ice.descrizione}</div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500">Data Inizio</div>
              <div className="text-gray-800">{ice.dataInizio ? new Date(ice.dataInizio).toLocaleDateString('it-IT') : '-'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Data Fine</div>
              <div className="text-gray-800">{ice.dataFine ? new Date(ice.dataFine).toLocaleDateString('it-IT') : '-'}</div>
            </div>
          </div>
          {ice.sitoWeb && (
            <div>
              <a href={ice.sitoWeb} target="_blank" rel="noopener noreferrer">
                <Button className="w-full sm:w-auto shadow-md hover:shadow-lg" variant="default">
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


