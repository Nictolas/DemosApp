// @ts-nocheck
import React, { useState, useEffect } from "react";
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

export default function VotaIniziativaPopolare() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [openDialog, setOpenDialog] = useState<{open: boolean, names: string[]}>({open: false, names: []});
  // Stato centralizzato per i sostegni
  const [sostegni, setSostegni] = useState<{[id: string]: {count: number, supporters: string[]}}>({});
  const [loadingSostegni, setLoadingSostegni] = useState(false);

  // Recupera la lista delle iniziative popolari
  const { data: listaIniziative = [], isLoading: isListaLoading } = useQuery<any[]>({
    queryKey: ["/api/iniziative-popolari/lista"],
    enabled: !!user,
  });

  // Recupera i like dell'utente
  const { data: userLikes = [] } = useQuery<string[]>({
    queryKey: ["/api/iniziative-popolari/voti"],
    enabled: !!user,
  });

  // Mutazione per mettere like
  const likeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch("/api/iniziative-popolari/vota", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ iniziativaId: id }),
      });
      if (!response.ok) throw new Error("Errore nel voto");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/iniziative-popolari/voti"] });
      queryClient.invalidateQueries({ queryKey: ["/api/iniziative-popolari/lista"] });
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

  useEffect(() => {
    if (!listaIniziative || !user) return;
    setLoadingSostegni(true);
    const myPeople = getMyPeople(user);
    Promise.all(
      listaIniziative.map(async (i: any) => {
        const res = await fetch(`/api/iniziative-popolari/${i.id}/votanti`);
        if (!res.ok) return [i.id, {count: 0, supporters: []}];
        const ids = await res.json();
        const filtered = ids.filter((id: string) => myPeople.includes(id));
        return [i.id, {count: filtered.length, supporters: filtered}];
      })
    ).then(results => {
      setSostegni(Object.fromEntries(results));
      setLoadingSostegni(false);
    });
  }, [JSON.stringify(listaIniziative), user && getMyPeople(user).join(",")]);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user) {
    return <Redirect to="/auth" />;
  }

  // Filtro solo quelle con quorum raggiunto
  const iniziativeQuorum = listaIniziative.filter((i: any) => i.quorum === 'ok');
  // Ordino per più votate
  iniziativeQuorum.sort((a: any, b: any) => (b.voti || 0) - (a.voti || 0));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Navbar />
      <div className="container mx-auto px-4 py-8 space-y-6">
        <Card className="w-full max-w-3xl mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Iniziative Popolari con Quorum Raggiunto</CardTitle>
            <CardDescription>Vota le iniziative popolari che hanno raggiunto il quorum. Le più votate sono in cima.</CardDescription>
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
                  {iniziativeQuorum.map((iniziativa: any) => {
                    return (
                      <TableRow key={iniziativa.id}>
                        <TableCell className="font-medium">
                          {iniziativa.sitoWeb ? (
                            <a
                              href={iniziativa.sitoWeb}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-700 underline hover:text-blue-900 cursor-pointer"
                            >
                              {iniziativa.nome}
                            </a>
                          ) : (
                            <span>{iniziativa.nome}</span>
                          )}
                        </TableCell>
                        <TableCell>{iniziativa.voti || 0}</TableCell>
                        <TableCell>
                          <Button
                            variant={userLikes.includes(iniziativa.id) ? "default" : "outline"}
                            onClick={() => likeMutation.mutate(iniziativa.id)}
                            disabled={likeMutation.isPending || userLikes.includes(iniziativa.id)}
                          >
                            <ThumbsUp className="h-4 w-4 mr-1" />
                            {userLikes.includes(iniziativa.id) ? "Votato" : "Vota"}
                          </Button>
                        </TableCell>
                        <TableCell>
                          {sostegni[iniziativa.id]?.count > 0 ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                const names = await fetchNames(sostegni[iniziativa.id].supporters);
                                setOpenDialog({open: true, names});
                              }}
                            >
                              Sostenuta da {sostegni[iniziativa.id].count} tuoi rappresentanti/candidati
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {iniziativeQuorum.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-gray-500">Nessuna iniziativa ha raggiunto il quorum.</TableCell>
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