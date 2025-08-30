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

  // Hook personalizzato per gestire le selezioni geografiche
  const useGeographicSelections = (watch: any) => {
    const paeseResidenza = watch("paese_residenza");
    const regioneResidenza = watch("regione_residenza");
    const provinciaResidenza = watch("provincia_residenza");
    const paeseElezione = watch("paese_elezione");
    const regioneElezione = watch("regione_elezione");
    const provinciaElezione = watch("provincia_elezione");
    const paeseCandidatura = watch("paese_candidatura");
    const regioneCandidatura = watch("regione_candidatura");
    const provinciaCandidatura = watch("provincia_candidatura");

    return {
      paeseResidenza,
      regioneResidenza,
      provinciaResidenza,
      paeseElezione,
      regioneElezione,
      provinciaElezione,
      paeseCandidatura,
      regioneCandidatura,
      provinciaCandidatura,
    };
  };

  // Hook personalizzato per gestire la data di nascita
  const useBirthDate = (setValue: any) => {
    const handleDateChange = (date: string) => {
      setValue("data_nascita", date);
    };

    return { handleDateChange };
  };

  const geographicSelections = useGeographicSelections(registerForm.watch);
  const birthDate = useBirthDate(registerForm.setValue);

  // Gestione del submit per il login
  const onLoginSubmit = (data: LoginFormValues) => {
    loginMutation.mutate({ ...data, email: data.email.trim().toLowerCase() });
  };

  // Gestione del submit per la registrazione
  const onRegisterSubmit = (data: RegisterFormValues) => {
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

  // Gestione del reinvio email di verifica
  const handleResendVerification = async (email: string) => {
    try {
      await resendVerificationEmail(email);
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
  };

  // Redirect se l'utente è già autenticato
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
                          <Input
                            type="email"
                            placeholder="Inserisci la tua email"
                            {...field}
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
                              type={showLoginPassword ? "text" : "password"}
                              placeholder="Inserisci la tua password"
                              {...field}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => setShowLoginPassword(!showLoginPassword)}
                            >
                              {showLoginPassword ? "Nascondi" : "Mostra"}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {loginMutation.error && (
                    <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                      {loginMutation.error.message}
                    </div>
                  )}
                  
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
            
            <TabsContent value="register">
              <Form {...registerForm}>
                <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={registerForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="Inserisci la tua email"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={registerForm.control}
                      name="codice_fiscale"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Codice Fiscale</FormLabel>
                          <FormControl>
                            <CodiceFiscaleInput
                              value={field.value}
                              onChange={field.onChange}
                              placeholder="Codice Fiscale"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={registerForm.control}
                      name="nome"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome</FormLabel>
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
                          <FormLabel>Cognome</FormLabel>
                          <FormControl>
                            <Input placeholder="Inserisci il tuo cognome" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={registerForm.control}
                      name="data_nascita"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data di Nascita</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                birthDate.handleDateChange(e.target.value);
                              }}
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
                          <FormLabel>Genere</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleziona il genere" />
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
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={registerForm.control}
                      name="cittadinanza"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cittadinanza</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleziona la cittadinanza" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="italiana">Italiana</SelectItem>
                              <SelectItem value="europea">Europea</SelectItem>
                              <SelectItem value="extraeuropea">Extraeuropea</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={registerForm.control}
                      name="paese_residenza"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Paese di Residenza</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleziona il paese" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {ITALY_DATA.map((paese) => (
                                <SelectItem key={paese.name} value={paese.name}>
                                  {paese.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  {geographicSelections.paeseResidenza === "Italia" && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={registerForm.control}
                          name="regione_residenza"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Regione di Residenza</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Seleziona la regione" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {ITALY_DATA.find(p => p.name === "Italia")?.regions.map((regione) => (
                                    <SelectItem key={regione.name} value={regione.name}>
                                      {regione.name}
                                    </SelectItem>
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
                              <FormLabel>Provincia di Residenza</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Seleziona la provincia" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {ITALY_DATA.find(p => p.name === "Italia")?.regions
                                    .find(r => r.name === geographicSelections.regioneResidenza)?.provinces.map((provincia) => (
                                      <SelectItem key={provincia.name} value={provincia.name}>
                                        {provincia.name}
                                      </SelectItem>
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
                              <FormLabel>Comune di Residenza</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Seleziona il comune" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {ITALY_DATA.find(p => p.name === "Italia")?.regions
                                    .find(r => r.name === geographicSelections.regioneResidenza)?.provinces
                                    .find(p => p.name === geographicSelections.provinciaResidenza)?.cities.map((citta) => (
                                      <SelectItem key={citta.name} value={citta.name}>
                                        {citta.name}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </>
                  )}
                  
                  <FormField
                    control={registerForm.control}
                    name="ruolo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ruolo</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleziona il ruolo" />
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
                  
                  {(geographicSelections.paeseResidenza === "Italia" && registerForm.watch("ruolo") === "candidato") && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={registerForm.control}
                          name="paese_candidatura"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Paese di Candidatura</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Seleziona il paese" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {ITALY_DATA.map((paese) => (
                                    <SelectItem key={paese.name} value={paese.name}>
                                      {paese.name}
                                    </SelectItem>
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
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Seleziona il grado" />
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
                      </div>
                      
                      {geographicSelections.paeseCandidatura === "Italia" && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <FormField
                            control={registerForm.control}
                            name="regione_candidatura"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Regione di Candidatura</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Seleziona la regione" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {ITALY_DATA.find(p => p.name === "Italia")?.regions.map((regione) => (
                                      <SelectItem key={regione.name} value={regione.name}>
                                        {regione.name}
                                      </SelectItem>
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
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Seleziona la provincia" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {ITALY_DATA.find(p => p.name === "Italia")?.regions
                                      .find(r => r.name === geographicSelections.regioneCandidatura)?.provinces.map((provincia) => (
                                        <SelectItem key={provincia.name} value={provincia.name}>
                                          {provincia.name}
                                        </SelectItem>
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
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Seleziona il comune" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {ITALY_DATA.find(p => p.name === "Italia")?.regions
                                      .find(r => r.name === geographicSelections.regioneCandidatura)?.provinces
                                      .find(p => p.name === geographicSelections.provinciaCandidatura)?.cities.map((citta) => (
                                        <SelectItem key={citta.name} value={citta.name}>
                                          {citta.name}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}
                    </>
                  )}
                  
                  {(geographicSelections.paeseResidenza === "Italia" && registerForm.watch("ruolo") === "candidato_politico") && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={registerForm.control}
                          name="paese_elezione"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Paese di Elezione</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Seleziona il paese" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {ITALY_DATA.map((paese) => (
                                    <SelectItem key={paese.name} value={paese.name}>
                                      {paese.name}
                                    </SelectItem>
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
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Seleziona il grado" />
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
                      </div>
                      
                      {geographicSelections.paeseElezione === "Italia" && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <FormField
                            control={registerForm.control}
                            name="regione_elezione"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Regione di Elezione</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Seleziona la regione" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {ITALY_DATA.find(p => p.name === "Italia")?.regions.map((regione) => (
                                      <SelectItem key={regione.name} value={regione.name}>
                                        {regione.name}
                                      </SelectItem>
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
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Seleziona la provincia" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {ITALY_DATA.find(p => p.name === "Italia")?.regions
                                      .find(r => r.name === geographicSelections.regioneElezione)?.provinces.map((provincia) => (
                                        <SelectItem key={provincia.name} value={provincia.name}>
                                          {provincia.name}
                                        </SelectItem>
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
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Seleziona il comune" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {ITALY_DATA.find(p => p.name === "Italia")?.regions
                                      .find(r => r.name === geographicSelections.regioneElezione)?.provinces
                                      .find(p => p.name === geographicSelections.provinciaElezione)?.cities.map((citta) => (
                                        <SelectItem key={citta.name} value={citta.name}>
                                          {citta.name}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={registerForm.control}
                          name="paese_candidatura"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Paese di Candidatura</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Seleziona il paese" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {ITALY_DATA.map((paese) => (
                                    <SelectItem key={paese.name} value={paese.name}>
                                      {paese.name}
                                    </SelectItem>
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
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Seleziona il grado" />
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
                      </div>
                      
                      {geographicSelections.paeseCandidatura === "Italia" && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <FormField
                            control={registerForm.control}
                            name="regione_candidatura"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Regione di Candidatura</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Seleziona la regione" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {ITALY_DATA.find(p => p.name === "Italia")?.regions.map((regione) => (
                                      <SelectItem key={regione.name} value={regione.name}>
                                        {regione.name}
                                      </SelectItem>
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
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Seleziona la provincia" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {ITALY_DATA.find(p => p.name === "Italia")?.regions
                                      .find(r => r.name === geographicSelections.regioneCandidatura)?.provinces.map((provincia) => (
                                        <SelectItem key={provincia.name} value={provincia.name}>
                                          {provincia.name}
                                        </SelectItem>
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
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Seleziona il comune" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {ITALY_DATA.find(p => p.name === "Italia")?.regions
                                      .find(r => r.name === geographicSelections.regioneCandidatura)?.provinces
                                      .find(p => p.name === geographicSelections.provinciaCandidatura)?.cities.map((citta) => (
                                        <SelectItem key={citta.name} value={citta.name}>
                                          {citta.name}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}
                    </>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={registerForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showRegisterPassword ? "text" : "password"}
                                placeholder="Inserisci la password"
                                {...field}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowRegisterPassword(!showRegisterPassword)}
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
                          <FormLabel>Conferma Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showConfirmPassword ? "text" : "password"}
                                placeholder="Conferma la password"
                                {...field}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
                  
                  {registerMutation.error && (
                    <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                      {registerMutation.error.message}
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
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
