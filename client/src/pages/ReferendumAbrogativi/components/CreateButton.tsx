import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Info } from "lucide-react";

interface CreateButtonProps {
  onClick: () => void;
  disabled?: boolean;
  currentProposals?: number;
  limit?: number;
}

export const CreateButton: React.FC<CreateButtonProps> = ({ 
  onClick, 
  disabled = false, 
  currentProposals = 0, 
  limit = 1 
}) => {
  return (
    <div className="flex items-center space-x-4">
      <Button 
        onClick={onClick} 
        disabled={disabled}
        className={`${disabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
      >
        <Plus className="h-4 w-4 mr-2" />
        Proponi Referendum Abrogativo
      </Button>
      <Badge variant={disabled ? "destructive" : "secondary"} className="flex items-center space-x-1">
        <Info className="h-3 w-3" />
        <span>{currentProposals}/{limit}</span>
      </Badge>
    </div>
  );
};
