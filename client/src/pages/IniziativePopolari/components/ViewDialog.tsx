import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import { ViewDialogProps } from "../types";

export const ViewDialog: React.FC<ViewDialogProps> = ({ iniziativa, onClose, onEdit, onDelete, deleteMutation }) => {
  if (!iniziativa) return null;

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
              {iniziativa.descrizione}
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
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Sito Web</h4>
              <a 
                href={iniziativa.sitoWeb.startsWith('http') ? iniziativa.sitoWeb : `https://${iniziativa.sitoWeb}`} 
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
              href={iniziativa.sitoWeb?.startsWith('http') ? iniziativa.sitoWeb : `https://${iniziativa.sitoWeb}`} 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <Button className="w-full sm:w-auto shadow-md hover:shadow-lg bg-blue-600 hover:bg-blue-700 text-white border-blue-600 hover:border-blue-700" variant="default">
                Apri pagina iniziativa
              </Button>
            </a>
          </div>
        </div>
        
        <div className="flex justify-between mt-4 bg-white">
          <div className="flex space-x-2">
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onEdit(iniziativa);
                  onClose();
                }}
                disabled={deleteMutation?.isPending}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Modifica
              </Button>
            )}
            {onDelete && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  onDelete(iniziativa.id);
                  onClose();
                }}
                disabled={deleteMutation?.isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Cestina
              </Button>
            )}
          </div>
          <Button variant="outline" onClick={onClose}>Chiudi</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
