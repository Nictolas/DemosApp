import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useLocation } from "wouter";

const datiSchema = z.object({
  ruolo: z.string().min(1, "Il ruolo è obbligatorio"),
});

type DatiValues = z.infer<typeof datiSchema>;

export default function RegistrazioneDati() {
  const [, navigate] = useLocation();

  const form = useForm<DatiValues>({
    resolver: zodResolver(datiSchema),
    defaultValues: {
      ruolo: "",
    },
  });

  const onSubmit = (data: DatiValues) => {
    // Salva i dati nel localStorage
    localStorage.setItem("registrazione_ruolo", data.ruolo);
    
    // Vai alla pagina successiva
    navigate("/registrazione-3-residenza");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Registrazione</h1>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Quale ruolo vuoi ricoprire?
          </h2>
          <p className="text-gray-600 text-sm">
            Scegli il tuo ruolo nella piattaforma
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="ruolo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ruolo *</FormLabel>
                  <FormControl>
                    <select
                      {...field}
                      className="w-full h-12 text-lg text-center border rounded-md"
                    >
                      <option value="">Seleziona ruolo</option>
                      <option value="elettore">Elettore</option>
                      <option value="candidato">Candidato</option>
                      <option value="rappresentante">Rappresentante</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full h-12 text-lg">
              Continua
            </Button>
          </form>
        </Form>

        <div className="text-center mt-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/registrazione-codice-fiscale")}
            className="text-gray-500 hover:text-gray-700"
          >
            ← Indietro
          </Button>
        </div>
      </div>
    </div>
  );
}
