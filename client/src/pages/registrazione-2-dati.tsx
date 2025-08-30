import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useLocation } from "wouter";

const datiSchema = z.object({
  ruolo: z.string().min(1, "Il ruolo è obbligatorio"),
  grado_elezione: z.string().optional(),
  paese_elezione: z.string().optional(),
  grado_candidatura: z.string().optional(),
  paese_candidatura: z.string().optional(),
});

type DatiValues = z.infer<typeof datiSchema>;

export default function RegistrazioneDati() {
  const [, navigate] = useLocation();

  const form = useForm<DatiValues>({
    resolver: zodResolver(datiSchema),
    defaultValues: {
      ruolo: "",
      grado_elezione: "",
      paese_elezione: "",
      grado_candidatura: "",
      paese_candidatura: "",
    },
  });

  const onSubmit = (data: DatiValues) => {
    // Salva i dati nel localStorage
    localStorage.setItem("registrazione_ruolo", data.ruolo);
    if (data.grado_elezione) {
      localStorage.setItem("registrazione_grado_elezione", data.grado_elezione);
    }
    if (data.paese_elezione) {
      localStorage.setItem("registrazione_paese_elezione", data.paese_elezione);
    }
    if (data.grado_candidatura) {
      localStorage.setItem("registrazione_grado_candidatura", data.grado_candidatura);
    }
    if (data.paese_candidatura) {
      localStorage.setItem("registrazione_paese_candidatura", data.paese_candidatura);
    }
    
    // Vai alla pagina successiva
    navigate("/menu");
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
                       <option value="politico">Politico</option>
                       <option value="candidato">Candidato</option>
                       <option value="candidato_politico">Candidato Politico</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
                          />

              {/* Campi dinamici per Grado di Elezione e Paese di Elezione */}
              {form.watch("ruolo") === "elettore" && (
                <>
                  <FormField
                    control={form.control}
                    name="grado_elezione"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grado di Elezione *</FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            className="w-full h-12 text-lg text-center border rounded-md"
                          >
                            <option value="">Seleziona grado di elezione</option>
                            <option value="europeo">Europeo</option>
                            <option value="nazionale">Nazionale</option>
                            <option value="regionale">Regionale</option>
                            <option value="provinciale">Provinciale</option>
                            <option value="comunale">Comunale</option>
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="paese_elezione"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Paese di Elezione *</FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            className="w-full h-12 text-lg text-center border rounded-md"
                          >
                            <option value="">Seleziona paese di elezione</option>
                            <option value="Italia">Italia</option>
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
                </>
              )}

              {form.watch("ruolo") === "candidato" && (
                <>
                  <FormField
                    control={form.control}
                    name="grado_elezione"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grado di Elezione *</FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            className="w-full h-12 text-lg text-center border rounded-md"
                          >
                            <option value="">Seleziona grado di elezione</option>
                            <option value="europeo">Europeo</option>
                            <option value="nazionale">Nazionale</option>
                            <option value="regionale">Regionale</option>
                            <option value="provinciale">Provinciale</option>
                            <option value="comunale">Comunale</option>
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="paese_elezione"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Paese di Elezione *</FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            className="w-full h-12 text-lg text-center border rounded-md"
                          >
                            <option value="">Seleziona paese di elezione</option>
                            <option value="Italia">Italia</option>
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
                  
                  <FormField
                    control={form.control}
                    name="grado_candidatura"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grado di Candidatura *</FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            className="w-full h-12 text-lg text-center border rounded-md"
                          >
                            <option value="">Seleziona grado di candidatura</option>
                            <option value="europeo">Europeo</option>
                            <option value="nazionale">Nazionale</option>
                            <option value="regionale">Regionale</option>
                            <option value="provinciale">Provinciale</option>
                            <option value="comunale">Comunale</option>
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="paese_candidatura"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Paese di Candidatura *</FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            className="w-full h-12 text-lg text-center border rounded-md"
                          >
                            <option value="">Seleziona paese di candidatura</option>
                            <option value="Italia">Italia</option>
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
                </>
              )}

              {form.watch("ruolo") === "candidato_politico" && (
                <>
                  <FormField
                    control={form.control}
                    name="grado_elezione"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grado di Elezione *</FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            className="w-full h-12 text-lg text-center border rounded-md"
                          >
                            <option value="">Seleziona grado di elezione</option>
                            <option value="europeo">Europeo</option>
                            <option value="nazionale">Nazionale</option>
                            <option value="regionale">Regionale</option>
                            <option value="provinciale">Provinciale</option>
                            <option value="comunale">Comunale</option>
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="paese_elezione"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Paese di Elezione *</FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            className="w-full h-12 text-lg text-center border rounded-md"
                          >
                            <option value="">Seleziona paese di elezione</option>
                            <option value="Italia">Italia</option>
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
                  
                  <FormField
                    control={form.control}
                    name="grado_candidatura"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grado di Candidatura *</FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            className="w-full h-12 text-lg text-center border rounded-md"
                          >
                            <option value="">Seleziona grado di candidatura</option>
                            <option value="europeo">Europeo</option>
                            <option value="nazionale">Nazionale</option>
                            <option value="regionale">Regionale</option>
                            <option value="provinciale">Provinciale</option>
                            <option value="comunale">Comunale</option>
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="paese_candidatura"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Paese di Candidatura *</FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            className="w-full h-12 text-lg text-center border rounded-md"
                          >
                            <option value="">Seleziona paese di candidatura</option>
                            <option value="Italia">Italia</option>
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
                </>
              )}

              {form.watch("ruolo") === "politico" && (
                <>
                  <FormField
                    control={form.control}
                    name="grado_elezione"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grado di Elezione *</FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            className="w-full h-12 text-lg text-center border rounded-md"
                          >
                            <option value="">Seleziona grado di elezione</option>
                            <option value="europeo">Europeo</option>
                            <option value="nazionale">Nazionale</option>
                            <option value="regionale">Regionale</option>
                            <option value="provinciale">Provinciale</option>
                            <option value="comunale">Comunale</option>
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="paese_elezione"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Paese di Elezione *</FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            className="w-full h-12 text-lg text-center border rounded-md"
                          >
                            <option value="">Seleziona paese di elezione</option>
                            <option value="Italia">Italia</option>
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
                </>
              )}

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
