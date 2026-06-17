import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { ITALY_DATA } from "@/data/italyData";
import CodiceFiscaleInput from "@/components/CodiceFiscaleInput";
import './auth-page.css';

const loginSchema = z.object({
  email: z.string().email("Inserisci un'email valida").min(3, "L'email deve contenere almeno 3 caratteri"),
  password: z.string().min(6, "La password deve contenere almeno 6 caratteri"),
});

const registerSchema = z.object({
  email: z.string().email("Inserisci un'email valida").min(3, "L'email deve contenere almeno 3 caratteri"),
  password: z.string().min(6, "La password deve contenere almeno 6 caratteri"),
  confirmPassword: z.string(),
  codice_fiscale: z.string().min(16, "Il codice fiscale deve essere di 16 caratteri").max(16, "Il codice fiscale deve essere di 16 caratteri"),
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
      codice_fiscale: "",
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

  // Effetti per le selezioni a cascata (residenza)
  useEffect(() => {
    const paese = registerForm.watch("paese_residenza");
    if (paese === "Italia") {
      setRegioniResidenza(ITALY_DATA.Italia.regioni.map(r => r.nome));
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
    const paese = registerForm.watch("paese_residenza");
    const regione = registerForm.watch("regione_residenza");
    if (paese === "Italia" && regione) {
      const reg = ITALY_DATA.Italia.regioni.find(r => r.nome === regione);
      if (reg) setProvinceResidenza(reg.province.map(p => p.nome));
    } else {
      setProvinceResidenza([]);
    }
    setComuniResidenza([]);
    registerForm.setValue("provincia_residenza", "");
    registerForm.setValue("comune_residenza", "");
  }, [registerForm.watch("regione_residenza")]);
  useEffect(() => {
    const paese = registerForm.watch("paese_residenza");
    const regione = registerForm.watch("regione_residenza");
    const provincia = registerForm.watch("provincia_residenza");
    if (paese === "Italia" && regione && provincia) {
      const reg = ITALY_DATA.Italia.regioni.find(r => r.nome === regione);
      if (reg) {
        const prov = reg.province.find(p => p.nome === provincia);
        if (prov) setComuniResidenza(prov.comuni);
      }
    } else {
      setComuniResidenza([]);
    }
    registerForm.setValue("comune_residenza", "");
  }, [registerForm.watch("provincia_residenza")]);
  // Effetti per elezione
  useEffect(() => {
    const paese = registerForm.watch("paese_elezione");
    if (paese === "Italia") {
      setRegioniElezione(ITALY_DATA.Italia.regioni.map(r => r.nome));
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
    const paese = registerForm.watch("paese_elezione");
    const regione = registerForm.watch("regione_elezione");
    if (paese === "Italia" && regione) {
      const reg = ITALY_DATA.Italia.regioni.find(r => r.nome === regione);
      if (reg) setProvinceElezione(reg.province.map(p => p.nome));
    } else {
      setProvinceElezione([]);
    }
    setComuniElezione([]);
    registerForm.setValue("provincia_elezione", "");
    registerForm.setValue("comune_elezione", "");
  }, [registerForm.watch("regione_elezione")]);
  useEffect(() => {
    const paese = registerForm.watch("paese_elezione");
    const regione = registerForm.watch("regione_elezione");
    const provincia = registerForm.watch("provincia_elezione");
    if (paese === "Italia" && regione && provincia) {
      const reg = ITALY_DATA.Italia.regioni.find(r => r.nome === regione);
      if (reg) {
        const prov = reg.province.find(p => p.nome === provincia);
        if (prov) setComuniElezione(prov.comuni);
      }
    } else {
      setComuniElezione([]);
    }
    registerForm.setValue("comune_elezione", "");
  }, [registerForm.watch("provincia_elezione")]);
  // Effetti per candidatura
  useEffect(() => {
    const paese = registerForm.watch("paese_candidatura");
    if (paese === "Italia") {
      setRegioniCandidatura(ITALY_DATA.Italia.regioni.map(r => r.nome));
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
    const paese = registerForm.watch("paese_candidatura");
    const regione = registerForm.watch("regione_candidatura");
    if (paese === "Italia" && regione) {
      const reg = ITALY_DATA.Italia.regioni.find(r => r.nome === regione);
      if (reg) setProvinceCandidatura(reg.province.map(p => p.nome));
    } else {
      setProvinceCandidatura([]);
    }
    setComuniCandidatura([]);
    registerForm.setValue("provincia_candidatura", "");
    registerForm.setValue("comune_candidatura", "");
  }, [registerForm.watch("regione_candidatura")]);
  useEffect(() => {
    const paese = registerForm.watch("paese_candidatura");
    const regione = registerForm.watch("regione_candidatura");
    const provincia = registerForm.watch("provincia_candidatura");
    if (paese === "Italia" && regione && provincia) {
      const reg = ITALY_DATA.Italia.regioni.find(r => r.nome === regione);
      if (reg) {
        const prov = reg.province.find(p => p.nome === provincia);
        if (prov) setComuniCandidatura(prov.comuni);
      }
    } else {
      setComuniCandidatura([]);
    }
    registerForm.setValue("comune_candidatura", "");
  }, [registerForm.watch("provincia_candidatura")]);

  // Stati per la data di nascita
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");

  // Array per giorni, mesi e anni
  const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString());
  const months = [
    { value: "01", label: "Gennaio" },
    { value: "02", label: "Febbraio" },
    { value: "03", label: "Marzo" },
    { value: "04", label: "Aprile" },
    { value: "05", label: "Maggio" },
    { value: "06", label: "Giugno" },
    { value: "07", label: "Luglio" },
    { value: "08", label: "Agosto" },
    { value: "09", label: "Settembre" },
    { value: "10", label: "Ottobre" },
    { value: "11", label: "Novembre" },
    { value: "12", label: "Dicembre" },
  ];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => (currentYear - i).toString());

  // Aggiorna il campo data_nascita quando cambiano giorno, mese o anno
  useEffect(() => {
    if (birthDay && birthMonth && birthYear) {
      registerForm.setValue("data_nascita", `${birthYear}-${birthMonth.padStart(2, "0")}-${birthDay.padStart(2, "0")}`);
    } else {
      registerForm.setValue("data_nascita", "");
    }
  }, [birthDay, birthMonth, birthYear]);

  // Submit
  const onLoginSubmit = (data: LoginFormValues) => {
    // Normalizza l'email a lowercase
    loginMutation.mutate({ ...data, email: data.email.trim().toLowerCase() });
  };
  const onRegisterSubmit = (data: RegisterFormValues) => {
    // Normalizza l'email a lowercase e invia tutti i campi per il backend
    const registerData = {
      email: data.email.trim().toLowerCase(),
      password: data.password,
      codice_fiscale: data.codice_fiscale.toUpperCase(),
      nome: data.nome,
      cognome: data.cognome,
      ruolo: data.ruolo,
      data_nascita: data.data_nascita,
      genere: data.genere,
      cittadinanza: data.cittadinanza,
      paese_residenza: data.paese_residenza,
      regione_residenza: data.regione_residenza,
      provincia_residenza: data.provincia_residenza,
      comune_residenza: data.comune_residenza,
      paese_elezione: data.paese_elezione,
      regione_elezione: data.regione_elezione,
      provincia_elezione: data.provincia_elezione,
      comune_elezione: data.comune_elezione,
      paese_candidatura: data.paese_candidatura,
      regione_candidatura: data.regione_candidatura,
      provincia_candidatura: data.provincia_candidatura,
      comune_candidatura: data.comune_candidatura,
      grado_elezione: data.grado_elezione,
      grado_candidatura: data.grado_candidatura,
    };
    registerMutation.mutate(registerData);
  };

  if (user && !isLoading) {
    return <Redirect to="/menu" />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-secondary/20">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Accesso a DEMOS</CardTitle>
          <CardDescription className="text-center">Accedi o registrati per continuare</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-2 mb-6">
              <TabsTrigger value="login">Accedi</TabsTrigger>
              <TabsTrigger value="register">Registrati</TabsTrigger>
            </TabsList>
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
                          <Input type="email" placeholder="Email" {...field} />
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
                              type={showLoginPassword ? "text" : "password"}
                              placeholder="Password"
                              {...field}
                            />
                            <button
                              type="button"
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                              tabIndex={-1}
                              onClick={() => setShowLoginPassword((v) => !v)}
                              aria-label={showLoginPassword ? "Nascondi password" : "Mostra password"}
                            >
                              {showLoginPassword ? (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.458 12C2.732 16.057 6.523 19 12 19c1.306 0 2.555-.154 3.722-.44M21.542 12c-.274.857-.67 1.664-1.176 2.398M15 12a3 3 0 11-6 0 3 3 0 016 0zm6.022-3.777A10.45 10.45 0 0122.542 12c-1.274 4.057-5.065 7-10.542 7-1.306 0-2.555-.154-3.722-.44M6.222 4.44A10.45 10.45 0 0112 5c4.478 0 8.268 2.943 9.542 7-.274.857-.67 1.664-1.176 2.398M9.88 9.88l4.24 4.24m0-4.24l-4.24 4.24" />
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-.274.857-.67 1.664-1.176 2.398" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                        <div className="flex justify-end mt-1">
                          <a href="/reset-password" className="text-xs text-blue-600 hover:underline">Password dimenticata?</a>
                        </div>
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
                  {loginMutation.error && (
                    (loginMutation.error as any).requiresVerification ? (
                      <div className="flex flex-col items-center mt-2">
                        <span className="text-red-600 text-sm mb-2">Devi confermare la tua email prima di accedere.</span>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-fit"
                          onClick={async () => {
                            try {
                              await resendVerificationEmail((loginMutation.error as any).email);
                              toast({ 
                                title: "Email inviata!", 
                                description: "Nuovo link di verifica inviato alla tua email",
                                variant: "default"
                              });
                            } catch (error) {
                              toast({ 
                                title: "Errore", 
                                description: "Impossibile inviare l'email di verifica. Riprova più tardi.",
                                variant: "destructive"
                              });
                            }
                          }}
                        >
                          Reinvia email di verifica
                        </Button>
                      </div>
                    ) : loginMutation.error.message.includes("auth/invalid-credential") ? (
                      <div className="flex flex-col items-center mt-2">
                        <span className="text-red-600 text-sm mb-2">Credenziali non valide.</span>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-fit"
                          onClick={() => {
                            // Sostituisci con la tua logica di recupero password o reindirizzamento
                            window.location.href = "/reset-password";
                          }}
                        >
                          Recupera password
                        </Button>
                      </div>
                    ) : (
                      <div className="text-red-600 text-sm mt-2">{loginMutation.error.message || "Errore di accesso"}</div>
                    )
                  )}
                </form>
              </Form>
            </TabsContent>
            <TabsContent value="register">
              <Form {...registerForm}>
                <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
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
                              <div className="relative">
                                <Input
                                  type={showRegisterPassword ? "text" : "password"}
                                  placeholder="Crea una password"
                                  {...field}
                                />
                                <button
                                  type="button"
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                                  tabIndex={-1}
                                  onClick={() => setShowRegisterPassword((v) => !v)}
                                  aria-label={showRegisterPassword ? "Nascondi password" : "Mostra password"}
                                >
                                  {showRegisterPassword ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.458 12C2.732 16.057 6.523 19 12 19c1.306 0 2.555-.154 3.722-.44M21.542 12c-.274.857-.67 1.664-1.176 2.398M15 12a3 3 0 11-6 0 3 3 0 016 0zm6.022-3.777A10.45 10.45 0 0122.542 12c-1.274 4.057-5.065 7-10.542 7-1.306 0-2.555-.154-3.722-.44M6.222 4.44A10.45 10.45 0 0112 5c4.478 0 8.268 2.943 9.542 7-.274.857-.67 1.664-1.176 2.398M9.88 9.88l4.24 4.24m0-4.24l-4.24 4.24" />
                                    </svg>
                                  ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-.274.857-.67 1.664-1.176 2.398" />
                                    </svg>
                                  )}
                                </button>
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
                            <FormLabel className="required-field">Conferma password</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type={showConfirmPassword ? "text" : "password"}
                                  placeholder="Ripeti la password"
                                  {...field}
                                />
                                <button
                                  type="button"
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                                  tabIndex={-1}
                                  onClick={() => setShowConfirmPassword((v) => !v)}
                                  aria-label={showConfirmPassword ? "Nascondi password" : "Mostra password"}
                                >
                                  {showConfirmPassword ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.458 12C2.732 16.057 6.523 19 12 19c1.306 0 2.555-.154 3.722-.44M21.542 12c-.274.857-.67 1.664-1.176 2.398M15 12a3 3 0 11-6 0 3 3 0 016 0zm6.022-3.777A10.45 10.45 0 0122.542 12c-1.274 4.057-5.065 7-10.542 7-1.306 0-2.555-.154-3.722-.44M6.222 4.44A10.45 10.45 0 0112 5c4.478 0 8.268 2.943 9.542 7-.274.857-.67 1.664-1.176 2.398M9.88 9.88l4.24 4.24m0-4.24l-4.24 4.24" />
                                    </svg>
                                  ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-.274.857-.67 1.664-1.176 2.398" />
                                    </svg>
                                  )}
                                </button>
                              </div>
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
                         name="codice_fiscale"
                         render={({ field }) => (
                           <FormItem className="md:col-span-2">
                             <FormLabel className="required-field">Codice Fiscale</FormLabel>
                             <FormControl>
                               <CodiceFiscaleInput
                                 value={field.value}
                                 onChange={field.onChange}
                                 required={true}
                                 placeholder="Inserisci il codice fiscale"
                               />
                             </FormControl>
                             <FormMessage />
                           </FormItem>
                         )}
                       />
                      <FormField
                        control={registerForm.control}
                        name="nome"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="required-field">Nome</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Inserisci il tuo nome" 
                                {...field}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  const capitalized = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
                                  field.onChange(capitalized);
                                }}
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
                                placeholder="Inserisci il tuo cognome" 
                                {...field}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  const capitalized = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
                                  field.onChange(capitalized);
                                }}
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
                              <div className="flex gap-2">
                                <select
                                  className="data-nascita-select"
                                  value={birthDay}
                                  onChange={e => setBirthDay(e.target.value)}
                                >
                                  <option value="">Gg</option>
                                  {days.map(d => (
                                    <option key={d} value={d}>{d}</option>
                                  ))}
                                </select>
                                <select
                                  className="data-nascita-select"
                                  value={birthMonth}
                                  onChange={e => setBirthMonth(e.target.value)}
                                >
                                  <option value="">Mese</option>
                                  {months.map(m => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                  ))}
                                </select>
                                <select
                                  className="data-nascita-select"
                                  value={birthYear}
                                  onChange={e => setBirthYear(e.target.value)}
                                >
                                  <option value="">Anno</option>
                                  {years.map(y => (
                                    <option key={y} value={y}>{y}</option>
                                  ))}
                                </select>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="w-full h-4" />
                      <FormField
                        control={registerForm.control}
                        name="genere"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="required-field">Genere</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-white">
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
                                <SelectTrigger className="bg-white">
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
                                <SelectTrigger className="bg-white">
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
                                <SelectTrigger className="bg-white">
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
                                <SelectTrigger className="bg-white">
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
                                <SelectTrigger className="bg-white">
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
                               <SelectTrigger className="bg-white">
                                 <SelectValue placeholder="Seleziona ruolo" />
                               </SelectTrigger>
                             </FormControl>
                             <SelectContent>
                               <SelectItem value="Elettore">Elettore</SelectItem>
                               <SelectItem value="Candidato">Candidato</SelectItem>
                               <SelectItem value="Politico">Politico</SelectItem>
                               <SelectItem value="Candidato Politico">Candidato Politico</SelectItem>
                             </SelectContent>
                           </Select>
                           <FormMessage />
                         </FormItem>
                       )}
                     />
                   </div>

                   {/* Sezione Elezione - visibile solo per "Politico" e "Candidato Politico" */}
                   {(registerForm.watch("ruolo") === "P" || registerForm.watch("ruolo") === "Candidato Politico") && (
                     <div className="space-y-4">
                       <h3 className="text-lg font-medium border-b pb-2">Dati di Elezione</h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <FormField
                           control={registerForm.control}
                           name="paese_elezione"
                           render={({ field }) => (
                             <FormItem>
                               <FormLabel>Paese di Elezione</FormLabel>
                               <Select onValueChange={field.onChange} value={field.value}>
                                 <FormControl>
                                   <SelectTrigger className="bg-white">
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
                           name="regione_elezione"
                           render={({ field }) => (
                             <FormItem>
                               <FormLabel>Regione di Elezione</FormLabel>
                               <Select onValueChange={field.onChange} value={field.value} disabled={regioniElezione.length === 0}>
                                 <FormControl>
                                   <SelectTrigger className="bg-white">
                                     <SelectValue placeholder="Seleziona regione" />
                                   </SelectTrigger>
                                 </FormControl>
                                 <SelectContent>
                                   {regioniElezione.map((regione) => (
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
                           name="provincia_elezione"
                           render={({ field }) => (
                             <FormItem>
                               <FormLabel>Provincia di Elezione</FormLabel>
                               <Select onValueChange={field.onChange} value={field.value} disabled={provinceElezione.length === 0}>
                                 <FormControl>
                                   <SelectTrigger className="bg-white">
                                     <SelectValue placeholder="Seleziona provincia" />
                                   </SelectTrigger>
                                 </FormControl>
                                 <SelectContent>
                                   {provinceElezione.map((provincia) => (
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
                           name="comune_elezione"
                           render={({ field }) => (
                             <FormItem>
                               <FormLabel>Comune di Elezione</FormLabel>
                               <Select onValueChange={field.onChange} value={field.value} disabled={comuniElezione.length === 0}>
                                 <FormControl>
                                   <SelectTrigger className="bg-white">
                                     <SelectValue placeholder="Seleziona comune" />
                                   </SelectTrigger>
                                 </FormControl>
                                 <SelectContent>
                                   {comuniElezione.map((comune) => (
                                     <SelectItem key={comune} value={comune}>{comune}</SelectItem>
                                   ))}
                                 </SelectContent>
                               </Select>
                               <FormMessage />
                             </FormItem>
                           )}
                         />
                         <FormField
                           control={registerForm.control}
                           name="grado_elezione"
                           render={({ field }) => (
                             <FormItem>
                               <FormLabel>Grado di Elezione</FormLabel>
                               <Select onValueChange={field.onChange} value={field.value}>
                                 <FormControl>
                                   <SelectTrigger className="bg-white">
                                     <SelectValue placeholder="Seleziona grado" />
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
                       </div>
                     </div>
                   )}

                   {/* Sezione Candidatura - visibile solo per "Candidato" e "Candidato Politico" */}
                   {(registerForm.watch("ruolo") === "C" || registerForm.watch("ruolo") === "Candidato Politico") && (
                     <div className="space-y-4">
                       <h3 className="text-lg font-medium border-b pb-2">Dati di Candidatura</h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <FormField
                           control={registerForm.control}
                           name="paese_candidatura"
                           render={({ field }) => (
                             <FormItem>
                               <FormLabel>Paese di Candidatura</FormLabel>
                               <Select onValueChange={field.onChange} value={field.value}>
                                 <FormControl>
                                   <SelectTrigger className="bg-white">
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
                           name="regione_candidatura"
                           render={({ field }) => (
                             <FormItem>
                               <FormLabel>Regione di Candidatura</FormLabel>
                               <Select onValueChange={field.onChange} value={field.value} disabled={regioniCandidatura.length === 0}>
                                 <FormControl>
                                   <SelectTrigger className="bg-white">
                                     <SelectValue placeholder="Seleziona regione" />
                                   </SelectTrigger>
                                 </FormControl>
                                 <SelectContent>
                                   {regioniCandidatura.map((regione) => (
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
                           name="provincia_candidatura"
                           render={({ field }) => (
                             <FormItem>
                               <FormLabel>Provincia di Candidatura</FormLabel>
                               <Select onValueChange={field.onChange} value={field.value} disabled={provinceCandidatura.length === 0}>
                                 <FormControl>
                                   <SelectTrigger className="bg-white">
                                     <SelectValue placeholder="Seleziona provincia" />
                                   </SelectTrigger>
                                 </FormControl>
                                 <SelectContent>
                                   {provinceCandidatura.map((provincia) => (
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
                           name="comune_candidatura"
                           render={({ field }) => (
                             <FormItem>
                               <FormLabel>Comune di Candidatura</FormLabel>
                               <Select onValueChange={field.onChange} value={field.value} disabled={comuniCandidatura.length === 0}>
                                 <FormControl>
                                   <SelectTrigger className="bg-white">
                                     <SelectValue placeholder="Seleziona comune" />
                                   </SelectTrigger>
                                 </FormControl>
                                 <SelectContent>
                                   {comuniCandidatura.map((comune) => (
                                     <SelectItem key={comune} value={comune}>{comune}</SelectItem>
                                   ))}
                                 </SelectContent>
                               </Select>
                               <FormMessage />
                             </FormItem>
                           )}
                         />
                         <FormField
                           control={registerForm.control}
                           name="grado_candidatura"
                           render={({ field }) => (
                             <FormItem>
                               <FormLabel>Grado di Candidatura</FormLabel>
                               <Select onValueChange={field.onChange} value={field.value}>
                                 <FormControl>
                                   <SelectTrigger className="bg-white">
                                     <SelectValue placeholder="Seleziona grado" />
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
                       </div>
                     </div>
                   )}
                  
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
                  {registerMutation.error && (
                    <div className="text-red-600 text-sm mt-2">{registerMutation.error.message || "Errore di registrazione"}</div>
                  )}
                  {registerMutation.data && (registerMutation.data as any).requiresVerification && (
                    <div className="flex flex-col items-center mt-2">
                      <span className="text-green-600 text-sm mb-2">Registrazione completata! Controlla la tua email per confermare l'account.</span>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-fit"
                        onClick={async () => {
                          try {
                            await resendVerificationEmail(registerForm.getValues().email);
                            toast({ 
                              title: "Email inviata!", 
                              description: "Nuovo link di verifica inviato alla tua email",
                              variant: "default"
                            });
                          } catch (error) {
                            toast({ 
                              title: "Errore", 
                              description: "Impossibile inviare l'email di verifica. Riprova più tardi.",
                              variant: "destructive"
                              });
                          }
                        }}
                      >
                        Reinvia email di verifica
                      </Button>
                    </div>
                  )}
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-center text-sm text-gray-500">
          {activeTab === "login" ? (
            <p>
              Non hai un account?{" "}
              <Button variant="link" className="p-0" onClick={() => setActiveTab("register")}>Registrati</Button>
            </p>
          ) : (
            <p>
              Hai già un account?{" "}
              <Button variant="link" className="p-0" onClick={() => setActiveTab("login")}>Accedi</Button>
            </p>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
