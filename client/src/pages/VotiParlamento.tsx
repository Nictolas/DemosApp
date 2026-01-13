import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { PageContainer } from "@/components/PageContainer";
import { Loader2, ArrowLeft, Vote, AlertCircle, RefreshCw, Calendar, Building2, Sparkles, Users, CheckCircle2, XCircle, MinusCircle, User, Info, Eye, TrendingUp, TrendingDown, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

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
  // Dati tecnici Senato
  favorevoli: number | null;
  contrari: number | null;
  presenti: number | null;
  votanti: number | null;
  maggioranza: number | null;
  astenuti: number | null;
  numero_legale: number | null;
  presidente: string | null;
  tipo_seduta: string | null;
  numero_seduta: string | null;
  titolo_seduta: string | null;
  // Dati Camera
  approvato: number | null;
  // Flag
  dati_arricchiti?: boolean;
  // URI per dettagli
  uri?: string;
}

interface AnalisiLegge {
  spiegazione_generale?: string | null;
  effetti_positivi?: string | null;
  effetti_negativi?: string | null;
  numero_legge?: string | null;
  tipo_atto?: string | null;
  provider_ai?: string | null;
  modello_ai?: string | null;
  data_generazione?: string | null;
}

interface DettagliVotazione extends VotazioneParlamento {
  voti_nominali?: {
    favorevoli: string[];
    contrari: string[];
    astenuti: string[];
  } | null;
  uri_seduta?: string | null;
  analisi_legge?: AnalisiLegge | null;
}

