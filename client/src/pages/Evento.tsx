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
import { Redirect, useRouter } from "wouter";
import { ITALY_DATA } from "@/data/italyData";
import { apiRequest } from "@/lib/queryClient";
import DatePicker from "@/components/DatePicker";

const eventoSchema = z.object({
  nome_evento: z.string().min(1, "Il nome dell'evento è obbligatorio"),
  tipologia_evento: z.string().min(1, "La tipologia è obbligatoria"),
  paese_evento: z.string().min(1, "Il paese è obbligatorio"),
  regione_evento: z.string().optional(),
  provincia_evento: z.string().optional(),
  comune_evento: z.string().optional(),
  indirizzo_evento: z.string().optional(),
  giorno_inizio: z.string().min(1, "Il giorno di inizio è obbligatorio"),
  giorno_fine: z.string().optional(),
  orario_inizio: z.string().optional(),
  orario_fine: z.string().optional(),
}).refine((data) => {
  // Se la tipologia NON è "Elezioni", allora regione, provincia e comune sono obbligatori
  if (data.tipologia_evento !== "Elezioni") {
    return data.regione_evento && data.regione_evento.trim().length > 0 &&
           data.provincia_evento && data.provincia_evento.trim().length > 0 &&
           data.comune_evento && data.comune_evento.trim().length > 0;
  }
  return true;
}, {
  message: "Regione, provincia e comune sono obbligatori per questa tipologia di evento",
  path: ["regione_evento"]
});

type EventoFormData = z.infer<typeof eventoSchema>;

export default function Evento() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

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
      giorno_inizio: "",
      giorno_fine: "",
      orario_inizio: "",
      orario_fine: "",
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
  const watchTipologiaEvento = eventoForm.watch("tipologia_evento");

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
      
      console.log('📤 Invio dati evento:', dataWithOrganizzatore);
      
      const response = await apiRequest.post("/eventi", dataWithOrganizzatore);
      
      console.log('📥 Risposta server:', response);
      
      if (!response.success) {
        console.error('❌ Errore server:', response);
        throw new Error(response.error || "Errore nell'invio del evento");
      }
      return response;
    },
    onSuccess: (data) => {
      console.log('✅ onSuccess chiamato con dati:', data);
      toast({
        title: "Evento Salvato",
        description: "Il tuo evento è stato salvato con successo.",
      });
      eventoForm.reset();
      // Redirect alla pagina eventi
      console.log('🔄 Tentativo redirect a /eventi');
      router.push("/eventi");
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
                      <FormLabel>
                        Regione {watchTipologiaEvento !== "Elezioni" && <span className="text-red-500">*</span>}
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={watchTipologiaEvento === "Elezioni" ? "Seleziona regione (opzionale)" : "Seleziona regione"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ITALY_DATA?.Italia?.regioni?.map((regione) => (
                            <SelectItem key={regione.nome} value={regione.nome}>
                              {regione.nome}
                            </SelectItem>
                          )) || []}
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
                      <FormLabel>
                        Provincia {watchTipologiaEvento !== "Elezioni" && <span className="text-red-500">*</span>}
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={watchTipologiaEvento !== "Elezioni" && !watchRegioneEvento}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={watchTipologiaEvento === "Elezioni" ? "Seleziona provincia (opzionale)" : "Seleziona provincia"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {watchTipologiaEvento === "Elezioni" 
                            ? ITALY_DATA?.Italia?.regioni?.flatMap(regione => regione.province).map((provincia) => (
                                <SelectItem key={provincia.nome} value={provincia.nome}>
                                  {provincia.nome}
                                </SelectItem>
                              )) || []
                            : watchRegioneEvento && ITALY_DATA?.Italia?.regioni
                              ?.find(r => r.nome === watchRegioneEvento)
                              ?.province?.map((provincia) => (
                                <SelectItem key={provincia.nome} value={provincia.nome}>
                                  {provincia.nome}
                                </SelectItem>
                              )) || []
                          }
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
                      <FormLabel>
                        Comune {watchTipologiaEvento !== "Elezioni" && <span className="text-red-500">*</span>}
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={watchTipologiaEvento !== "Elezioni" && !watchProvinciaEvento}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={watchTipologiaEvento === "Elezioni" ? "Seleziona comune (opzionale)" : "Seleziona comune"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {watchTipologiaEvento === "Elezioni"
                            ? ITALY_DATA?.Italia?.regioni?.flatMap(regione => 
                                regione.province.flatMap(provincia => 
                                  provincia.comuni.map(comune => ({ comune, regione: regione.nome, provincia: provincia.nome }))
                                )
                              ).map(({ comune, regione, provincia }) => (
                                <SelectItem key={`${regione}-${provincia}-${comune}`} value={comune}>
                                  {comune} ({provincia}, {regione})
                                </SelectItem>
                              )) || []
                            : watchProvinciaEvento && watchRegioneEvento && ITALY_DATA?.Italia?.regioni
                              ?.find(r => r.nome === watchRegioneEvento)
                              ?.province?.find(p => p.nome === watchProvinciaEvento)
                              ?.comuni?.map((comune) => (
                                <SelectItem key={comune} value={comune}>
                                  {comune}
                                </SelectItem>
                              )) || []
                          }
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={eventoForm.control}
                    name="giorno_inizio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Giorno di Inizio</FormLabel>
                        <FormControl>
                          <DatePicker
                            value={field.value || ''}
                            onChange={field.onChange}
                            disabled={submitEvento.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={eventoForm.control}
                    name="giorno_fine"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Giorno di Fine (opzionale)</FormLabel>
                        <FormControl>
                          <DatePicker
                            value={field.value || ''}
                            onChange={field.onChange}
                            disabled={submitEvento.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={eventoForm.control}
                    name="orario_inizio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Orario di Inizio (opzionale)</FormLabel>
                        <FormControl>
                          <Input
                            type="time"
                            step="60"
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
                    name="orario_fine"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Orario di Fine (opzionale)</FormLabel>
                        <FormControl>
                          <Input
                            type="time"
                            step="60"
                            {...field}
                            disabled={submitEvento.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

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
