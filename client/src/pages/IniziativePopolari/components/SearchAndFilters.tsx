import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ArrowUpDown } from "lucide-react";

type SortOption = "firme" | "scadenza" | null;

interface SearchAndFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
}

export const SearchAndFilters: React.FC<SearchAndFiltersProps> = ({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
}) => {
  return (
    <div className="space-y-4 mb-6">
      {/* Barra di ricerca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          type="text"
          placeholder="Cerca per nome o descrizione..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 w-full"
        />
      </div>

      {/* Filtri di ordinamento */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={sortBy === "firme" ? "default" : "outline"}
          size="sm"
          onClick={() => onSortChange(sortBy === "firme" ? null : "firme")}
          className="flex items-center gap-2"
        >
          <ArrowUpDown className="h-4 w-4" />
          Ordina per Firme
        </Button>
        <Button
          variant={sortBy === "scadenza" ? "default" : "outline"}
          size="sm"
          onClick={() => onSortChange(sortBy === "scadenza" ? null : "scadenza")}
          className="flex items-center gap-2"
        >
          <ArrowUpDown className="h-4 w-4" />
          Ordina per Scadenza
        </Button>
        {sortBy && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSortChange(null)}
            className="text-gray-500"
          >
            Rimuovi filtro
          </Button>
        )}
      </div>
    </div>
  );
};

