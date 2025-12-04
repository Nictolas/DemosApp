import { useEffect, useState } from "react";
import { useLocation, Redirect } from "wouter";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth-neon";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getApiUrl } from "@/lib/api-config";

export default function CIECallback() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const exchangeCode = async () => {
      // Estrai i parametri dalla query string (code e state dall'Identity Provider)
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');
      const errorDescription = urlParams.get('error_description');

      // Gestisci errori dall'Identity Provider
      if (error) {
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

      // Verifica che code e state siano presenti
      if (!code || !state) {
        setStatus('error');
        setErrorMessage('Parametri di autenticazione mancanti');
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

      // Chiama il backend per scambiare code e state con i token
      try {
        const exchangeUrl = getApiUrl('/auth/cie/exchange');
        console.log('🔐 CIE Callback: Scambio code con token...');
        
        const response = await fetch(exchangeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ code, state })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Errore HTTP ${response.status}`);
        }

        const data = await response.json();

        // Se richiede registrazione, reindirizza al modulo di registrazione
        if (data.requiresRegistration && data.cieData) {
          console.log('🆕 CIE Callback: Registrazione richiesta, reindirizzamento...');
          
          // Salva i dati CIE nel localStorage per precompilare il modulo
          localStorage.setItem('cie_pending_registration', JSON.stringify({
            pendingId: data.pendingRegistrationId,
            fiscal_number: data.cieData.fiscal_number,
            nome: data.cieData.nome,
            cognome: data.cieData.cognome,
            sub: data.cieData.sub
          }));
          
          setStatus('success');
          toast({
            title: "Autenticazione CIE completata",
            description: "Completa la registrazione per continuare",
            variant: "default"
          });

          // Reindirizza al modulo di registrazione dopo 1 secondo
          setTimeout(() => {
            window.location.href = '/auth?tab=register&from=cie';
          }, 1000);
          return;
        }

        if (!data.success || !data.accessToken) {
          throw new Error(data.message || 'Token di accesso non ricevuto');
        }

        // Salva i token nel localStorage
        localStorage.setItem('auth_token', data.accessToken);
        if (data.refreshToken) {
          localStorage.setItem('refresh_token', data.refreshToken);
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
      } catch (err: any) {
        console.error('❌ Errore durante exchange CIE:', err);
        setStatus('error');
        setErrorMessage(err.message || 'Errore durante lo scambio del codice di autorizzazione');
        toast({
          title: "Errore",
          description: err.message || "Impossibile completare l'autenticazione",
          variant: "destructive"
        });
        
        setTimeout(() => {
          setLocation('/auth?tab=cie');
        }, 3000);
      }
    };

    exchangeCode();
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

