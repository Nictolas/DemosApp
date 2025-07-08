import { useState, useEffect } from "react";
import { z } from "zod";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useRegistration } from "@/hooks/use-registration";
import { useLocation } from "wouter";
import { ITALY_DATA } from "@/data/italyData";

// Nuovo schema combinato senza .partial()
const fullSchema = z.object({
  // Account
  email: z.string().email("Email non valida"),
  password: z.string().min(6, "Minimo 6 caratteri"),
  ruolo: z.string().min(1, "Il ruolo è obbligatorio"),
  // Elezione (tutti opzionali, validati solo se richiesti)
  grado_elezione: z.string().optional(),
  aula_elezione: z.string().optional(),
  paese_elezione: z.string().optional(),
  regione_elezione: z.string().optional(),
  provincia_elezione: z.string().optional(),
  comune_elezione: z.string().optional(),
  // Candidatura (tutti opzionali, validati solo se richiesti)
  grado_candidatura: z.string().optional(),
  aula_candidatura: z.string().optional(),
  paese_candidatura: z.string().optional(),
  regione_candidatura: z.string().optional(),
  provincia_candidatura: z.string().optional(),
  comune_candidatura: z.string().optional(),
}).refine((data) => {
  // Validazione dinamica in base al ruolo
  if (data.ruolo === "Politico" || data.ruolo === "Candidato Politico") {
    if (!data.grado_elezione) return false;
    if (!data.paese_elezione) return false;
    if (!data.regione_elezione) return false;
    if (!data.provincia_elezione) return false;
    if (!data.comune_elezione) return false;
    if (data.grado_elezione === "Nazionale" && !data.aula_elezione) return false;
  }
  if (data.ruolo === "Candidato" || data.ruolo === "Candidato Politico") {
    if (!data.grado_candidatura) return false;
    if (!data.paese_candidatura) return false;
    if (!data.regione_candidatura) return false;
    if (!data.provincia_candidatura) return false;
    if (!data.comune_candidatura) return false;
    if (data.grado_candidatura === "Nazionale" && !data.aula_candidatura) return false;
  }
  return true;
}, {
  message: "Compila tutti i campi obbligatori per il tuo ruolo (e l'aula se Nazionale)",
});

type WizardFormValues = z.infer<typeof fullSchema>;

const steps = ["Account", "Elezione/Candidatura", "Riepilogo"];

