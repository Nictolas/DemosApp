import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth-neon";
import { useToast } from "@/hooks/use-toast";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

  // Gestione del submit per la registrazione (solo credenziali base)
  const onRegisterSubmit = async (data: RegisterFormValues) => {
    try {
      // CONTROLLO EMAIL DUPLICATA ALL'INIZIO
      const response = await fetch('/api/check-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: data.email.trim().toLowerCase() }),
      });

      let result;
      try {
        result = await response.json();
      } catch (jsonError) {
        console.error('Errore nel parsing JSON:', jsonError);
        toast({
          title: "Errore",
          description: "Risposta non valida dal server. Riprova più tardi.",
          variant: "destructive",
        });
        return;
      }

      if (response.ok && result.exists) {
        // Email già registrata - BLOCCA SUBITO
        toast({
          title: "Email già registrata",
          description: "Un account con questa email esiste già. Prova con un'altra email o accedi.",
          variant: "destructive",
        });
        return;
      }

      // Email disponibile, salva i dati e procedi
      localStorage.setItem("registrazione_email", data.email);
      localStorage.setItem("registrazione_password", data.password);
      window.location.href = "/registrazione-nome";
      
    } catch (error) {
      console.error('Errore nel controllo email:', error);
      toast({
        title: "Errore",
        description: "Impossibile verificare l'email. Riprova più tardi.",
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
