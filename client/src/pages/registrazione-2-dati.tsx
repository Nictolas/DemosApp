import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useLocation } from "wouter";
import CodiceFiscaleInput from "@/components/CodiceFiscaleInput";

const datiSchema = z.object({
  codice_fiscale: z.string().min(16, "Il codice fiscale deve essere di 16 caratteri").max(16, "Il codice fiscale deve essere di 16 caratteri"),
  nome: z.string().min(1, "Il nome è obbligatorio"),
  cognome: z.string().min(1, "Il cognome è obbligatorio"),
  data_nascita: z.string().min(1, "La data di nascita è obbligatoria"),
  genere: z.string().min(1, "Il genere è obbligatorio"),
  cittadinanza: z.string().min(1, "La cittadinanza è obbligatoria"),
});

type DatiValues = z.infer<typeof datiSchema>;

export default function RegistrazioneDati() {
  const [, navigate] = useLocation();

  const form = useForm<DatiValues>({
    resolver: zodResolver(datiSchema),
    defaultValues: {
      codice_fiscale: "",
      nome: "",
      cognome: "",
      data_nascita: "",
      genere: "",
      cittadinanza: "",
    },
  });

  const onSubmit = (data: DatiValues) => {
    // Salva i dati nel localStorage
    localStorage.setItem("registrazione_codice_fiscale", data.codice_fiscale);
    localStorage.setItem("registrazione_nome", data.nome);
    localStorage.setItem("registrazione_cognome", data.cognome);
    localStorage.setItem("registrazione_data_nascita", data.data_nascita);
    localStorage.setItem("registrazione_genere", data.genere);
    localStorage.setItem("registrazione_cittadinanza", data.cittadinanza);
    
    // Vai alla pagina successiva
    navigate("/registrazione-3-residenza");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Registrazione</h1>
          <p className="text-gray-600 mt-2">Passo 2 di 4 - Dati Personali</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="codice_fiscale"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Codice Fiscale *</FormLabel>
                  <FormControl>
                    <CodiceFiscaleInput
                      {...field}
                      placeholder="Codice Fiscale"
                      className="w-full"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Il tuo nome"
                        className="w-full"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cognome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cognome *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Il tuo cognome"
                        className="w-full"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="data_nascita"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data di Nascita *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="date"
                      className="w-full"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="genere"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Genere *</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Seleziona genere</option>
                        <option value="uomo">Uomo</option>
                        <option value="donna">Donna</option>
                        <option value="altro">Altro</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cittadinanza"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cittadinanza *</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Seleziona cittadinanza</option>
                        <option value="italiana">Italiana</option>
                        <option value="europea">Europea</option>
                        <option value="extra-ue">Extra-UE</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" className="w-full">
              Continua
            </Button>
          </form>
        </Form>

        <div className="text-center mt-6 space-y-2">
          <Button
            variant="ghost"
            onClick={() => navigate("/registrazione-1-email")}
            className="text-gray-500 hover:text-gray-700"
          >
            ← Indietro
          </Button>
        </div>
      </div>
    </div>
  );
}
