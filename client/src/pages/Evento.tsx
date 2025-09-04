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

const eventoSchema = z.object({
  nome_evento: z.string().min(1, "Il nome dell'evento è obbligatorio"),
  tipologia_evento: z.string().min(1, "La tipologia è obbligatoria"),
  paese_evento: z.string().min(1, "Il paese è obbligatorio"),
  regione_evento: z.string().min(1, "La regione è obbligatoria"),
  provincia_evento: z.string().min(1, "La provincia è obbligatoria"),
  comune_evento: z.string().min(1, "Il comune è obbligatorio"),
  indirizzo_evento: z.string().optional(),
  orario_evento: z.string().min(1, "L'orario è obbligatorio"),
  organizzatore: z.string().min(1, "L'organizzatore è obbligatorio"),
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
      orario_evento: "",
      organizzatore: "",
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

  const submitEvento = useMutation({
    mutationFn: async (data: EventoFormData) => {
      const response = await fetch("/api/eventi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
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
                      <FormControl>
                        <Input
                          placeholder="Es: Assemblea, Conferenza, Incontro"
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
                          <SelectItem value="Lombardia">Lombardia</SelectItem>
                          <SelectItem value="Lazio">Lazio</SelectItem>
                          <SelectItem value="Campania">Campania</SelectItem>
                          <SelectItem value="Sicilia">Sicilia</SelectItem>
                          <SelectItem value="Veneto">Veneto</SelectItem>
                          <SelectItem value="Emilia-Romagna">Emilia-Romagna</SelectItem>
                          <SelectItem value="Piemonte">Piemonte</SelectItem>
                          <SelectItem value="Puglia">Puglia</SelectItem>
                          <SelectItem value="Toscana">Toscana</SelectItem>
                          <SelectItem value="Calabria">Calabria</SelectItem>
                          <SelectItem value="Sardegna">Sardegna</SelectItem>
                          <SelectItem value="Liguria">Liguria</SelectItem>
                          <SelectItem value="Marche">Marche</SelectItem>
                          <SelectItem value="Abruzzo">Abruzzo</SelectItem>
                          <SelectItem value="Friuli-Venezia Giulia">Friuli-Venezia Giulia</SelectItem>
                          <SelectItem value="Trentino-Alto Adige">Trentino-Alto Adige</SelectItem>
                          <SelectItem value="Umbria">Umbria</SelectItem>
                          <SelectItem value="Basilicata">Basilicata</SelectItem>
                          <SelectItem value="Molise">Molise</SelectItem>
                          <SelectItem value="Valle d'Aosta">Valle d'Aosta</SelectItem>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona provincia" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Milano">Milano</SelectItem>
                          <SelectItem value="Roma">Roma</SelectItem>
                          <SelectItem value="Napoli">Napoli</SelectItem>
                          <SelectItem value="Torino">Torino</SelectItem>
                          <SelectItem value="Palermo">Palermo</SelectItem>
                          <SelectItem value="Genova">Genova</SelectItem>
                          <SelectItem value="Bologna">Bologna</SelectItem>
                          <SelectItem value="Firenze">Firenze</SelectItem>
                          <SelectItem value="Bari">Bari</SelectItem>
                          <SelectItem value="Catania">Catania</SelectItem>
                          <SelectItem value="Venezia">Venezia</SelectItem>
                          <SelectItem value="Verona">Verona</SelectItem>
                          <SelectItem value="Messina">Messina</SelectItem>
                          <SelectItem value="Padova">Padova</SelectItem>
                          <SelectItem value="Trieste">Trieste</SelectItem>
                          <SelectItem value="Brescia">Brescia</SelectItem>
                          <SelectItem value="Parma">Parma</SelectItem>
                          <SelectItem value="Taranto">Taranto</SelectItem>
                          <SelectItem value="Prato">Prato</SelectItem>
                          <SelectItem value="Modena">Modena</SelectItem>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona comune" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Milano">Milano</SelectItem>
                          <SelectItem value="Roma">Roma</SelectItem>
                          <SelectItem value="Napoli">Napoli</SelectItem>
                          <SelectItem value="Torino">Torino</SelectItem>
                          <SelectItem value="Palermo">Palermo</SelectItem>
                          <SelectItem value="Genova">Genova</SelectItem>
                          <SelectItem value="Bologna">Bologna</SelectItem>
                          <SelectItem value="Firenze">Firenze</SelectItem>
                          <SelectItem value="Bari">Bari</SelectItem>
                          <SelectItem value="Catania">Catania</SelectItem>
                          <SelectItem value="Venezia">Venezia</SelectItem>
                          <SelectItem value="Verona">Verona</SelectItem>
                          <SelectItem value="Messina">Messina</SelectItem>
                          <SelectItem value="Padova">Padova</SelectItem>
                          <SelectItem value="Trieste">Trieste</SelectItem>
                          <SelectItem value="Brescia">Brescia</SelectItem>
                          <SelectItem value="Parma">Parma</SelectItem>
                          <SelectItem value="Taranto">Taranto</SelectItem>
                          <SelectItem value="Prato">Prato</SelectItem>
                          <SelectItem value="Modena">Modena</SelectItem>
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
                  name="orario_evento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Orario</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
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
                  name="organizzatore"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organizzatore</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Es: Comune di Milano"
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