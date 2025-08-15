// Questo file è la versione aggiornata di Comizi.tsx, ora rinominato in Eventi.tsx.
// ... (inserire qui il contenuto aggiornato come da edit precedente) ... 

import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Calendar } from "lucide-react";

export default function Eventi() {
  const { user, isLoading } = useAuth();

  // Fetch eventi data from API
  const { data: eventi = [], isLoading: eventiLoading } = useQuery<any[]>({
    queryKey: ["/api/eventi"],
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 space-y-6">
        <Card className="w-full max-w-6xl mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
              Eventi
            </CardTitle>
            <CardDescription>
              Calendario degli eventi organizzati dai tuoi rappresentanti e candidati scelti.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Ora</TableHead>
                    <TableHead>Luogo</TableHead>
                    <TableHead>Organizzatore</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventi.map((evento: any) => (
                    <TableRow key={evento.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <TableCell className="font-medium">
                        {new Date(evento.quando).toLocaleDateString('it-IT', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </TableCell>
                      <TableCell>
                        {new Date(evento.quando).toLocaleTimeString('it-IT', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate" title={evento.dove}>
                          {evento.dove}
                        </div>
                      </TableCell>
                      <TableCell>{evento.organizzatore}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {!eventiLoading && eventi.length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
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