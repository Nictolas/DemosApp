import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ThumbsUp } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export default function VotaReferendumAbrogativo() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [openDialog, setOpenDialog] = useState<{open: boolean, names: string[]}>({open: false, names: []});

  // Recupera la lista dei referendum abrogativi
  const { data: listaReferendum = [], isLoading: isListaLoading } = useQuery<any[]>({
    queryKey: ["/api/referendum-abrogativi/lista"],
    enabled: !!user,
  });

  // Recupera i like dell'utente
  const { data: userLikes = [] } = useQuery<string[]>({
    queryKey: ["/api/referendum-abrogativi/voti"],
    enabled: !!user,
  });

  // Mutazione per mettere like
  const likeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch("/api/referendum-abrogativi/vota", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referendumId: id }),
      });
      if (!response.ok) throw new Error("Errore nel voto");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referendum-abrogativi/voti"] });
      queryClient.invalidateQueries({ queryKey: ["/api/referendum-abrogativi/lista"] });
      toast({ title: "Voto registrato", description: "Il tuo voto è stato registrato con successo." });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Helper per estrarre tutti i rappresentanti/candidati scelti dall'utente
  const getMyPeople = (user: any) => {
    if (!user) return [];
    return [
      user.rappresentante_europeo,
      user.rappresentante_camera,
      user.rappresentante_senato,
      user.rappresentante_regionale,
      user.rappresentante_comunale,
      user.candidato_europeo,
      user.candidato_camera,
      user.candidato_senato,
      user.candidato_regionale,
      user.candidato_comunale,
    ].filter(Boolean);
  };
  const myPeople = getMyPeople(user);

  // Funzione per recuperare i nomi dei sostenitori (API /api/users/:id)
  const fetchNames = async (ids: string[]) => {
    const results = await Promise.all(ids.map(async (id) => {
      try {
        const res = await fetch(`/api/users/${encodeURIComponent(id)}`);
        if (res.ok) {
          const data = await res.json();
          return `${data.nome} ${data.cognome}`;
        }
      } catch {}
      return id;
    }));
    return results;
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user) {
    return <Redirect to="/auth" />;
  }

  // Filtro solo quelli con quorum raggiunto
  const referendumQuorum = listaReferendum.filter(r => r.quorum === 'ok');
  // Ordino per più votati
  referendumQuorum.sort((a, b) => (b.voti || 0) - (a.voti || 0));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Navbar />
      <div className="container mx-auto px-4 py-8 space-y-6">
        <Card className="w-full max-w-3xl mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Referendum Abrogativi con Quorum Raggiunto</CardTitle>
            <CardDescription>Vota i referendum abrogativi che hanno raggiunto il quorum. I più votati sono in cima.</CardDescription>
          </CardHeader>
          <CardContent>
            {isListaLoading ? (
              <div className="flex justify-center items-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Voti</TableHead>
                    <TableHead>Like</TableHead>
                    <TableHead>Sostegno</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referendumQuorum.map((referendum) => {
                    const [supportCount, setSupportCount] = useState<number>(0);
                    const [supporters, setSupporters] = useState<string[]>([]);
                    React.useEffect(() => {
                      fetch(`/api/referendum-abrogativi/${referendum.id}/votanti`).then(async res => {
                        if (res.ok) {
                          const ids = await res.json();
                          const filtered = ids.filter((id: string) => myPeople.includes(id));
                          setSupportCount(filtered.length);
                          setSupporters(filtered);
                        }
                      });
                    }, [referendum.id, myPeople.join(",")]);
                    return (
                      <TableRow key={referendum.id}>
                        <TableCell className="font-medium">
                          {referendum.sitoWeb ? (
                            <a
                              href={referendum.sitoWeb}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-700 underline hover:text-blue-900 cursor-pointer"
                            >
                              {referendum.nome}
                            </a>
                          ) : (
                            <span>{referendum.nome}</span>
                          )}
                        </TableCell>
                        <TableCell>{referendum.voti || 0}</TableCell>
                        <TableCell>
                          <Button
                            variant={userLikes.includes(referendum.id) ? "default" : "outline"}
                            onClick={() => likeMutation.mutate(referendum.id)}
                            disabled={likeMutation.isPending || userLikes.includes(referendum.id)}
                          >
                            <ThumbsUp className="h-4 w-4 mr-1" />
                            {userLikes.includes(referendum.id) ? "Votato" : "Vota"}
                          </Button>
                        </TableCell>
                        <TableCell>
                          {supportCount > 0 ? (
                            <Button variant="outline" size="sm" onClick={async () => {
                              const names = await fetchNames(supporters);
                              setOpenDialog({open: true, names});
                            }}>
                              Sostenuta da {supportCount} tuoi rappresentanti/candidati
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {referendumQuorum.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-gray-500">Nessun referendum ha raggiunto il quorum.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        {/* Dialog per mostrare la lista */}
        <Dialog open={openDialog.open} onOpenChange={o => setOpenDialog({...openDialog, open: o})}>
          <DialogContent>
            <DialogTitle>I tuoi rappresentanti/candidati che sostengono questa proposta</DialogTitle>
            <ul className="list-disc pl-4">
              {openDialog.names.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
} 