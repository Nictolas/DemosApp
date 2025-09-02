import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Vote } from "lucide-react";

export const Header: React.FC = () => {
  return (
    <div className="mb-8">
      <Link href="/menu">
        <Button variant="ghost" className="mb-4 flex items-center text-gray-600 hover:text-gray-800 hover:bg-white/50">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Torna al Menu
        </Button>
      </Link>
      
      {/* Titolo principale */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center justify-center">
          <Vote className="mr-3 h-10 w-10 text-blue-600" />
          Referendum Abrogativi
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Gestisci i referendum abrogativi e monitora il loro stato di avanzamento
        </p>
      </div>
    </div>
  );
};
