import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart as BarChartIcon } from "lucide-react";

interface HeaderProps {
  questionText: string;
}

export const Header: React.FC<HeaderProps> = ({ questionText }) => {
  return (
    <div className="mb-8">
      <Link href="/sondaggi">
        <Button variant="ghost" className="mb-4 flex items-center text-gray-600 hover:text-gray-800 hover:bg-white/50">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Torna ai Sondaggi
        </Button>
      </Link>
      
      {/* Titolo principale */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center justify-center">
          <BarChartIcon className="mr-3 h-10 w-10 text-blue-600" />
          {questionText}
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Statistiche dettagliate e analisi regionali
        </p>
      </div>
    </div>
  );
};
