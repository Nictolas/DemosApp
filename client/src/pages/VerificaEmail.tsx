import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Mail, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

const VerificaEmail: React.FC = () => {
  const [isResending, setIsResending] = useState(false);
  const [email, setEmail] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Estrai email dai parametri URL o dal localStorage
    const urlParams = new URLSearchParams(location.search);
    const emailFromUrl = urlParams.get('email');
    const emailFromStorage = localStorage.getItem('user_email');
    
    if (emailFromUrl) {
      setEmail(emailFromUrl);
    } else if (emailFromStorage) {
      setEmail(emailFromStorage);
    }

    // Controlla se c'è un token di verifica nell'URL
    const token = urlParams.get('token');
    if (token) {
      verifyEmail(token);
    }
  }, [location]);

  const verifyEmail = async (token: string) => {
    setIsVerifying(true);
    try {
      const response = await fetch('https://demos-c7k0.onrender.com/api/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: "Email verificata!",
          description: "La tua email è stata verificata con successo. Ora puoi accedere al menu.",
        });
        
        // Aggiorna lo status dell'utente nel localStorage
        localStorage.setItem('user_status', 'verified');
        
        // Reindirizza al menu
        navigate('/menu');
      } else {
        toast({
          title: "Errore nella verifica",
          description: result.message || "Token non valido o scaduto.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Errore nella verifica email:', error);
      toast({
        title: "Errore",
        description: "Impossibile verificare l'email. Riprova più tardi.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const resendVerificationEmail = async () => {
    if (!email) {
      toast({
        title: "Errore",
        description: "Email non trovata. Effettua nuovamente la registrazione.",
        variant: "destructive",
      });
      return;
    }

    setIsResending(true);
    try {
      const response = await fetch('https://demos-c7k0.onrender.com/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: "Email inviata!",
          description: "Controlla la tua casella di posta per il nuovo link di verifica.",
        });
      } else {
        toast({
          title: "Errore",
          description: result.message || "Impossibile inviare l'email. Riprova più tardi.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Errore nell\'invio email:', error);
      toast({
        title: "Errore",
        description: "Impossibile inviare l'email. Riprova più tardi.",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  const handleLogout = () => {
    // Pulisce tutti i dati di autenticazione
    localStorage.removeItem('token');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_status');
    localStorage.removeItem('user_id');
    
    // Reindirizza alla homepage
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <Mail className="w-8 h-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold">Verifica la tua email</CardTitle>
          <CardDescription>
            Ti abbiamo inviato un'email di verifica all'indirizzo:
            <br />
            <strong className="text-blue-600">{email}</strong>
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {isVerifying ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Verifica in corso...</p>
            </div>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Cosa fare ora:</p>
                    <ol className="list-decimal list-inside space-y-1 text-blue-700">
                      <li>Controlla la tua casella di posta</li>
                      <li>Clicca sul link di verifica nell'email</li>
                      <li>Se non trovi l'email, controlla anche la cartella spam</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={resendVerificationEmail}
                  disabled={isResending}
                  className="w-full"
                  variant="outline"
                >
                  {isResending ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Invio in corso...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Rinviami l'email
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleLogout}
                  variant="ghost"
                  className="w-full text-gray-600"
                >
                  Torna alla homepage
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VerificaEmail;
