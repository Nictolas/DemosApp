import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
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
import { Loader2, Plus, Vote, ExternalLink, Calendar, Check, Hourglass, X as XIcon } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { useToast } from "@/hooks/use-toast";

const referendumSchema = z.object({
  nome: z.string().min(1, "Il nome è obbligatorio"),
  dataInizio: z.string().min(1, "La data di inizio è obbligatoria"),
  dataFine: z.string().min(1, "La data di fine è obbligatoria"),
  sitoWeb: z.string().url("Inserisci un URL valido"),
});

type ReferendumFormData = z.infer<typeof referendumSchema>;

export default function ReferendumAbrogativi() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  // Stato quorum persistente
  const [updatingQuorum, setUpdatingQuorum] = useState<string | null>(null);
  const quorumOptions = [
    { value: 'ok', label: 'Raggiunto', icon: <Check className="text-green-600 inline" /> },
    { value: 'pending', label: 'In attesa', icon: <Hourglass className="text-yellow-500 inline" /> },
    { value: 'no', label: 'Non raggiunto', icon: <XIcon className="text-red-600 inline" /> },
  ];

  const form = useForm<ReferendumFormData>({
    resolver: zodResolver(referendumSchema),
    defaultValues: {
      nome: "",
      dataInizio: "",
      dataFine: "",
      sitoWeb: "",
    },
  });

  // Funzione helper per gestire gli errori delle mutazioni
  const handleMutationError = (error: any, actionName: string) => {
    toast({
      title: "Errore",
      description: error.message || `Si è verificato un errore durante l'operazione di ${actionName}.`,
      variant: "destructive",
    });
  };

  // Redirect to auth page if not logged in
  if (!user && !isLoading) {
    return <Redirect to="/auth" />;
  }

  // Get user's votes
  const { data: userVotes = [] } = useQuery<string[]>({
    queryKey: ["/api/referendum-abrogativi/voti"],
    enabled: !!user,
  });

  // Get ranking
  const { data: classifica = [] } = useQuery<Array<{nome: string, voti: number, dataInizio: string, dataFine: string, sitoWeb?: string, quorum?: 'ok' | 'pending' | 'no'}>>({
    queryKey: ["/api/referendum-abrogativi/classifica"],
    enabled: !!user,
  });

  // Vote mutation
  const voteMutation = useMutation({
    mutationFn: async (nome: string) => {
      const response = await fetch("/api/referendum-abrogativi/vota", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome }),
      });
      if (!response.ok) throw new Error("Errore nel voto");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referendum-abrogativi/voti"] });
      queryClient.invalidateQueries({ queryKey: ["/api/referendum-abrogativi/classifica"] });
      toast({
        title: "Voto registrato",
        description: "Il tuo voto è stato registrato con successo.",
      });
    },
    onError: (error: any) => handleMutationError(error, "voto"),
  });

  // Submit new referendum
  const submitReferendum = useMutation({
    mutationFn: async (data: ReferendumFormData) => {
      const response = await fetch("/api/referendum-abrogativi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Errore nell'invio del referendum");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Referendum proposto",
        description: "Il tuo referendum è stato proposto con successo.",
      });
      form.reset();
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/referendum-abrogativi/classifica"] });
    },
    onError: (error: any) => handleMutationError(error, "invio del referendum"),
  });

  const onSubmit = (data: ReferendumFormData) => {
    submitReferendum.mutate(data);
  };

  const handleVote = (nome: string) => {
    voteMutation.mutate(nome);
  };

  // PATCH quorum
  const patchQuorum = async (id: string, quorum: 'ok' | 'pending' | 'no') => {
    setUpdatingQuorum(id);
    try {
      const res = await fetch(`/api/referendum-abrogativi/${id}/quorum`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ quorum })
      });
      if (!res.ok) throw new Error('Errore aggiornamento quorum');
      queryClient.invalidateQueries({ queryKey: ["/api/referendum-abrogativi/classifica"] });
    } catch (e) {
      toast({ title: 'Errore', description: 'Impossibile aggiornare quorum', variant: 'destructive' });
    } finally {
      setUpdatingQuorum(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Navbar />
      {isLoading ? (
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      ) : (
        <div className="container mx-auto px-4 py-8 space-y-6">
          <Card className="w-full max-w-6xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                Referendum Abrogativi
              </CardTitle>
              <CardDescription>
                Proponi e vota per i referendum abrogativi. I 10 più votati sono mostrati di seguito.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Add new referendum button */}
              <div className="flex justify-center">
                <Button
                  onClick={() => setShowForm(!showForm)}
                  className="mb-4"
                  variant={showForm ? "outline" : "default"}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {showForm ? "Annulla" : "Proponi Nuovo Referendum"}
                </Button>
              </div>

              {/* Form for new referendum */}
              {showForm && (
                <Card>
                  <CardHeader>
                    <CardTitle>Proponi Nuovo Referendum Abrogativo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="nome"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nome del referendum</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Es: Abrogazione della legge..."
                                  {...field}
                                  disabled={submitReferendum.isPending}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="dataInizio"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Data di inizio</FormLabel>
                                <FormControl>
                                  <Input
                                    type="date"
                                    {...field}
                                    disabled={submitReferendum.isPending}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="dataFine"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Data di fine</FormLabel>
                                <FormControl>
                                  <Input
                                    type="date"
                                    {...field}
                                    disabled={submitReferendum.isPending}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="sitoWeb"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Sito web</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="https://esempio.com"
                                  {...field}
                                  disabled={submitReferendum.isPending}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Button
                          type="submit"
                          className="w-full"
                          disabled={submitReferendum.isPending}
                        >
                          {submitReferendum.isPending ? "Invio in corso..." : "Proponi Referendum"}
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              )}

              {/* Ultimi Referendum Proposti */}
              <Card>
                <CardHeader>
                  <CardTitle>Ultimi Referendum Proposti</CardTitle>
                  <CardDescription>
                    I referendum più recenti proposti dalla comunità
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>
                            <div className="flex items-center space-x-2">
                              <Calendar className="h-4 w-4" />
                              <span>Periodo</span>
                            </div>
                          </TableHead>
                          <TableHead>Sito Web</TableHead>
                          <TableHead>Quorum</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {classifica.filter(r => r.status === 'accepted')
                          .sort((a, b) => new Date(b.dataInizio).getTime() - new Date(a.dataInizio).getTime())
                          .map((referendum, index) => (
                          <TableRow key={referendum.nome}>
                            <TableCell className="font-medium">
                              {referendum.nome}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(referendum.dataInizio).toLocaleDateString('it-IT')} - {new Date(referendum.dataFine).toLocaleDateString('it-IT')}
                            </TableCell>
                            <TableCell>
                              {referendum.sitoWeb ? (
                                <a
                                  href={referendum.sitoWeb}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center space-x-1 text-blue-600 hover:text-blue-800"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                  <span>Visita</span>
                                </a>
                              ) : (
                                <span className="text-muted-foreground">N/A</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {user?.ruolo === 'Admin' ? (
                                <select
                                  className="border rounded px-2 py-1"
                                  value={referendum.quorum || 'pending'}
                                  disabled={updatingQuorum === referendum.id}
                                  onChange={e => patchQuorum(referendum.id, e.target.value as 'ok' | 'pending' | 'no')}
                                >
                                  {quorumOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className="flex items-center gap-1">
                                  {quorumOptions.find(opt => opt.value === (referendum.quorum || 'pending'))?.icon}
                                  {quorumOptions.find(opt => opt.value === (referendum.quorum || 'pending'))?.label}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {classifica.filter(r => r.status === 'accepted').length === 0 && (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <Vote className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nessun referendum proposto al momento.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}