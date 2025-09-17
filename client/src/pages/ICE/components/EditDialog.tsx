import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ICEForm } from "./ICEForm";
import { EditDialogProps } from "../types";

export const EditDialog: React.FC<EditDialogProps> = ({ ice, onClose, onSubmit, isLoading }) => {
  if (!ice) return null;

  const defaultValues = {
    nome: ice.nome,
    descrizione: ice.descrizione,
    dataInizio: ice.dataInizio || "",
    dataFine: ice.dataFine || "",
    sitoWeb: ice.sitoWeb || ""
  };

  return (
    <Dialog open={!!ice} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Modifica ICE</DialogTitle>
        </DialogHeader>
        <ICEForm
          onSubmit={onSubmit}
          onCancel={onClose}
          isLoading={isLoading}
          defaultValues={defaultValues}
        />
      </DialogContent>
    </Dialog>
  );
};
