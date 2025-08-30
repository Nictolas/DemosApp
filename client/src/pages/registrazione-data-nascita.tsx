import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useLocation } from "wouter";

const dataNascitaSchema = z.object({
  giorno: z.string().min(1, "Il giorno è obbligatorio"),
  mese: z.string().min(1, "Il mese è obbligatorio"),
  anno: z.string().min(1, "L'anno è obbligatorio"),
});

type DataNascitaValues = z.infer<typeof dataNascitaSchema>;

export default function RegistrazioneDataNascita() {
  const [, navigate] = useLocation();

  const form = useForm<DataNascitaValues>({
    resolver: zodResolver(dataNascitaSchema),
    defaultValues: {
      giorno: "",
      mese: "",
      anno: "",
    },
  });

  const onSubmit = (data: DataNascitaValues) => {
    const dataCompleta = `${data.giorno}/${data.mese}/${data.anno}`;
    localStorage.setItem("registrazione_data_nascita", dataCompleta);
    navigate("/registrazione-3-residenza");
  };

  // Calcola l'anno minimo (18 anni fa) e massimo (14 anni fa)
  const today = new Date();
  const minYear = today.getFullYear() - 18;
  const maxYear = today.getFullYear() - 14;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Registrazione</h1>
          
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
                         <div className="grid grid-cols-3 gap-4">
               <FormField
                 control={form.control}
                 name="giorno"
                 render={({ field }) => (
                   <FormItem>
                     <FormLabel className="text-lg font-medium">Giorno *</FormLabel>
                     <FormControl>
                       <select
                         {...field}
                         className="w-full h-12 text-lg text-center border rounded-md"
                       >
                         <option value="">Giorno</option>
                         {Array.from({ length: 31 }, (_, i) => i + 1).map((giorno) => (
                           <option key={giorno} value={giorno.toString().padStart(2, '0')}>
                             {giorno.toString().padStart(2, '0')}
                           </option>
                         ))}
                       </select>
                     </FormControl>
                     <FormMessage />
                   </FormItem>
                 )}
               />

               <FormField
                 control={form.control}
                 name="mese"
                 render={({ field }) => (
                   <FormItem>
                     <FormLabel className="text-lg font-medium">Mese *</FormLabel>
                     <FormControl>
                       <select
                         {...field}
                         className="w-full h-12 text-lg text-center border rounded-md"
                       >
                         <option value="">Mese</option>
                         {Array.from({ length: 12 }, (_, i) => i + 1).map((mese) => (
                           <option key={mese} value={mese.toString().padStart(2, '0')}>
                             {mese.toString().padStart(2, '0')}
                           </option>
                         ))}
                       </select>
                     </FormControl>
                     <FormMessage />
                   </FormItem>
                 )}
               />

               <FormField
                 control={form.control}
                 name="anno"
                 render={({ field }) => (
                   <FormItem>
                     <FormLabel className="text-lg font-medium">Anno *</FormLabel>
                     <FormControl>
                       <select
                         {...field}
                         className="w-full h-12 text-lg text-center border rounded-md"
                       >
                         <option value="">Anno</option>
                         {Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i).map((anno) => (
                           <option key={anno} value={anno.toString()}>
                             {anno}
                           </option>
                         ))}
                       </select>
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
             onClick={() => navigate("/registrazione-cittadinanza")}
             className="text-gray-500 hover:text-gray-700"
           >
             ← Indietro
           </Button>
         </div>
      </div>
    </div>
  );
}
