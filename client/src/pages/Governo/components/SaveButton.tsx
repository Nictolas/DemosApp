import React from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { SaveButtonProps } from "../types";

export const SaveButton: React.FC<SaveButtonProps> = ({
  isBlocked,
  votiCambiati,
  isPending,
  onSave
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xs border-t">
      <div className="container mx-auto max-w-7xl flex justify-end">
        <Button 
          size="lg" 
          onClick={onSave} 
          disabled={isPending || isBlocked || !votiCambiati}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Salva le Tue Preferenze
        </Button>
      </div>
    </div>
  );
};