export default function RegistrazioneWizard() {
  const [step, setStep] = useState(0);
  const [regioniElezione, setRegioniElezione] = useState<string[]>([]);
  const [provinceElezione, setProvinceElezione] = useState<string[]>([]);
  const [comuniElezione, setComuniElezione] = useState<string[]>([]);
  const [regioniCandidatura, setRegioniCandidatura] = useState<string[]>([]);
  const [provinceCandidatura, setProvinceCandidatura] = useState<string[]>([]);
  const [comuniCandidatura, setComuniCandidatura] = useState<string[]>([]);
  const { registerMutation } = useAuth();
  const [, navigate] = useLocation();
  const methods = useForm<WizardFormValues>({
    resolver: zodResolver(fullSchema),
    defaultValues: {},
    mode: "onTouched"
  });
  const { watch, handleSubmit, formState, setValue } = methods;
  const ruolo = watch("ruolo");

  // --- LOGICA REGIONI/PROVINCE/COMUNI ELEZIONE ---
  const paeseElezione = watch("paese_elezione");
  const regioneElezione = watch("regione_elezione");
  const provinciaElezione = watch("provincia_elezione");
  useEffect(() => {
    if (paeseElezione === "Italia") {
      setRegioniElezione(ITALY_DATA.Italia.regioni.map(r => r.nome));
    } else {
      setRegioniElezione([]);
      setValue("regione_elezione", "");
    }
    setProvinceElezione([]);
    setComuniElezione([]);
    setValue("provincia_elezione", "");
    setValue("comune_elezione", "");
  }, [paeseElezione]);
  useEffect(() => {
    if (paeseElezione === "Italia" && regioneElezione) {
      const regione = ITALY_DATA.Italia.regioni.find(r => r.nome === regioneElezione);
      setProvinceElezione(regione ? regione.province.map(p => p.nome) : []);
    } else {
      setProvinceElezione([]);
    }
    setComuniElezione([]);
    setValue("provincia_elezione", "");
    setValue("comune_elezione", "");
  }, [regioneElezione, paeseElezione]);
  useEffect(() => {
    if (paeseElezione === "Italia" && regioneElezione && provinciaElezione) {
      const regione = ITALY_DATA.Italia.regioni.find(r => r.nome === regioneElezione);
      const provincia = regione?.province.find(p => p.nome === provinciaElezione);
      setComuniElezione(provincia ? provincia.comuni : []);
    } else {
      setComuniElezione([]);
    }
    setValue("comune_elezione", "");
  }, [provinciaElezione, regioneElezione, paeseElezione]);

  // --- LOGICA REGIONI/PROVINCE/COMUNI CANDIDATURA ---
  const paeseCandidatura = watch("paese_candidatura");
  const regioneCandidatura = watch("regione_candidatura");
  const provinciaCandidatura = watch("provincia_candidatura");
  useEffect(() => {
    if (paeseCandidatura === "Italia") {
      setRegioniCandidatura(ITALY_DATA.Italia.regioni.map(r => r.nome));
    } else {
      setRegioniCandidatura([]);
      setValue("regione_candidatura", "");
    }
    setProvinceCandidatura([]);
    setComuniCandidatura([]);
    setValue("provincia_candidatura", "");
    setValue("comune_candidatura", "");
  }, [paeseCandidatura]);
  useEffect(() => {
    if (paeseCandidatura === "Italia" && regioneCandidatura) {
      const regione = ITALY_DATA.Italia.regioni.find(r => r.nome === regioneCandidatura);
      setProvinceCandidatura(regione ? regione.province.map(p => p.nome) : []);
    } else {
      setProvinceCandidatura([]);
    }
    setComuniCandidatura([]);
    setValue("provincia_candidatura", "");
    setValue("comune_candidatura", "");
  }, [regioneCandidatura, paeseCandidatura]);
  useEffect(() => {
    if (paeseCandidatura === "Italia" && regioneCandidatura && provinciaCandidatura) {
      const regione = ITALY_DATA.Italia.regioni.find(r => r.nome === regioneCandidatura);
      const provincia = regione?.province.find(p => p.nome === provinciaCandidatura);
      setComuniCandidatura(provincia ? provincia.comuni : []);
    } else {
      setComuniCandidatura([]);
    }
    setValue("comune_candidatura", "");
  }, [provinciaCandidatura, regioneCandidatura, paeseCandidatura]);

  // Step 1: Account
  const renderStep1 = () => (
    <>
      <FormField control={methods.control} name="email" render={({ field }) => (
        <FormItem>
          <FormLabel>Email</FormLabel>
          <FormControl><Input {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={methods.control} name="password" render={({ field }) => (
        <FormItem>
          <FormLabel>Password</FormLabel>
          <FormControl><Input type="password" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={methods.control} name="ruolo" render={({ field }) => (
        <FormItem>
          <FormLabel>Ruolo</FormLabel>
          <Select onValueChange={field.onChange} defaultValue={field.value}>
            <FormControl>
              <SelectTrigger><SelectValue placeholder="Seleziona ruolo" /></SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value="Politico">Politico</SelectItem>
              <SelectItem value="Candidato">Candidato</SelectItem>
              <SelectItem value="Candidato Politico">Candidato Politico</SelectItem>
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )} />
    </>
  );

  // Step 2: Elezione/Candidatura (dinamico)
  const renderStep2 = () => (
    <>
      {/* Sezione Elezione solo per Politico e Candidato Politico */}
      {(ruolo === "Politico" || ruolo === "Candidato Politico") && (
        <>
          <FormField control={methods.control} name="grado_elezione" render={({ field }) => (
            <FormItem>
              <FormLabel>Grado di Elezione</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Seleziona grado di elezione" /></SelectTrigger>
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
          )} />
          {watch("grado_elezione") === "Nazionale" && (
            <FormField control={methods.control} name="aula_elezione" render={({ field }) => (
              <FormItem>
                <FormLabel>Aula</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Seleziona aula" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Camera">Camera</SelectItem>
                    <SelectItem value="Senato">Senato</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          )}
          {/* Paese, Regione, Provincia, Comune Elezione */}
          <FormField control={methods.control} name="paese_elezione" render={({ field }) => (
            <FormItem>
              <FormLabel>Paese di Elezione</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Seleziona paese" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Italia">Italia</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={methods.control} name="regione_elezione" render={({ field }) => (
            <FormItem>
              <FormLabel>Regione di Elezione</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value} disabled={regioniElezione.length === 0}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Seleziona regione" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {regioniElezione.map(regione => (
                    <SelectItem key={regione} value={regione}>{regione}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={methods.control} name="provincia_elezione" render={({ field }) => (
            <FormItem>
              <FormLabel>Provincia di Elezione</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value} disabled={provinceElezione.length === 0}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Seleziona provincia" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {provinceElezione.map(provincia => (
                    <SelectItem key={provincia} value={provincia}>{provincia}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={methods.control} name="comune_elezione" render={({ field }) => (
            <FormItem>
              <FormLabel>Comune di Elezione</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value} disabled={comuniElezione.length === 0}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Seleziona comune" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {comuniElezione.map(comune => (
                    <SelectItem key={comune} value={comune}>{comune}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </>
      )}
      {/* Sezione Candidatura solo per Candidato e Candidato Politico */}
      {(ruolo === "Candidato" || ruolo === "Candidato Politico") && (
        <>
          <FormField control={methods.control} name="grado_candidatura" render={({ field }) => (
            <FormItem>
              <FormLabel>Grado di Candidatura</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Seleziona grado di candidatura" /></SelectTrigger>
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
          )} />
          {watch("grado_candidatura") === "Nazionale" && (
            <FormField control={methods.control} name="aula_candidatura" render={({ field }) => (
              <FormItem>
                <FormLabel>Aula</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Seleziona aula" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Camera">Camera</SelectItem>
                    <SelectItem value="Senato">Senato</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          )}
          {/* Paese, Regione, Provincia, Comune Candidatura */}
          <FormField control={methods.control} name="paese_candidatura" render={({ field }) => (
            <FormItem>
              <FormLabel>Paese di Candidatura</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Seleziona paese" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Italia">Italia</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={methods.control} name="regione_candidatura" render={({ field }) => (
            <FormItem>
              <FormLabel>Regione di Candidatura</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value} disabled={regioniCandidatura.length === 0}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Seleziona regione" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {regioniCandidatura.map(regione => (
                    <SelectItem key={regione} value={regione}>{regione}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={methods.control} name="provincia_candidatura" render={({ field }) => (
            <FormItem>
              <FormLabel>Provincia di Candidatura</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value} disabled={provinceCandidatura.length === 0}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Seleziona provincia" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {provinceCandidatura.map(provincia => (
                    <SelectItem key={provincia} value={provincia}>{provincia}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={methods.control} name="comune_candidatura" render={({ field }) => (
            <FormItem>
              <FormLabel>Comune di Candidatura</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value} disabled={comuniCandidatura.length === 0}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Seleziona comune" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {comuniCandidatura.map(comune => (
                    <SelectItem key={comune} value={comune}>{comune}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </>
      )}
    </>
  );

  // Step 3: Riepilogo
  const renderStep3 = () => {
    const values = methods.getValues();
    return (
      <div>
        <h3 className="font-bold mb-2">Riepilogo dati</h3>
        <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">{JSON.stringify(values, null, 2)}</pre>
      </div>
    );
  };

  const onSubmit = (data: WizardFormValues) => {
    registerMutation.mutate(data as any, {
      onSuccess: () => {
        navigate("/menu");
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
      <div className="w-full max-w-2xl">
        <Card className="shadow-xl border-t-4 border-t-blue-600">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Registrazione DEMOS</CardTitle>
            <div className="flex justify-center gap-2 mt-2">
              {steps.map((s, i) => (
                <div key={s} className={`h-2 w-2 rounded-full ${i === step ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <FormProvider {...methods}>
              <Form {...methods}>
                <form onSubmit={handleSubmit(onSubmit)}>
                  {step === 0 && renderStep1()}
                  {step === 1 && renderStep2()}
                  {step === 2 && renderStep3()}
                  <div className="flex justify-between mt-6">
                    {step > 0 && (
                      <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
                        Indietro
                      </Button>
                    )}
                    {step < steps.length - 1 && (
                      <Button type="button" onClick={() => {
                        handleSubmit(() => setStep(step + 1))();
                      }}>
                        Avanti
                      </Button>
                    )}
                    {step === steps.length - 1 && (
                      <Button type="submit">Registrati</Button>
                    )}
                  </div>
                </form>
              </Form>
            </FormProvider>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 