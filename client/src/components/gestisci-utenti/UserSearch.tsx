import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Search } from "lucide-react";
import { UserSearchProps } from "./types";

export function UserSearch({ 
  searchTerm, 
  onSearchChange, 
  onRefresh, 
  lastUpdateTime, 
  isLoading 
}: UserSearchProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Cerca utenti... (es: candidato:attivo, elezione:comune)"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Suggerimenti: candidato:attivo, elezione:comune, elezione:regionale, elezione:nazionale
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="text-sm text-gray-500 text-right">
          <div>Ultimo aggiornamento:</div>
          <div>{lastUpdateTime.toLocaleTimeString('it-IT')}</div>
        </div>
        
        <Button
          onClick={onRefresh}
          disabled={isLoading}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Aggiorna
        </Button>
      </div>
    </div>
  );
}
