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
      className={`${disabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
    >
      <Plus className="h-4 w-4 mr-2" />
      Proponi Referendum Abrogativo
    </Button>
  );
};
