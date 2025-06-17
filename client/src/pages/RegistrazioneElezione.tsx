import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useRegistration } from "@/hooks/use-registration";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { ITALY_DATA } from "@/data/italyData";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query"; // Aggiunto import per useMutation

// Schema per la parte di elezione del form
const elezioneSchema = z.object({
  grado_elezione: z.string().min(1, "Il grado di elezione è obbligatorio"),
  paese_elezione: z.string().min(1, "Il paese di elezione è obbligatorio"),
  regione_elezione: z.string().min(1, "La regione di elezione è obbligatoria"),
  provincia_elezione: z.string().min(1, "La provincia di elezione è obbligatoria"),
  comune_elezione: z.string().min(1, "Il comune di elezione è obbligatorio"),
});

type ElezioneFormValues = z.infer<typeof elezioneSchema>;

export default function RegistrazioneElezione() {
  const { toast } = useToast();
  const { formData, clearFormData } = useRegistration();
  const [, navigate] = useLocation();

  const [regioniElezione, setRegioniElezione] = useState<string[]>([]);
  const [provinceElezione, setProvinceElezione] = useState<string[]>([]);
  const [comuniElezione, setComuniElezione] = useState<string[]>([]);

  // Definiamo una nuova mutation per l'aggiornamento del profilo
  const { mutate: updateProfileMutation, isPending } = useMutation({
    mutationFn: async (politicianData: ElezioneFormValues) => {
      const response = await fetch('/api/complete-politician-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(politicianData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Errore durante l'aggiornamento del profilo");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Profilo completato!", description: "La tua registrazione è ora completa.", variant: "success" });
      clearFormData(); // Pulisce i dati temporanei
      navigate("/menu"); // Reindirizza al menu
    },
    onError: (error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    }
  });

  const form = useForm<ElezioneFormValues>({
    resolver: zodResolver(elezioneSchema),
    defaultValues: {
      grado_elezione: "",
      paese_elezione: "",
      regione_elezione: "",
      provincia_elezione: "",
      comune_elezione: "",
    },
  });

  const { watch, setValue } = form; // Aggiunto setValue

  const paeseElezione = watch("paese_elezione");
  const regioneElezione = watch("regione_elezione");
  const provinciaElezione = watch("provincia_elezione");

  useEffect(() => {
    if (!formData) {
      // Se non ci sono dati dal primo step, reindirizza all'autenticazione
      navigate("/auth");
    }
  }, [formData, navigate]);

  useEffect(() => {
    if (paeseElezione === "Italia") {
      const regioni = ITALY_DATA.Italia.regioni.map((regione) => regione.nome);
      setRegioniElezione(regioni);
    } else {
      setRegioniElezione([]);
      setValue("regione_elezione", "");
    }
    setProvinceElezione([]);
    setComuniElezione([]);
    setValue("provincia_elezione", "");
    setValue("comune_elezione", "");
  }, [paeseElezione, setValue]);

  useEffect(() => {
    if (paeseElezione === "Italia" && regioneElezione) {
      const selectedRegion = ITALY_DATA.Italia.regioni.find(
        (r) => r.nome === regioneElezione
      );

      if (selectedRegion) {
        const province = selectedRegion.province.map(
          (provincia) => provincia.nome
        );
        setProvinceElezione(province);
      }
    } else {
      setProvinceElezione([]);
    }
    setComuniElezione([]);
    setValue("provincia_elezione", "");
    setValue("comune_elezione", "");
  }, [regioneElezione, paeseElezione, setValue]);

  useEffect(() => {
    if (paeseElezione === "Italia" && regioneElezione && provinciaElezione) {
      const selectedRegion = ITALY_DATA.Italia.regioni.find(
        (r) => r.nome === regioneElezione
      );

      if (selectedRegion) {
        const selectedProvince = selectedRegion.province.find(
          (p) => p.nome === provinciaElezione
        );

        if (selectedProvince) {
          setComuniElezione(selectedProvince.comuni);
        }
      }
    } else {
      setComuniElezione([]);
    }
    setValue("comune_elezione", "");
  }, [provinciaElezione, regioneElezione, paeseElezione, setValue]);

  const onSubmit = (values: ElezioneFormValues) => {
    // Invia solo i nuovi dati raccolti in questo form.
    // Il backend sa già chi è l'utente grazie alla sessione/autenticazione.
    updateProfileMutation(values);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-16">
        <div className="flex justify-center">
          <div className="w-full max-w-md">
            <Card className="shadow-xl border-t-4 border-t-blue-600">
              <CardHeader>
                <CardTitle className="text-2xl text-center">Dati di Elezione</CardTitle>
                <CardDescription className="text-center">
                  Completa la tua registrazione con i dati di elezione
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium border-b pb-2">Informazioni di Elezione</h3>

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

                    <Button type="submit" className="w-full" disabled={isPending}>
                      {isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Salvataggio in corso...
                        </>
                      ) : (
                        "Completa Registrazione"
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