import React from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface CreateButtonProps {
  onClick: () => void;
}

export const CreateButton: React.FC<CreateButtonProps> = ({ onClick }) => {
  return (
    <Button onClick={onClick} className="mb-0 h-11 px-3 text-sm">
      <Plus className="h-4 w-4 mr-2" />
      Proponi carcerato
    </Button>
  );
};
