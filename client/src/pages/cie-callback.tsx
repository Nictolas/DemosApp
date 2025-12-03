import { useEffect, useState } from "react";
import { useLocation, Redirect } from "wouter";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth-neon";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CIECallback() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    // Estrai i parametri dalla query string
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get('accessToken');
    const refreshToken = urlParams.get('refreshToken');
    const success = urlParams.get('success');
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');

    // Gestisci errori
    if (error || success === 'false') {
      setStatus('error');
      setErrorMessage(errorDescription || error || 'Errore durante l\'autenticazione CIE');
      toast({
        title: "Errore autenticazione CIE",
        description: errorDescription || error || 'Si è verificato un errore durante il login',
        variant: "destructive"
      });
      
      // Reindirizza alla pagina di autenticazione dopo 3 secondi
      setTimeout(() => {
        setLocation('/auth?tab=cie');
      }, 3000);
      return;
    }

    // Verifica che i token siano presenti
    if (!accessToken || success !== 'true') {
      setStatus('error');
      setErrorMessage('Token di accesso non ricevuto');
      toast({
        title: "Errore autenticazione",
        description: "Non è stato possibile completare l'autenticazione",
        variant: "destructive"
      });
      
      setTimeout(() => {
        setLocation('/auth?tab=cie');
      }, 3000);
      return;
    }

    // Salva i token nel localStorage
    try {
      localStorage.setItem('auth_token', accessToken);
      if (refreshToken) {
        localStorage.setItem('refresh_token', refreshToken);
      }

      setStatus('success');
      toast({
        title: "Login effettuato!",
        description: "Autenticazione CIE completata con successo",
        variant: "default"
      });

      // Reindirizza al menu dopo 1 secondo
      setTimeout(() => {
        // Forza il refresh della pagina per aggiornare lo stato dell'autenticazione
        window.location.href = '/menu';
      }, 1000);
    } catch (err) {
      setStatus('error');
      setErrorMessage('Errore durante il salvataggio dei token');
      toast({
        title: "Errore",
        description: "Impossibile salvare i dati di autenticazione",
        variant: "destructive"
      });
      
      setTimeout(() => {
        setLocation('/auth?tab=cie');
      }, 3000);
    }
  }, [setLocation, toast]);

  // Se l'utente è già autenticato, reindirizza al menu
  if (user) {
    return <Redirect to="/menu" />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <Card className="w-full max-w-md shadow-xl bg-white">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-800">
            Autenticazione CIE
          </CardTitle>
          <CardDescription className="text-center">
            {status === 'loading' && 'Completamento autenticazione...'}
            {status === 'success' && 'Autenticazione completata!'}
            {status === 'error' && 'Errore durante l\'autenticazione'}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col items-center justify-center py-8">
          {status === 'loading' && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
              <p className="text-sm text-muted-foreground">
                Attendere, stiamo completando l'autenticazione...
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle2 className="h-12 w-12 text-green-600 mb-4" />
              <p className="text-sm text-green-600 font-medium">
                Autenticazione completata con successo!
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Reindirizzamento in corso...
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="h-12 w-12 text-red-600 mb-4" />
              <p className="text-sm text-red-600 font-medium">
                {errorMessage}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Reindirizzamento alla pagina di autenticazione...
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

