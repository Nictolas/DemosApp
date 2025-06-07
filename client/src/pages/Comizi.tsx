import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Calendar, MapPin } from "lucide-react";
import { Navbar } from "@/components/Navbar";

export default function Comizi() {
  const { user, isLoading } = useAuth();

  // Redirect to auth page if not logged in
  if (!user && !isLoading) {
    return <Redirect to="/auth" />;
  }

  // Fetch comizi data from API
  const { data: comizi = [], isLoading: comiziLoading } = useQuery<any[]>({
    queryKey: ["/api/comizi"],
    enabled: !!user,
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Navbar />
      {isLoading || comiziLoading ? (
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      ) : (
        <div className="container mx-auto px-4 py-8">
          <Card className="w-full max-w-6xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                Comizi
              </CardTitle>
              <CardDescription>
                Calendario dei comizi organizzati dai tuoi rappresentanti e candidati scelti.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4" />
                          <span>Data</span>
                        </div>
                      </TableHead>
                      <TableHead className="w-[100px]">Ora</TableHead>
                      <TableHead>
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-4 w-4" />
                          <span>Luogo</span>
                        </div>
                      </TableHead>
                      <TableHead>Organizzatore</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comizi.map((comizio: any) => (
                      <TableRow key={comizio.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <TableCell className="font-medium">
                          {new Date(comizio.quando).toLocaleDateString('it-IT', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </TableCell>
                        <TableCell>
                          {new Date(comizio.quando).toLocaleTimeString('it-IT', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="truncate" title={comizio.dove}>
                            {comizio.dove}
                          </div>
                        </TableCell>
                        <TableCell>{comizio.organizzatore}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {!comiziLoading && comizi.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nessun comizio programmato dai tuoi rappresentanti al momento.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}