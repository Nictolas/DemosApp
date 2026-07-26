import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { ViewDialogProps } from "../types";
import { getDisplayableDate } from "@/utils/dateUtils";

export const ViewDialog: React.FC<ViewDialogProps> = ({ iniziativa, onClose, onEdit, onDelete, deleteMutation }) => {
  if (!iniziativa) return null;

  const dataInizio = getDisplayableDate(iniziativa.dataInizio || iniziativa.data_inizio);
  const dataFine = getDisplayableDate(iniziativa.dataFine || iniziativa.data_fine);

  return (
    <Dialog open={!!iniziativa} onOpenChange={onClose}>
      <DialogContent className="w-screen h-screen max-w-none max-h-none left-0 top-0 translate-x-0 translate-y-0 rounded-none bg-white overflow-y-auto p-6">
        <DialogHeader className="bg-white">
          <DialogTitle className="text-2xl font-bold text-gray-900">
            {iniziativa.nome}
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            Dettagli dell'iniziativa popolare
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 bg-white overflow-y-auto">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Descrizione</h4>
            <p className="text-gray-700 whitespace-pre-wrap">
              {iniziativa.descrizione}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dataInizio && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Data Inizio</h4>
                <p className="text-gray-700">
                  {new Date(dataInizio).toLocaleDateString('it-IT')}
                </p>
              </div>
            )}
            
            {dataFine && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Data Fine</h4>
                <p className="text-gray-700">
                  {new Date(dataFine).toLocaleDateString('it-IT')}
                </p>
              </div>
            )}
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
