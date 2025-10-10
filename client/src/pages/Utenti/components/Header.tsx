import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, RefreshCw } from "lucide-react";

interface HeaderProps {
  lastUpdateTime: Date;
  onRefresh: () => void;
  isLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({ lastUpdateTime, onRefresh, isLoading }) => {
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
          <Users className="mr-3 h-10 w-10 text-blue-600" />
          Utenti
        </h1>
        <p className="text-lg text-gray-600">Gestisci e visualizza statistiche degli utenti</p>
      </div>
      
      <div className="flex items-center space-x-4">
        <div className="text-right text-sm text-gray-500">
          <div>Ultimo aggiornamento:</div>
          <div>{lastUpdateTime.toLocaleTimeString('it-IT')}</div>
        </div>
        <Button 
          onClick={onRefresh} 
          disabled={isLoading}
          variant="outline" 
          size="sm"
          className="flex items-center space-x-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Aggiorna</span>
        </Button>
      </div>
    </div>
  );
};
