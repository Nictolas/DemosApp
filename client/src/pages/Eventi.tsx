import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Calendar, Clock, MapPin } from "lucide-react";

// Helper functions per formattare date e orari
const formatDate = (dateString: string | null) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const formatTime = (timeString: string | null) => {
  if (!timeString) return null;
  return timeString;
};

export default function Eventi() {
  const { user, isLoading } = useAuth();

  // Fetch eventi data from API
  const { data: eventiResponse, isLoading: eventiLoading } = useQuery<any>({
    queryKey: ["/api/eventi"],
    enabled: !!user,
  });

  // Extract eventi array from API response
  const eventi = eventiResponse?.data || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 select-none page-with-navbar" style={{ paddingBottom: '280px' }}>
      <div className="container mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Calendar className="h-8 w-8 text-blue-600 mr-3" />
            <h1 className="text-3xl font-bold text-gray-900">Eventi</h1>
          </div>
          <p className="text-lg text-gray-600">
            Calendario degli eventi organizzati dai tuoi rappresentanti e candidati
          </p>
        </div>

        {/* Schede Eventi */}
        <div className="space-y-4">
          {eventiLoading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
              <p className="text-gray-600 mt-2">Caricamento eventi...</p>
            </div>
          ) : eventi.length > 0 ? (
            eventi.map((evento: any) => (
              <div key={evento.id} className={`rounded-xl shadow-lg border p-6 hover:shadow-xl transition-shadow ${
                evento.tipologia_evento === 'Elezioni' 
                  ? 'bg-yellow-50 border-yellow-200 shadow-yellow-100' 
                  : 'bg-white border-gray-100'
              }`}>
                                            {/* Nome Evento */}
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-xl font-bold text-gray-900">
                                {evento.nome_evento}
                              </h3>
                              {evento.tipologia_evento === 'Elezioni' && (
                                <span className="bg-yellow-200 text-yellow-800 text-xs font-semibold px-2 py-1 rounded-full">
                                  Elezioni
                                </span>
                              )}
                            </div>
                            
                            {/* Organizzatore */}
                            <div className="mb-3">
                              <span className="text-gray-700 font-medium">
                                {evento.organizzatore || 'Organizzatore non specificato'}
                              </span>
                            </div>
                            
                            {/* Luogo - Solo per eventi non "Elezioni" */}
                            {evento.tipologia_evento !== 'Elezioni' && (
                              <div className="mb-3 flex items-center">
                                <MapPin className="h-4 w-4 text-gray-500 mr-2" />
                                <span className="text-gray-600">
                                  {evento.comune_evento && evento.indirizzo_evento 
                                    ? `${evento.comune_evento}, ${evento.indirizzo_evento}`
                                    : evento.comune_evento || 'Luogo non specificato'
                                  }
                                </span>
                              </div>
                            )}
                            
                            {/* Date e Orari - Solo per eventi non "Elezioni" */}
                            {evento.tipologia_evento !== 'Elezioni' && (
                              <div className="space-y-2">
                                {/* Giorno di Inizio */}
                                {evento.giorno_inizio && (
                                  <div className="flex items-center">
                                    <Calendar className="h-4 w-4 text-gray-500 mr-2" />
                                    <span className="text-gray-600">
                                      Inizio: {formatDate(evento.giorno_inizio)}
                                    </span>
                                  </div>
                                )}
                                
                                {/* Giorno di Fine */}
                                {evento.giorno_fine && (
                                  <div className="flex items-center">
                                    <Calendar className="h-4 w-4 text-gray-500 mr-2" />
                                    <span className="text-gray-600">
                                      Fine: {formatDate(evento.giorno_fine)}
                                    </span>
                                  </div>
                                )}
                                
                                {/* Orario di Inizio */}
                                {evento.orario_inizio && (
                                  <div className="flex items-center">
                                    <Clock className="h-4 w-4 text-gray-500 mr-2" />
                                    <span className="text-gray-600">
                                      Orario inizio: {formatTime(evento.orario_inizio)}
                                    </span>
                                  </div>
                                )}
                                
                                {/* Orario di Fine */}
                                {evento.orario_fine && (
                                  <div className="flex items-center">
                                    <Clock className="h-4 w-4 text-gray-500 mr-2" />
                                    <span className="text-gray-600">
                                      Orario fine: {formatTime(evento.orario_fine)}
                                    </span>
                                  </div>
                                )}
                                
                                {/* Fallback per orario_evento se non ci sono i nuovi campi */}
                                {!evento.giorno_inizio && !evento.orario_inizio && evento.orario_evento && (
                                  <div className="flex items-center">
                                    <Clock className="h-4 w-4 text-gray-500 mr-2" />
                                    <span className="text-gray-600">
                                      {evento.orario_evento}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Per eventi "Elezioni" - Solo data di inizio se disponibile */}
                            {evento.tipologia_evento === 'Elezioni' && evento.giorno_inizio && (
                              <div className="flex items-center">
                                <Calendar className="h-4 w-4 text-yellow-600 mr-2" />
                                <span className="text-gray-700 font-medium">
                                  Data: {formatDate(evento.giorno_inizio)}
                                </span>
                              </div>
                            )}
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nessun evento programmato al momento.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 