import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ExternalLink, ArrowLeft, Check, Hourglass, X as XIcon, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AdminIniziativeManager } from "./VotaIniziativaPopolare/components/AdminIniziativeManager";

interface Iniziativa {
  id: string;
  nome: string;
  sitoWeb?: string;
  quorum: string;
  firestoreid?: string;
}

export default function IniziativePopolare() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 1. Caricamento dati con React Query
  const { data: listaIniziative = [], isLoading, isError } = useQuery<Iniziativa[]>({
    queryKey: ['iniziativePopolari'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/iniziative-popolari");
      if (!response.ok) throw new Error("Errore nel caricamento delle iniziative popolari");
      const result = await response.json();
      // Estrai l'array delle iniziative dalla risposta API
      return result.iniziative || [];
    },
    enabled: !!user,
  });

  const invalidateAndRefetch = () => queryClient.invalidateQueries({ queryKey: ['iniziativePopolari'] });

  // 2. Mutazioni gestite da React Query
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/iniziative-popolari/${id}`),
    onSuccess: () => {
      toast({ title: "Iniziativa rimossa", description: "L'iniziativa popolare è stata rimossa." });
      invalidateAndRefetch();
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message || "Impossibile rimuovere l'iniziativa popolare.", variant: "destructive" }),
  });

  const quorumMutation = useMutation({
    mutationFn: ({ id, quorum }: { id: string, quorum: 'accepted' | 'pending' | 'rejected' }) => apiRequest("PATCH", `/api/iniziative-popolari/${id}/quorum`, { quorum }),
    onSuccess: () => {
      toast({ title: "Stato aggiornato", description: "Lo stato dell'iniziativa è stato aggiornato." });
      invalidateAndRefetch();
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message || "Impossibile aggiornare lo stato dell'iniziativa popolare.", variant: "destructive" }),
  });

  if (isAuthLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Redirect to="/auth" />;
  
  const quorumOptions = [
    { value: 'accepted', label: 'Accettata', icon: <Check className="text-green-600 inline" /> },
    { value: 'pending', label: 'In attesa', icon: <Hourglass className="text-yellow-500 inline" /> },
    { value: 'rejected', label: 'Rifiutata', icon: <XIcon className="text-red-600 inline" /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 page-with-navbar">
      <div className="container mx-auto px-4 py-8 space-y-6">
        <Link href="/menu"><Button variant="ghost" className="mb-4 flex items-center"><ArrowLeft className="mr-2 h-4 w-4" />Torna al Menu</Button></Link>
        <Card className="w-full max-w-6xl mx-auto bg-white">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold">Iniziative Popolari</CardTitle>
            <CardDescription>Consulta le iniziative popolari disponibili per la votazione.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Sezione Admin - Gestisci Iniziative Popolari */}
            <AdminIniziativeManager 
              userRole={user?.ruolo || user?.role} 
              userEmail={user?.email}
            />
            
            <Card className="bg-white">
              <CardHeader><CardTitle>Iniziative Popolari</CardTitle></CardHeader>
              <CardContent>
                {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                : isError ? <div className="text-center text-red-500 p-4">Errore nel caricamento delle iniziative popolari.</div>
                : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Stato</TableHead>{user.ruolo === 'Admin' && <TableHead className="text-right">Azioni</TableHead>}</TableRow></TableHeader>
                      <TableBody>
                        {listaIniziative.length === 0 ? <TableRow><TableCell colSpan={user.ruolo === 'Admin' ? 3 : 2} className="text-center py-8 text-gray-500">Nessuna iniziativa popolare disponibile.</TableCell></TableRow>
                        : listaIniziative.map((iniz) => (
                          <TableRow key={iniz.id}>
                            <TableCell className="font-medium">
                              {iniz.sitoWeb ? <a href={iniz.sitoWeb} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">{iniz.nome}<ExternalLink className="h-4 w-4" /></a> : iniz.nome}
                            </TableCell>
                            <TableCell>
                                {user.ruolo === 'Admin' ? (
                                    <select className="border rounded px-2 py-1 bg-white" value={iniz.quorum} disabled={quorumMutation.isPending} onChange={e => quorumMutation.mutate({id: iniz.id, quorum: e.target.value as 'accepted' | 'pending' | 'rejected'})}>
                                        {quorumOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </select>
                                ) : (
                                    <span className="flex items-center gap-1">{quorumOptions.find(opt => opt.value === iniz.quorum)?.icon} {quorumOptions.find(opt => opt.value === iniz.quorum)?.label}</span>
                                )}
                            </TableCell>
                            {user.ruolo === 'Admin' && (
                              <TableCell className="text-right">
                                <Button size="sm" variant="destructive" disabled={deleteMutation.isPending && deleteMutation.variables === iniz.id} onClick={() => deleteMutation.mutate(iniz.id)}>
                                  {deleteMutation.isPending && deleteMutation.variables === iniz.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}