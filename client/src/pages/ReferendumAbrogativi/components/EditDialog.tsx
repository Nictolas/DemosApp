import React, { useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReferendumForm } from "./ReferendumForm";
import { EditDialogProps } from "../types";
import { useReferendumForms } from "../hooks/useReferendumForms";

export const EditDialog: React.FC<EditDialogProps> = ({
  open,
  onOpenChange,
  referendum,
  form,
  onSubmit,
  isPending
}) => {
  const { populateEditForm } = useReferendumForms();

  // Popola il form quando si apre il dialog
  useEffect(() => {
    if (open && referendum) {
      populateEditForm(referendum);
    }
  }, [open, referendum, populateEditForm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifica Referendum</DialogTitle>
        </DialogHeader>
        
        <ReferendumForm
          form={form}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
          isPending={isPending}
          title="Modifica Referendum"
        />
      </DialogContent>
    </Dialog>
  );
};
