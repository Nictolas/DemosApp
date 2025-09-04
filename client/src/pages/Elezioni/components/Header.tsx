import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export const Header: React.FC = () => {
  return (
    <div className="text-center mb-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Le tue Elezioni</h1>
      <p className="text-gray-600">Gestisci i tuoi candidati per le diverse elezioni</p>
    </div>
  );
};
