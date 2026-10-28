import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useLocation } from "wouter";

const nomeSchema = z.object({
  nome: z.string().min(2, "Il nome deve contenere almeno 2 caratteri").max(50, "Il nome è troppo lungo"),
  cognome: z.string().min(2, "Il cognome deve contenere almeno 2 caratteri").max(50, "Il cognome è troppo lungo"),
});

type NomeValues = z.infer<typeof nomeSchema>;

export default function RegistrazioneNome() {
  const [, navigate] = useLocation();

  const form = useForm<NomeValues>({
    resolver: zodResolver(nomeSchema),
    defaultValues: {
      nome: "",
      cognome: "",
    },
  });

  const onSubmit = (data: NomeValues) => {
    localStorage.setItem("registrazione_nome", data.nome);
    localStorage.setItem("registrazione_cognome", data.cognome);
    navigate("/registrazione-genere");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 android-fixed-registration">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 android-fixed-registration__panel">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Registrazione</h1>
          
        </div>

                 <div className="text-center mb-8">
           <h2 className="text-xl font-semibold text-gray-800 mb-4">
             Come ti chiami?
           </h2>
           <p className="text-gray-600 text-sm">
             Inserisci il tuo nome e cognome
           </p>
         </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                         <div className="grid grid-cols-2 gap-4">
               <FormField
                 control={form.control}
                 name="nome"
                 render={({ field }) => (
                   <FormItem>
                     <FormLabel className="text-lg font-medium">Nome *</FormLabel>
                     <FormControl>
                       <Input
                         {...field}
                         placeholder="Il tuo nome"
                         className="w-full h-12 text-lg text-center"
                         autoFocus
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
                     <FormLabel className="text-lg font-medium">Cognome *</FormLabel>
                     <FormControl>
                       <Input
                         {...field}
                         placeholder="Il tuo cognome"
                         className="w-full h-12 text-lg text-center"
                       />
                     </FormControl>
                     <FormMessage />
                   </FormItem>
                 )}
               />
             </div>

            <Button type="submit" className="w-full h-12 text-lg">
              Continua
            </Button>
          </form>
        </Form>

        <div className="text-center mt-6">
                     <Button
             variant="ghost"
             onClick={() => navigate("/auth")}
             className="text-gray-500 hover:text-gray-700"
           >
             ← Indietro
           </Button>
        </div>
      </div>
    </div>
  );
}
