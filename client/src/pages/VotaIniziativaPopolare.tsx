// @ts-nocheck
import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ThumbsUp } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { useToast } from "@/hooks/use-toast";

export default function VotaIniziativaPopolare() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {iniziativeQuorum.map((iniziativa: any) => (
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
                    </TableRow>
                  ))}
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
      </div>
    </div>
  );
} 