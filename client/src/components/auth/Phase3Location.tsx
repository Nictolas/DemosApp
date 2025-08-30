import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ITALY_DATA } from "@/data/italyData";

const phase3Schema = z.object({
  paese_residenza: z.string().min(1, "Il paese di residenza è obbligatorio"),
  regione_residenza: z.string().min(1, "La regione di residenza è obbligatoria"),
  provincia_residenza: z.string().min(1, "La provincia di residenza è obbligatoria"),
  comune_residenza: z.string().min(1, "Il comune di residenza è obbligatorio"),
});

type Phase3Values = z.infer<typeof phase3Schema>;

interface Phase3LocationProps {
  onNext: (data: Phase3Values) => void;
  onBack: () => void;
  defaultValues?: Partial<Phase3Values>;
}

export function Phase3Location({ onNext, onBack, defaultValues }: Phase3LocationProps) {
  const form = useForm<Phase3Values>({
    resolver: zodResolver(phase3Schema),
    defaultValues: {
      paese_residenza: defaultValues?.paese_residenza || "",
      regione_residenza: defaultValues?.regione_residenza || "",
      provincia_residenza: defaultValues?.provincia_residenza || "",
      comune_residenza: defaultValues?.comune_residenza || "",
    },
  });

  const watchPaeseResidenza = form.watch("paese_residenza");
  const watchRegioneResidenza = form.watch("regione_residenza");
  const watchProvinciaResidenza = form.watch("provincia_residenza");

  const onSubmit = (data: Phase3Values) => {
    onNext(data);
  };

  // Reset dei campi dipendenti quando cambia il paese
  React.useEffect(() => {
    if (watchPaeseResidenza !== "Italia") {
      form.setValue("regione_residenza", "");
      form.setValue("provincia_residenza", "");
      form.setValue("comune_residenza", "");
    }
  }, [watchPaeseResidenza, form]);

  // Reset dei campi dipendenti quando cambia la regione
  React.useEffect(() => {
    if (watchRegioneResidenza) {
      form.setValue("provincia_residenza", "");
      form.setValue("comune_residenza", "");
    }
  }, [watchRegioneResidenza, form]);

  // Reset dei campi dipendenti quando cambia la provincia
  React.useEffect(() => {
    if (watchProvinciaResidenza) {
      form.setValue("comune_residenza", "");
    }
  }, [watchProvinciaResidenza, form]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold">Fase 3: Luogo di Residenza</h3>
          <p className="text-sm text-muted-foreground">Inserisci il tuo luogo di residenza</p>
        </div>

        <FormField
          control={form.control}
          name="paese_residenza"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Paese di Residenza *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona paese" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Italia">Italia</SelectItem>
                  <SelectItem value="Francia">Francia</SelectItem>
                  <SelectItem value="Germania">Germania</SelectItem>
                  <SelectItem value="Spagna">Spagna</SelectItem>
                  <SelectItem value="Regno Unito">Regno Unito</SelectItem>
                  <SelectItem value="altro">Altro</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {watchPaeseResidenza === "Italia" && (
          <>
            <FormField
              control={form.control}
              name="regione_residenza"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Regione di Residenza *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona regione" />
                      </SelectTrigger>
                    </FormControl>
                                           <SelectContent>
                         {ITALY_DATA.Italia.regioni.map((regione) => (
                           <SelectItem key={regione.nome} value={regione.nome}>
                             {regione.nome}
                           </SelectItem>
                         ))}
                       </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {watchRegioneResidenza && (
              <FormField
                control={form.control}
                name="provincia_residenza"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provincia di Residenza *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona provincia" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                                                 {ITALY_DATA.Italia.regioni
                           .find((r) => r.nome === watchRegioneResidenza)
                           ?.province.map((provincia) => (
                             <SelectItem key={provincia.nome} value={provincia.nome}>
                               {provincia.nome}
                             </SelectItem>
                           )) || []}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {watchProvinciaResidenza && (
              <FormField
                control={form.control}
                name="comune_residenza"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comune di Residenza *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona comune" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                                                 {ITALY_DATA.Italia.regioni
                           .find((r) => r.nome === watchRegioneResidenza)
                           ?.province.find((p) => p.nome === watchProvinciaResidenza)
                           ?.comuni.map((comune) => (
                             <SelectItem key={comune.nome} value={comune.nome}>
                               {comune.nome}
                             </SelectItem>
                           )) || []}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </>
        )}

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onBack} className="flex-1">
            Indietro
          </Button>
          <Button type="submit" className="flex-1">
            Continua
          </Button>
        </div>
      </form>
    </Form>
  );
}
