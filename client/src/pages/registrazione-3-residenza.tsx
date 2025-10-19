import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useLocation } from "wouter";
import { ITALY_DATA } from "@/data/italyData";

const residenzaSchema = z.object({
  paese_residenza: z.string().min(1, "Il paese di residenza è obbligatorio"),
  regione_residenza: z.string().min(1, "La regione di residenza è obbligatoria"),
  provincia_residenza: z.string().min(1, "La provincia di residenza è obbligatoria"),
  comune_residenza: z.string().min(1, "Il comune di residenza è obbligatorio"),
});

type ResidenzaValues = z.infer<typeof residenzaSchema>;

export default function RegistrazioneResidenza() {
  const [, navigate] = useLocation();

  // Debug: verifica che i dati italiani siano caricati
  console.log("ITALY_DATA caricato:", ITALY_DATA);
  console.log("Regioni disponibili:", ITALY_DATA.Italia.regioni.length);

  const form = useForm<ResidenzaValues>({
    resolver: zodResolver(residenzaSchema),
    defaultValues: {
      paese_residenza: "",
      regione_residenza: "",
      provincia_residenza: "",
      comune_residenza: "",
    },
  });

  const watchPaeseResidenza = form.watch("paese_residenza");
  const watchRegioneResidenza = form.watch("regione_residenza");
  const watchProvinciaResidenza = form.watch("provincia_residenza");

  // Debug: verifica i valori dei campi
  console.log("Paese selezionato:", watchPaeseResidenza);
  console.log("Regione selezionata:", watchRegioneResidenza);
  console.log("Provincia selezionata:", watchProvinciaResidenza);

  const onSubmit = (data: ResidenzaValues) => {
    // Salva i dati nel localStorage
    localStorage.setItem("registrazione_paese_residenza", data.paese_residenza);
    localStorage.setItem("registrazione_regione_residenza", data.regione_residenza);
    localStorage.setItem("registrazione_provincia_residenza", data.provincia_residenza);
    localStorage.setItem("registrazione_comune_residenza", data.comune_residenza);
    
          // Vai alla pagina successiva
              navigate("/registrazione-ruolo");
  };

  // Reset dei campi dipendenti
  React.useEffect(() => {
    if (watchPaeseResidenza !== "it") {
      form.setValue("regione_residenza", "");
      form.setValue("provincia_residenza", "");
      form.setValue("comune_residenza", "");
    }
  }, [watchPaeseResidenza, form]);

  React.useEffect(() => {
    if (watchRegioneResidenza) {
      form.setValue("provincia_residenza", "");
      form.setValue("comune_residenza", "");
    }
  }, [watchRegioneResidenza, form]);

  React.useEffect(() => {
    if (watchProvinciaResidenza) {
      form.setValue("comune_residenza", "");
    }
  }, [watchProvinciaResidenza, form]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Registrazione</h1>
          
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="paese_residenza"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Paese di Residenza *</FormLabel>
                  <FormControl>
                    <select
                      {...field}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Seleziona paese</option>
                      <option value="it">Italia</option>
                      <option value="Francia">Francia</option>
                      <option value="Germania">Germania</option>
                      <option value="Spagna">Spagna</option>
                      <option value="Regno Unito">Regno Unito</option>
                      <option value="altro">Altro</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {watchPaeseResidenza === "it" && (
              <>
                <FormField
                  control={form.control}
                  name="regione_residenza"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Regione di Residenza *</FormLabel>
                      <FormControl>
                        <select
                          {...field}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="">Seleziona regione</option>
                          {ITALY_DATA.Italia.regioni.map((regione) => (
                            <option key={regione.nome} value={regione.nome}>
                              {regione.nome}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                                 {watchRegioneResidenza && (
                   <FormField
                     control={form.control}
                     name="provincia_residenza"
                     render={({ field }) => {
                       const regioniTrovate = ITALY_DATA.Italia.regioni.find((r) => r.nome === watchRegioneResidenza);
                       const provinceDisponibili = regioniTrovate?.province || [];
                       
                       console.log("Regione trovata:", regioniTrovate);
                       console.log("Province disponibili:", provinceDisponibili);
                       
                       return (
                         <FormItem>
                           <FormLabel>Provincia di Residenza *</FormLabel>
                           <FormControl>
                             <select
                               {...field}
                               className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                             >
                               <option value="">Seleziona provincia</option>
                               {provinceDisponibili.map((provincia) => (
                                 <option key={provincia.nome} value={provincia.nome}>
                                   {provincia.nome}
                                 </option>
                               ))}
                             </select>
                           </FormControl>
                           <FormMessage />
                         </FormItem>
                       );
                     }}
                   />
                 )}

                {watchProvinciaResidenza && (
                  <FormField
                    control={form.control}
                    name="comune_residenza"
                    render={({ field }) => {
                      const regioniTrovate = ITALY_DATA.Italia.regioni.find((r) => r.nome === watchRegioneResidenza);
                      const provinceTrovate = regioniTrovate?.province.find((p) => p.nome === watchProvinciaResidenza);
                      const comuniDisponibili = provinceTrovate?.comuni || [];
                      
                      console.log("Regione per comuni:", regioniTrovate);
                      console.log("Provincia per comuni:", provinceTrovate);
                      console.log("Comuni disponibili:", comuniDisponibili);
                      
                      return (
                        <FormItem>
                          <FormLabel>Comune di Residenza *</FormLabel>
                          <FormControl>
                            <select
                              {...field}
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <option value="">Seleziona comune</option>
                              {comuniDisponibili.map((comune) => (
                                <option key={comune} value={comune}>
                                  {comune}
                                </option>
                              ))}
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                )}
              </>
            )}

            <Button type="submit" className="w-full">
              Continua
            </Button>
          </form>
        </Form>

                 <div className="text-center mt-6 space-y-2">
           <Button
             variant="ghost"
             onClick={() => navigate("/registrazione-data-nascita")}
             className="text-gray-500 hover:text-gray-700"
           >
             ← Indietro
           </Button>
         </div>
      </div>
    </div>
  );
}
