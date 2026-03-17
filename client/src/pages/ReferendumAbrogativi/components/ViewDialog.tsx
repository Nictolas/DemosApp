import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { ViewDialogProps } from "../types";

export const ViewDialog: React.FC<ViewDialogProps> = ({ referendum, onClose, onEdit, onDelete, deleteMutation }) => {
  if (!referendum) return null;

  return (
    <Dialog open={!!referendum} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader className="bg-white">
          <DialogTitle className="text-2xl font-bold text-gray-900">
            {referendum.nome}
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            Dettagli del referendum abrogativo
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 bg-white overflow-y-auto">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Descrizione</h4>
            <p className="text-gray-700 whitespace-pre-wrap">
              {referendum.descrizione}
            </p>
          </div>
          
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
        </div>
        
        <div className="flex justify-between mt-4 bg-white">
          <div className="flex space-x-2">
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onEdit(referendum);
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
                  onDelete(referendum.id);
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
