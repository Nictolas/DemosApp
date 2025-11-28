import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth-neon";
import { useToast } from "@/hooks/use-toast";
import { Redirect, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Eye, EyeOff } from "lucide-react";
import './auth-page.css';

const loginSchema = z.object({
  email: z.string().email("Inserisci un'email valida").min(3, "L'email deve contenere almeno 3 caratteri"),
  password: z.string().min(6, "La password deve contenere almeno 6 caratteri"),
});

const registerSchema = z.object({
  email: z.string().email("Inserisci un'email valida").min(3, "L'email deve contenere almeno 3 caratteri"),
  password: z.string().min(6, "La password deve contenere almeno 6 caratteri"),
  confirmPassword: z.string(),
  privacyPolicyConsent: z.boolean().refine((val) => val === true, {
    message: "Devi accettare la Privacy Policy per continuare",
  }),
  termsOfServiceConsent: z.boolean().refine((val) => val === true, {
    message: "Devi accettare i Termini di Servizio per continuare",
  }),
  politicalOpinionsConsent: z.boolean().refine((val) => val === true, {
    message: "Devi accettare il consenso al trattamento delle opinioni politiche per continuare",
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Le password non corrispondono",
  path: ["confirmPassword"],
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Inserisci un'email valida").min(3, "L'email deve contenere almeno 3 caratteri"),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;
type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<"login" | "register" | "forgot-password">("login");
  const { user, isLoading, loginMutation, registerMutation, resendVerificationEmail, forgotPasswordMutation } = useAuth();
  const { toast } = useToast();

  // Stato per mostrare/nascondere la password nel login
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  // Stato per mostrare/nascondere la password nella registrazione
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  // Stato per mostrare/nascondere la conferma password nella registrazione
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // Stato per il controllo intelligente dell'email
  const [emailStatus, setEmailStatus] = useState<'idle' | 'checking' | 'available' | 'duplicate' | 'error'>('idle');
  const [emailCheckTimeout, setEmailCheckTimeout] = useState<NodeJS.Timeout | null>(null);

  // Cleanup timeout quando il componente viene smontato
  useEffect(() => {
    return () => {
      if (emailCheckTimeout) {
        clearTimeout(emailCheckTimeout);
      }
    };
  }, [emailCheckTimeout]);

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
      privacyPolicyConsent: false,
      termsOfServiceConsent: false,
      politicalOpinionsConsent: false,
    },
  });

  const forgotPasswordForm = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  // Gestione del submit per il login
  const onLoginSubmit = (data: LoginFormValues) => {
    loginMutation.mutate({ ...data, email: data.email.trim().toLowerCase() });
  };

  // Controllo intelligente dell'email con debouncing
  const checkEmailIntelligently = async (email: string) => {
    if (!email || !email.includes('@')) {
      setEmailStatus('idle');
      return;
    }

    try {
      setEmailStatus('checking');
      console.log('🔍 Controllo intelligente email:', email);
      
      const apiUrl = 'https://demos-c7k0.onrender.com/api/check-email';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('📊 Risultato controllo intelligente:', result);

      if (result.exists) {
        setEmailStatus('duplicate');
      } else {
        setEmailStatus('available');
      }

    } catch (error) {
      console.error('💥 Errore controllo intelligente email:', error);
      setEmailStatus('error');
    }
  };

  // Gestione cambio email con debouncing
  const handleEmailChange = (email: string) => {
    // Cancella timeout precedente
    if (emailCheckTimeout) {
      clearTimeout(emailCheckTimeout);
    }

    // Reset stato se email vuota
    if (!email || !email.includes('@')) {
      setEmailStatus('idle');
      return;
    }

    // Imposta nuovo timeout per controllo dopo 500ms
    const timeout = setTimeout(() => {
      checkEmailIntelligently(email);
    }, 500);

    setEmailCheckTimeout(timeout);
  };

  // Gestione del submit per la registrazione con consensi
  const onRegisterSubmit = async (data: RegisterFormValues) => {
    // Verifica che l'email sia disponibile prima di procedere
    if (emailStatus === 'duplicate') {
      toast({
        title: "Email già registrata",
        description: "Questa email è già presente nel sistema. Usa un'altra email o accedi se hai già un account.",
        variant: "destructive",
      });
      return;
    }

    if (emailStatus === 'checking') {
      toast({
        title: "Attendi",
        description: "Stiamo ancora verificando l'email. Riprova tra un momento.",
        variant: "default",
      });
      return;
    }

    if (emailStatus === 'error') {
      toast({
        title: "Errore di verifica",
        description: "Non siamo riusciti a verificare l'email. Riprova più tardi.",
        variant: "destructive",
      });
      return;
    }

    // Se l'email non è stata ancora controllata, fai il controllo ora
    if (emailStatus === 'idle') {
      await checkEmailIntelligently(data.email);
      // Aspetta un momento per il controllo
      setTimeout(async () => {
        if (emailStatus === 'duplicate') {
          toast({
            title: "Email già registrata",
            description: "Questa email è già presente nel sistema. Usa un'altra email o accedi se hai già un account.",
            variant: "destructive",
          });
          return;
        }
        // Se l'email è disponibile, salva i dati nel localStorage per la registrazione finale
        try {
          // Salva i dati per il flusso di registrazione (NON registrare ancora)
          localStorage.setItem("registrazione_email", data.email);
          localStorage.setItem("registrazione_password", data.password);
          localStorage.setItem("registrazione_privacy_consent", data.privacyPolicyConsent.toString());
          localStorage.setItem("registrazione_terms_consent", data.termsOfServiceConsent.toString());
          localStorage.setItem("registrazione_political_opinions_consent", (data.politicalOpinionsConsent || false).toString());
          localStorage.setItem("registrazione_consent_timestamp", new Date().toISOString());
          
          // Vai alla fase successiva senza registrare l'utente
          window.location.href = "/registrazione-nome";
        } catch (error) {
          toast({
            title: "Errore di connessione",
            description: "Impossibile salvare i dati. Riprova più tardi.",
            variant: "destructive",
          });
        }
      }, 1000);
      return;
    }

    // Email disponibile, salva i dati nel localStorage per la registrazione finale
    try {
      // Salva i dati per il flusso di registrazione (NON registrare ancora)
      localStorage.setItem("registrazione_email", data.email);
      localStorage.setItem("registrazione_password", data.password);
      localStorage.setItem("registrazione_privacy_consent", data.privacyPolicyConsent.toString());
      localStorage.setItem("registrazione_terms_consent", data.termsOfServiceConsent.toString());
      localStorage.setItem("registrazione_political_opinions_consent", (data.politicalOpinionsConsent || false).toString());
      localStorage.setItem("registrazione_consent_timestamp", new Date().toISOString());
      
      // Vai alla fase successiva senza registrare l'utente
      window.location.href = "/registrazione-nome";
    } catch (error) {
      toast({
        title: "Errore di connessione",
        description: "Impossibile salvare i dati. Riprova più tardi.",
        variant: "destructive",
      });
    }
  };

  // Gestione del submit per il reset password
  const onForgotPasswordSubmit = (data: ForgotPasswordFormValues) => {
    forgotPasswordMutation.mutate(data);
  };


  // Gestione del reinvio email di verifica
  const handleResendVerification = async () => {
    if (user?.email) {
      try {
        await resendVerificationEmail();
        toast({
          title: "Email inviata",
          description: "Controlla la tua casella email per il link di verifica",
        });
      } catch (error) {
        toast({
          title: "Errore",
          description: "Impossibile inviare l'email di verifica",
          variant: "destructive",
        });
      }
    }
  };

  // Se l'utente è già autenticato, reindirizza alla home
  if (user && !isLoading) {
    return <Redirect to="/" />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <Card className="w-full max-w-md shadow-xl bg-white">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-800">
            Benvenuto su Demos
          </CardTitle>
          <CardDescription className="text-center">Accedi o registrati per continuare</CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "login" | "register" | "forgot-password")}>
            <TabsList className="grid w-full grid-cols-2">
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
                              placeholder="Inserisci la password"
                              {...field}
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => setShowLoginPassword(!showLoginPassword)}
                            >
                              {showLoginPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
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

                  <div className="text-center mt-4">
                    <Button
                      type="button"
                      variant="link"
                      className="text-sm text-blue-600 hover:text-blue-800"
                      onClick={() => setActiveTab("forgot-password")}
                    >
                      Password dimenticata?
                    </Button>
                  </div>

                  {loginMutation.isError && (
                    <div className="text-center">
                      <p className="text-sm text-red-600 mb-2">
                        {loginMutation.error?.message || "Errore durante l'accesso"}
                      </p>
                      {loginMutation.error?.message?.includes("verificata") && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleResendVerification}
                          className="w-full"
                        >
                          Reinvia email di verifica
                        </Button>
                      )}
                    </div>
                  )}
                </form>
              </Form>
            </TabsContent>
            
            <TabsContent value="register">
              <Form {...registerForm}>
                <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                  <div className="text-center mb-6">
                    <h3 className="text-lg font-semibold">Inizia la Registrazione</h3>
                    <p className="text-sm text-muted-foreground">Inserisci le tue credenziali per iniziare</p>
                  </div>
                  
                  <FormField
                    control={registerForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type="email"
                              placeholder="Inserisci la tua email"
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                handleEmailChange(e.target.value);
                              }}
                            />
                            {emailStatus === 'checking' && (
                              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                              </div>
                            )}
                            {emailStatus === 'available' && (
                              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                <span className="text-green-600 text-sm">✓</span>
                              </div>
                            )}
                            {emailStatus === 'duplicate' && (
                              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                <span className="text-red-600 text-sm">✗</span>
                              </div>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                        {emailStatus === 'duplicate' && (
                          <p className="text-sm text-red-600">Questa email è già registrata</p>
                        )}
                        {emailStatus === 'available' && (
                          <p className="text-sm text-green-600">Email disponibile</p>
                        )}
                        {emailStatus === 'error' && (
                          <p className="text-sm text-red-600">Errore nella verifica dell'email</p>
                        )}
                      </FormItem>
                    )}
                  />
                  
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
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                            >
                              {showRegisterPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
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
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            >
                              {showConfirmPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Sezione Consensi Legali */}
                  <div className="space-y-4 pt-4 border-t">
                    <h4 className="text-sm font-medium text-gray-700">Consensi Obbligatori</h4>
                    
                    <FormField
                      control={registerForm.control}
                      name="privacyPolicyConsent"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-sm text-gray-700">
                              Accetto la{" "}
                              <Link 
                                href="/privacy-policy" 
                                className="text-blue-600 hover:text-blue-800 underline"
                                target="_blank"
                              >
                                Privacy Policy
                              </Link>
                              {" "}e il trattamento dei miei dati personali
                            </FormLabel>
                            <FormMessage className="text-red-600 font-semibold" />
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={registerForm.control}
                      name="termsOfServiceConsent"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-sm text-gray-700">
                              Accetto i{" "}
                              <Link 
                                href="/terms-of-service" 
                                className="text-blue-600 hover:text-blue-800 underline"
                                target="_blank"
                              >
                                Termini di Servizio
                              </Link>
                              {" "}e le condizioni d'uso della piattaforma
                            </FormLabel>
                            <FormMessage className="text-red-600 font-semibold" />
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={registerForm.control}
                      name="politicalOpinionsConsent"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-sm text-gray-700">
                              <strong>Consento esplicitamente</strong> al trattamento delle mie opinioni politiche 
                              (GDPR Art. 9). Questo consenso è <strong>necessario</strong> per utilizzare la piattaforma 
                              e mi permetterà di esprimere opinioni e votare. Posso revocarlo in qualsiasi momento dalle 
                              impostazioni GDPR, ma questo limiterà l'accesso ad alcune funzionalità.{" "}
                              <Link 
                                href="/privacy-policy#4.1" 
                                className="text-blue-600 hover:text-blue-800 underline"
                                target="_blank"
                              >
                                Maggiori informazioni
                              </Link>
                            </FormLabel>
                            <FormMessage className="text-red-600 font-semibold" />
                          </div>
                        </FormItem>
                      )}
                    />

                  </div>
                  
                  <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
                    {registerMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Inizializzazione...
                      </>
                    ) : (
                      "Inizia Registrazione"
                    )}
                  </Button>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="forgot-password">
              <Form {...forgotPasswordForm}>
                <form onSubmit={forgotPasswordForm.handleSubmit(onForgotPasswordSubmit)} className="space-y-4">
                  <div className="text-center mb-6">
                    <h3 className="text-lg font-semibold">Reset Password</h3>
                    <p className="text-sm text-muted-foreground">Inserisci la tua email per ricevere il link di reset</p>
                  </div>
                  
                  <FormField
                    control={forgotPasswordForm.control}
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
                  
                  <Button type="submit" className="w-full" disabled={forgotPasswordMutation.isPending}>
                    {forgotPasswordMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Invio in corso...
                      </>
                    ) : (
                      "Invia Link di Reset"
                    )}
                  </Button>

                  <div className="text-center mt-4">
                    <Button
                      type="button"
                      variant="link"
                      className="text-sm text-blue-600 hover:text-blue-800"
                      onClick={() => setActiveTab("login")}
                    >
                      Torna al Login
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>


    </div>
  );
}
