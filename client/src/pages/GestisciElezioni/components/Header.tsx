import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar } from "lucide-react";

export const Header: React.FC = () => {
  return (
    <div className="flex items-center justify-between mb-8">
      <Link href="/menu">
        <Button variant="ghost" className="flex items-center text-gray-600 hover:text-gray-800 hover:bg-white/50">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Torna al Menu
        </Button>
      </Link>
      
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center justify-center">
          <Calendar className="mr-3 h-10 w-10 text-blue-600" />
          Gestisci Elezioni
        </h1>
        <p className="text-lg text-gray-600">Amministra le elezioni del sistema</p>
      </div>
      
      <div className="w-24"></div> {/* Spacer per centrare il titolo */}
    </div>
  );
};
