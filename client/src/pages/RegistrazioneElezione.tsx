import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useRegistration } from "@/hooks/use-registration";
import { Redirect, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  CardFooter,
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

// Schema per la parte di elezione del form
const elezioneSchema = z.object({
  grado_elezione: z.string().min(1, "Il grado di elezione è obbligatorio"),
  paese_elezione: z.string().min(1, "Il paese di elezione è obbligatorio"),
  regione_elezione: z.string().min(1, "La regione di elezione è obbligatoria"),
  provincia_elezione: z.string().min(1, "La provincia di elezione è obbligatoria"),
  comune_elezione: z.string().min(1, "Il comune di elezione è obbligatorio"),
  aula_elezione: z.string().optional(),
}).refine((data) => {
  if (data.grado_elezione === "Nazionale") {
    return !!data.aula_elezione;
  }
  return true;
}, {
  message: "L'aula è obbligatoria per il grado nazionale",
  path: ["aula_elezione"]
});

type ElezioneFormValues = z.infer<typeof elezioneSchema>;

export default function RegistrazioneElezione() {
  const { toast } = useToast();
  const { registerMutation } = useAuth();
  const { formData, clearFormData } = useRegistration();
  const [, navigate] = useLocation();

  const [regioniElezione, setRegioniElezione] = useState<string[]>([]);
  const [provinceElezione, setProvinceElezione] = useState<string[]>([]);
  const [comuniElezione, setComuniElezione] = useState<string[]>([]);
  const [aulaElezione, setAulaElezione] = useState("");

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

  const { watch } = form;

  const paeseElezione = watch("paese_elezione");
  const regioneElezione = watch("regione_elezione");
  const provinciaElezione = watch("provincia_elezione");
  const gradoElezione = form.watch("grado_elezione");

  useEffect(() => {
    if (!formData) {
      navigate("/auth");
    }
  }, [formData, navigate]);

  useEffect(() => {
    if (paeseElezione === "Italia") {
      const regioni = ITALY_DATA.Italia.regioni.map((regione) => regione.nome);
      setRegioniElezione(regioni);
    } else {
      setRegioniElezione([]);
      form.setValue("regione_elezione", "");
    }
    setProvinceElezione([]);
    setComuniElezione([]);
    form.setValue("provincia_elezione", "");
    form.setValue("comune_elezione", "");
  }, [paeseElezione]);

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
    form.setValue("provincia_elezione", "");
    form.setValue("comune_elezione", "");
  }, [regioneElezione, paeseElezione]);

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
    form.setValue("comune_elezione", "");
  }, [provinciaElezione, regioneElezione, paeseElezione]);

  const onSubmit = (values: ElezioneFormValues) => {
    const completeData = {
      ...formData,
      ...values,
      aula_elezione: gradoElezione === "Nazionale" ? aulaElezione : undefined,
    };

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
                      
                      {/* Grado di Elezione */}
                      <FormField
                        control={form.control}
                        name="grado_elezione"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="required-field">Grado di Elezione</FormLabel>
                            <Select 
                              onValueChange={value => {
                                field.onChange(value);
                                if (value !== "Nazionale") setAulaElezione("");
                              }}
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
                      
                      {gradoElezione === "Nazionale" && (
                        <FormField
                          control={form.control}
                          name="aula_elezione"
                          render={() => (
                            <FormItem>
                              <FormLabel className="required-field">Aula</FormLabel>
                              <Select
                                onValueChange={setAulaElezione}
                                value={aulaElezione}
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
                              {form.formState.errors.aula_elezione && <FormMessage />}
                            </FormItem>
                          )}
                        />
                      )}
                      
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