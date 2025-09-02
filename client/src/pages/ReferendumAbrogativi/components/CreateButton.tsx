import React from "react";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";

interface CreateButtonProps {
  showForm: boolean;
  onToggle: () => void;
}

export const CreateButton: React.FC<CreateButtonProps> = ({ showForm, onToggle }) => {
  return (
    <Button
      onClick={onToggle}
      className="mb-6"
      variant={showForm ? "outline" : "default"}
    >
      {showForm ? (
        <>
          <X className="mr-2 h-4 w-4" />
          Annulla Creazione
        </>
      ) : (
        <>
          <Plus className="mr-2 h-4 w-4" />
          Nuovo Referendum
        </>
      )}
    </Button>
  );
};
