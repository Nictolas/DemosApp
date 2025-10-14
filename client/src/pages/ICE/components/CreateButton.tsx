import React from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface CreateButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export const CreateButton: React.FC<CreateButtonProps> = ({ onClick, disabled = false }) => {
  return (
    <Button 
      onClick={onClick} 
      disabled={disabled}
      className={`mb-6 ${disabled ? 'bg-gray-400 cursor-not-allowed' : ''}`}
    >
      <Plus className="h-4 w-4 mr-2" />
      Proponi ICE
    </Button>
  );
};
