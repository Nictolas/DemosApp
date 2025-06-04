import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navbar } from "@/components/Navbar";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";

const comunicaSchema = z.object({
  titolo: z.string().min(1, "Il titolo è obbligatorio"),
  voto_dato: z.enum(["Favorevole", "Contrario", "Astenuto"], {
    required_error: "Seleziona il tuo voto",
  }),
  commento: z.string().max(20, "Il commento non può superare i 20 caratteri").optional(),
  vincitore: z.enum(["Favorevole", "Contrario", "Astenuto"], {
    required_error: "Seleziona il vincitore",
  }),
});

type ComunicaFormData = z.infer<typeof comunicaSchema>;

interface ExistingComunicazione {
  titolo: string;
  vincitore: string;
  zona: string;
}

export default function Comunica() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [existingComunicazione, setExistingComunicazione] = useState<ExistingComunicazione | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  const form = useForm<ComunicaFormData>({
    resolver: zodResolver(comunicaSchema),
    defaultValues: {
      titolo: "",
      voto_dato: undefined,
      commento: "",
      vincitore: undefined,
    },
  });

  // Get user session data
  const { data: sessionData } = useQuery({
    queryKey: ["/api/user"],
    enabled: !!user?.email,
  });

  // Get complete user data including role
  const { data: userData } = useQuery({
    queryKey: ["/api/users", sessionData?.email],
    queryFn: async () => {
      if (!sessionData?.email) return null;
      const response = await fetch(`/api/users/${encodeURIComponent(sessionData.email)}`);
      if (!response.ok) throw new Error('Failed to fetch user data');
      return response.json();
    },
    enabled: !!sessionData?.email,
  });

  // Generate zona based on user's election data
  const generateZona = () => {
    if (!userData) return "";
    
    const { grado_elezione, comune_elezione, provincia_elezione, regione_elezione, paese_elezione } = userData as any;
    
    if (grado_elezione === "Comunale" && comune_elezione) {
      return `Comune di ${comune_elezione}`;
    } else if (grado_elezione === "Provinciale" && provincia_elezione) {
      return `Provincia di ${provincia_elezione}`;
    } else if (grado_elezione === "Regionale" && regione_elezione) {
      return `Regione ${regione_elezione}`;
    } else if (grado_elezione === "Nazionale" && paese_elezione) {
      return `Parlamento ${paese_elezione === "Italia" ? "Italiano" : paese_elezione}`;
    } else if (grado_elezione === "Europeo") {
      return "Parlamento Europeo";
    }
    
    return "Zona non specificata";
  };

  // Check for existing comunicazione
  const checkDuplicate = async (titolo: string) => {
    if (!titolo.trim()) return;
    
    setCheckingDuplicate(true);
    try {
      const zona = generateZona();
      const response = await fetch(`/api/comunicazioni/check-duplicate?titolo=${encodeURIComponent(titolo)}&zona=${encodeURIComponent(zona)}`);
      const data = await response.json();
      
      if (data.exists) {
        setExistingComunicazione(data.comunicazione);
        form.setValue("vincitore", data.comunicazione.vincitore);
      } else {
        setExistingComunicazione(null);
      }
    } catch (error) {
      console.error("Errore nel controllo duplicati:", error);
    } finally {
      setCheckingDuplicate(false);
    }
  };

  // Submit comunicazione
  const submitComunicazione = useMutation({
    mutationFn: async (data: ComunicaFormData) => {
      const zona = generateZona();
      const comunicazioneData = {
        ...data,
        zona,
        isDuplicate: !!existingComunicazione,
      };
      
      const response = await fetch("/api/comunicazioni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(comunicazioneData),
      });
      
      if (!response.ok) {
        throw new Error("Errore nell'invio della comunicazione");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Comunicazione inviata",
        description: "La tua comunicazione è stata registrata con successo.",
      });
      form.reset();
      setExistingComunicazione(null);
      // Naviga alla home page con un breve delay per mostrare il toast
      setTimeout(() => {
        setLocation("/");
      }, 1000);
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Si è verificato un errore nell'invio della comunicazione.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ComunicaFormData) => {
    submitComunicazione.mutate(data);
  };

  // Show loading while sessionData or userData is being fetched
  if (!sessionData || !userData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Caricamento dati utente...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check if user has the right role
  const userRole = (userData as any)?.ruolo;
  if (!user || (userRole !== "Politico" && userRole !== "Candidato Politico")) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Accesso negato</AlertTitle>
            <AlertDescription>
              Questa sezione è accessibile solo ai Politici e ai Candidati Politici. Il tuo ruolo attuale: {userRole || 'Non definito'}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">Comunica una Votazione</CardTitle>
            <CardDescription className="text-center">
              Condividi i dettagli di una votazione con i tuoi elettori
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {existingComunicazione && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Votazione già comunicata</AlertTitle>
                <AlertDescription>
                  Questa votazione è già stata comunicata per la zona "{existingComunicazione.zona}".
                  <br />
                  <strong>Titolo:</strong> {existingComunicazione.titolo}
                  <br />
                  <strong>Vincitore:</strong> {existingComunicazione.vincitore}
                  <br />
                  Puoi comunque indicare il tuo voto.
                </AlertDescription>
              </Alert>
            )}

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>La tua zona di elezione:</strong> {generateZona()}
              </p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="titolo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Titolo della votazione</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Es: Legge sul bilancio 2024"
                          {...field}
                          onBlur={(e) => {
                            field.onBlur();
                            checkDuplicate(e.target.value);
                          }}
                          disabled={submitComunicazione.isPending || checkingDuplicate}
                        />
                      </FormControl>
                      {checkingDuplicate && (
                        <p className="text-sm text-muted-foreground">Controllo duplicati...</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="voto_dato"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Il tuo voto</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={submitComunicazione.isPending}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona il tuo voto" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Favorevole">Favorevole</SelectItem>
                          <SelectItem value="Contrario">Contrario</SelectItem>
                          <SelectItem value="Astenuto">Astenuto</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="commento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Commento <span className="text-sm text-muted-foreground">(opzionale, max 20 caratteri)</span></FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Aggiungi un breve commento..."
                          {...field}
                          maxLength={20}
                          disabled={submitComunicazione.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="vincitore"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Risultato della votazione</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value} 
                        disabled={submitComunicazione.isPending || !!existingComunicazione}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona il vincitore" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Favorevole">Favorevole</SelectItem>
                          <SelectItem value="Contrario">Contrario</SelectItem>
                          <SelectItem value="Astenuto">Astenuto</SelectItem>
                        </SelectContent>
                      </Select>
                      {existingComunicazione && (
                        <p className="text-sm text-muted-foreground">
                          Risultato già comunicato da un altro rappresentante
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={submitComunicazione.isPending || checkingDuplicate}
                >
                  {submitComunicazione.isPending ? "Invio in corso..." : "Invia Comunicazione"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}