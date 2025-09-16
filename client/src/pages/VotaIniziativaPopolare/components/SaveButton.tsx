import React from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface SaveButtonProps {
  onSave: () => void;
  isPending: boolean;
  votiCambiati: boolean;
  isBlocked: boolean;
  userRole?: string;
}

export const SaveButton: React.FC<SaveButtonProps> = ({
  onSave,
  isPending,
  votiCambiati,
  isBlocked,
  userRole
}) => {
  // Gli Admin possono sempre salvare, indipendentemente da isBlocked
  const isAdmin = userRole === 'Admin';
  const canSave = isAdmin || (!isBlocked && votiCambiati);
  
  return (
    <div className="flex justify-end mt-4">
      <Button 
        onClick={onSave} 
        disabled={isPending || !canSave}
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        {isAdmin ? "Salva (Admin)" : "Salva le mie Preferenze"}
      </Button>
    </div>
  );
};
