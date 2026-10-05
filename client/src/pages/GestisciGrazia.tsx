import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link, useLocation } from "wouter";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, ArrowLeft, Check, X, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface GraziaRequest {
  id: string;
  nome: string;
  urlProva: string;
  userId: string;
}

interface UserPublicInfo {
  nome: string;
  cognome: string;
}

export default function GestisciGrazia() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [userMap, setUserMap] = useState<Record<string, UserPublicInfo>>({});

  // 1. Caricamento delle richieste con React Query
  const { data: requests = [], isLoading, isError, error } = useQuery<GraziaRequest[]>({
    queryKey: ['graziaRequests'],
    queryFn: async () => {
      const response = await apiRequest('GET', "/api/grazia/richieste");
      if (!response.ok) throw new Error("Errore nel recupero delle richieste");
      return response.json();
    },
    enabled: !!user, // Esegui solo se l'utente è loggato
  });

  // 2. Effetto per caricare i dati degli utenti quando le richieste cambiano
  useEffect(() => {
    const fetchUsers = async () => {
      const ids = Array.from(new Set(requests.map(r => r.userId).filter(Boolean)));
      if (ids.length === 0) return;

      const newMap: Record<string, UserPublicInfo> = {};
      await Promise.all(ids.map(async (id) => {
        try {
          const res = await apiRequest('GET', `/api/users/${id}/public`);
          if (res.ok) {
            newMap[id] = await res.json();
          }
        } catch (e) {
          console.error(`Failed to fetch user ${id}`, e);
        }
      }));
      setUserMap(newMap);
    };
    fetchUsers();
  }, [requests]);

  // 3. Mutazione per gestire le azioni (accetta/rifiuta)
  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'accetta' | 'rifiuta' }) =>
      apiRequest('POST', `/api/grazia/richiesta/${id}/${action}`),
    onSuccess: (_, { action }) => {
      toast({ title: "Successo", description: `Richiesta ${action === 'accetta' ? 'accettata' : 'rifiutata'}.` });
      // Invalida la query per forzare un ricaricamento automatico della lista
      queryClient.invalidateQueries({ queryKey: ['graziaRequests'] });
    },
    onError: () => {
      toast({ title: "Errore", description: "L'azione sulla richiesta è fallita.", variant: "destructive" });
    },
  });

  if (isAuthLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  if (!user) {
    return <Redirect to="/auth" />;
  }

  if (user.ruolo !== "AD") {
    return <Redirect to="/menu" />;
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-background to-secondary/20 p-4 page-with-navbar">
      <div className="container mx-auto max-w-3xl">
        <Button variant="ghost" className="mb-4 flex items-center" onClick={() => setLocation("/gestisci")}> <ArrowLeft className="mr-2 h-4 w-4" /> Torna a Gestisci </Button>
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4"><div className="p-4 bg-linear-to-r from-green-500 to-green-700 rounded-full"><Heart className="h-10 w-10 text-white" /></div></div>
            <CardTitle className="text-2xl font-bold">Gestisci Grazia</CardTitle>
            <CardDescription>Gestisci le richieste di grazia pendenti.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : isError ? (
              <div className="text-center text-red-500 py-8">{(error as Error).message}</div>
            ) : requests.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">Nessuna richiesta pendente.</div>
            ) : (
              <div className="space-y-4">
                {requests.map(r => (
                  <div key={r.id} className="border rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <div className="font-semibold">{r.nome}</div>
                      <a href={r.urlProva} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-sm break-all">{r.urlProva}</a>
                      <div className="text-xs text-muted-foreground mt-1">
                        Richiesta da utente: {userMap[r.userId] ? (
                          <Link href={`/menu/profilo/${r.userId}`} className="text-blue-700 underline hover:text-blue-900 cursor-pointer">
                            {userMap[r.userId].nome} {userMap[r.userId].cognome}
                          </Link>
                        ) : r.userId}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2 md:mt-0">
                      <Button size="sm" variant="outline" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ id: r.id, action: 'accetta' })}>
                        {actionMutation.isPending && actionMutation.variables?.id === r.id && actionMutation.variables?.action === 'accetta' ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4 mr-1"/>}
                        Accetta
                      </Button>
                      <Button size="sm" variant="destructive" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ id: r.id, action: 'rifiuta' })}>
                        {actionMutation.isPending && actionMutation.variables?.id === r.id && actionMutation.variables?.action === 'rifiuta' ? <Loader2 className="h-4 w-4 animate-spin"/> : <X className="h-4 w-4 mr-1"/>}
                        Rifiuta
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
