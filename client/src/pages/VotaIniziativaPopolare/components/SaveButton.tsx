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
  const isAdmin = userRole === 'AD';
  const canSave = isAdmin || (!isBlocked && votiCambiati);
  
  const handleClick = () => {
    console.log('🔍 DEBUG SaveButton - Click su Salva');
    console.log('🔍 DEBUG SaveButton - votiCambiati:', votiCambiati);
    console.log('🔍 DEBUG SaveButton - isBlocked:', isBlocked);
    console.log('🔍 DEBUG SaveButton - isAdmin:', isAdmin);
    console.log('🔍 DEBUG SaveButton - canSave:', canSave);
    console.log('🔍 DEBUG SaveButton - isPending:', isPending);
    onSave();
  };
  
  return (
    <div className="flex justify-end mt-4">
      <Button 
        onClick={handleClick} 
        disabled={isPending || !canSave}
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        {isAdmin ? "Salva (Admin)" : "Salva le mie Preferenze"}
      </Button>
      {/* Debug info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-gray-500 mt-1">
          Debug: votiCambiati={votiCambiati ? 'true' : 'false'}, canSave={canSave ? 'true' : 'false'}, isBlocked={isBlocked ? 'true' : 'false'}
        </div>
      )}
    </div>
  );
};
