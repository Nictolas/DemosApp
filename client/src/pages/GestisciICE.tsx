import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect, useLocation } from "wouter";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IceCream, ArrowLeft, Check, X, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ICERequest {
  id: string;
  nome: string;
  dataInizio: string;
  dataFine: string;
  sitoWeb?: string;
}

export default function GestisciICE() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // 1. Caricamento delle richieste ICE con React Query
  const { data: requests = [], isLoading, isError, error } = useQuery<ICERequest[]>({
    queryKey: ['iceRequests'],
    queryFn: async () => {
      const response = await apiRequest('GET', "/api/ice/richieste");
      if (!response.ok) throw new Error("Errore nel recupero delle richieste ICE");
      return response.json();
    },
    enabled: !!user, // Esegui solo se l'utente è loggato
  });

  // 2. Mutazione per gestire le azioni (accetta/rifiuta)
  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'accetta' | 'rifiuta' }) =>
      apiRequest('POST', `/api/ice/${id}/${action}`),
    onSuccess: (_, { action }) => {
      toast({ title: "Successo", description: `Richiesta ICE ${action === 'accetta' ? 'accettata' : 'rifiutata'}.` });
      // Invalida la query per forzare un ricaricamento automatico
      queryClient.invalidateQueries({ queryKey: ['iceRequests'] });
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

  if (user.ruolo !== 'Admin') {
    return <Redirect to="/menu" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-100 p-4 page-with-navbar">
      <div className="container mx-auto max-w-4xl">
        <Button variant="ghost" className="mb-4 flex items-center" onClick={() => setLocation("/gestisci")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Torna a Gestisci
        </Button>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center gap-2 justify-center text-2xl">
              <IceCream className="h-6 w-6" /> Gestisci ICE
            </CardTitle>
            <CardDescription>Approva o rifiuta le Iniziative dei Cittadini Europei (ICE) proposte</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : isError ? (
              <div className="text-center text-red-500 py-8">{(error as Error).message}</div>
            ) : requests.length === 0 ? (
              <div className="text-center py-8 text-gray-500"><IceCream className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Nessuna richiesta pendente.</p></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Periodo</TableHead>
                      <TableHead>Sito Web</TableHead>
                      <TableHead className="text-right">Azione</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.nome}</TableCell>
                        <TableCell>{new Date(r.dataInizio).toLocaleDateString('it-IT')} - {new Date(r.dataFine).toLocaleDateString('it-IT')}</TableCell>
                        <TableCell>
                          {r.sitoWeb ? (<a href={r.sitoWeb} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">Visita</a>) : "N/A"}
                        </TableCell>
                        <TableCell className="flex justify-end gap-2">
                          <Button size="sm" variant="default" onClick={() => actionMutation.mutate({ id: r.id, action: 'accetta' })} disabled={actionMutation.isPending}>
                            {actionMutation.isPending && actionMutation.variables?.id === r.id && actionMutation.variables?.action === 'accetta' ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4" />}
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => actionMutation.mutate({ id: r.id, action: 'rifiuta' })} disabled={actionMutation.isPending}>
                            {actionMutation.isPending && actionMutation.variables?.id === r.id && actionMutation.variables?.action === 'rifiuta' ? <Loader2 className="h-4 w-4 animate-spin"/> : <X className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
