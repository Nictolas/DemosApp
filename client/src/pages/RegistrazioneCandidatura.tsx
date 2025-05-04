import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useRegistration } from "@/hooks/use-registration";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { ITALY_DATA } from "@/data/italyData";
import { useToast } from "@/hooks/use-toast";

// Schema per la parte di candidatura del form
const candidaturaSchema = z.object({
  grado_candidatura: z.string().min(1, "Il grado di candidatura è obbligatorio"),
  paese_candidatura: z.string().min(1, "Il paese di candidatura è obbligatorio"),
  regione_candidatura: z.string().min(1, "La regione di candidatura è obbligatoria"),
  provincia_candidatura: z.string().min(1, "La provincia di candidatura è obbligatoria"),
  comune_candidatura: z.string().min(1, "Il comune di candidatura è obbligatorio"),
});

type CandidaturaFormValues = z.infer<typeof candidaturaSchema>;

export default function RegistrazioneCandidatura() {
  const { toast } = useToast();
  const { registerMutation } = useAuth();
  const { formData, clearFormData } = useRegistration();
  const [registrationSubmitted, setRegistrationSubmitted] = useState(false);

  // Stati per le opzioni dinamiche delle località
  const [regioniCandidatura, setRegioniCandidatura] = useState<string[]>([]);
  const [provinceCandidatura, setProvinceCandidatura] = useState<string[]>([]);
  const [comuniCandidatura, setComuniCandidatura] = useState<string[]>([]);

  // Inizializzazione del form
  const form = useForm<CandidaturaFormValues>({
    resolver: zodResolver(candidaturaSchema),
    defaultValues: {
      grado_candidatura: "",
      paese_candidatura: "",
      regione_candidatura: "",
      provincia_candidatura: "",
      comune_candidatura: "",
    },
  });

  // Redirect se non ci sono dati di registrazione
  if (!formData) {
    return <Redirect to="/auth" />;
  }

  // Redirect se la registrazione è completata con successo
  if (registrationSubmitted && !registerMutation.isPending) {
    return <Redirect to="/menu" />;
  }

  // Gestione selezioni a cascata per la candidatura
  useEffect(() => {
    const paeseCandidatura = form.watch("paese_candidatura");
    if (paeseCandidatura === "Italia") {
      const regioni = ITALY_DATA.Italia.regioni.map(regione => regione.nome);
      setRegioniCandidatura(regioni);
    } else {
      setRegioniCandidatura([]);
      form.setValue("regione_candidatura", "");
    }
    setProvinceCandidatura([]);
    setComuniCandidatura([]);
    form.setValue("provincia_candidatura", "");
    form.setValue("comune_candidatura", "");
  }, [form.watch("paese_candidatura")]);
  
  useEffect(() => {
    const paeseCandidatura = form.watch("paese_candidatura");
    const regioneCandidatura = form.watch("regione_candidatura");
    
    if (paeseCandidatura === "Italia" && regioneCandidatura) {
      const selectedRegion = ITALY_DATA.Italia.regioni.find(
        r => r.nome === regioneCandidatura
      );
      
      if (selectedRegion) {
        const province = selectedRegion.province.map(provincia => provincia.nome);
        setProvinceCandidatura(province);
      }
    } else {
      setProvinceCandidatura([]);
    }
    setComuniCandidatura([]);
    form.setValue("provincia_candidatura", "");
    form.setValue("comune_candidatura", "");
  }, [form.watch("regione_candidatura")]);
  
  useEffect(() => {
    const paeseCandidatura = form.watch("paese_candidatura");
    const regioneCandidatura = form.watch("regione_candidatura");
    const provinciaCandidatura = form.watch("provincia_candidatura");
    
    if (paeseCandidatura === "Italia" && regioneCandidatura && provinciaCandidatura) {
      const selectedRegion = ITALY_DATA.Italia.regioni.find(
        r => r.nome === regioneCandidatura
      );
      
      if (selectedRegion) {
        const selectedProvince = selectedRegion.province.find(
          p => p.nome === provinciaCandidatura
        );
        
        if (selectedProvince) {
          setComuniCandidatura(selectedProvince.comuni);
        }
      }
    } else {
      setComuniCandidatura([]);
    }
    form.setValue("comune_candidatura", "");
  }, [form.watch("provincia_candidatura")]);

  const onSubmit = (values: CandidaturaFormValues) => {
    // Combina i dati del form precedente con quelli di questo form
    const completeData = {
      ...formData,
      ...values
    };
    
    // Registra l'utente con i dati completi
    registerMutation.mutate(completeData as any);
    setRegistrationSubmitted(true);
    clearFormData(); // Pulisci i dati temporanei dopo l'invio
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-16">
        <div className="flex justify-center">
          <div className="w-full max-w-md">
            <Card className="shadow-xl border-t-4 border-t-blue-600">
              <CardHeader>
                <CardTitle className="text-2xl text-center">Dati di Candidatura</CardTitle>
                <CardDescription className="text-center">
                  Completa la tua registrazione con i dati di candidatura
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium border-b pb-2">Informazioni di Candidatura</h3>
                      
                      {/* Grado di Candidatura */}
                      <FormField
                        control={form.control}
                        name="grado_candidatura"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="required-field">Grado di Candidatura</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleziona grado di candidatura" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Comunale">Comunale</SelectItem>
                                <SelectItem value="Provinciale">Provinciale</SelectItem>
                                <SelectItem value="Regionale">Regionale</SelectItem>
                                <SelectItem value="Nazionale">Nazionale</SelectItem>
                                <SelectItem value="Europeo">Europeo</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {/* Paese di Candidatura */}
                      <FormField
                        control={form.control}
                        name="paese_candidatura"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="required-field">Paese di Candidatura</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleziona paese" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Italia">Italia</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {/* Regione di Candidatura */}
                      <FormField
                        control={form.control}
                        name="regione_candidatura"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="required-field">Regione di Candidatura</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                              disabled={regioniCandidatura.length === 0}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleziona regione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {regioniCandidatura.map(regione => (
                                  <SelectItem key={regione} value={regione}>
                                    {regione}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {/* Provincia di Candidatura */}
                      <FormField
                        control={form.control}
                        name="provincia_candidatura"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="required-field">Provincia di Candidatura</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                              disabled={provinceCandidatura.length === 0}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleziona provincia" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {provinceCandidatura.map(provincia => (
                                  <SelectItem key={provincia} value={provincia}>
                                    {provincia}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {/* Comune di Candidatura */}
                      <FormField
                        control={form.control}
                        name="comune_candidatura"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="required-field">Comune di Candidatura</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                              disabled={comuniCandidatura.length === 0}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleziona comune" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {comuniCandidatura.map(comune => (
                                  <SelectItem key={comune} value={comune}>
                                    {comune}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
                      {registerMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Registrazione in corso...
                        </>
                      ) : (
                        "Registrati"
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}