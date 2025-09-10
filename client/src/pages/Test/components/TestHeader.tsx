import React from "react";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";

interface TestHeaderProps {
  isAdmin: boolean;
  onAdminClick: () => void;
}

export const TestHeader: React.FC<TestHeaderProps> = ({ isAdmin, onAdminClick }) => {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xl font-bold">
            T
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Test Candidati</h1>
            <p className="text-gray-600">Seleziona i tuoi candidati di test per ogni categoria</p>
          </div>
        </div>
        
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAdminClick}
            className="flex items-center space-x-2"
          >
            <Settings className="w-4 h-4" />
            <span>Gestisci</span>
          </Button>
        )}
      </div>
    </div>
  );
};
