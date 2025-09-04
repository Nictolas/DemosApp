import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Calendar, MapPin, Clock, Tag } from "lucide-react";

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

        {/* Tabella Eventi */}
        <div className="bg-white rounded-xl shadow-xl border-0 overflow-hidden">
          {eventiLoading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
              <p className="text-gray-600 mt-2">Caricamento eventi...</p>
            </div>
          ) : eventi.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-blue-50">
                    <TableHead className="text-blue-800 font-semibold">Nome Evento</TableHead>
                    <TableHead className="text-blue-800 font-semibold">Tipologia</TableHead>
                    <TableHead className="text-blue-800 font-semibold">Luogo</TableHead>
                    <TableHead className="text-blue-800 font-semibold">Orario</TableHead>
                    <TableHead className="text-blue-800 font-semibold">Data Creazione</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventi.map((evento: any) => (
                    <TableRow key={evento.id} className="hover:bg-blue-50 transition-colors">
                      <TableCell className="font-medium text-gray-800">
                        {evento.nome_evento}
                      </TableCell>
                      <TableCell className="text-gray-700">
                        <div className="flex items-center">
                          <Tag className="h-4 w-4 mr-2 text-gray-500" />
                          {evento.tipologia_evento}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-700">
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 mr-2 text-gray-500" />
                          <div>
                            {evento.comune_evento && (
                              <div className="font-medium">{evento.comune_evento}</div>
                            )}
                            {evento.indirizzo_evento && (
                              <div className="text-sm text-gray-500">{evento.indirizzo_evento}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-700">
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-2 text-gray-500" />
                          {evento.orario_evento || 'Non specificato'}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-700">
                        {evento.created_at ? new Date(evento.created_at).toLocaleDateString('it-IT') : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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