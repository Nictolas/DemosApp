import React from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface CreateButtonProps {
  onClick: () => void;
}

export const CreateButton: React.FC<CreateButtonProps> = ({ onClick }) => {
  return (
    <Button onClick={onClick} className="bg-blue-600 hover:bg-blue-700 text-white">
      <Plus className="h-4 w-4 mr-2" />
      Proponi Referendum Abrogativo
    </Button>
  );
};
