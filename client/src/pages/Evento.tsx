import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth-neon";
import { useMutation } from "@tanstack/react-query";
import { Redirect } from "wouter";
import { ITALY_DATA } from "@/data/italyData";

const eventoSchema = z.object({
  nome_evento: z.string().min(1, "Il nome dell'evento è obbligatorio"),
  tipologia_evento: z.string().min(1, "La tipologia è obbligatoria"),
  paese_evento: z.string().min(1, "Il paese è obbligatorio"),
  regione_evento: z.string().min(1, "La regione è obbligatoria"),
  provincia_evento: z.string().min(1, "La provincia è obbligatoria"),
  comune_evento: z.string().min(1, "Il comune è obbligatorio"),
  indirizzo_evento: z.string().optional(),
  giorno_evento: z.string().min(1, "Il giorno è obbligatorio"),
  orario_evento: z.string().min(1, "L'orario è obbligatorio"),
});

type EventoFormData = z.infer<typeof eventoSchema>;

export default function Evento() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();

  const eventoForm = useForm<EventoFormData>({
    resolver: zodResolver(eventoSchema),
    defaultValues: {
      nome_evento: "",
      tipologia_evento: "",
      paese_evento: "Italia",
      regione_evento: "",
      provincia_evento: "",
      comune_evento: "",
      indirizzo_evento: "",
      giorno_evento: "",
      orario_evento: "",
    },
  });

  // Redirect if not logged in
  if (!user && !isLoading) {
    return <Redirect to="/auth" />;
  }

  // Show loading while user is being fetched
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Caricamento...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Watch per la selezione a sequenza
  const watchPaeseEvento = eventoForm.watch("paese_evento");
  const watchRegioneEvento = eventoForm.watch("regione_evento");
  const watchProvinciaEvento = eventoForm.watch("provincia_evento");

  // Reset dei campi dipendenti quando cambia il paese
  React.useEffect(() => {
    if (watchPaeseEvento !== "Italia") {
      eventoForm.setValue("regione_evento", "");
      eventoForm.setValue("provincia_evento", "");
      eventoForm.setValue("comune_evento", "");
    }
  }, [watchPaeseEvento, eventoForm]);

  // Reset dei campi dipendenti quando cambia la regione
  React.useEffect(() => {
    if (watchRegioneEvento) {
      eventoForm.setValue("provincia_evento", "");
      eventoForm.setValue("comune_evento", "");
    }
  }, [watchRegioneEvento, eventoForm]);

  // Reset dei campi dipendenti quando cambia la provincia
  React.useEffect(() => {
    if (watchProvinciaEvento) {
      eventoForm.setValue("comune_evento", "");
    }
  }, [watchProvinciaEvento, eventoForm]);

  const submitEvento = useMutation({
    mutationFn: async (data: EventoFormData) => {
      // Aggiungi automaticamente l'organizzatore (nome dell'utente)
      const dataWithOrganizzatore = {
        ...data,
        organizzatore: user?.nome && user?.cognome ? `${user.nome} ${user.cognome}` : user?.email || "Utente"
      };
      
      const response = await fetch("/api/eventi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataWithOrganizzatore),
      });
      if (!response.ok) {
        throw new Error("Errore nell'invio del evento");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Evento programmato",
        description: "Il tuo evento è stato programmato con successo.",
      });
      eventoForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Si è verificato un errore nella programmazione del evento.",
        variant: "destructive",
      });
    },
  });

  const onSubmitEvento = (data: EventoFormData) => {
    submitEvento.mutate(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 page-with-navbar" style={{ paddingBottom: '120px' }}>
      <div className="container mx-auto px-4 py-8 space-y-6">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">Nuovo Evento</CardTitle>
            <CardDescription className="text-center">
              Programma un nuovo evento per comunicare con i tuoi elettori
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Form {...eventoForm}>
              <form onSubmit={eventoForm.handleSubmit(onSubmitEvento)} className="space-y-4">
                <FormField
                  control={eventoForm.control}
                  name="nome_evento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Evento</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Es: Assemblea Pubblica"
                          {...field}
                          disabled={submitEvento.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={eventoForm.control}
                  name="tipologia_evento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipologia Evento</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona tipologia evento" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Assemblea">Assemblea</SelectItem>
                          <SelectItem value="Conferenza">Conferenza</SelectItem>
                          <SelectItem value="Incontro">Incontro</SelectItem>
                          <SelectItem value="Seminario">Seminario</SelectItem>
                          <SelectItem value="Workshop">Workshop</SelectItem>
                          <SelectItem value="Manifestazione">Manifestazione</SelectItem>
                          <SelectItem value="Comizio">Comizio</SelectItem>
                          <SelectItem value="Dibattito">Dibattito</SelectItem>
                          <SelectItem value="Presentazione">Presentazione</SelectItem>
                          <SelectItem value="Riunione">Riunione</SelectItem>
                          {user?.role === 'Admin' || user?.ruolo === 'Admin' ? (
                            <SelectItem value="Elezioni">Elezioni</SelectItem>
                          ) : null}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={eventoForm.control}
                  name="paese_evento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Paese</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona paese" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Italia">Italia</SelectItem>
                          <SelectItem value="Francia">Francia</SelectItem>
                          <SelectItem value="Germania">Germania</SelectItem>
                          <SelectItem value="Spagna">Spagna</SelectItem>
                          <SelectItem value="Regno Unito">Regno Unito</SelectItem>
                          <SelectItem value="altro">Altro</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={eventoForm.control}
                  name="regione_evento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Regione</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona regione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ITALY_DATA.Italia.regioni.map((regione) => (
                            <SelectItem key={regione.nome} value={regione.nome}>
                              {regione.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={eventoForm.control}
                  name="provincia_evento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Provincia</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!watchRegioneEvento}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona provincia" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {watchRegioneEvento && ITALY_DATA.Italia.regioni
                            .find(r => r.nome === watchRegioneEvento)
                            ?.province.map((provincia) => (
                              <SelectItem key={provincia.nome} value={provincia.nome}>
                                {provincia.nome}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={eventoForm.control}
                  name="comune_evento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Comune</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!watchProvinciaEvento}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona comune" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {watchProvinciaEvento && watchRegioneEvento && ITALY_DATA.Italia.regioni
                            .find(r => r.nome === watchRegioneEvento)
                            ?.province.find(p => p.nome === watchProvinciaEvento)
                            ?.comuni.map((comune) => (
                              <SelectItem key={comune} value={comune}>
                                {comune}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={eventoForm.control}
                  name="indirizzo_evento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Indirizzo (opzionale)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Es: Piazza del Duomo, 1"
                          {...field}
                          disabled={submitEvento.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={eventoForm.control}
                  name="giorno_evento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Giorno</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          disabled={submitEvento.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={eventoForm.control}
                  name="orario_evento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Orario</FormLabel>
                      <FormControl>
                        <Input
                          type="time"
                          {...field}
                          disabled={submitEvento.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />


                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={submitEvento.isPending}
                >
                  {submitEvento.isPending ? "Programmazione in corso..." : "Programma Evento"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 