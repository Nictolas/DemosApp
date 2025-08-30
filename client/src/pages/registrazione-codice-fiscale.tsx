import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useLocation } from "wouter";


const codiceFiscaleSchema = z.object({
  codice_fiscale: z.string().min(16, "Il codice fiscale deve essere di 16 caratteri").max(16, "Il codice fiscale deve essere di 16 caratteri"),
});

type CodiceFiscaleValues = z.infer<typeof codiceFiscaleSchema>;

export default function RegistrazioneCodiceFiscale() {
  const [, navigate] = useLocation();

  const form = useForm<CodiceFiscaleValues>({
    resolver: zodResolver(codiceFiscaleSchema),
    defaultValues: {
      codice_fiscale: "",
    },
  });

  const onSubmit = (data: CodiceFiscaleValues) => {
    localStorage.setItem("registrazione_codice_fiscale", data.codice_fiscale.toUpperCase());
    navigate("/registrazione-nome");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Registrazione</h1>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Qual è il tuo codice fiscale?
          </h2>
          <p className="text-gray-600 text-sm">
            Inserisci il tuo codice fiscale di 16 caratteri
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="codice_fiscale"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-lg font-medium">Codice Fiscale *</FormLabel>
                                     <FormControl>
                     <Input
                       {...field}
                       placeholder="Codice Fiscale"
                       className="w-full h-12 text-lg text-center"
                       autoFocus
                       maxLength={16}
                       autoComplete="off"
                       spellCheck={false}
                     />
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
             onClick={() => navigate("/registrazione-3-residenza")}
             className="text-gray-500 hover:text-gray-700"
           >
             ← Indietro
           </Button>
         </div>
      </div>
    </div>
  );
}
