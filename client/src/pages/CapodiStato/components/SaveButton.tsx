import React from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface SaveButtonProps {
  onSave: () => void;
  isPending: boolean;
  votiCambiati: boolean;
  isBlocked: boolean;
}

export const SaveButton: React.FC<SaveButtonProps> = ({
  onSave,
  isPending,
  votiCambiati,
  isBlocked
}) => {
  return (
    <div className="flex justify-end mt-4">
      <Button 
        onClick={onSave} 
        disabled={isPending || !votiCambiati || isBlocked}
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Salva le mie preferenze
      </Button>
    </div>
  );
};
