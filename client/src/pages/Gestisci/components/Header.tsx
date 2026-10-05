import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const Header: React.FC = () => {
  return (
    <div className="flex items-center justify-between">
      <Button
        variant="outline"
        onClick={() => window.location.href = "/menu"}
        className="flex items-center gap-2 hover:bg-purple-50 hover:border-purple-300 transition-all duration-300 shadow-xs"
      >
        <ArrowLeft className="h-4 w-4" />
        Torna al Menu
      </Button>
    </div>
  );
};
