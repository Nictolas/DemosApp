// Questo file è la versione aggiornata di Comizi.tsx, ora rinominato in Eventi.tsx.
// ... (inserire qui il contenuto aggiornato come da edit precedente) ... 

import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Calendar, Vote, MapPin, Clock, Users } from "lucide-react";

export default function Eventi() {
  const { user, isLoading } = useAuth();

  // Fetch eventi data from API
  const { data: eventi = [], isLoading: eventiLoading } = useQuery<any[]>({
    queryKey: ["/api/eventi"],
    enabled: !!user,
  });

  // Fetch prossime elezioni from API
  const { data: elezioni = [], isLoading: elezioniLoading } = useQuery<any[]>({
    queryKey: ["/api/elezioni/prossime"],
    enabled: !!user,
  });

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 select-none" style={{ paddingBottom: '80px' }}>
      <div className="container mx-auto px-4 py-8 space-y-8">
        
        {/* Sezione Prossime Elezioni */}
        <Card className="w-full max-w-6xl mx-auto border-0 shadow-xl bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardHeader className="text-center pb-4">
            <div className="flex items-center justify-center mb-2">
              <Vote className="h-8 w-8 text-blue-600 mr-3" />
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Prossime Elezioni
              </CardTitle>
            </div>
            <CardDescription className="text-lg text-gray-600">
              Le prossime elezioni in programma nella tua zona
            </CardDescription>
          </CardHeader>
          <CardContent>
            {elezioniLoading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
                <p className="text-gray-600 mt-2">Caricamento elezioni...</p>
              </div>
            ) : elezioni.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {elezioni.map((elezione: any) => (
                  <div key={elezione.id} className="bg-white rounded-xl p-6 shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
                    <div className="flex items-center mb-3">
                      <Vote className="h-6 w-6 text-blue-600 mr-2" />
                      <h3 className="font-semibold text-gray-800 capitalize">{elezione.tipo}</h3>
                    </div>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 mr-2 text-gray-500" />
                        <span className="capitalize">{elezione.zona}</span>
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-gray-500" />
                        <span>
                          {elezione.datainizio} - {elezione.datafine}
                          {elezione.circa && <span className="text-orange-600 ml-1">(circa)</span>}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Vote className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nessuna elezione programmata al momento.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sezione Eventi */}
        <Card className="w-full max-w-6xl mx-auto border-0 shadow-xl bg-gradient-to-r from-green-50 to-emerald-50">
          <CardHeader className="text-center pb-4">
            <div className="flex items-center justify-center mb-2">
              <Calendar className="h-8 w-8 text-green-600 mr-3" />
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                Eventi
              </CardTitle>
            </div>
            <CardDescription className="text-lg text-gray-600">
              Calendario degli eventi organizzati dai tuoi rappresentanti e candidati scelti
            </CardDescription>
          </CardHeader>
          <CardContent>
            {eventiLoading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-green-600 mx-auto" />
                <p className="text-gray-600 mt-2">Caricamento eventi...</p>
              </div>
            ) : eventi.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-green-50">
                      <TableHead className="text-green-800 font-semibold">Data</TableHead>
                      <TableHead className="text-green-800 font-semibold">Ora</TableHead>
                      <TableHead className="text-green-800 font-semibold">Luogo</TableHead>
                      <TableHead className="text-green-800 font-semibold">Organizzatore</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eventi.map((evento: any) => (
                      <TableRow key={evento.id} className="hover:bg-green-50 transition-colors">
                        <TableCell className="font-medium text-gray-800">
                          {new Date(evento.quando).toLocaleDateString('it-IT', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </TableCell>
                        <TableCell className="text-gray-700">
                          {new Date(evento.quando).toLocaleTimeString('it-IT', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell className="max-w-xs text-gray-700">
                          <div className="truncate" title={evento.dove}>
                            {evento.dove}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-700">{evento.organizzatore}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nessun evento programmato dai tuoi rappresentanti al momento.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 