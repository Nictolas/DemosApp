import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useNavigate } from "wouter";

const dataNascitaSchema = z.object({
  data_nascita: z.string().min(1, "La data di nascita è obbligatoria"),
});

type DataNascitaValues = z.infer<typeof dataNascitaSchema>;

export default function RegistrazioneDataNascita() {
  const navigate = useNavigate();

  const form = useForm<DataNascitaValues>({
    resolver: zodResolver(dataNascitaSchema),
    defaultValues: {
      data_nascita: "",
    },
  });

  const onSubmit = (data: DataNascitaValues) => {
    localStorage.setItem("registrazione_data_nascita", data.data_nascita);
    navigate("/registrazione-codice-fiscale");
  };

  // Calcola l'età minima (18 anni fa)
  const today = new Date();
  const minDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  const maxDate = new Date(today.getFullYear() - 14, today.getMonth(), today.getDate());

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Registrazione</h1>
          <p className="text-gray-600 mt-2">Passo 5 di 8 - Data di nascita</p>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Quando sei nato/a?
          </h2>
          <p className="text-gray-600 text-sm">
            Seleziona la tua data di nascita
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="data_nascita"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-lg font-medium">Data di Nascita *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="date"
                      min={minDate.toISOString().split('T')[0]}
                      max={maxDate.toISOString().split('T')[0]}
                      className="w-full h-12 text-lg text-center"
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-gray-500 mt-2">
                    Deve essere tra i 14 e i 18 anni
                  </p>
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
            onClick={() => navigate("/registrazione-cognome")}
            className="text-gray-500 hover:text-gray-700"
          >
            ← Indietro
          </Button>
        </div>
      </div>
    </div>
  );
}
