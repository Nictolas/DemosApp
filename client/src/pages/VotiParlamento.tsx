import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { PageContainer } from "@/components/PageContainer";
import { Loader2, ArrowLeft, Vote, AlertCircle, RefreshCw, Calendar, Building2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface VotazioneParlamento {
  votazione_id: number;
  titolo_votazione: string;
  descrizione_votazione: string | null;
  camera: string;
  data_votazione: string | null;
  spiegazione: string | null;
  esito: string | null;
  legislatura: number | null;
  tipo_atto: string | null;
  sigla_atto: string | null;
  numero_atto: number | null;
}

export default function VotiParlamento() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [limit] = useState(3);

  // Query per recuperare le ultime votazioni
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/voti-politici/ultime", limit],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/voti-politici/ultime?limit=${limit}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Errore nel recupero dei dati");
      }
      const result = await response.json();
      return result.data || [];
    },
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minuti
  });

  const votazioni: VotazioneParlamento[] = data || [];

  const getCameraColor = (camera: string) => {
    if (camera === "Senato") return "bg-purple-100 text-purple-800 border-purple-300";
    return "bg-blue-100 text-blue-800 border-blue-300";
  };

  const getEsitoColor = (esito: string | null) => {
    if (!esito) return "bg-gray-100 text-gray-800 border-gray-300";
    const esitoLower = esito.toLowerCase();
    if (esitoLower.includes("approvato") || esitoLower.includes("favorevole")) {
      return "bg-green-100 text-green-800 border-green-300";
    }
    if (esitoLower.includes("non approvato") || esitoLower.includes("contrario")) {
      return "bg-red-100 text-red-800 border-red-300";
    }
    return "bg-yellow-100 text-yellow-800 border-yellow-300";
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Data non disponibile";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <PageContainer className="bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full px-4 py-6">
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
                <Vote className="h-8 w-8 text-green-600" />
                Voti Parlamento
              </h1>
              <p className="text-muted-foreground mt-1">
                Ultime {limit} votazioni del Parlamento (Camera e Senato) in ordine cronologico
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
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
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
              <Loader2 className="h-8 w-8 animate-spin text-green-600" />
              <p className="ml-4 text-muted-foreground">
                Caricamento votazioni...
              </p>
            </CardContent>
          </Card>
        )}

        {/* Votazioni List */}
        {!isLoading && !error && (
          <>
            {votazioni.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">
                    Nessuna votazione trovata. Le votazioni verranno aggiornate automaticamente.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {votazioni.map((votazione, index) => (
                  <Card
                    key={votazione.votazione_id}
                    className={`transition-all hover:shadow-lg ${
                      index === 0
                        ? "border-2 border-green-500 shadow-md"
                        : "border"
                    }`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <CardTitle className="text-xl">
                              {votazione.titolo_votazione || "Votazione senza titolo"}
                            </CardTitle>
                            {index === 0 && (
                              <Badge className="bg-green-600 text-white">
                                PIÙ RECENTE
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="flex items-center gap-4 flex-wrap mt-2">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4" />
                              <Badge
                                variant="outline"
                                className={getCameraColor(votazione.camera)}
                              >
                                {votazione.camera || "N/A"}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              <span className="text-sm">
                                {formatDate(votazione.data_votazione)}
                              </span>
                            </div>
                            {votazione.esito && (
                              <Badge
                                variant="outline"
                                className={getEsitoColor(votazione.esito)}
                              >
                                {votazione.esito}
                              </Badge>
                            )}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Descrizione */}
                      {votazione.descrizione_votazione && (
                        <div>
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {votazione.descrizione_votazione}
                          </p>
                        </div>
                      )}

                      {/* Dettagli aggiuntivi */}
                      <div className="flex flex-wrap gap-2">
                        {votazione.legislatura && (
                          <Badge variant="outline" className="text-xs">
                            📜 Legislatura {votazione.legislatura}
                          </Badge>
                        )}
                        {votazione.tipo_atto && (
                          <Badge variant="outline" className="text-xs">
                            📄 {votazione.tipo_atto}
                          </Badge>
                        )}
                        {votazione.sigla_atto && votazione.numero_atto && (
                          <Badge variant="outline" className="text-xs">
                            {votazione.sigla_atto} n. {votazione.numero_atto}
                          </Badge>
                        )}
                      </div>

                      {/* Spiegazione AI */}
                      {votazione.spiegazione && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-semibold text-blue-900">
                              Spiegazione AI
                            </span>
                          </div>
                          <p className="text-sm text-blue-900 leading-relaxed">
                            {votazione.spiegazione}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </PageContainer>
  );
}
