import React from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface CreateButtonProps {
  onClick: () => void;
}

export const CreateButton: React.FC<CreateButtonProps> = ({ onClick }) => {
  return (
    <Button 
      onClick={onClick} 
      variant="ghost" className="h-9 px-1.5 text-sm text-purple-700 hover:text-purple-800 lg:h-11 lg:px-3"
    >
      <Plus className="h-4 w-4 mr-2" />
      Proponi Amnistia
    </Button>
  );
};
