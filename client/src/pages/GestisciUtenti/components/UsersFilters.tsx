import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UsersFiltersProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  setQuickFilter: (filter: string) => void;
  filteredCount: number;
  lastUpdateTime: Date;
  onRefresh: () => void;
  isLoading: boolean;
}

export const UsersFilters: React.FC<UsersFiltersProps> = ({
  searchTerm,
  setSearchTerm,
  setQuickFilter,
  filteredCount,
  lastUpdateTime,
  onRefresh,
  isLoading
}) => {
  const { toast } = useToast();

  const handleRefresh = () => {
    onRefresh();
    toast({ 
      title: 'Aggiornamento', 
      description: 'Dati utenti in aggiornamento...' 
    });
  };

  return (
    <>
      {/* Barra di ricerca migliorata */}
      <div className="flex items-center mb-6">
        <div className="relative flex-1 max-w-2xl">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input 
            placeholder="🔍 Cerca utenti per nome completo, email, ruolo, candidatura o elezione..." 
            className="pl-10 pr-4 py-2 border-2 border-gray-200 focus:border-blue-500 rounded-lg transition-colors" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
        </div>
        <div className="ml-4 text-sm text-gray-500">
          {filteredCount} utenti trovati
        </div>
        <div className="ml-4 text-xs text-gray-400">
          Ultimo aggiornamento: {lastUpdateTime.toLocaleTimeString('it-IT')}
        </div>
      </div>
      
      {/* Filtri rapidi per candidati */}
      <div className="flex items-center space-x-3 mb-4">
        <Button 
          variant={searchTerm === 'candidato:attivo' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setQuickFilter('candidato:attivo')}
          className="text-xs"
        >
          Candidati Attivi
        </Button>
        <Button 
          variant={searchTerm === 'elezione:comune' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setQuickFilter('elezione:comune')}
          className="text-xs"
        >
          Elezioni Comunali
        </Button>
        <Button 
          variant={searchTerm === 'elezione:regionale' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setQuickFilter('elezione:regionale')}
          className="text-xs"
        >
          Elezioni Regionali
        </Button>
        <Button 
          variant={searchTerm === 'elezione:nazionale' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setQuickFilter('elezione:nazionale')}
          className="text-xs"
        >
          Elezioni Nazionali
        </Button>
        
        {/* Pulsante di refresh manuale */}
        <div className="ml-auto">
          <Button 
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="text-xs"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Aggiorna Dati
          </Button>
        </div>
      </div>
    </>
  );
};
