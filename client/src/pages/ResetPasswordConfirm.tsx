import { useState, useEffect } from "react";
import { useLocation, useRouter } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Eye, EyeOff, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl, API_CONFIG } from "@/lib/api-config";

const resetPasswordSchema = z.object({
  password: z.string().min(6, "La password deve contenere almeno 6 caratteri"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Le password non corrispondono",
  path: ["confirmPassword"],
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordConfirm() {
  const [, setLocation] = useLocation();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  // Estrai il token dall'URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    
    if (tokenParam) {
      setToken(tokenParam);
      // Verifica che il token sia valido (opzionale, per ora assumiamo che sia valido)
      setIsValidToken(true);
    } else {
      setIsValidToken(false);
    }
  }, []);

  const onSubmit = async (data: ResetPasswordFormValues) => {
    if (!token) {
      toast({
        title: "Errore",
        description: "Token di reset non valido",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await fetch(getApiUrl(API_CONFIG.AUTH.RESET_PASSWORD), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password: data.password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore nel reset password');
      }

      if (!result.success) {
        throw new Error(result.error || 'Errore nel reset password');
      }

      toast({
        title: "Password aggiornata!",
        description: "La tua password è stata aggiornata con successo. Ora puoi accedere con la nuova password.",
        variant: "default",
      });

      // Reindirizza al login dopo 2 secondi
      setTimeout(() => {
        setLocation("/auth");
      }, 2000);

    } catch (error) {
      toast({
        title: "Errore",
        description: error instanceof Error ? error.message : "Errore nel reset password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Se non c'è token o è invalido
  if (isValidToken === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100 p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <XCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <CardTitle className="text-2xl font-bold text-red-800">
              Link Non Valido
            </CardTitle>
            <CardDescription className="text-center text-red-600">
              Il link di reset password non è valido o è scaduto
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button 
              onClick={() => setLocation("/auth")}
              className="w-full"
            >
              Torna al Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Se il token è valido, mostra il form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
          <CardTitle className="text-2xl font-bold text-gray-800">
            Reset Password
          </CardTitle>
          <CardDescription className="text-center">
            Inserisci la tua nuova password
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nuova Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Inserisci la nuova password"
                          {...field}
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
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
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conferma Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Conferma la nuova password"
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

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Aggiornamento in corso...
                  </>
                ) : (
                  "Aggiorna Password"
                )}
              </Button>

              <div className="text-center mt-4">
                <Button
                  type="button"
                  variant="link"
                  className="text-sm text-blue-600 hover:text-blue-800"
                  onClick={() => setLocation("/auth")}
                >
                  Torna al Login
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
