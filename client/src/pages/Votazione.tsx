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
import { useAuth } from "@/hooks/use-auth-neon";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { useLocation, Redirect } from "wouter";
import { apiRequest } from "@/lib/queryClient";

const comunicaSchema = z.object({
  titolo: z.string().min(1, "Il titolo è obbligatorio"),
  voto_dato: z.enum(["Favorevole", "Contrario", "Astenuto"]),
  commento: z.string().max(20, "Il commento non può superare i 20 caratteri").optional(),
  vincitore: z.enum(["Approvata", "Respinta"]),
});

type ComunicaFormData = z.infer<typeof comunicaSchema>;

interface ExistingComunicazione {
  titolo: string;
  vincitore: string;
  zona: string;
}

export default function Votazione() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [existingComunicazione, setExistingComunicazione] = useState<ExistingComunicazione | null>(null);

  const form = useForm<ComunicaFormData>({
    resolver: zodResolver(comunicaSchema),
    defaultValues: { titolo: "", commento: "" },
  });

  // 1. Caricamento dati utente con React Query (già presente e corretto)
  const { data: userData, isLoading: isLoadingUser } = useQuery({
    queryKey: ["userData", user?.uid],
    queryFn: async () => {
      if (!user?.uid) return null;
      const response = await apiRequest("GET", `/api/users/${user.uid}`);
      if (!response.ok) throw new Error('Failed to fetch user data');
      return response.json();
    },
    enabled: !!user,
  });

  // 2. Controllo duplicati tramite API (usando una mutazione per la flessibilità)
  const checkDuplicateMutation = useMutation({
      mutationFn: async (titolo: string) => {
        if (!titolo.trim()) return;
        const response = await apiRequest("GET", `/api/comunicazioni/check-duplicate?titolo=${encodeURIComponent(titolo)}`);
        const data = await response.json();
        if (data.exists) {
            setExistingComunicazione(data.comunicazione);
            form.setValue("vincitore", data.comunicazione.vincitore);
        } else {
            setExistingComunicazione(null);
        }
      },
  });

  // 3. Submit comunicazione tramite API (già presente, solo ripulito)
  const submitComunicazione = useMutation({
    mutationFn: (data: ComunicaFormData) => apiRequest("POST", "/api/comunicazioni", data),
    onSuccess: () => {
      toast({ title: "Comunicazione inviata", description: "La tua comunicazione è stata registrata." });
      form.reset();
      setExistingComunicazione(null);
      setTimeout(() => setLocation("/menu"), 1000);
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message || "Invio fallito.", variant: "destructive" });
    },
  });

  if (isAuthLoading || (user && isLoadingUser)) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  if (!user) return <Redirect to="/auth" />;

  const userRole = userData?.ruolo;
  const isAllowed = userRole === "Politico" || userRole === "Candidato Politico" || userRole === "Admin";
  if (userData && !isAllowed) {
    return (
      <div className="min-h-screen container mx-auto p-4 flex items-center justify-center">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Accesso negato</AlertTitle>
          <AlertDescription>Questa sezione è accessibile solo ai Politici, Candidati Politici e Admin.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 space-y-6">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">Nuova Comunicazione Votazione</CardTitle>
            <CardDescription className="text-center">Condividi i dettagli di una votazione con i tuoi elettori.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {existingComunicazione && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Votazione già comunicata</AlertTitle>
                <AlertDescription>
                  Questa votazione è già stata registrata per la tua zona. Puoi comunque aggiungere il tuo voto.
                  <br /><strong>Risultato registrato:</strong> {existingComunicazione.vincitore}
                </AlertDescription>
              </Alert>
            )}
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => submitComunicazione.mutate(data))} className="space-y-4">
                <FormField control={form.control} name="titolo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titolo della votazione *</FormLabel>
                    <FormControl><Input placeholder="Es: Approvazione legge..." {...field} onChange={(e) => { field.onChange(e); checkDuplicateMutation.mutate(e.target.value); }} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="voto_dato" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Il tuo voto *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Seleziona il tuo voto" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Favorevole">Favorevole</SelectItem>
                        <SelectItem value="Contrario">Contrario</SelectItem>
                        <SelectItem value="Astenuto">Astenuto</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="commento" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Commento (opzionale, max 20 caratteri)</FormLabel>
                    <FormControl><Input {...field} maxLength={20} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="vincitore" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Risultato della votazione *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!!existingComunicazione}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Seleziona il risultato" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Approvata">Approvata</SelectItem>
                        <SelectItem value="Respinta">Respinta</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={submitComunicazione.isPending || checkDuplicateMutation.isPending}>
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