export default function VotiParlamento() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [limit] = useState(3);
  const [selectedVotazione, setSelectedVotazione] = useState<VotazioneParlamento | null>(null);
  const [dettagliVotazione, setDettagliVotazione] = useState<DettagliVotazione | null>(null);
  const [loadingDettagli, setLoadingDettagli] = useState(false);

  // Query per recuperare le ultime votazioni
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/voti-politici/ultime", limit],
    queryFn: async () => {
      // Forza refresh per ottenere dati aggiornati da SPARQL
      const response = await apiRequest("GET", `/api/voti-politici/ultime?limit=${limit}&refresh=true`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Errore nel recupero dei dati");
      }
      const result = await response.json();
      // La risposta ora ha struttura: { camera: [...], senato: [...] }
      return {
        camera: result.camera || result.data?.camera || [],
        senato: result.senato || result.data?.senato || []
      };
    },
    retry: 2,
    staleTime: 0, // Sempre considera i dati come "stale" per forzare refresh
    cacheTime: 0, // Non cache i dati
  });

  const votazioniCamera: VotazioneParlamento[] = data?.camera || [];
  const votazioniSenato: VotazioneParlamento[] = data?.senato || [];

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

  // Funzione per caricare i dettagli di una votazione
  const handleVotazioneClick = async (votazione: VotazioneParlamento) => {
    console.log('🔍 Click su votazione:', votazione);
    console.log('🔍 URI disponibile:', votazione.uri);
    
    if (!votazione.uri) {
      console.error('❌ URI non disponibile nella votazione:', votazione);
      toast({
        title: "Errore",
        description: "URI della votazione non disponibile",
        variant: "destructive",
      });
      return;
    }

    setSelectedVotazione(votazione);
    setLoadingDettagli(true);
    setDettagliVotazione(null);

    try {
      const encodedUri = encodeURIComponent(votazione.uri);
      const response = await apiRequest("GET", `/api/voti-politici/dettagli/${encodedUri}`);
      
      if (!response.ok) {
        throw new Error("Errore nel recupero dei dettagli");
      }

      const result = await response.json();
      setDettagliVotazione(result.data);
    } catch (error) {
      console.error("Errore nel caricamento dettagli:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dettagli della votazione",
        variant: "destructive",
      });
      // Mostra comunque i dettagli base dalla card
      setDettagliVotazione(votazione as DettagliVotazione);
    } finally {
      setLoadingDettagli(false);
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
                Ultime {limit} votazioni della Camera e ultime {limit} votazioni del Senato
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
            {votazioniCamera.length === 0 && votazioniSenato.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">
                    Nessuna votazione trovata. Le votazioni verranno aggiornate automaticamente.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Sezione Camera */}
                {votazioniCamera.length > 0 && (
                  <div>
                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                      <Building2 className="h-6 w-6 text-blue-600" />
                      Camera dei Deputati
                    </h2>
                    <div className="space-y-4">
                      {votazioniCamera.map((votazione, index) => (
                        <Card
                          key={`camera-${votazione.votazione_id}`}
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
                      <div className="space-y-3">
                        {/* Badge principali */}
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
                          {votazione.numero_seduta && (
                            <Badge variant="outline" className="text-xs">
                              🏛️ Seduta n. {votazione.numero_seduta}
                            </Badge>
                          )}
                          {votazione.tipo_seduta && (
                            <Badge variant="outline" className="text-xs">
                              🕐 {votazione.tipo_seduta}
                            </Badge>
                          )}
                        </div>
                        
                        {/* Dati tecnici Senato - Statistiche votazione */}
                        {(votazione.favorevoli !== null || votazione.contrari !== null || votazione.astenuti !== null) && (
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                            <div className="text-xs font-semibold text-gray-700 mb-2">📊 Statistiche Votazione</div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              {votazione.favorevoli !== null && votazione.favorevoli !== undefined && (
                                <div className="flex items-center gap-1">
                                  <Badge variant="outline" className="text-xs bg-green-50 text-green-800 border-green-300">
                                    ✅ {votazione.favorevoli}
                                  </Badge>
                                  <span className="text-xs text-gray-600">Fav.</span>
                                </div>
                              )}
                              {votazione.contrari !== null && votazione.contrari !== undefined && (
                                <div className="flex items-center gap-1">
                                  <Badge variant="outline" className="text-xs bg-red-50 text-red-800 border-red-300">
                                    ❌ {votazione.contrari}
                                  </Badge>
                                  <span className="text-xs text-gray-600">Contr.</span>
                                </div>
                              )}
                              {votazione.astenuti !== null && votazione.astenuti !== undefined && votazione.astenuti > 0 && (
                                <div className="flex items-center gap-1">
                                  <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-800 border-yellow-300">
                                    ⚪ {votazione.astenuti}
                                  </Badge>
                                  <span className="text-xs text-gray-600">Asten.</span>
                                </div>
                              )}
                              {votazione.presenti !== null && votazione.presenti !== undefined && (
                                <div className="flex items-center gap-1">
                                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-800 border-blue-300">
                                    👥 {votazione.presenti}
                                  </Badge>
                                  <span className="text-xs text-gray-600">Pres.</span>
                                </div>
                              )}
                              {votazione.votanti !== null && votazione.votanti !== undefined && (
                                <div className="flex items-center gap-1">
                                  <Badge variant="outline" className="text-xs bg-purple-50 text-purple-800 border-purple-300">
                                    🗳️ {votazione.votanti}
                                  </Badge>
                                  <span className="text-xs text-gray-600">Vot.</span>
                                </div>
                              )}
                              {votazione.maggioranza !== null && votazione.maggioranza !== undefined && (
                                <div className="flex items-center gap-1">
                                  <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-800 border-indigo-300">
                                    📊 {votazione.maggioranza}
                                  </Badge>
                                  <span className="text-xs text-gray-600">Magg.</span>
                                </div>
                              )}
                              {votazione.numero_legale !== null && votazione.numero_legale !== undefined && (
                                <div className="flex items-center gap-1">
                                  <Badge variant="outline" className="text-xs bg-gray-50 text-gray-800 border-gray-300">
                                    ⚖️ {votazione.numero_legale}
                                  </Badge>
                                  <span className="text-xs text-gray-600">Legale</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Informazioni aggiuntive */}
                        {(votazione.presidente || votazione.titolo_seduta) && (
                          <div className="text-xs text-gray-600 space-y-1">
                            {votazione.presidente && (
                              <div>👤 Presidente: {votazione.presidente}</div>
                            )}
                            {votazione.titolo_seduta && (
                              <div>📋 {votazione.titolo_seduta}</div>
                            )}
                          </div>
                        )}
                        
                        {/* Badge dati arricchiti */}
                        {votazione.dati_arricchiti && (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                            ✨ Dati arricchiti da Openpolis
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
                      
                      {/* Pulsante Dettagli */}
                      <div className="pt-4 border-t">
                        <Button
                          onClick={() => handleVotazioneClick(votazione)}
                          variant="outline"
                          className="w-full"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Dettagli
                        </Button>
                      </div>
                        </CardContent>
                      </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sezione Senato */}
                {votazioniSenato.length > 0 && (
                  <div>
                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                      <Building2 className="h-6 w-6 text-purple-600" />
                      Senato della Repubblica
                    </h2>
                    <div className="space-y-4">
                      {votazioniSenato.map((votazione, index) => (
                        <Card
                          key={`senato-${votazione.votazione_id}`}
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
                                    {votazione.titolo_votazione || votazione.descrizione || "Votazione senza titolo"}
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
                            {votazione.descrizione && (
                              <div>
                                <p className="text-sm text-gray-700 leading-relaxed">
                                  {votazione.descrizione}
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
                            
                            {/* Pulsante Dettagli */}
                            <div className="pt-4 border-t">
                              <Button
                                onClick={() => handleVotazioneClick(votazione)}
                                variant="outline"
                                className="w-full"
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                Dettagli
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Dialog Dettagli Votazione */}
        <Dialog open={!!selectedVotazione} onOpenChange={(open) => !open && setSelectedVotazione(null)}>
          <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <Vote className="h-6 w-6 text-green-600" />
                {dettagliVotazione?.titolo || selectedVotazione?.titolo_votazione || "Dettagli Votazione"}
              </DialogTitle>
              <DialogDescription>
                Informazioni complete sulla votazione parlamentare
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="flex-1 pr-4">
              {loadingDettagli ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-green-600" />
                  <p className="ml-4 text-muted-foreground">Caricamento dettagli...</p>
                </div>
              ) : dettagliVotazione ? (
                <div className="space-y-6">
                  {/* Informazioni Base */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Info className="h-5 w-5" />
                      Informazioni Generali
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Camera</p>
                        <Badge variant="outline" className={getCameraColor(dettagliVotazione.camera)}>
                          {dettagliVotazione.camera}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Data</p>
                        <p className="text-sm font-medium">{formatDate(dettagliVotazione.data_votazione)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Esito</p>
                        <Badge variant="outline" className={getEsitoColor(dettagliVotazione.esito || null)}>
                          {dettagliVotazione.esito || "N/A"}
                        </Badge>
                      </div>
                      {dettagliVotazione.legislatura && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Legislatura</p>
                          <p className="text-sm font-medium">{dettagliVotazione.legislatura}</p>
                        </div>
                      )}
                      {dettagliVotazione.numero_seduta && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Seduta</p>
                          <p className="text-sm font-medium">n. {dettagliVotazione.numero_seduta}</p>
                        </div>
                      )}
                      {dettagliVotazione.tipo_votazione && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Tipo Votazione</p>
                          <p className="text-sm font-medium">{dettagliVotazione.tipo_votazione}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Descrizione */}
                  {dettagliVotazione.descrizione && (
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">Descrizione</h3>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {dettagliVotazione.descrizione}
                      </p>
                    </div>
                  )}

                  {/* Statistiche Votazione */}
                  {(dettagliVotazione.favorevoli !== null || dettagliVotazione.contrari !== null || 
                    dettagliVotazione.presenti !== null || dettagliVotazione.votanti !== null) && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <Users className="h-5 w-5" />
                          Statistiche Votazione
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {dettagliVotazione.favorevoli !== null && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <p className="text-xs text-green-700 font-medium">Favorevoli</p>
                              </div>
                              <p className="text-2xl font-bold text-green-800">{dettagliVotazione.favorevoli}</p>
                            </div>
                          )}
                          {dettagliVotazione.contrari !== null && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <XCircle className="h-4 w-4 text-red-600" />
                                <p className="text-xs text-red-700 font-medium">Contrari</p>
                              </div>
                              <p className="text-2xl font-bold text-red-800">{dettagliVotazione.contrari}</p>
                            </div>
                          )}
                          {dettagliVotazione.astenuti !== null && dettagliVotazione.astenuti > 0 && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <MinusCircle className="h-4 w-4 text-yellow-600" />
                                <p className="text-xs text-yellow-700 font-medium">Astenuti</p>
                              </div>
                              <p className="text-2xl font-bold text-yellow-800">{dettagliVotazione.astenuti}</p>
                            </div>
                          )}
                          {dettagliVotazione.presenti !== null && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <Users className="h-4 w-4 text-blue-600" />
                                <p className="text-xs text-blue-700 font-medium">Presenti</p>
                              </div>
                              <p className="text-2xl font-bold text-blue-800">{dettagliVotazione.presenti}</p>
                            </div>
                          )}
                          {dettagliVotazione.votanti !== null && (
                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <Vote className="h-4 w-4 text-purple-600" />
                                <p className="text-xs text-purple-700 font-medium">Votanti</p>
                              </div>
                              <p className="text-2xl font-bold text-purple-800">{dettagliVotazione.votanti}</p>
                            </div>
                          )}
                          {dettagliVotazione.maggioranza !== null && (
                            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <Info className="h-4 w-4 text-indigo-600" />
                                <p className="text-xs text-indigo-700 font-medium">Maggioranza</p>
                              </div>
                              <p className="text-2xl font-bold text-indigo-800">{dettagliVotazione.maggioranza}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Voti Nominali */}
                  {dettagliVotazione.voti_nominali && 
                   (dettagliVotazione.voti_nominali.favorevoli.length > 0 || 
                    dettagliVotazione.voti_nominali.contrari.length > 0 || 
                    dettagliVotazione.voti_nominali.astenuti.length > 0) && (
                    <>
                      <Separator />
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <User className="h-5 w-5" />
                          Voti Nominali
                        </h3>
                        
                        {dettagliVotazione.voti_nominali.favorevoli.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              <h4 className="font-semibold text-green-800">
                                Favorevoli ({dettagliVotazione.voti_nominali.favorevoli.length})
                              </h4>
                            </div>
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                              <div className="flex flex-wrap gap-2">
                                {dettagliVotazione.voti_nominali.favorevoli.map((nome, i) => (
                                  <Badge key={i} variant="outline" className="bg-green-100 text-green-800 border-green-300">
                                    {nome}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {dettagliVotazione.voti_nominali.contrari.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <XCircle className="h-4 w-4 text-red-600" />
                              <h4 className="font-semibold text-red-800">
                                Contrari ({dettagliVotazione.voti_nominali.contrari.length})
                              </h4>
                            </div>
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                              <div className="flex flex-wrap gap-2">
                                {dettagliVotazione.voti_nominali.contrari.map((nome, i) => (
                                  <Badge key={i} variant="outline" className="bg-red-100 text-red-800 border-red-300">
                                    {nome}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {dettagliVotazione.voti_nominali.astenuti.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <MinusCircle className="h-4 w-4 text-yellow-600" />
                              <h4 className="font-semibold text-yellow-800">
                                Astenuti ({dettagliVotazione.voti_nominali.astenuti.length})
                              </h4>
                            </div>
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                              <div className="flex flex-wrap gap-2">
                                {dettagliVotazione.voti_nominali.astenuti.map((nome, i) => (
                                  <Badge key={i} variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                                    {nome}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Informazioni Aggiuntive */}
                  {(dettagliVotazione.presidente || dettagliVotazione.titolo_seduta || dettagliVotazione.numero_legale) && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold">Informazioni Aggiuntive</h3>
                        <div className="space-y-2 text-sm">
                          {dettagliVotazione.presidente && (
                            <div>
                              <p className="text-muted-foreground">Presidente:</p>
                              <p className="font-medium">{dettagliVotazione.presidente}</p>
                            </div>
                          )}
                          {dettagliVotazione.titolo_seduta && (
                            <div>
                              <p className="text-muted-foreground">Titolo Seduta:</p>
                              <p className="font-medium">{dettagliVotazione.titolo_seduta}</p>
                            </div>
                          )}
                          {dettagliVotazione.numero_legale && (
                            <div>
                              <p className="text-muted-foreground">Numero Legale:</p>
                              <p className="font-medium">{dettagliVotazione.numero_legale}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Spiegazione AI (legacy) */}
                  {dettagliVotazione.spiegazione && !dettagliVotazione.analisi_legge && (
                    <>
                      <Separator />
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="h-4 w-4 text-blue-600" />
                          <h3 className="text-lg font-semibold text-blue-900">Spiegazione AI</h3>
                        </div>
                        <p className="text-sm text-blue-900 leading-relaxed">
                          {dettagliVotazione.spiegazione}
                        </p>
                      </div>
                    </>
                  )}

                  {/* Analisi Legge: Spiegazione Generale */}
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-blue-600" />
                      Spiegazione Generale
                    </h3>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      {dettagliVotazione.analisi_legge?.spiegazione_generale ? (
                        <>
                          <p className="text-sm text-blue-900 leading-relaxed whitespace-pre-line">
                            {dettagliVotazione.analisi_legge.spiegazione_generale}
                          </p>
                          {dettagliVotazione.analisi_legge.numero_legge && (
                            <p className="text-xs text-blue-700 mt-2">
                              Legge n. {dettagliVotazione.analisi_legge.numero_legge}
                              {dettagliVotazione.analisi_legge.tipo_atto && ` - ${dettagliVotazione.analisi_legge.tipo_atto}`}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-blue-700 italic">
                          {loadingDettagli ? "Caricamento analisi..." : "Analisi in generazione. Ricarica la pagina tra qualche secondo."}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Analisi Legge: Effetti Positivi */}
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                      Effetti Positivi
                    </h3>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      {dettagliVotazione.analisi_legge?.effetti_positivi ? (
                        <div className="text-sm text-green-900 leading-relaxed whitespace-pre-line">
                          {dettagliVotazione.analisi_legge.effetti_positivi.split('\n').map((line, i) => {
                            // Se la riga inizia con "-" o "*" o un numero, è un punto elenco
                            if (line.trim().match(/^[-*•]\s/) || line.trim().match(/^\d+[\.)]\s/)) {
                              return (
                                <div key={i} className="mb-2 flex items-start gap-2">
                                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                  <span>{line.trim().replace(/^[-*•]\s/, '').replace(/^\d+[\.)]\s/, '')}</span>
                                </div>
                              );
                            }
                            // Altrimenti mostra come paragrafo normale
                            return line.trim() ? <p key={i} className="mb-2">{line}</p> : null;
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-green-700 italic">
                          {loadingDettagli ? "Caricamento analisi..." : "Analisi in generazione. Ricarica la pagina tra qualche secondo."}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Analisi Legge: Effetti Negativi */}
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <TrendingDown className="h-5 w-5 text-red-600" />
                      Effetti Negativi
                    </h3>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      {dettagliVotazione.analisi_legge?.effetti_negativi ? (
                        <div className="text-sm text-red-900 leading-relaxed whitespace-pre-line">
                          {dettagliVotazione.analisi_legge.effetti_negativi.split('\n').map((line, i) => {
                            // Se la riga inizia con "-" o "*" o un numero, è un punto elenco
                            if (line.trim().match(/^[-*•]\s/) || line.trim().match(/^\d+[\.)]\s/)) {
                              return (
                                <div key={i} className="mb-2 flex items-start gap-2">
                                  <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                                  <span>{line.trim().replace(/^[-*•]\s/, '').replace(/^\d+[\.)]\s/, '')}</span>
                                </div>
                              );
                            }
                            // Altrimenti mostra come paragrafo normale
                            return line.trim() ? <p key={i} className="mb-2">{line}</p> : null;
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-red-700 italic">
                          {loadingDettagli ? "Caricamento analisi..." : "Analisi in generazione. Ricarica la pagina tra qualche secondo."}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground text-center">
                    Impossibile caricare i dettagli della votazione
                  </p>
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </PageContainer>
  );
}
