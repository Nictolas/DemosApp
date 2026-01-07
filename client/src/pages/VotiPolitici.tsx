import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { PageContainer } from "@/components/PageContainer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, ArrowLeft, Vote, AlertCircle } from "lucide-react";

interface Votazione {
  uri: string;
  id: string;
  data_creazione: string | null;
  descrizione: string | null;
  esito: string | null;
  sigla_atto: string | null;
  numero_atto: string | null;
  tipo_atto: string | null;
  data: Record<string, any>;
}

export default function VotiPolitici() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Query per recuperare i dati delle votazioni
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/voti-politici"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/voti-politici");
      if (!response.ok) {
        throw new Error("Errore nel recupero dei dati");
      }
      const result = await response.json();
      return result.data || [];
    },
    retry: 2,
    staleTime: 5 * 60 * 1000, // Cache per 5 minuti
  });

  const votazioni: Votazione[] = data || [];

  // Formatta la data
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("it-IT", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  // Estrai tutti i predicati unici per mostrare colonne dinamiche
  const getAllPredicates = () => {
    const predicates = new Set<string>();
    votazioni.forEach((votazione) => {
      Object.keys(votazione.data || {}).forEach((key) => {
        predicates.add(key);
      });
    });
    return Array.from(predicates).sort();
  };

  const allPredicates = getAllPredicates();

  return (
    <PageContainer className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setLocation("/gestisci")}
              className="flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Vote className="h-8 w-8 text-blue-600" />
                Voti Politici
              </h1>
              <p className="text-muted-foreground mt-1">
                Votazioni della Camera dei Deputati - XIX Legislatura
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Aggiorna
          </Button>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Errore nel caricamento dei dati. Riprova più tardi.
            </AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {isLoading && (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="ml-4 text-muted-foreground">
                Caricamento votazioni...
              </p>
            </CardContent>
          </Card>
        )}

        {/* Data Table */}
        {!isLoading && !error && (
          <Card>
            <CardHeader>
              <CardTitle>Votazioni ({votazioni.length})</CardTitle>
              <CardDescription>
                Dati recuperati dall'endpoint SPARQL della Camera dei Deputati
              </CardDescription>
            </CardHeader>
            <CardContent>
              {votazioni.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Nessuna votazione trovata.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[100px]">ID</TableHead>
                        <TableHead className="min-w-[150px]">Data</TableHead>
                        <TableHead className="min-w-[200px]">Descrizione</TableHead>
                        <TableHead className="min-w-[100px]">Esito</TableHead>
                        <TableHead className="min-w-[100px]">Sigla Atto</TableHead>
                        <TableHead className="min-w-[100px]">Numero Atto</TableHead>
                        <TableHead className="min-w-[100px]">Tipo Atto</TableHead>
                        {allPredicates.slice(0, 5).map((predicate) => (
                          <TableHead key={predicate} className="min-w-[150px]">
                            {predicate}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {votazioni.map((votazione) => (
                        <TableRow key={votazione.id}>
                          <TableCell className="font-mono text-xs">
                            {votazione.id.substring(0, 20)}...
                          </TableCell>
                          <TableCell>{formatDate(votazione.data_creazione)}</TableCell>
                          <TableCell className="max-w-[300px] truncate">
                            {votazione.descrizione || "N/A"}
                          </TableCell>
                          <TableCell>{votazione.esito || "N/A"}</TableCell>
                          <TableCell>{votazione.sigla_atto || "N/A"}</TableCell>
                          <TableCell>{votazione.numero_atto || "N/A"}</TableCell>
                          <TableCell>{votazione.tipo_atto || "N/A"}</TableCell>
                          {allPredicates.slice(0, 5).map((predicate) => (
                            <TableCell key={predicate} className="max-w-[200px] truncate">
                              {votazione.data[predicate] || "N/A"}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        {!isLoading && !error && votazioni.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Informazioni</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <strong>Totale votazioni:</strong> {votazioni.length}
                </p>
                <p>
                  <strong>Predicati unici trovati:</strong> {allPredicates.length}
                </p>
                <p className="text-xs">
                  I dati vengono recuperati in tempo reale dall'endpoint SPARQL
                  della Camera dei Deputati. Solo i primi 5 predicati
                  aggiuntivi sono mostrati nella tabella per questioni di
                  spazio.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}

