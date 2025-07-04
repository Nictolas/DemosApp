import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ThumbsUp } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { useToast } from "@/hooks/use-toast";

export default function VotaReferendumAbrogativo() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Recupera la lista dei referendum abrogativi
  const { data: classifica = [], isLoading: isListaLoading } = useQuery<Array<{id: string, nome: string, voti: number, quorum?: 'ok' | 'pending' | 'no'}>>({
    queryKey: ["/api/referendum-abrogativi/classifica"],
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
      queryClient.invalidateQueries({ queryKey: ["/api/referendum-abrogativi/classifica"] });
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

  // Filtro solo quelli con quorum raggiunto
  const referendumQuorum = classifica.filter(r => r.quorum === 'ok');
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referendumQuorum.map((referendum) => (
                    <TableRow key={referendum.id}>
                      <TableCell className="font-medium">{referendum.nome}</TableCell>
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
                    </TableRow>
                  ))}
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
      </div>
    </div>
  );
} 