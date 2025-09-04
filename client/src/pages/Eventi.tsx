import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Calendar, MapPin, Clock, User } from "lucide-react";

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
              <div key={evento.id} className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow">
                {/* Nome Evento */}
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {evento.nome_evento}
                </h3>
                
                {/* Organizzatore */}
                <div className="flex items-center mb-3">
                  <User className="h-5 w-5 text-blue-600 mr-2" />
                  <span className="text-gray-700 font-medium">
                    {evento.organizzatore || 'Organizzatore non specificato'}
                  </span>
                </div>
                
                {/* Luogo e Orario */}
                <div className="flex items-center text-gray-600">
                  <MapPin className="h-5 w-5 text-gray-500 mr-2" />
                  <span className="mr-4">
                    {evento.comune_evento && evento.indirizzo_evento 
                      ? `${evento.comune_evento}, ${evento.indirizzo_evento}`
                      : evento.comune_evento || 'Luogo non specificato'
                    }
                  </span>
                  <Clock className="h-5 w-5 text-gray-500 mr-2" />
                  <span>
                    {evento.orario_evento || 'Orario non specificato'}
                  </span>
                </div>
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