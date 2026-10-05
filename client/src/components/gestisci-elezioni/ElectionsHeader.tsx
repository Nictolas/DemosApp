import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";
import { ElectionsHeaderProps } from "./types";

export function ElectionsHeader({ onAddNew }: ElectionsHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div className="flex items-center space-x-4">
        <Link href="/menu">
          <Button variant="ghost" className="flex items-center text-gray-600 hover:text-gray-800">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Torna al Menu
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Gestisci Elezioni</h1>
      </div>
      
      <Button 
        onClick={onAddNew}
        className="bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 text-lg font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
      >
        <Plus className="h-6 w-6 mr-3" />
        Aggiungi Nuova Elezione
      </Button>
    </div>
  );
}
