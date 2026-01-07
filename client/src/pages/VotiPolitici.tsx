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

interface VotazioneCamera {
  politico_nome: string;
  data_votazione: string | null;
  oggetto_voto: string | null;
  esito_voto: string | null;
}

export default function VotiPolitici() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Query per recuperare i dati delle votazioni dalla tabella voti_camera
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/voti-camera"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/voti-camera");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Errore nel recupero dei dati");
      }
      const result = await response.json();
      console.log("📊 Dati ricevuti:", result);
      return result.data || [];
    },
    retry: 2,
    staleTime: 5 * 60 * 1000, // Cache per 5 minuti
  });

  const votazioni: VotazioneCamera[] = data || [];

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

  // Conta i politici unici
  const getUniquePolitici = () => {
    const politici = new Set<string>();
    votazioni.forEach((votazione) => {
      if (votazione.politico_nome) {
        politici.add(votazione.politico_nome);
      }
    });
    return Array.from(politici);
  };

  const uniquePolitici = getUniquePolitici();

  return (
    <PageContainer className="bg-gradient-to-br from-blue-50 to-indigo-100">
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
                Votazioni più recenti dei deputati della Camera
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Dati estratti dal sito della Camera dei Deputati
              </p>
            </div>
          </div>
          <div className="flex gap-2">
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
                Votazioni più recenti dei deputati della Camera dei Deputati
              </CardDescription>
            </CardHeader>
            <CardContent>
              {votazioni.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Nessuna votazione trovata. Esegui lo script Python per popolare la tabella voti_camera.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Politico</TableHead>
                        <TableHead className="min-w-[150px]">Data Votazione</TableHead>
                        <TableHead className="min-w-[300px]">Oggetto Voto</TableHead>
                        <TableHead className="min-w-[120px]">Esito</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {votazioni.map((votazione, index) => (
                        <TableRow key={`${votazione.politico_nome}-${index}`}>
                          <TableCell className="font-medium">
                            {votazione.politico_nome || "N/A"}
                          </TableCell>
                          <TableCell>
                            {votazione.data_votazione ? formatDate(votazione.data_votazione) : "N/A"}
                          </TableCell>
                          <TableCell className="max-w-[400px]">
                            <div className="truncate" title={votazione.oggetto_voto || ""}>
                              {votazione.oggetto_voto || "N/A"}
                            </div>
                          </TableCell>
                          <TableCell>
                            {votazione.esito_voto ? (
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                votazione.esito_voto.toLowerCase().includes('favorevole') || 
                                votazione.esito_voto.toLowerCase().includes('sì') ||
                                votazione.esito_voto.toLowerCase().includes('approvato')
                                  ? 'bg-green-100 text-green-800' 
                                  : votazione.esito_voto.toLowerCase().includes('contrario') ||
                                    votazione.esito_voto.toLowerCase().includes('no') ||
                                    votazione.esito_voto.toLowerCase().includes('respinto')
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {votazione.esito_voto}
                              </span>
                            ) : (
                              "N/A"
                            )}
                          </TableCell>
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
                  <strong>Politici unici:</strong> {uniquePolitici.length}
                </p>
                <p className="text-xs">
                  <strong>Dati disponibili:</strong> Nome politico, Data votazione, Oggetto del voto, Esito
                </p>
                <p className="text-xs mt-2">
                  <strong>Fonte:</strong> Dati estratti dal sito della Camera dei Deputati tramite scraping automatico.
                  Ogni politico mostra la votazione più recente disponibile.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}

