import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth-neon";
import { Plus, Loader2 } from "lucide-react";

const createIniziativaSchema = z.object({
  nome: z.string().min(1, "Il nome è obbligatorio").max(200, "Il nome non può superare i 200 caratteri"),
  sitoWeb: z.string().url("Inserisci un URL valido").optional().or(z.literal("")),
  descrizione: z.string().min(10, "La descrizione deve avere almeno 10 caratteri").max(1000, "La descrizione non può superare i 1000 caratteri"),
  dataInizio: z.string().min(1, "La data di inizio è obbligatoria"),
  dataFine: z.string().min(1, "La data di fine è obbligatoria"),
});

type CreateIniziativaFormData = z.infer<typeof createIniziativaSchema>;

export const CreateIniziativaForm: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);

  const form = useForm<CreateIniziativaFormData>({
    resolver: zodResolver(createIniziativaSchema),
    defaultValues: {
      nome: "",
      sitoWeb: "",
      descrizione: "",
      dataInizio: "",
      dataFine: "",
    },
  });

  const createIniziativaMutation = useMutation({
    mutationFn: (data: CreateIniziativaFormData) => {
      const payload = {
        nome: data.nome,
        sito_web: data.sitoWeb || null,
        descrizione: data.descrizione,
        data_inizio: data.dataInizio,
        data_fine: data.dataFine,
        userid: user?.id,
        status: "pending",
        quorum: "ok"
      };
      return apiRequest("POST", "/api/iniziative-popolari/richiesta", payload);
    },
    onSuccess: () => {
      toast({
        title: "Richiesta inviata",
        description: "La tua richiesta di iniziativa popolare è stata inviata per l'approvazione.",
      });
      form.reset();
      setIsExpanded(false);
      queryClient.invalidateQueries({ queryKey: ['iniziativePopolariData'] });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile inviare la richiesta.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateIniziativaFormData) => {
    createIniziativaMutation.mutate(data);
  };

  if (!isExpanded) {
    return (
      <Card className="bg-white">
        <CardContent className="p-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">Proponi una Nuova Iniziativa Popolare</h3>
            <p className="text-gray-600 mb-4">
              Hai un'idea per una nuova iniziativa popolare? Proponila qui!
            </p>
            <Button 
              onClick={() => setIsExpanded(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Proponi Iniziativa
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Plus className="h-5 w-5 mr-2" />
          Proponi una Nuova Iniziativa Popolare
        </CardTitle>
        <CardDescription>
          Compila il modulo per proporre una nuova iniziativa popolare. La richiesta sarà esaminata da un amministratore.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome dell'Iniziativa *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Es: Basta Quorum per i Referendum"
                      {...field}
                      disabled={createIniziativaMutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sitoWeb"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sito Web (opzionale)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://esempio.com"
                      {...field}
                      disabled={createIniziativaMutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="descrizione"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrizione *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descrivi in dettaglio l'iniziativa popolare che vuoi proporre..."
                      className="min-h-[100px]"
                      {...field}
                      disabled={createIniziativaMutation.isPending}
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
                    <FormLabel>Data di Inizio *</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        disabled={createIniziativaMutation.isPending}
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
                    <FormLabel>Data di Fine *</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        disabled={createIniziativaMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="submit"
                disabled={createIniziativaMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {createIniziativaMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                )}
                Invia Richiesta
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsExpanded(false);
                  form.reset();
                }}
                disabled={createIniziativaMutation.isPending}
              >
                Annulla
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

