import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { Heart, Search, Filter, Star, Users, MessageSquare, Calendar, MapPin } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

interface Preferito {
  id: string;
  tipo: 'rappresentante' | 'opinione' | 'evento' | 'candidato';
  titolo: string;
  descrizione?: string;
  data_creazione: string;
  data_aggiunta: string;
  metadata?: any;
}

export default function Preferiti() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("tutti");

  // Redirect se non autenticato
  if (isAuthLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </PageContainer>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  // Query per ottenere i preferiti
  const { data: preferiti, isLoading, error, refetch } = useQuery({
    queryKey: ['preferiti', user.id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/preferiti?user_id=${user.id}`);
      return response.data || [];
    },
    enabled: !!user?.id,
  });

  // Filtra i preferiti in base al termine di ricerca e al tipo
  const filteredPreferiti = preferiti?.filter((preferito: Preferito) => {
    const matchesSearch = preferito.titolo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         preferito.descrizione?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === "tutti" || preferito.tipo === filterType;
    return matchesSearch && matchesFilter;
  }) || [];

  const getIconForType = (tipo: string) => {
    switch (tipo) {
      case 'rappresentante':
        return <Users className="h-5 w-5 text-blue-600" />;
      case 'opinione':
        return <MessageSquare className="h-5 w-5 text-green-600" />;
      case 'evento':
        return <Calendar className="h-5 w-5 text-purple-600" />;
      case 'candidato':
        return <Star className="h-5 w-5 text-yellow-600" />;
      default:
        return <Heart className="h-5 w-5 text-red-600" />;
    }
  };

  const getTypeLabel = (tipo: string) => {
    switch (tipo) {
      case 'rappresentante':
        return 'Rappresentante';
      case 'opinione':
        return 'Opinione';
      case 'evento':
        return 'Evento';
      case 'candidato':
        return 'Candidato';
      default:
        return 'Preferito';
    }
  };

  const handleRemovePreferito = async (preferitoId: string) => {
    try {
      await apiRequest("DELETE", `/api/preferiti/${preferitoId}`);
      refetch();
    } catch (error) {
      console.error("Errore nella rimozione del preferito:", error);
    }
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="min-h-screen bg-gray-50 pt-20 pb-24">
        <div className="max-w-4xl mx-auto px-4">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Heart className="h-8 w-8 text-red-500" />
              <h1 className="text-2xl font-bold text-gray-900">I Tuoi Preferiti</h1>
            </div>
            <p className="text-gray-600">
              Gestisci i tuoi contenuti preferiti per un accesso rapido
            </p>
          </div>

          {/* Filtri e ricerca */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Barra di ricerca */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cerca nei tuoi preferiti..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Filtro per tipo */}
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-gray-400" />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="tutti">Tutti i tipi</option>
                  <option value="rappresentante">Rappresentanti</option>
                  <option value="opinione">Opinioni</option>
                  <option value="evento">Eventi</option>
                  <option value="candidato">Candidati</option>
                </select>
              </div>
            </div>
          </div>

          {/* Lista preferiti */}
          <div className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-600">Errore nel caricamento dei preferiti. Riprova più tardi.</p>
              </div>
            )}

            {filteredPreferiti.length === 0 && !isLoading && (
              <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                <Heart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {searchTerm || filterType !== "tutti" ? "Nessun preferito trovato" : "Nessun preferito ancora"}
                </h3>
                <p className="text-gray-600">
                  {searchTerm || filterType !== "tutti" 
                    ? "Prova a modificare i filtri di ricerca" 
                    : "Inizia ad aggiungere contenuti ai tuoi preferiti per vederli qui"
                  }
                </p>
              </div>
            )}

            {filteredPreferiti.map((preferito: Preferito) => (
              <div key={preferito.id} className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="flex-shrink-0">
                      {getIconForType(preferito.tipo)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {getTypeLabel(preferito.tipo)}
                        </span>
                        <span className="text-sm text-gray-500">
                          Aggiunto il {new Date(preferito.data_aggiunta).toLocaleDateString('it-IT')}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {preferito.titolo}
                      </h3>
                      {preferito.descrizione && (
                        <p className="text-gray-600 mb-3 line-clamp-2">
                          {preferito.descrizione}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>Creato il {new Date(preferito.data_creazione).toLocaleDateString('it-IT')}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemovePreferito(preferito.id)}
                    className="flex-shrink-0 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Rimuovi dai preferiti"
                  >
                    <Heart className="h-5 w-5 fill-current" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
