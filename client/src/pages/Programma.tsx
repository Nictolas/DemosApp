import React, { useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth-neon";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import { Redirect } from "wouter";

interface ProgrammaData {
  proposta1: string;
  proposta2: string;
  proposta3: string;
  proposta4: string;
  proposta5: string;
  url1: string;
  url2: string;
  url3: string;
  url4: string;
  url5: string;
}

const defaultValues: ProgrammaData = {
  proposta1: "",
  proposta2: "",
  proposta3: "",
  proposta4: "",
  proposta5: "",
  url1: "",
  url2: "",
  url3: "",
  url4: "",
  url5: "",
};

export default function Programma() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ProgrammaData>({ defaultValues });

  // 1. Caricamento dati utente e programma con React Query
  const { data, isLoading } = useQuery({
    queryKey: ['programmaData', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      // Carica il programma specifico dell'utente
      const response = await apiRequest("GET", `/api/programma/${user.id}`);
      if (!response.ok) {
        if (response.status === 404) {
          // Nessun programma trovato, restituisci valori vuoti
          return { programma: defaultValues };
        }
        throw new Error('Failed to fetch data');
      }
      const result = await response.json();
      return { programma: result.data };
    },
    enabled: !!user,
  });

  // Popola il form quando i dati vengono caricati
  useEffect(() => {
    if (data?.programma) {
      form.reset(data.programma);
    }
  }, [data, form]);

  // 2. Mutazione per salvare il programma
  const saveMutation = useMutation({
    mutationFn: async (values: ProgrammaData) => {
      const response = await apiRequest("POST", "/api/programma", {
        utente_id: user?.id,
        proposta_1: values.proposta1,
        proposta_2: values.proposta2,
        proposta_3: values.proposta3,
        proposta_4: values.proposta4,
        proposta_5: values.proposta5,
        url_1: values.url1,
        url_2: values.url2,
        url_3: values.url3,
        url_4: values.url4,
        url_5: values.url5
      });
      if (!response.ok) throw new Error("Impossibile salvare il programma.");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Salvato!", description: "Il tuo programma è stato aggiornato." });
      queryClient.invalidateQueries({ queryKey: ['programmaData', user?.id] });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    }
  });

  if (isAuthLoading || (user && isLoading)) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  const canEdit = user && ["AD", "P", "C", "Candidato Politico"].includes(user.ruolo || user.role || '');

  if (!canEdit) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4 flex items-center justify-center page-with-navbar">
        <Card><CardHeader><CardTitle>Accesso negato</CardTitle><CardDescription>Non hai i permessi per visualizzare questa pagina.</CardDescription></CardHeader></Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4 page-with-navbar">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-2xl">Programma Elettorale</CardTitle>
            <CardDescription>Inserisci le tue 5 proposte elettorali principali.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="space-y-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <div>
                    <label className="block font-medium mb-1">Proposta {n}</label>
                    <Input
                      {...form.register(`proposta${n}` as keyof ProgrammaData)}
                      placeholder={`Scrivi la proposta ${n}...`}
                      disabled={!canEdit || saveMutation.isPending}
                      className="bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-medium mb-1 text-sm text-gray-600">
                      URL {n} (opzionale)
                    </label>
                    <Input
                      {...form.register(`url${n}` as keyof ProgrammaData)}
                      placeholder={`https://esempio.com/proposta-${n}`}
                      disabled={!canEdit || saveMutation.isPending}
                      className="bg-white"
                      type="url"
                    />
                  </div>
                </div>
              ))}
              <Button type="submit" className="mt-4" disabled={!canEdit || saveMutation.isPending}>
                {saveMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvataggio...</> : "Salva Programma"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
