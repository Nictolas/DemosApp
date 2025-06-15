import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Vote, ExternalLink, Calendar, ArrowLeft } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { useToast } from "@/hooks/use-toast";

const iniziativaSchema = z.object({
  nome: z.string().min(1, "Il nome è obbligatorio"),
  dataInizio: z.string().min(1, "La data di inizio è obbligatoria"),
  dataFine: z.string().min(1, "La data di fine è obbligatoria"),
  sitoWeb: z.string().url("Inserisci un URL valido").or(z.literal("")),
});

type IniziativaFormData = z.infer<typeof iniziativaSchema>;

// Funzione helper per le chiamate fetch
const fetcher = async ({ queryKey }: { queryKey: readonly unknown[] }) => {
    const response = await fetch(queryKey[0] as string);
    if (!response.ok) {
        throw new Error('La risposta della rete non era ok');
    }
    return response.json();
};

export default function IniziativePopolare() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const form = useForm<IniziativaFormData>({
    resolver: zodResolver(iniziativaSchema),
    defaultValues: {
      nome: "",
      dataInizio: "",
      dataFine: "",
      sitoWeb: "",
    },
  });

  // Get user's votes
  const { data: userVotes = [] } = useQuery<string[]>({
    queryKey: ["/api/iniziative-popolari/voti"],
    queryFn: fetcher,
    enabled: !!user,
  });

  // Get ranking
  const { data: classifica = [], isFetching: isClassificaLoading } = useQuery<Array<{nome: string, voti: number, dataInizio: string, dataFine: string, sitoWeb?: string}>>({
    queryKey: ["/api/iniziative-popolari/classifica"],
    queryFn: fetcher,
    enabled: !!user,
  });

  // Vote mutation
  const voteMutation = useMutation({
    mutationFn: async (nome: string) => {
      const response = await fetch("/api/iniziative-popolari/vota", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Errore nel voto");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Voto registrato", description: "Il tuo voto è stato registrato con successo." });
      queryClient.invalidateQueries({ queryKey: ["/api/iniziative-popolari/voti"] });
      queryClient.invalidateQueries({ queryKey: ["/api/iniziative-popolari/classifica"] });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Submit new initiative
  const submitInitiative = useMutation({
    mutationFn: async (data: IniziativaFormData) => {
      const response = await fetch("/api/iniziative-popolari", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Errore nell'invio dell'iniziativa");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Iniziativa proposta", description: "La tua iniziativa è stata proposta con successo." });
      form.reset();
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/iniziative-popolari/classifica"] });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: IniziativaFormData) => {
    submitInitiative.mutate(data);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Navbar />
      <div className="container mx-auto px-4 py-8 space-y-6">
        <Link href="/menu">
            <Button variant="ghost" className="mb-4 flex items-center">
                <ArrowLeft className="mr-2 h-4 w-4" /> Torna al Menu
            </Button>
        </Link>
        <Card className="w-full max-w-6xl mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">Iniziative Popolari</CardTitle>
            <CardDescription>Proponi e vota per le iniziative popolari. Le 10 più votate sono mostrate di seguito.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              <Button onClick={() => setShowForm(!showForm)} className="mb-4" variant={showForm ? "outline" : "default"}>
                <Plus className="mr-2 h-4 w-4" />
                {showForm ? "Annulla" : "Proponi Nuova Iniziativa"}
              </Button>
            </div>
            {showForm && (
              <Card>
                <CardHeader><CardTitle>Proponi Nuova Iniziativa</CardTitle></CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField control={form.control} name="nome" render={({ field }) => (<FormItem><FormLabel>Nome dell'iniziativa</FormLabel><FormControl><Input placeholder="Es: Iniziativa per l'ambiente" {...field} disabled={submitInitiative.isPending} /></FormControl><FormMessage /></FormItem>)} />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="dataInizio" render={({ field }) => (<FormItem><FormLabel>Data di inizio</FormLabel><FormControl><Input type="date" {...field} disabled={submitInitiative.isPending} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="dataFine" render={({ field }) => (<FormItem><FormLabel>Data di fine</FormLabel><FormControl><Input type="date" {...field} disabled={submitInitiative.isPending} /></FormControl><FormMessage /></FormItem>)} />
                      </div>
                      <FormField control={form.control} name="sitoWeb" render={({ field }) => (<FormItem><FormLabel>Sito web (opzionale)</FormLabel><FormControl><Input placeholder="https://esempio.com" {...field} disabled={submitInitiative.isPending} /></FormControl><FormMessage /></FormItem>)} />
                      <Button type="submit" className="w-full" disabled={submitInitiative.isPending}>{submitInitiative.isPending ? "Invio in corso..." : "Proponi Iniziativa"}</Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader><CardTitle>Top 10 Iniziative Popolari</CardTitle><CardDescription>Le iniziative più votate dalla comunità</CardDescription></CardHeader>
              <CardContent>
                {isClassificaLoading ? (
                    <div className="flex justify-center items-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader><TableRow><TableHead className="w-[60px]">Pos.</TableHead><TableHead>Nome</TableHead><TableHead><div className="flex items-center space-x-2"><Calendar className="h-4 w-4" /><span>Periodo</span></div></TableHead><TableHead>Sito Web</TableHead><TableHead className="w-[100px]">Voti</TableHead><TableHead className="w-[120px]">Azione</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {classifica.map((iniziativa, index) => (
                            <TableRow key={iniziativa.nome}>
                              <TableCell className="font-medium"><Badge variant={index < 3 ? "default" : "secondary"}>#{index + 1}</Badge></TableCell>
                              <TableCell className="font-medium">{iniziativa.nome}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{new Date(iniziativa.dataInizio).toLocaleDateString('it-IT')} - {new Date(iniziativa.dataFine).toLocaleDateString('it-IT')}</TableCell>
                              <TableCell>{iniziativa.sitoWeb ? (<a href={iniziativa.sitoWeb} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-1 text-blue-600 hover:text-blue-800"><ExternalLink className="h-4 w-4" /><span>Visita</span></a>) : (<span className="text-muted-foreground">N/A</span>)}</TableCell>
                              <TableCell><Badge variant="outline">{iniziativa.voti}</Badge></TableCell>
                              <TableCell>
                                <Button size="sm" variant={userVotes.includes(iniziativa.nome) ? "default" : "outline"} onClick={() => voteMutation.mutate(iniziativa.nome)} disabled={voteMutation.isPending || userVotes.includes(iniziativa.nome)}>
                                  <Vote className="mr-1 h-3 w-3" />
                                  {userVotes.includes(iniziativa.nome) ? "Votato" : "Vota"}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {classifica.length === 0 && (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400"><Vote className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Nessuna iniziativa proposta al momento.</p></div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}