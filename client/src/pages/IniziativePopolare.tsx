import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, ExternalLink, ArrowLeft, ClipboardList, Check, Hourglass, X as XIcon, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const iniziativaSchema = z.object({
  nome: z.string().min(1, "Il nome è obbligatorio"),
  dataInizio: z.string().min(1, "La data di inizio è obbligatoria"),
  dataFine: z.string().min(1, "La data di fine è obbligatoria"),
  sitoWeb: z.string().url("Inserisci un URL valido").or(z.literal("")).optional(),
});

type IniziativaFormData = z.infer<typeof iniziativaSchema>;

interface Iniziativa extends IniziativaFormData {
  id: string;
  quorum: 'ok' | 'pending' | 'no';
}

export default function IniziativePopolare() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const form = useForm<IniziativaFormData>({
    resolver: zodResolver(iniziativaSchema),
    defaultValues: { nome: "", dataInizio: "", dataFine: "", sitoWeb: "" },
  });

  // 1. Caricamento dati con React Query
  const { data: listaIniziative = [], isLoading, isError } = useQuery<Iniziativa[]>({
    queryKey: ['iniziativePopolari'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/iniziative-popolari");
      if (!response.ok) throw new Error("Errore nel caricamento delle iniziative");
      return response.json();
    },
    enabled: !!user,
  });

  const invalidateAndRefetch = () => queryClient.invalidateQueries({ queryKey: ['iniziativePopolari'] });

  // 2. Mutazioni gestite da React Query
  const addMutation = useMutation({
    mutationFn: (data: IniziativaFormData) => apiRequest("POST", "/api/iniziative-popolari", data),
    onSuccess: () => {
      toast({ title: "Iniziativa proposta", description: "La tua proposta è stata inviata con successo." });
      form.reset();
      setShowForm(false);
      invalidateAndRefetch();
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message || "Impossibile proporre l'iniziativa.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/iniziative-popolari/${id}`),
    onSuccess: () => {
      toast({ title: "Iniziativa cancellata", description: "L'iniziativa è stata rimossa." });
      invalidateAndRefetch();
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message || "Impossibile cancellare l'iniziativa.", variant: "destructive" }),
  });

  const quorumMutation = useMutation({
    mutationFn: ({ id, quorum }: { id: string, quorum: 'ok' | 'pending' | 'no' }) => apiRequest("PATCH", `/api/iniziative-popolari/${id}/quorum`, { quorum }),
    onSuccess: () => {
      toast({ title: "Quorum aggiornato" });
      invalidateAndRefetch();
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message || "Impossibile aggiornare il quorum.", variant: "destructive" }),
  });

  if (isAuthLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Redirect to="/auth" />;
  
  const quorumOptions = [
    { value: 'ok', label: 'Raggiunto', icon: <Check className="text-green-600 inline" /> },
    { value: 'pending', label: 'In attesa', icon: <Hourglass className="text-yellow-500 inline" /> },
    { value: 'no', label: 'Non raggiunto', icon: <XIcon className="text-red-600 inline" /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100" style={{ paddingBottom: '80px' }}>
      <div className="container mx-auto px-4 py-8 space-y-6">
        <Link href="/menu"><Button variant="ghost" className="mb-4 flex items-center"><ArrowLeft className="mr-2 h-4 w-4" />Torna al Menu</Button></Link>
        <Card className="w-full max-w-6xl mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold">Iniziative Popolari</CardTitle>
            <CardDescription>Proponi o consulta le iniziative popolari. Le più recenti sono mostrate di seguito.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              <Button onClick={() => setShowForm(!showForm)} variant={showForm ? "outline" : "default"}>
                <Plus className="mr-2 h-4 w-4" />{showForm ? "Annulla" : "Proponi Nuova Iniziativa"}
              </Button>
            </div>

            {showForm && (
              <Card><CardHeader><CardTitle>Proponi Nuova Iniziativa</CardTitle></CardHeader><CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((data) => addMutation.mutate(data))} className="space-y-4">
                    {/* ... form fields for adding ... */}
                    <Button type="submit" className="w-full" disabled={addMutation.isPending}>{addMutation.isPending ? "Invio in corso..." : "Proponi Iniziativa"}</Button>
                  </form>
                </Form>
              </CardContent></Card>
            )}

            <Card>
              <CardHeader><CardTitle>Ultime Iniziative Proposte</CardTitle></CardHeader>
              <CardContent>
                {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                : isError ? <div className="text-center text-red-500 p-4">Errore nel caricamento delle iniziative.</div>
                : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Periodo</TableHead><TableHead>Quorum</TableHead>{user.ruolo === 'Admin' && <TableHead className="text-right">Azioni</TableHead>}</TableRow></TableHeader>
                      <TableBody>
                        {listaIniziative.length === 0 ? <TableRow><TableCell colSpan={user.ruolo === 'Admin' ? 4 : 3} className="text-center py-8 text-gray-500">Nessuna iniziativa proposta.</TableCell></TableRow>
                        : listaIniziative.map((iniz) => (
                          <TableRow key={iniz.id}>
                            <TableCell className="font-medium">
                              {iniz.sitoWeb ? <a href={iniz.sitoWeb} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">{iniz.nome}<ExternalLink className="h-4 w-4" /></a> : iniz.nome}
                            </TableCell>
                            <TableCell>{new Date(iniz.dataInizio).toLocaleDateString('it-IT')} - {new Date(iniz.dataFine).toLocaleDateString('it-IT')}</TableCell>
                            <TableCell>
                                {user.ruolo === 'Admin' ? (
                                    <select className="border rounded px-2 py-1 bg-white" value={iniz.quorum} disabled={quorumMutation.isPending} onChange={e => quorumMutation.mutate({id: iniz.id, quorum: e.target.value as any})}>
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