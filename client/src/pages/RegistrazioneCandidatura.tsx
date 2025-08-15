import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth-neon";
import { useRegistration } from "@/hooks/use-registration";
import { Redirect, useLocation } from "wouter";
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
  aula_candidatura: z.string().optional(),
}).refine((data) => {
  if (data.grado_candidatura === "Nazionale") {
    return !!data.aula_candidatura;
  }
  return true;
}, {
  message: "L'aula è obbligatoria per il grado nazionale",
  path: ["aula_candidatura"]
});

type CandidaturaFormValues = z.infer<typeof candidaturaSchema>;

export default function RegistrazioneCandidatura() {
  const { toast } = useToast();
  const { registerMutation } = useAuth();
  const { formData, clearFormData } = useRegistration();
  const [, navigate] = useLocation();

  // Stati per le opzioni dinamiche delle località
  const [regioniCandidatura, setRegioniCandidatura] = useState<string[]>([]);
  const [provinceCandidatura, setProvinceCandidatura] = useState<string[]>([]);
  const [comuniCandidatura, setComuniCandidatura] = useState<string[]>([]);
  const [aulaCandidatura, setAulaCandidatura] = useState("");
  const gradoCandidatura = form.watch("grado_candidatura");

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
  
  // Verifica se ci sono dati temporanei di registrazione
  useEffect(() => {
    if (!formData) {
      navigate("/auth");
    }
  }, [formData, navigate]);

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
      ...values,
      aula_candidatura: gradoCandidatura === "Nazionale" ? aulaCandidatura : undefined,
    };
    
    // Registra l'utente con i dati completi
    registerMutation.mutate(completeData as any, {
      onSuccess: () => {
        clearFormData(); // Pulisci i dati temporanei dopo l'invio
        navigate("/menu"); // Reindirizza direttamente al menu dopo la registrazione
      }
    });
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
                              onValueChange={value => {
                                field.onChange(value);
                                if (value !== "Nazionale") setAulaCandidatura("");
                              }}
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
                      {gradoCandidatura === "Nazionale" && (
                        <FormField
                          control={form.control}
                          name="aula_candidatura"
                          render={() => (
                            <FormItem>
                              <FormLabel className="required-field">Aula</FormLabel>
                              <Select
                                onValueChange={setAulaCandidatura}
                                value={aulaCandidatura}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Seleziona aula" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Camera">Camera</SelectItem>
                                  <SelectItem value="Senato">Senato</SelectItem>
                                </SelectContent>
                              </Select>
                              {form.formState.errors.aula_candidatura && <FormMessage />}
                            </FormItem>
                          )}
                        />
                      )}
                      
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