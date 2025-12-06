import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth-neon";
import { useToast } from "@/hooks/use-toast";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Shield, Smartphone, CheckCircle } from "lucide-react";
import { ITALY_DATA } from "@/data/italyData";
import CIEButton from "@/components/CIEButton";
import './auth-page.css';

const loginSchema = z.object({
  email: z.string().email("Inserisci un'email valida").min(3, "L'email deve contenere almeno 3 caratteri"),
  password: z.string().min(6, "La password deve contenere almeno 6 caratteri"),
});

const registerSchema = z.object({
  email: z.string().email("Inserisci un'email valida").min(3, "L'email deve contenere almeno 3 caratteri"),
  password: z.string().min(6, "La password deve contenere almeno 6 caratteri"),
  confirmPassword: z.string(),
  nome: z.string().min(1, "Il nome è obbligatorio"),
  cognome: z.string().min(1, "Il cognome è obbligatorio"),
  data_nascita: z.string().min(1, "La data di nascita è obbligatoria"),
  genere: z.string().min(1, "Il genere è obbligatorio"),
  cittadinanza: z.string().min(1, "La cittadinanza è obbligatoria"),
  paese_residenza: z.string().min(1, "Il paese di residenza è obbligatorio"),
  regione_residenza: z.string().min(1, "La regione di residenza è obbligatoria"),
  provincia_residenza: z.string().min(1, "La provincia di residenza è obbligatoria"),
  comune_residenza: z.string().min(1, "Il comune di residenza è obbligatorio"),
  paese_elezione: z.string().optional(),
  regione_elezione: z.string().optional(),
  provincia_elezione: z.string().optional(),
  comune_elezione: z.string().optional(),
  paese_candidatura: z.string().optional(),
  regione_candidatura: z.string().optional(),
  provincia_candidatura: z.string().optional(),
  comune_candidatura: z.string().optional(),
  ruolo: z.string().default("Elettore"),
  grado_elezione: z.string().optional(),
  grado_candidatura: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Le password non corrispondono",
  path: ["confirmPassword"],
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

export default function AuthPageCIE() {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const { user, isLoading, loginMutation, registerMutation, resendVerificationEmail } = useAuth();
  const { toast } = useToast();

  // Stato per mostrare/nascondere la password nel login
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  // Stato per mostrare/nascondere la password nella registrazione
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  // Stato per mostrare/nascondere la conferma password nella registrazione
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

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
      ruolo: "Elettore", // Ruolo automaticamente impostato a "Elettore"
      grado_elezione: "",
      grado_candidatura: "",
    },
  });

  // Selezioni a cascata per residenza, elezione, candidatura
  const [regioniResidenza, setRegioniResidenza] = useState<string[]>([]);
  const [provinceResidenza, setProvinceResidenza] = useState<string[]>([]);
  const [comuniResidenza, setComuniResidenza] = useState<string[]>([]);
  const [regioniElezione, setRegioniElezione] = useState<string[]>([]);
  const [provinceElezione, setProvinceElezione] = useState<string[]>([]);
  const [comuniElezione, setComuniElezione] = useState<string[]>([]);
  const [regioniCandidatura, setRegioniCandidatura] = useState<string[]>([]);
  const [provinceCandidatura, setProvinceCandidatura] = useState<string[]>([]);
  const [comuniCandidatura, setComuniCandidatura] = useState<string[]>([]);

  // Gestione CIE
  const [cieAuthenticated, setCieAuthenticated] = useState(false);
  const [cieUserData, setCieUserData] = useState<any>(null);

  // Se l'utente è già autenticato, reindirizza alla dashboard
  if (user && !isLoading) {
    return <Redirect to="/dashboard" />;
  }

  // Carica le regioni all'avvio
  useEffect(() => {
    setRegioniResidenza(Object.keys(ITALY_DATA));
    setRegioniElezione(Object.keys(ITALY_DATA));
    setRegioniCandidatura(Object.keys(ITALY_DATA));
  }, []);

  // Gestione selezione a cascata per residenza
  const handleRegioneResidenzaChange = (regione: string) => {
    registerForm.setValue("regione_residenza", regione);
    registerForm.setValue("provincia_residenza", "");
    registerForm.setValue("comune_residenza", "");
    
    if (regione && ITALY_DATA[regione]) {
      setProvinceResidenza(Object.keys(ITALY_DATA[regione]));
      setComuniResidenza([]);
    } else {
      setProvinceResidenza([]);
      setComuniResidenza([]);
    }
  };

  const handleProvinciaResidenzaChange = (provincia: string) => {
    registerForm.setValue("provincia_residenza", provincia);
    registerForm.setValue("comune_residenza", "");
    
    const regione = registerForm.getValues("regione_residenza");
    if (regione && provincia && ITALY_DATA[regione]?.[provincia]) {
      setComuniResidenza(Object.keys(ITALY_DATA[regione][provincia]));
    } else {
      setComuniResidenza([]);
    }
  };

  // Gestione selezione a cascata per elezione
  const handleRegioneElezioneChange = (regione: string) => {
    registerForm.setValue("regione_elezione", regione);
    registerForm.setValue("provincia_elezione", "");
    registerForm.setValue("comune_elezione", "");
    
    if (regione && ITALY_DATA[regione]) {
      setProvinceElezione(Object.keys(ITALY_DATA[regione]));
      setComuniElezione([]);
    } else {
      setProvinceElezione([]);
      setComuniElezione([]);
    }
  };

  const handleProvinciaElezioneChange = (provincia: string) => {
    registerForm.setValue("provincia_elezione", provincia);
    registerForm.setValue("comune_elezione", "");
    
    const regione = registerForm.getValues("regione_elezione");
    if (regione && provincia && ITALY_DATA[regione]?.[provincia]) {
      setComuniElezione(Object.keys(ITALY_DATA[regione][provincia]));
    } else {
      setComuniElezione([]);
    }
  };

  // Gestione selezione a cascata per candidatura
  const handleRegioneCandidaturaChange = (regione: string) => {
    registerForm.setValue("regione_candidatura", regione);
    registerForm.setValue("provincia_candidatura", "");
    registerForm.setValue("comune_candidatura", "");
    
    if (regione && ITALY_DATA[regione]) {
      setProvinceCandidatura(Object.keys(ITALY_DATA[regione]));
      setComuniCandidatura([]);
    } else {
      setProvinceCandidatura([]);
      setComuniCandidatura([]);
    }
  };

  const handleProvinciaCandidaturaChange = (provincia: string) => {
    registerForm.setValue("provincia_candidatura", provincia);
    registerForm.setValue("comune_candidatura", "");
    
    const regione = registerForm.getValues("regione_candidatura");
    if (regione && provincia && ITALY_DATA[regione]?.[provincia]) {
      setComuniCandidatura(Object.keys(ITALY_DATA[regione][provincia]));
    } else {
      setComuniCandidatura([]);
    }
  };

  // Gestione login CIE
  const handleCIELogin = () => {
    // Reindirizza al provider CIE
    window.location.href = '/api/auth/signin/cie';
  };

  // Gestione login tradizionale
  const onLoginSubmit = async (data: LoginFormValues) => {
    try {
      await loginMutation.mutateAsync(data);
      toast({
        title: "Login effettuato",
        description: "Benvenuto in DemosApp!",
      });
    } catch (error: any) {
      toast({
        title: "Errore durante il login",
        description: error.message || "Si è verificato un errore",
        variant: "destructive",
      });
    }
  };

  // Gestione registrazione tradizionale
  const onRegisterSubmit = async (data: RegisterFormValues) => {
    try {
      // Assicurati che il ruolo sia sempre "Elettore"
      const registrationData = { ...data, ruolo: "Elettore" };
      await registerMutation.mutateAsync(registrationData);
      toast({
        title: "Registrazione completata",
        description: "Controlla la tua email per verificare l'account",
      });
    } catch (error: any) {
      toast({
        title: "Errore durante la registrazione",
        description: error.message || "Si è verificato un errore",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            DemosApp
          </h1>
          <p className="text-gray-600">
            La piattaforma per la democrazia digitale
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "login" | "register")} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="login">Accedi</TabsTrigger>
            <TabsTrigger value="register">Registrati</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="space-y-6">
            <Card className="w-full max-w-md mx-auto">
              <CardHeader>
                <CardTitle>Accedi al tuo account</CardTitle>
                <CardDescription>
                  Scegli il metodo di autenticazione preferito
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Pulsante CIE */}
                <CIEButton 
                  onClick={handleCIELogin}
                  disabled={loginMutation.isPending}
                />

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      oppure
                    </span>
                  </div>
                </div>

                {/* Login tradizionale */}
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="email" 
                              placeholder="Inserisci la tua email"
                              disabled={loginMutation.isPending}
                            />
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
                            <div className="relative">
                              <Input 
                                {...field} 
                                type={showLoginPassword ? "text" : "password"}
                                placeholder="Inserisci la tua password"
                                disabled={loginMutation.isPending}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowLoginPassword(!showLoginPassword)}
                                disabled={loginMutation.isPending}
                              >
                                {showLoginPassword ? "Nascondi" : "Mostra"}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Accedi
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="register" className="space-y-6">
            <Card className="w-full max-w-4xl mx-auto">
              <CardHeader>
                <CardTitle>Registrati a DemosApp</CardTitle>
                <CardDescription>
                  Crea il tuo account per partecipare alla democrazia digitale
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  {/* Sezione autenticazione CIE */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium border-b pb-2 flex items-center space-x-2">
                      <Shield className="w-5 h-5 text-blue-600" />
                      <span>Autenticazione CIE (Raccomandato)</span>
                    </h3>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                          <p className="text-sm text-blue-800 font-medium">
                            L'autenticazione CIE sostituisce il Codice Fiscale
                          </p>
                          <p className="text-sm text-blue-600 mt-1">
                            È più sicura, gratuita e ufficiale. I tuoi dati personali verranno 
                            automaticamente compilati dalla CIE.
                          </p>
                        </div>
                      </div>
                    </div>
                    <CIEButton 
                      onClick={handleCIELogin}
                      disabled={registerMutation.isPending}
                    />
                  </div>

                  {/* Divider */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        oppure registrati manualmente
                      </span>
                    </div>
                  </div>

                  {/* Form registrazione tradizionale */}
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-6">
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
                                  <Input 
                                    {...field} 
                                    placeholder="Inserisci il nome"
                                    disabled={registerMutation.isPending}
                                  />
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
                                  <Input 
                                    {...field} 
                                    placeholder="Inserisci il cognome"
                                    disabled={registerMutation.isPending}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={registerForm.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="required-field">Email</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    type="email"
                                    placeholder="Inserisci l'email"
                                    disabled={registerMutation.isPending}
                                  />
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
                                  <Input 
                                    {...field} 
                                    type="date"
                                    disabled={registerMutation.isPending}
                                  />
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
                                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={registerMutation.isPending}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Seleziona il genere" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="M">Maschio</SelectItem>
                                    <SelectItem value="F">Femmina</SelectItem>
                                    <SelectItem value="Altro">Altro</SelectItem>
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
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    placeholder="Inserisci la cittadinanza"
                                    disabled={registerMutation.isPending}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* Sezione password */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium border-b pb-2">Credenziali di accesso</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={registerForm.control}
                            name="password"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="required-field">Password</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Input 
                                      {...field} 
                                      type={showRegisterPassword ? "text" : "password"}
                                      placeholder="Inserisci la password"
                                      disabled={registerMutation.isPending}
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                      onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                                      disabled={registerMutation.isPending}
                                    >
                                      {showRegisterPassword ? "Nascondi" : "Mostra"}
                                    </Button>
                                  </div>
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
                                <FormLabel className="required-field">Conferma Password</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Input 
                                      {...field} 
                                      type={showConfirmPassword ? "text" : "password"}
                                      placeholder="Conferma la password"
                                      disabled={registerMutation.isPending}
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                      disabled={registerMutation.isPending}
                                    >
                                      {showConfirmPassword ? "Nascondi" : "Mostra"}
                                    </Button>
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* Resto del form... */}
                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={registerMutation.isPending}
                      >
                        {registerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Registrati
                      </Button>
                    </form>
                  </Form>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
