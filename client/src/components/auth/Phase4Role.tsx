import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ITALY_DATA } from "@/data/italyData";

const phase4Schema = z.object({
  ruolo: z.string().min(1, "Il ruolo è obbligatorio"),
  paese_elezione: z.string().optional(),
  regione_elezione: z.string().optional(),
  provincia_elezione: z.string().optional(),
  comune_elezione: z.string().optional(),
  paese_candidatura: z.string().optional(),
  regione_candidatura: z.string().optional(),
  provincia_candidatura: z.string().optional(),
  comune_candidatura: z.string().optional(),
  grado_elezione: z.string().optional(),
  grado_candidatura: z.string().optional(),
});

type Phase4Values = z.infer<typeof phase4Schema>;

interface Phase4RoleProps {
  onSubmit: (data: Phase4Values) => void;
  onBack: () => void;
  defaultValues?: Partial<Phase4Values>;
}

export function Phase4Role({ onSubmit, onBack, defaultValues }: Phase4RoleProps) {
  const form = useForm<Phase4Values>({
    resolver: zodResolver(phase4Schema),
    defaultValues: {
      ruolo: defaultValues?.ruolo || "",
      paese_elezione: defaultValues?.paese_elezione || "",
      regione_elezione: defaultValues?.regione_elezione || "",
      provincia_elezione: defaultValues?.provincia_elezione || "",
      comune_elezione: defaultValues?.comune_elezione || "",
      paese_candidatura: defaultValues?.paese_candidatura || "",
      regione_candidatura: defaultValues?.regione_candidatura || "",
      provincia_candidatura: defaultValues?.provincia_candidatura || "",
      comune_candidatura: defaultValues?.comune_candidatura || "",
      grado_elezione: defaultValues?.grado_elezione || "",
      grado_candidatura: defaultValues?.grado_candidatura || "",
    },
  });

  const watchRuolo = form.watch("ruolo");
  const watchPaeseElezione = form.watch("paese_elezione");
  const watchRegioneElezione = form.watch("regione_elezione");
  const watchProvinciaElezione = form.watch("provincia_elezione");
  const watchPaeseCandidatura = form.watch("paese_candidatura");
  const watchRegioneCandidatura = form.watch("regione_candidatura");
  const watchProvinciaCandidatura = form.watch("provincia_candidatura");

  const handleSubmit = (data: Phase4Values) => {
    onSubmit(data);
  };

  // Reset dei campi dipendenti quando cambia il paese elezione
  React.useEffect(() => {
    if (watchPaeseElezione !== "Italia") {
      form.setValue("regione_elezione", "");
      form.setValue("provincia_elezione", "");
      form.setValue("comune_elezione", "");
    }
  }, [watchPaeseElezione, form]);

  // Reset dei campi dipendenti quando cambia la regione elezione
  React.useEffect(() => {
    if (watchRegioneElezione) {
      form.setValue("provincia_elezione", "");
      form.setValue("comune_elezione", "");
    }
  }, [watchRegioneElezione, form]);

  // Reset dei campi dipendenti quando cambia la provincia elezione
  React.useEffect(() => {
    if (watchProvinciaElezione) {
      form.setValue("comune_elezione", "");
    }
  }, [watchProvinciaElezione, form]);

  // Reset dei campi dipendenti quando cambia il paese candidatura
  React.useEffect(() => {
    if (watchPaeseCandidatura !== "Italia") {
      form.setValue("regione_candidatura", "");
      form.setValue("provincia_candidatura", "");
      form.setValue("comune_candidatura", "");
    }
  }, [watchPaeseCandidatura, form]);

  // Reset dei campi dipendenti quando cambia la regione candidatura
  React.useEffect(() => {
    if (watchRegioneCandidatura) {
      form.setValue("provincia_candidatura", "");
      form.setValue("comune_candidatura", "");
    }
  }, [watchRegioneCandidatura, form]);

  // Reset dei campi dipendenti quando cambia la provincia candidatura
  React.useEffect(() => {
    if (watchProvinciaCandidatura) {
      form.setValue("comune_candidatura", "");
    }
  }, [watchProvinciaCandidatura, form]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold">Ruolo e Candidature</h3>
        </div>

        <FormField
          control={form.control}
          name="ruolo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ruolo *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona ruolo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="cittadino">Cittadino</SelectItem>
                  <SelectItem value="candidato">Candidato</SelectItem>
                  <SelectItem value="candidato_politico">Candidato Politico</SelectItem>
                  <SelectItem value="rappresentante">Rappresentante</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Luogo di Elezione */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm">Luogo di Elezione</h4>
          
          <FormField
            control={form.control}
            name="paese_elezione"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Paese di Elezione</FormLabel>
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

          {watchPaeseElezione === "Italia" && (
            <>
              <FormField
                control={form.control}
                name="regione_elezione"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Regione di Elezione</FormLabel>
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

              {watchRegioneElezione && (
                <FormField
                  control={form.control}
                  name="provincia_elezione"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Provincia di Elezione</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona provincia" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ITALY_DATA.Italia.regioni
                            .find((r) => r.nome === watchRegioneElezione)
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

              {watchProvinciaElezione && (
                <FormField
                  control={form.control}
                  name="comune_elezione"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Comune di Elezione</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona comune" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ITALY_DATA.Italia.regioni
                            .find((r) => r.nome === watchRegioneElezione)
                            ?.province.find((p) => p.nome === watchProvinciaElezione)
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

              {watchComuneElezione && (
                <FormField
                  control={form.control}
                  name="grado_elezione"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grado di Elezione</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona grado" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="comunale">Comunale</SelectItem>
                          <SelectItem value="provinciale">Provinciale</SelectItem>
                          <SelectItem value="regionale">Regionale</SelectItem>
                          <SelectItem value="nazionale">Nazionale</SelectItem>
                          <SelectItem value="europeo">Europeo</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </>
          )}
        </div>

        {/* Luogo di Candidatura */}
        {(watchRuolo === "C" || watchRuolo === "CP") && (
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Luogo di Candidatura</h4>
            
            <FormField
              control={form.control}
              name="paese_candidatura"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Paese di Candidatura</FormLabel>
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

            {watchPaeseCandidatura === "Italia" && (
              <>
                <FormField
                  control={form.control}
                  name="regione_candidatura"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Regione di Candidatura</FormLabel>
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

                {watchRegioneCandidatura && (
                  <FormField
                    control={form.control}
                    name="provincia_candidatura"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Provincia di Candidatura</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleziona provincia" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ITALY_DATA.Italia.regioni
                              .find((r) => r.nome === watchRegioneCandidatura)
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

                {watchProvinciaCandidatura && (
                  <FormField
                    control={form.control}
                    name="comune_candidatura"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Comune di Candidatura</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleziona comune" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ITALY_DATA.Italia.regioni
                              .find((r) => r.nome === watchRegioneCandidatura)
                              ?.province.find((p) => p.nome === watchProvinciaCandidatura)
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

                {watchComuneCandidatura && (
                  <FormField
                    control={form.control}
                    name="grado_candidatura"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grado di Candidatura</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleziona grado" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="comunale">Comunale</SelectItem>
                            <SelectItem value="provinciale">Provinciale</SelectItem>
                            <SelectItem value="regionale">Regionale</SelectItem>
                            <SelectItem value="nazionale">Nazionale</SelectItem>
                            <SelectItem value="europeo">Europeo</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onBack} className="flex-1">
            Indietro
          </Button>
          <Button type="submit" className="flex-1">
            Completa Registrazione
          </Button>
        </div>
      </form>
    </Form>
  );
}
