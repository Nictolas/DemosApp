import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { ITALY_DATA } from "@/data/italyData";

const loginSchema = z.object({
  email: z.string().email("Inserisci un'email valida").min(3, "L'email deve contenere almeno 3 caratteri"),
  password: z.string().min(6, "La password deve contenere almeno 6 caratteri"),
});

// Schema completo per la registrazione includendo tutti i dati demografici
const registerSchema = z.object({
  email: z.string().email("Inserisci un'email valida").min(3, "L'email deve contenere almeno 3 caratteri"),
  password: z.string().min(6, "La password deve contenere almeno 6 caratteri"),
  confirmPassword: z.string(),
  
  // Dati personali
  nome: z.string().min(1, "Il nome è obbligatorio"),
  cognome: z.string().min(1, "Il cognome è obbligatorio"),
  data_nascita: z.string().min(1, "La data di nascita è obbligatoria"),
  genere: z.string().min(1, "Il genere è obbligatorio"),
  cittadinanza: z.string().min(1, "La cittadinanza è obbligatoria"),
  
  // Dati di residenza
  paese_residenza: z.string().min(1, "Il paese di residenza è obbligatorio"),
  regione_residenza: z.string().min(1, "La regione di residenza è obbligatoria"),
  provincia_residenza: z.string().min(1, "La provincia di residenza è obbligatoria"),
  comune_residenza: z.string().min(1, "Il comune di residenza è obbligatorio"),
  
  // Dati opzionali
  paese_elezione: z.string().optional(),
  regione_elezione: z.string().optional(),
  provincia_elezione: z.string().optional(),
  comune_elezione: z.string().optional(),
  
  paese_candidatura: z.string().optional(),
  regione_candidatura: z.string().optional(),
  provincia_candidatura: z.string().optional(),
  comune_candidatura: z.string().optional(),
  
  ruolo: z.string().min(1, "Il ruolo è obbligatorio"),
  grado_elezione: z.string().optional(),
  grado_candidatura: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Le password non corrispondono",
  path: ["confirmPassword"],
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const { user, loginMutation, registerMutation } = useAuth();

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Stati per le opzioni dinamiche delle località
  const [regioniResidenza, setRegioniResidenza] = useState<string[]>([]);
  const [provinceResidenza, setProvinceResidenza] = useState<string[]>([]);
  const [comuniResidenza, setComuniResidenza] = useState<string[]>([]);
  
  const [regioniElezione, setRegioniElezione] = useState<string[]>([]);
  const [provinceElezione, setProvinceElezione] = useState<string[]>([]);
  const [comuniElezione, setComuniElezione] = useState<string[]>([]);
  
  const [regioniCandidatura, setRegioniCandidatura] = useState<string[]>([]);
  const [provinceCandidatura, setProvinceCandidatura] = useState<string[]>([]);
  const [comuniCandidatura, setComuniCandidatura] = useState<string[]>([]);

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      nome: "",
      cognome: "",
      data_nascita: "",
      genere: "",
      cittadinanza: "",
      paese_residenza: "",
      regione_residenza: "",
      provincia_residenza: "",
      comune_residenza: "",
      paese_elezione: "",
      regione_elezione: "",
      provincia_elezione: "",
      comune_elezione: "",
      paese_candidatura: "",
      regione_candidatura: "",
      provincia_candidatura: "",
      comune_candidatura: "",
      ruolo: "",
      grado_elezione: "",
      grado_candidatura: "",
    },
  });
  
  // Gestione delle selezioni a cascata per la residenza
  useEffect(() => {
    const paeseResidenza = registerForm.watch("paese_residenza");
    if (paeseResidenza === "Italia") {
      const regioni = ITALY_DATA.Italia.regioni.map(regione => regione.nome);
      setRegioniResidenza(regioni);
    } else {
      setRegioniResidenza([]);
      registerForm.setValue("regione_residenza", "");
    }
    setProvinceResidenza([]);
    setComuniResidenza([]);
    registerForm.setValue("provincia_residenza", "");
    registerForm.setValue("comune_residenza", "");
  }, [registerForm.watch("paese_residenza")]);
  
  useEffect(() => {
    const paeseResidenza = registerForm.watch("paese_residenza");
    const regioneResidenza = registerForm.watch("regione_residenza");
    
    if (paeseResidenza === "Italia" && regioneResidenza) {
      const selectedRegion = ITALY_DATA.Italia.regioni.find(
        r => r.nome === regioneResidenza
      );
      
      if (selectedRegion) {
        const province = selectedRegion.province.map(provincia => provincia.nome);
        setProvinceResidenza(province);
      }
    } else {
      setProvinceResidenza([]);
    }
    setComuniResidenza([]);
    registerForm.setValue("provincia_residenza", "");
    registerForm.setValue("comune_residenza", "");
  }, [registerForm.watch("regione_residenza")]);
  
  useEffect(() => {
    const paeseResidenza = registerForm.watch("paese_residenza");
    const regioneResidenza = registerForm.watch("regione_residenza");
    const provinciaResidenza = registerForm.watch("provincia_residenza");
    
    if (paeseResidenza === "Italia" && regioneResidenza && provinciaResidenza) {
      const selectedRegion = ITALY_DATA.Italia.regioni.find(
        r => r.nome === regioneResidenza
      );
      
      if (selectedRegion) {
        const selectedProvince = selectedRegion.province.find(
          p => p.nome === provinciaResidenza
        );
        
        if (selectedProvince) {
          setComuniResidenza(selectedProvince.comuni);
        }
      }
    } else {
      setComuniResidenza([]);
    }
    registerForm.setValue("comune_residenza", "");
  }, [registerForm.watch("provincia_residenza")]);
  
  // Gestione delle selezioni a cascata per il luogo di elezione
  useEffect(() => {
    const paeseElezione = registerForm.watch("paese_elezione");
    if (paeseElezione === "Italia") {
      const regioni = ITALY_DATA.Italia.regioni.map(regione => regione.nome);
      setRegioniElezione(regioni);
    } else {
      setRegioniElezione([]);
      registerForm.setValue("regione_elezione", "");
    }
    setProvinceElezione([]);
    setComuniElezione([]);
    registerForm.setValue("provincia_elezione", "");
    registerForm.setValue("comune_elezione", "");
  }, [registerForm.watch("paese_elezione")]);
  
  useEffect(() => {
    const paeseElezione = registerForm.watch("paese_elezione");
    const regioneElezione = registerForm.watch("regione_elezione");
    
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
    registerForm.setValue("provincia_elezione", "");
    registerForm.setValue("comune_elezione", "");
  }, [registerForm.watch("regione_elezione")]);
  
  useEffect(() => {
    const paeseElezione = registerForm.watch("paese_elezione");
    const regioneElezione = registerForm.watch("regione_elezione");
    const provinciaElezione = registerForm.watch("provincia_elezione");
    
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
    registerForm.setValue("comune_elezione", "");
  }, [registerForm.watch("provincia_elezione")]);
  
  // Gestione delle selezioni a cascata per la candidatura
  useEffect(() => {
    const paeseCandidatura = registerForm.watch("paese_candidatura");
    if (paeseCandidatura === "Italia") {
      const regioni = ITALY_DATA.Italia.regioni.map(regione => regione.nome);
      setRegioniCandidatura(regioni);
    } else {
      setRegioniCandidatura([]);
      registerForm.setValue("regione_candidatura", "");
    }
    setProvinceCandidatura([]);
    setComuniCandidatura([]);
    registerForm.setValue("provincia_candidatura", "");
    registerForm.setValue("comune_candidatura", "");
  }, [registerForm.watch("paese_candidatura")]);
  
  useEffect(() => {
    const paeseCandidatura = registerForm.watch("paese_candidatura");
    const regioneCandidatura = registerForm.watch("regione_candidatura");
    
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
    registerForm.setValue("provincia_candidatura", "");
    registerForm.setValue("comune_candidatura", "");
  }, [registerForm.watch("regione_candidatura")]);
  
  useEffect(() => {
    const paeseCandidatura = registerForm.watch("paese_candidatura");
    const regioneCandidatura = registerForm.watch("regione_candidatura");
    const provinciaCandidatura = registerForm.watch("provincia_candidatura");
    
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
    registerForm.setValue("comune_candidatura", "");
  }, [registerForm.watch("provincia_candidatura")]);

  const onLoginSubmit = (data: LoginFormValues) => {
    loginMutation.mutate(data);
  };

  const onRegisterSubmit = (data: RegisterFormValues) => {
    const { confirmPassword, ...userData } = data;
    registerMutation.mutate(userData);
  };

  // Redirect to home page if already logged in
  if (user) {
    return <Redirect to="/" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-16">
        <div className="flex flex-col lg:flex-row items-center gap-8">
          {/* Hero Section */}
          <div className="lg:w-1/2">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Benvenuto in <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">DEMOS</span>
            </h1>
            <p className="text-xl text-gray-700 mb-6">
              Registrati per entrare a far parte del sistema di registrazione per gli utenti DEMOS.
            </p>
            <div className="bg-white rounded-lg p-6 shadow-md border border-gray-100">
              <h3 className="text-lg font-medium mb-2">Cosa puoi fare con DEMOS:</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-center">
                  <svg className="h-5 w-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  Registrare le tue informazioni personali
                </li>
                <li className="flex items-center">
                  <svg className="h-5 w-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  Specificare dati di residenza e informazioni elettorali
                </li>
                <li className="flex items-center">
                  <svg className="h-5 w-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  Partecipare al sistema democratico italiano
                </li>
              </ul>
            </div>
          </div>

          {/* Auth Forms */}
          <div className="lg:w-1/2 w-full max-w-md">
            <Card className="shadow-xl border-t-4 border-t-blue-600">
              <CardHeader>
                <CardTitle className="text-2xl text-center">Account</CardTitle>
                <CardDescription className="text-center">
                  Accedi o crea un nuovo account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "login" | "register")}>
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="login">Accedi</TabsTrigger>
                    <TabsTrigger value="register">Registrati</TabsTrigger>
                  </TabsList>

                  {/* Login Form */}
                  <TabsContent value="login">
                    <Form {...loginForm}>
                      <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                        <FormField
                          control={loginForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input placeholder="Inserisci la tua email" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={loginForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password</FormLabel>
                              <FormControl>
                                <Input type="password" placeholder="Inserisci la tua password" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                          {loginMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Accesso in corso...
                            </>
                          ) : (
                            "Accedi"
                          )}
                        </Button>
                      </form>
                    </Form>
                  </TabsContent>

                  {/* Register Form */}
                  <TabsContent value="register">
                    <Form {...registerForm}>
                      <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-6">
                        {/* Sezione di accesso */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-medium border-b pb-2">Credenziali di accesso</h3>
                          <div className="grid grid-cols-1 gap-4">
                            <FormField
                              control={registerForm.control}
                              name="email"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="required-field">Email</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Inserisci la tua email" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={registerForm.control}
                              name="password"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="required-field">Password</FormLabel>
                                  <FormControl>
                                    <Input type="password" placeholder="Crea una password" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={registerForm.control}
                              name="confirmPassword"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="required-field">Conferma password</FormLabel>
                                  <FormControl>
                                    <Input type="password" placeholder="Ripeti la password" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                        
                        {/* Sezione dati personali */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-medium border-b pb-2">Dati personali</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={registerForm.control}
                              name="nome"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="required-field">Nome</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Inserisci il tuo nome" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={registerForm.control}
                              name="cognome"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="required-field">Cognome</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Inserisci il tuo cognome" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={registerForm.control}
                              name="data_nascita"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="required-field">Data di nascita</FormLabel>
                                  <FormControl>
                                    <Input type="date" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={registerForm.control}
                              name="genere"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="required-field">Genere</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Seleziona genere" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="uomo">Uomo</SelectItem>
                                      <SelectItem value="donna">Donna</SelectItem>
                                      <SelectItem value="altro">Altro</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={registerForm.control}
                              name="cittadinanza"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="required-field">Cittadinanza</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Seleziona cittadinanza" />
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
                          </div>
                        </div>
                        
                        {/* Sezione residenza */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-medium border-b pb-2">Dati di residenza</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={registerForm.control}
                              name="paese_residenza"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="required-field">Paese</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
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
                              control={registerForm.control}
                              name="regione_residenza"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="required-field">Regione</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value} disabled={regioniResidenza.length === 0}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Seleziona regione" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {regioniResidenza.map((regione) => (
                                        <SelectItem key={regione} value={regione}>{regione}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={registerForm.control}
                              name="provincia_residenza"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="required-field">Provincia</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value} disabled={provinceResidenza.length === 0}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Seleziona provincia" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {provinceResidenza.map((provincia) => (
                                        <SelectItem key={provincia} value={provincia}>{provincia}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={registerForm.control}
                              name="comune_residenza"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="required-field">Comune</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value} disabled={comuniResidenza.length === 0}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Seleziona comune" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {comuniResidenza.map((comune) => (
                                        <SelectItem key={comune} value={comune}>{comune}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                        
                        {/* Ruolo */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-medium border-b pb-2">Ruolo</h3>
                          <FormField
                            control={registerForm.control}
                            name="ruolo"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="required-field">Ruolo</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Seleziona ruolo" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="Elettore">Elettore</SelectItem>
                                    <SelectItem value="Candidato">Candidato</SelectItem>
                                    <SelectItem value="Politico">Politico</SelectItem>
                                    <SelectItem value="Candidato Politico">Candidato Politico</SelectItem>
                                    <SelectItem value="Admin">Admin</SelectItem>
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
                  </TabsContent>
                </Tabs>
              </CardContent>
              <CardFooter className="flex justify-center text-sm text-gray-500">
                {activeTab === "login" ? (
                  <p>
                    Non hai un account?{" "}
                    <Button variant="link" className="p-0" onClick={() => setActiveTab("register")}>
                      Registrati
                    </Button>
                  </p>
                ) : (
                  <p>
                    Hai già un account?{" "}
                    <Button variant="link" className="p-0" onClick={() => setActiveTab("login")}>
                      Accedi
                    </Button>
                  </p>
                )}
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}