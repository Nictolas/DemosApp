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

// Schema per entrambe le parti del form
const elezioneCandidaturaSchema = z.object({
  // Parte elezione
  grado_elezione: z.string().min(1, "Il grado di elezione è obbligatorio"),
  paese_elezione: z.string().min(1, "Il paese di elezione è obbligatorio"),
  regione_elezione: z.string().min(1, "La regione di elezione è obbligatoria"),
  provincia_elezione: z.string().min(1, "La provincia di elezione è obbligatoria"),
  comune_elezione: z.string().min(1, "Il comune di elezione è obbligatorio"),
  
  // Parte candidatura
  grado_candidatura: z.string().min(1, "Il grado di candidatura è obbligatorio"),
  paese_candidatura: z.string().min(1, "Il paese di candidatura è obbligatorio"),
  regione_candidatura: z.string().min(1, "La regione di candidatura è obbligatoria"),
  provincia_candidatura: z.string().min(1, "La provincia di candidatura è obbligatoria"),
  comune_candidatura: z.string().min(1, "Il comune di candidatura è obbligatorio")
});

type ElezioneCandidaturaFormValues = z.infer<typeof elezioneCandidaturaSchema>;

export default function RegistrazioneElezioneCandidatura() {
  const { toast } = useToast();
  const { registerMutation } = useAuth();
  const { formData, clearFormData } = useRegistration();
  const [registrationSubmitted, setRegistrationSubmitted] = useState(false);
  const [shouldRedirectToAuth, setShouldRedirectToAuth] = useState(false);
  const [shouldRedirectToMenu, setShouldRedirectToMenu] = useState(false);

  // Stati per le opzioni dinamiche delle località di elezione
  const [regioniElezione, setRegioniElezione] = useState<string[]>([]);
  const [provinceElezione, setProvinceElezione] = useState<string[]>([]);
  const [comuniElezione, setComuniElezione] = useState<string[]>([]);
  
  // Stati per le opzioni dinamiche delle località di candidatura
  const [regioniCandidatura, setRegioniCandidatura] = useState<string[]>([]);
  const [provinceCandidatura, setProvinceCandidatura] = useState<string[]>([]);
  const [comuniCandidatura, setComuniCandidatura] = useState<string[]>([]);

  // Inizializzazione del form
  const form = useForm<ElezioneCandidaturaFormValues>({
    resolver: zodResolver(elezioneCandidaturaSchema),
    defaultValues: {
      grado_elezione: "",
      paese_elezione: "",
      regione_elezione: "",
      provincia_elezione: "",
      comune_elezione: "",
      grado_candidatura: "",
      paese_candidatura: "",
      regione_candidatura: "",
      provincia_candidatura: "",
      comune_candidatura: "",
    },
  });
  
  // Verifico se devo fare redirect
  useEffect(() => {
    if (!formData) {
      setShouldRedirectToAuth(true);
    }
  }, [formData]);
  
  useEffect(() => {
    if (registrationSubmitted && !registerMutation.isPending) {
      setShouldRedirectToMenu(true);
    }
  }, [registrationSubmitted, registerMutation.isPending]);
  
  // Redirect se necessario
  if (shouldRedirectToAuth) {
    return <Redirect to="/auth" />;
  }
  
  if (shouldRedirectToMenu) {
    return <Redirect to="/menu" />;
  }

  // Gestione selezioni a cascata per l'elezione
  useEffect(() => {
    const paeseElezione = form.watch("paese_elezione");
    if (paeseElezione === "Italia") {
      const regioni = ITALY_DATA.Italia.regioni.map(regione => regione.nome);
      setRegioniElezione(regioni);
    } else {
      setRegioniElezione([]);
      form.setValue("regione_elezione", "");
    }
    setProvinceElezione([]);
    setComuniElezione([]);
    form.setValue("provincia_elezione", "");
    form.setValue("comune_elezione", "");
  }, [form.watch("paese_elezione")]);
  
  useEffect(() => {
    const paeseElezione = form.watch("paese_elezione");
    const regioneElezione = form.watch("regione_elezione");
    
    if (paeseElezione === "Italia" && regioneElezione) {
      const selectedRegion = ITALY_DATA.Italia.regioni.find(
        r => r.nome === regioneElezione
      );
      
      if (selectedRegion) {
        const province = selectedRegion.province.map(provincia => provincia.nome);
        setProvinceElezione(province);
      }
    } else {
      setProvinceElezione([]);
    }
    setComuniElezione([]);
    form.setValue("provincia_elezione", "");
    form.setValue("comune_elezione", "");
  }, [form.watch("regione_elezione")]);
  
  useEffect(() => {
    const paeseElezione = form.watch("paese_elezione");
    const regioneElezione = form.watch("regione_elezione");
    const provinciaElezione = form.watch("provincia_elezione");
    
    if (paeseElezione === "Italia" && regioneElezione && provinciaElezione) {
      const selectedRegion = ITALY_DATA.Italia.regioni.find(
        r => r.nome === regioneElezione
      );
      
      if (selectedRegion) {
        const selectedProvince = selectedRegion.province.find(
          p => p.nome === provinciaElezione
        );
        
        if (selectedProvince) {
          setComuniElezione(selectedProvince.comuni);
        }
      }
    } else {
      setComuniElezione([]);
    }
    form.setValue("comune_elezione", "");
  }, [form.watch("provincia_elezione")]);

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

  const onSubmit = (values: ElezioneCandidaturaFormValues) => {
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
          <div className="w-full max-w-2xl">
            <Card className="shadow-xl border-t-4 border-t-blue-600">
              <CardHeader>
                <CardTitle className="text-2xl text-center">Dati di Elezione e Candidatura</CardTitle>
                <CardDescription className="text-center">
                  Completa la tua registrazione con i dati di elezione e candidatura
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {/* Sezione Elezione */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium border-b pb-2">Informazioni di Elezione</h3>
                      
                      {/* Grado di Elezione */}
                      <FormField
                        control={form.control}
                        name="grado_elezione"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="required-field">Grado di Elezione</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleziona grado di elezione" />
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
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Paese di Elezione */}
                        <FormField
                          control={form.control}
                          name="paese_elezione"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="required-field">Paese di Elezione</FormLabel>
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
                        
                        {/* Regione di Elezione */}
                        <FormField
                          control={form.control}
                          name="regione_elezione"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="required-field">Regione di Elezione</FormLabel>
                              <Select 
                                onValueChange={field.onChange} 
                                defaultValue={field.value}
                                disabled={regioniElezione.length === 0}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Seleziona regione" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {regioniElezione.map(regione => (
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
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Provincia di Elezione */}
                        <FormField
                          control={form.control}
                          name="provincia_elezione"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="required-field">Provincia di Elezione</FormLabel>
                              <Select 
                                onValueChange={field.onChange} 
                                defaultValue={field.value}
                                disabled={provinceElezione.length === 0}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Seleziona provincia" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {provinceElezione.map(provincia => (
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
                        
                        {/* Comune di Elezione */}
                        <FormField
                          control={form.control}
                          name="comune_elezione"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="required-field">Comune di Elezione</FormLabel>
                              <Select 
                                onValueChange={field.onChange} 
                                defaultValue={field.value}
                                disabled={comuniElezione.length === 0}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Seleziona comune" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {comuniElezione.map(comune => (
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
                    </div>
                    
                    {/* Separatore */}
                    <div className="border-t border-gray-200 my-6"></div>
                    
                    {/* Sezione Candidatura */}
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
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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