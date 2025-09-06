import React from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  categoria: string;
  getTitolo: () => string;
}

export const Header: React.FC<HeaderProps> = ({ categoria, getTitolo }) => {
  return (
    <div className="flex items-center mb-6">
      <Link to="/elezioni">
        <Button variant="ghost" className="mr-2">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Indietro
        </Button>
      </Link>
      <h1 className="text-2xl font-bold">Scegli Candidato {getTitolo()}</h1>
    </div>
  );
};
