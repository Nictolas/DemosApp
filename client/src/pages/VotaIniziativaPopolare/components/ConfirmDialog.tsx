import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  isPending
}) => {
  const handleConfirm = () => {
    console.log('🔍 DEBUG ConfirmDialog - Conferma clickata');
    onConfirm();
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white">
        <DialogHeader>
          <DialogTitle>Conferma salvataggio preferenze</DialogTitle>
          <DialogDescription>
            Dopo aver salvato, potrai modificare le preferenze solo tra una settimana. Confermi?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => {
            console.log('🔍 DEBUG ConfirmDialog - Annulla clickata');
            onOpenChange(false);
          }}>
            Annulla
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? 'Salvataggio...' : 'Conferma'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
