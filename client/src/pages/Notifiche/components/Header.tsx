import React from "react";
import { Bell, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export const Header: React.FC = () => {
  const [, setLocation] = useLocation();

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Bell className="h-8 w-8 text-blue-600" />
          Notifiche
        </h1>
        <Button 
          variant="outline" 
          size="sm" 
          className="flex items-center gap-2"
          onClick={() => setLocation("/notifiche/preferenze")}
        >
          <Settings className="h-4 w-4" />
          Preferenze
        </Button>
      </div>
    </div>
  );
};
