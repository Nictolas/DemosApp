import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Loader2, ArrowLeft, Vote, AlertCircle, Edit, ExternalLink, Search, X, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface VotazioneCamera {
  politico_nome: string;
  camera: string;
  url_openpolis: string;
  foto_url: string | null;
  votazione: string | null;
  descrizione_votazione: string | null;
  voto: string | null;
  data_votazione: string | null;
  ultimo_aggiornamento: string | null;
  spiegazione: string | null;
  votazione_id: number | null;
}

interface VotazioneParlamento {
  votazione_id: number;
  titolo_votazione: string;
  descrizione_votazione: string | null;
  camera: string;
  data_votazione: string | null;
  spiegazione: string | null;
  url_votazione: string | null;
  numero_seduta: number | null;
  tipo_atto: string | null;
  sigla_atto: string | null;
  numero_atto: number | null;
  created_at: string | null;
  updated_at: string | null;
  numero_politici: number;
}

export default function VotiPolitici() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingUrl, setEditingUrl] = useState<{ politico: string; url: string } | null>(null);
  const [politicoDialog, setPoliticoDialog] = useState<VotazioneCamera | null>(null);
  const [votazioneDialog, setVotazioneDialog] = useState<{ votazione_id: number; titolo: string; descrizione: string | null; spiegazione: string | null; camera: string; data_votazione: string | null; politici: Array<{ politico_nome: string; voto: string | null }> } | null>(null);
  const [newUrl, setNewUrl] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const isAdmin = user?.ruolo === "AD";

  // Query per recuperare i dati delle votazioni dalla tabella voti_camera (voti dei politici)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/voti-camera"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/voti-camera");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Errore nel recupero dei dati");
      }
      const result = await response.json();
      return result.data || [];
    },
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });

  // Query per recuperare le votazioni uniche da votazioni_parlamento
  const { data: votazioniData, isLoading: isLoadingVotazioni, error: errorVotazioni, refetch: refetchVotazioni } = useQuery({
    queryKey: ["/api/voti-camera/votazioni"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/voti-camera/votazioni");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Errore nel recupero delle votazioni");
      }
      const result = await response.json();
      return result.data || [];
    },
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });

  // Mutation per aggiornare l'URL
  const updateUrlMutation = useMutation({
    mutationFn: async ({ politico, url }: { politico: string; url: string }) => {
      const response = await apiRequest("PUT", `/api/voti-camera/${encodeURIComponent(politico)}/url`, {
        url_openpolis: url,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Errore nell'aggiornamento");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voti-camera"] });
      toast({
        title: "URL aggiornato",
        description: "L'URL è stato aggiornato con successo",
      });
      setEditingUrl(null);
      setNewUrl("");
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation per sincronizzare
  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/voti-camera/sync");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Errore nella sincronizzazione");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sincronizzazione avviata",
        description: "La sincronizzazione è stata avviata in background",
      });
      setTimeout(() => {
        refetch();
      }, 5000);
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation per cancellare un politico
  const deletePoliticoMutation = useMutation({
    mutationFn: async (politicoNome: string) => {
      const response = await apiRequest("DELETE", `/api/voti-camera/${encodeURIComponent(politicoNome)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Errore nella cancellazione");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voti-camera"] });
      toast({
        title: "Politico cancellato",
        description: "Il politico è stato cancellato con successo da voti_camera e users",
      });
      setPoliticoDialog(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation per generare spiegazione (usa votazione_id invece di politico_nome)
  const generaSpiegazioneMutation = useMutation({
    mutationFn: async (votazioneId: number) => {
      console.log(`[DEBUG] Inizio generazione spiegazione per votazione_id: ${votazioneId}`);
      const url = `/api/voti-camera/votazione/${votazioneId}/spiegazione`;
      console.log(`[DEBUG] URL chiamata: ${url}`);
      
      const response = await apiRequest("POST", url);
      console.log(`[DEBUG] Risposta ricevuta: status=${response.status}, ok=${response.ok}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`[DEBUG] Errore nella risposta:`, errorData);
        throw new Error(errorData.message || errorData.error || `Errore ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log(`[DEBUG] Risultato generazione:`, result);
      return result;
    },
    onSuccess: (data) => {
      console.log(`[DEBUG] Successo generazione spiegazione:`, data);
      queryClient.invalidateQueries({ queryKey: ["/api/voti-camera"] });
      queryClient.invalidateQueries({ queryKey: ["/api/voti-camera/votazioni"] });
      toast({
        title: "Spiegazione generata",
        description: data.message || "La spiegazione è stata generata con successo",
      });
      setTimeout(() => {
        refetch();
        refetchVotazioni();
      }, 2000);
    },
    onError: (error: Error) => {
      console.error(`[DEBUG] Errore nella generazione spiegazione:`, error);
      toast({
        title: "Errore nella generazione",
        description: error.message || "Si è verificato un errore durante la generazione della spiegazione",
        variant: "destructive",
      });
    },
  });

  const votazioni: VotazioneCamera[] = data || [];
  
  // Filtra le votazioni in base al termine di ricerca
  const filteredVotazioni = votazioni.filter((votazione) => {
    if (!searchTerm.trim()) return true;
    const searchLower = searchTerm.toLowerCase().trim();
    return (
      votazione.politico_nome?.toLowerCase().includes(searchLower) ||
      votazione.camera?.toLowerCase().includes(searchLower) ||
      votazione.votazione?.toLowerCase().includes(searchLower) ||
      votazione.voto?.toLowerCase().includes(searchLower)
    );
  });

  const handleEditUrl = (politico: string, currentUrl: string) => {
    setEditingUrl({ politico, url: currentUrl });
    setNewUrl(currentUrl);
  };

  const handleSaveUrl = () => {
    if (editingUrl && newUrl) {
      if (!newUrl.startsWith("https://parlamento19.openpolis.it")) {
        toast({
          title: "URL non valido",
          description: "L'URL deve essere un link valido a parlamento19.openpolis.it",
          variant: "destructive",
        });
        return;
      }
      updateUrlMutation.mutate({ politico: editingUrl.politico, url: newUrl });
    }
  };

  const getVotoColor = (voto: string | null) => {
    if (!voto) return "bg-gray-100 text-gray-800";
    const votoLower = voto.toLowerCase();
    if (votoLower.includes("favorevole")) return "bg-green-100 text-green-800";
    if (votoLower.includes("contrario")) return "bg-red-100 text-red-800";
    if (votoLower.includes("missione") || votoLower.includes("astenuto")) return "bg-yellow-100 text-yellow-800";
    return "bg-gray-100 text-gray-800";
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
                <Vote className="h-8 w-8 text-blue-600" />
                Voti Politici
              </h1>
              <p className="text-muted-foreground mt-1">
                Votazioni più recenti di deputati e senatori
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Button
                variant="outline"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
              >
                {syncMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Sincronizza
              </Button>
            )}
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

        {/* Tabs per Votazioni e Voti Politici */}
        {!isLoading && !error && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Voti e Votazioni Parlamentari</CardTitle>
                  <CardDescription>
                    Visualizza votazioni uniche o voti dei singoli politici
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="voti-politici" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="voti-politici">Voti Politici</TabsTrigger>
                  <TabsTrigger value="votazioni">Votazioni</TabsTrigger>
                </TabsList>

                {/* Tab: Voti Politici */}
                <TabsContent value="voti-politici" className="mt-4">
              {/* Barra di ricerca */}
              <div className="mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Cerca per nome politico, camera, votazione, voto o spiegazione..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-10"
                  />
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                      onClick={() => setSearchTerm("")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              
              {filteredVotazioni.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {searchTerm 
                      ? `Nessun risultato trovato per "${searchTerm}". ${votazioni.length === 0 && isAdmin ? "Clicca su 'Sincronizza' per popolare la tabella." : ""}`
                      : `Nessuna votazione trovata. ${isAdmin ? "Clicca su 'Sincronizza' per popolare la tabella." : ""}`
                    }
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[80px]">Foto</TableHead>
                        <TableHead className="min-w-[200px]">Politico</TableHead>
                        <TableHead className="min-w-[100px]">Camera</TableHead>
                        <TableHead className="min-w-[300px]">Votazione</TableHead>
                        <TableHead className="min-w-[120px]">Voto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredVotazioni.map((votazione, index) => (
                        <TableRow key={`${votazione.politico_nome}-${index}`}>
                          <TableCell>
                            {votazione.foto_url && votazione.foto_url.trim() !== '' ? (
                              <img 
                                src={votazione.foto_url} 
                                alt={votazione.politico_nome || "Politico"}
                                className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                                loading="lazy"
                                crossOrigin="anonymous"
                                onError={(e) => {
                                  // Sostituisci l'immagine con un placeholder se non carica
                                  const target = e.currentTarget;
                                  const placeholder = document.createElement('div');
                                  placeholder.className = 'w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-300';
                                  placeholder.innerHTML = '<span class="text-gray-400 text-xs">N/A</span>';
                                  target.parentNode?.replaceChild(placeholder, target);
                                }}
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-300">
                                <span className="text-gray-400 text-xs">N/A</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            <button
                              onClick={() => setPoliticoDialog(votazione)}
                              className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                            >
                              {votazione.politico_nome || "N/A"}
                            </button>
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              votazione.camera === "Senato" 
                                ? "bg-purple-100 text-purple-800" 
                                : "bg-blue-100 text-blue-800"
                            }`}>
                              {votazione.camera || "N/A"}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-[400px]">
                            {votazione.votazione && votazione.votazione_id ? (
                              <button
                                onClick={() => {
                                  // Recupera i dettagli della votazione
                                  apiRequest("GET", `/api/voti-camera/votazione/${votazione.votazione_id}`)
                                    .then(async (response) => {
                                      if (response.ok) {
                                        const data = await response.json();
                                        setVotazioneDialog(data.data);
                                      } else {
                                        const errorData = await response.json().catch(() => ({}));
                                        toast({
                                          title: "Errore",
                                          description: errorData.message || "Impossibile recuperare i dettagli della votazione",
                                          variant: "destructive",
                                        });
                                      }
                                    })
                                    .catch((error) => {
                                      toast({
                                        title: "Errore",
                                        description: error.message || "Errore nel recupero dei dettagli",
                                        variant: "destructive",
                                      });
                                    });
                                }}
                                className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer truncate block w-full text-left"
                                title={votazione.votazione}
                              >
                                {votazione.votazione}
                              </button>
                            ) : (
                              <div className="truncate" title={votazione.votazione || ""}>
                                {votazione.votazione || "N/A"}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {votazione.voto ? (
                              <span className={`px-2 py-1 rounded text-xs font-medium ${getVotoColor(votazione.voto)}`}>
                                {votazione.voto}
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
                </TabsContent>

                {/* Tab: Votazioni */}
                <TabsContent value="votazioni" className="mt-4">
                  {isLoadingVotazioni ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                      <p className="ml-4 text-muted-foreground">Caricamento votazioni...</p>
                    </div>
                  ) : errorVotazioni ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Errore nel caricamento delle votazioni. Riprova più tardi.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      {/* Barra di ricerca per votazioni */}
                      <div className="mb-6">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="text"
                            placeholder="Cerca per titolo, camera, tipo atto, sigla..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-10"
                          />
                          {searchTerm && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                              onClick={() => setSearchTerm("")}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Tabella Votazioni */}
                      {(() => {
                        const votazioni: VotazioneParlamento[] = votazioniData || [];
                        const filteredVotazioniTab = votazioni.filter((v) => {
                          if (!searchTerm.trim()) return true;
                          const searchLower = searchTerm.toLowerCase().trim();
                          return (
                            v.titolo_votazione?.toLowerCase().includes(searchLower) ||
                            v.camera?.toLowerCase().includes(searchLower) ||
                            v.tipo_atto?.toLowerCase().includes(searchLower) ||
                            v.sigla_atto?.toLowerCase().includes(searchLower) ||
                            v.spiegazione?.toLowerCase().includes(searchLower)
                          );
                        });

                        return filteredVotazioniTab.length === 0 ? (
                          <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              {searchTerm
                                ? `Nessun risultato trovato per "${searchTerm}".`
                                : `Nessuna votazione trovata. ${isAdmin ? "Clicca su 'Sincronizza' per popolare la tabella." : ""}`
                              }
                            </AlertDescription>
                          </Alert>
                        ) : (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="min-w-[200px] max-w-[300px]">Titolo Votazione</TableHead>
                                  <TableHead className="min-w-[100px]">Camera</TableHead>
                                  <TableHead className="min-w-[120px]">Data</TableHead>
                                  <TableHead className="min-w-[100px]">Tipo Atto</TableHead>
                                  <TableHead className="min-w-[100px]">Sigla</TableHead>
                                  <TableHead className="min-w-[80px]">Politici</TableHead>
                                  <TableHead className="min-w-[400px]">Spiegazione</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {filteredVotazioniTab.map((votazione) => (
                                  <TableRow key={votazione.votazione_id}>
                                    <TableCell className="font-medium max-w-[300px]">
                                      <button
                                        onClick={() => {
                                          apiRequest("GET", `/api/voti-camera/votazione/${votazione.votazione_id}`)
                                            .then(async (response) => {
                                              if (response.ok) {
                                                const data = await response.json();
                                                setVotazioneDialog(data.data);
                                              } else {
                                                const errorData = await response.json().catch(() => ({}));
                                                toast({
                                                  title: "Errore",
                                                  description: errorData.message || "Impossibile recuperare i dettagli",
                                                  variant: "destructive",
                                                });
                                              }
                                            })
                                            .catch((error) => {
                                              toast({
                                                title: "Errore",
                                                description: error.message || "Errore nel recupero",
                                                variant: "destructive",
                                              });
                                            });
                                        }}
                                        className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer whitespace-pre-wrap break-words block w-full text-left"
                                        title={votazione.titolo_votazione}
                                      >
                                        {votazione.titolo_votazione}
                                      </button>
                                    </TableCell>
                                    <TableCell>
                                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                                        votazione.camera === "Senato"
                                          ? "bg-purple-100 text-purple-800"
                                          : "bg-blue-100 text-blue-800"
                                      }`}>
                                        {votazione.camera || "N/A"}
                                      </span>
                                    </TableCell>
                                    <TableCell>
                                      {votazione.data_votazione
                                        ? new Date(votazione.data_votazione).toLocaleDateString('it-IT')
                                        : "N/A"}
                                    </TableCell>
                                    <TableCell>
                                      {votazione.tipo_atto || "N/A"}
                                    </TableCell>
                                    <TableCell>
                                      {votazione.sigla_atto || "N/A"}
                                    </TableCell>
                                    <TableCell>
                                      <span className="text-sm text-gray-600">
                                        {votazione.numero_politici || 0}
                                      </span>
                                    </TableCell>
                                    <TableCell className="max-w-[500px]">
                                      {votazione.spiegazione ? (
                                        <div className="text-sm text-gray-700">
                                          {votazione.spiegazione}
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2">
                                          <span className="text-gray-400 italic text-sm">Non disponibile</span>
                                          {isAdmin && (
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => generaSpiegazioneMutation.mutate(votazione.votazione_id)}
                                              disabled={generaSpiegazioneMutation.isPending}
                                              className="h-7 text-xs"
                                            >
                                              {generaSpiegazioneMutation.isPending ? (
                                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                              ) : null}
                                              Genera
                                            </Button>
                                          )}
                                        </div>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Dialog per visualizzare/modificare informazioni politico */}
        <Dialog open={!!politicoDialog} onOpenChange={(open) => !open && setPoliticoDialog(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{politicoDialog?.politico_nome}</DialogTitle>
              <DialogDescription>
                Informazioni e URL Openpolis per {politicoDialog?.politico_nome}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              {/* Camera */}
              <div>
                <label className="text-sm font-medium mb-2 block">Camera</label>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  politicoDialog?.camera === "Senato" 
                    ? "bg-purple-100 text-purple-800" 
                    : "bg-blue-100 text-blue-800"
                }`}>
                  {politicoDialog?.camera || "N/A"}
                </span>
              </div>

              {/* URL Openpolis */}
              <div>
                <label className="text-sm font-medium mb-2 block">URL Openpolis</label>
                <div className="flex items-center gap-2">
                  <Input
                    value={politicoDialog?.url_openpolis || ""}
                    onChange={(e) => {
                      if (politicoDialog) {
                        setPoliticoDialog({ ...politicoDialog, url_openpolis: e.target.value });
                      }
                    }}
                    placeholder="https://parlamento19.openpolis.it/persone/..."
                    className="flex-1"
                  />
                  <a
                    href={politicoDialog?.url_openpolis}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-gray-100 rounded"
                  >
                    <ExternalLink className="h-4 w-4 text-blue-600" />
                  </a>
                </div>
              </div>

              {/* Votazione */}
              {politicoDialog?.votazione && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Votazione</label>
                  <p className="text-sm text-gray-700">{politicoDialog.votazione}</p>
                </div>
              )}

              {/* Voto */}
              {politicoDialog?.voto && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Voto</label>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getVotoColor(politicoDialog.voto)}`}>
                    {politicoDialog.voto}
                  </span>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPoliticoDialog(null)}>
                Chiudi
              </Button>
              {isAdmin && (
                <>
                <Button 
                  onClick={() => {
                    if (politicoDialog) {
                      const urlToEdit = politicoDialog.url_openpolis || "";
                      setEditingUrl({ politico: politicoDialog.politico_nome, url: urlToEdit });
                      setNewUrl(urlToEdit);
                      setPoliticoDialog(null);
                    }
                  }}
                  disabled={updateUrlMutation.isPending}
                >
                  {updateUrlMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Edit className="h-4 w-4 mr-2" />
                  )}
                  Modifica URL
                </Button>
                  <Button 
                    variant="destructive"
                    onClick={() => {
                      if (politicoDialog && window.confirm(`Sei sicuro di voler cancellare il politico "${politicoDialog.politico_nome}"? Questa azione rimuoverà il politico sia da voti_camera che da users e non può essere annullata.`)) {
                        deletePoliticoMutation.mutate(politicoDialog.politico_nome);
                      }
                    }}
                    disabled={deletePoliticoMutation.isPending}
                  >
                    {deletePoliticoMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Cancella Politico
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog per modificare URL (solo admin) */}
        <Dialog open={!!editingUrl} onOpenChange={(open) => !open && setEditingUrl(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modifica URL Openpolis</DialogTitle>
              <DialogDescription>
                Modifica l'URL per {editingUrl?.politico}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://parlamento19.openpolis.it/persone/..."
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingUrl(null)}>
                Annulla
              </Button>
              <Button onClick={handleSaveUrl} disabled={updateUrlMutation.isPending}>
                {updateUrlMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Salva
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog per dettagli votazione */}
        <Dialog open={!!votazioneDialog} onOpenChange={(open) => !open && setVotazioneDialog(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl">{votazioneDialog?.titolo}</DialogTitle>
              <DialogDescription>
                Dettagli della votazione {votazioneDialog?.camera}
                {votazioneDialog?.data_votazione && ` - ${new Date(votazioneDialog.data_votazione).toLocaleDateString('it-IT')}`}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              {/* Descrizione */}
              {votazioneDialog?.descrizione && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Descrizione</label>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
                    {votazioneDialog.descrizione}
                  </p>
                </div>
              )}

              {/* Spiegazione */}
              {votazioneDialog?.spiegazione && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Spiegazione</label>
                  <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded-md">
                    {votazioneDialog.spiegazione}
                  </p>
                </div>
              )}

              {/* Politici che hanno votato */}
              {votazioneDialog?.politici && votazioneDialog.politici.length > 0 && (
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Politici che hanno votato ({votazioneDialog.politici.length})
                  </label>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {votazioneDialog.politici.map((politico, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                        <span className="text-sm font-medium">{politico.politico_nome}</span>
                        {politico.voto && (
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getVotoColor(politico.voto)}`}>
                            {politico.voto}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!votazioneDialog?.spiegazione && isAdmin && votazioneDialog?.votazione_id && (
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      generaSpiegazioneMutation.mutate(votazioneDialog.votazione_id);
                    }}
                    disabled={generaSpiegazioneMutation.isPending}
                  >
                    {generaSpiegazioneMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Genera Spiegazione
                  </Button>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setVotazioneDialog(null)}>
                Chiudi
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageContainer>
  );
}
