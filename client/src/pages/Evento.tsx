import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import Navbar from "@/components/Navbar";
import { AlertTriangle } from "lucide-react";

const eventoSchema = z.object({
  dove: z.string().min(1, "Il luogo è obbligatorio"),
  quando: z.string().min(1, "La data è obbligatoria"),
});

type EventoFormData = z.infer<typeof eventoSchema>;

export default function Evento() {
  const { user } = useAuth();
  const { toast } = useToast();

  const eventoForm = useForm<EventoFormData>({
    resolver: zodResolver(eventoSchema),
    defaultValues: {
      dove: "",
      quando: "",
    },
  });

  // Get complete user data including role
  const { data: userData } = useQuery({
    queryKey: ["/api/users", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const response = await fetch(`/api/users/${encodeURIComponent(user.uid)}`);
      if (!response.ok) throw new Error('Failed to fetch user data');
      return response.json();
    },
    enabled: !!user?.email,
  });

  // Show loading while userData is being fetched
  if (!userData) {
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
  if (!user || (userRole !== "Politico" && userRole !== "Candidato Politico" && userRole !== "Admin")) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <AlertTriangle className="h-4 w-4 text-red-600 mb-2" />
          <div className="text-lg font-semibold mb-2">Accesso negato</div>
          <div className="text-gray-700 dark:text-gray-300">
            Questa sezione è accessibile solo ai Politici, ai Candidati Politici e agli Admin. Il tuo ruolo attuale: {userRole || 'Non definito'}
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
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
                  name="dove"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dove</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Es: Piazza del Duomo, Milano"
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
                  name="quando"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quando</FormLabel>
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