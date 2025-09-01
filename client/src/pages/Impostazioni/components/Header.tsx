import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

export const Header: React.FC = () => {
  return (
    <div className="flex items-center gap-3 mb-8">
      <Link href="/menu">
        <Button variant="ghost" size="icon">
          <Home className="h-5 w-5" />
        </Button>
      </Link>
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Impostazioni</h1>
        <p className="text-gray-600">Gestisci il tuo account e le preferenze</p>
      </div>
    </div>
  );
};
