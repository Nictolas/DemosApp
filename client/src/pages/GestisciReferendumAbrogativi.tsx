import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Vote, Check, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

export default function GestisciReferendumAbrogativi() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Solo admin
  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user) return <Redirect to="/auth" />;
  if (user.ruolo !== "Admin") return <Redirect to="/menu" />;

  // Carica richieste pending
  const { data: richieste = [], isLoading: loadingRichieste } = useQuery({
    queryKey: ["/api/referendum-abrogativi/richieste"],
    queryFn: async () => {
      const res = await fetch("/api/referendum-abrogativi/richieste", { credentials: "include" });
      if (!res.ok) throw new Error("Errore nel caricamento richieste");
      return res.json();
    },
  });

  // Mutazioni accetta/rifiuta
  const accetta = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/referendum-abrogativi/${id}/accetta`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Errore nell'accettare la richiesta");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Richiesta accettata" });
      queryClient.invalidateQueries({ queryKey: ["/api/referendum-abrogativi/richieste"] });
    },
    onError: () => toast({ title: "Errore", description: "Impossibile accettare", variant: "destructive" })
  });
  const rifiuta = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/referendum-abrogativi/${id}/rifiuta`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Errore nel rifiutare la richiesta");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Richiesta rifiutata" });
      queryClient.invalidateQueries({ queryKey: ["/api/referendum-abrogativi/richieste"] });
    },
    onError: () => toast({ title: "Errore", description: "Impossibile rifiutare", variant: "destructive" })
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-yellow-100 p-4">
      <div className="container mx-auto max-w-4xl">
        <Link href="/gestisci">
          <Button variant="ghost" className="mb-4 flex items-center">
            <ArrowLeft className="mr-2 h-4 w-4" /> Torna a Gestisci
          </Button>
        </Link>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center gap-2 justify-center text-2xl">
              <Vote className="h-6 w-6" /> Gestisci Referendum Abrogativi
            </CardTitle>
            <CardDescription>Approva o rifiuta le richieste di referendum abrogativi proposte dagli utenti</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingRichieste ? (
              <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : richieste.length === 0 ? (
              <div className="text-center py-8 text-gray-500"><Vote className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Nessuna richiesta pending.</p></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Periodo</TableHead>
                      <TableHead>Sito Web</TableHead>
                      <TableHead>Azione</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {richieste.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.nome}</TableCell>
                        <TableCell>{new Date(r.dataInizio).toLocaleDateString('it-IT')} - {new Date(r.dataFine).toLocaleDateString('it-IT')}</TableCell>
                        <TableCell>{r.sitoWeb ? (<a href={r.sitoWeb} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-1 text-blue-600 hover:text-blue-800"><span>Visita</span></a>) : "N/A"}</TableCell>
                        <TableCell className="flex gap-2">
                          <Button size="sm" variant="default" onClick={() => accetta.mutate(r.id)} disabled={accetta.isPending}><Check className="h-4 w-4" /></Button>
                          <Button size="sm" variant="destructive" onClick={() => rifiuta.mutate(r.id)} disabled={rifiuta.isPending}><X className="h-4 w-4" /></Button>
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