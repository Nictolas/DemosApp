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
import { Loader2, ArrowLeft, Vote, AlertCircle, Edit, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/use-auth-neon";

interface VotazioneCamera {
  politico_nome: string;
  camera: string;
  url_openpolis: string;
  votazione: string | null;
  voto: string | null;
  data_votazione: string | null;
  ultimo_aggiornamento: string | null;
}

export default function VotiPolitici() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingUrl, setEditingUrl] = useState<{ politico: string; url: string } | null>(null);
  const [newUrl, setNewUrl] = useState("");

  const isAdmin = user?.ruolo === "AD";

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

  const votazioni: VotazioneCamera[] = data || [];

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

        {/* Data Table */}
        {!isLoading && !error && (
          <Card>
            <CardHeader>
              <CardTitle>Votazioni ({votazioni.length})</CardTitle>
              <CardDescription>
                Ultima votazione per ogni politico (Camera e Senato)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {votazioni.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Nessuna votazione trovata. {isAdmin && "Clicca su 'Sincronizza' per popolare la tabella."}
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Politico</TableHead>
                        <TableHead className="min-w-[100px]">Camera</TableHead>
                        <TableHead className="min-w-[300px]">URL</TableHead>
                        <TableHead className="min-w-[300px]">Votazione</TableHead>
                        <TableHead className="min-w-[120px]">Voto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {votazioni.map((votazione, index) => (
                        <TableRow key={`${votazione.politico_nome}-${index}`}>
                          <TableCell className="font-medium">
                            {votazione.politico_nome || "N/A"}
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
                            <div className="flex items-center gap-2">
                              <a
                                href={votazione.url_openpolis}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline text-sm truncate max-w-[250px]"
                              >
                                {votazione.url_openpolis}
                              </a>
                              <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => handleEditUrl(votazione.politico_nome, votazione.url_openpolis)}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[400px]">
                            <div className="truncate" title={votazione.votazione || ""}>
                              {votazione.votazione || "N/A"}
                            </div>
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
            </CardContent>
          </Card>
        )}

        {/* Dialog per modificare URL */}
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
      </div>
    </PageContainer>
  );
}
