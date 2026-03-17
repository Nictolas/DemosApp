import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ICEForm } from "./ICEForm";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { EditDialogProps } from "../types";

export const EditDialog: React.FC<EditDialogProps> = ({ ice, onClose, onSubmit, isLoading }) => {
  if (!ice) return null;

  const [quorum, setQuorum] = React.useState(ice.quorum || 'pending');

  // Funzione helper per convertire le date nel formato corretto per input date
  const formatDateForInput = (dateString: string) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0]; // Formato YYYY-MM-DD
    } catch {
      return "";
    }
  };

  const defaultValues = {
    nome: ice.nome,
    descrizione: ice.descrizione,
    dataInizio: formatDateForInput(ice.dataInizio || ice.datainizio || ""),
    dataFine: formatDateForInput(ice.dataFine || ice.datafine || ""),
    sitoWeb: ice.sitoWeb || ice.sitoweb || ""
  };

  const handleSubmit = (data: any) => {
    onSubmit({ ...data, quorum });
  };

  return (
    <Dialog open={!!ice} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white">
        <DialogHeader className="bg-white">
          <DialogTitle>Modifica ICE</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 bg-white">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quorum">Stato Quorum</Label>
              <Select value={quorum} onValueChange={setQuorum}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona stato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="proposta">Proposta</SelectItem>
                  <SelectItem value="pending">In corso</SelectItem>
                  <SelectItem value="ok">Raggiunto</SelectItem>
                  <SelectItem value="no">Non raggiunto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <ICEForm
            onSubmit={handleSubmit}
            onCancel={onClose}
            isLoading={isLoading}
            defaultValues={defaultValues}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
