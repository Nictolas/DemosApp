import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Mail, RefreshCw, CheckCircle, AlertCircle, LogOut } from 'lucide-react';

const VerificaEmailStandalone: React.FC = () => {
  const [isResending, setIsResending] = useState(false);
  const [email, setEmail] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { toast } = useToast();
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
        
        // Reindirizza ai preferiti
        window.location.href = '/preferiti';
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

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      // Chiama l'endpoint di logout
      const token = localStorage.getItem('auth_token');
      if (token) {
        await fetch('https://demos-c7k0.onrender.com/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      }
      
      // Pulisce tutti i dati di autenticazione
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_email');
      localStorage.removeItem('user_status');
      localStorage.removeItem('user_id');
      
      toast({
        title: "Logout effettuato",
        description: "Sei stato disconnesso con successo.",
      });
      
      // Reindirizza alla homepage
      window.location.href = '/';
    } catch (error) {
      console.error('Errore logout:', error);
      toast({
        title: "Errore",
        description: "Errore durante il logout. Riprova.",
        variant: "destructive",
      });
      setIsLoggingOut(false);
    }
  };


  // Se non abbiamo email, mostra un messaggio di errore
  if (!email) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <Card className="shadow-2xl border-0 bg-white">
            <CardHeader className="text-center pb-6">
              <div className="mx-auto mb-6 w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-lg">
                <AlertCircle className="w-10 h-10 text-white" />
              </div>
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-red-600 to-red-600 bg-clip-text text-transparent">
                Errore
              </CardTitle>
              <CardDescription className="text-lg text-gray-600 mt-2">
                Email non trovata. Effettua nuovamente la registrazione.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <Button
                onClick={() => window.location.href = '/'}
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
              >
                Torna alla Homepage
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <Card className="shadow-2xl border-0 bg-white">
          <CardHeader className="text-center pb-6">
            <div className="mx-auto mb-6 w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
              <Mail className="w-10 h-10 text-white" />
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Verifica la tua email
            </CardTitle>
            <CardDescription className="text-lg text-gray-600 mt-2">
              Ti abbiamo inviato un'email di verifica all'indirizzo:
              <br />
              <span className="font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full inline-block mt-2">
                {email}
              </span>
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6 px-6 pb-6">
            {isVerifying ? (
              <div className="text-center py-12">
                <div className="mx-auto mb-6 w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-lg">
                  <RefreshCw className="w-8 h-8 text-white animate-spin" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Verifica in corso...</h3>
                <p className="text-gray-600">Stiamo verificando il tuo token...</p>
              </div>
            ) : (
              <>
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 shadow-sm">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <AlertCircle className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="text-sm">
                      <p className="font-semibold text-blue-900 mb-3">Cosa fare ora:</p>
                      <ol className="space-y-2 text-blue-800">
                        <li className="flex items-start space-x-2">
                          <span className="flex-shrink-0 w-5 h-5 bg-blue-200 text-blue-800 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                          <span>Controlla la tua casella di posta</span>
                        </li>
                        <li className="flex items-start space-x-2">
                          <span className="flex-shrink-0 w-5 h-5 bg-blue-200 text-blue-800 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                          <span>Clicca sul link di verifica nell'email</span>
                        </li>
                        <li className="flex items-start space-x-2">
                          <span className="flex-shrink-0 w-5 h-5 bg-blue-200 text-blue-800 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                          <span>Se non trovi l'email, controlla anche la cartella spam</span>
                        </li>
                      </ol>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <Button
                    onClick={resendVerificationEmail}
                    disabled={isResending}
                    className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                    variant="default"
                  >
                    {isResending ? (
                      <>
                        <RefreshCw className="w-5 h-5 mr-3 animate-spin" />
                        Invio in corso...
                      </>
                    ) : (
                      <>
                        <Mail className="w-5 h-5 mr-3" />
                        Rinviami l'email
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    variant="outline"
                    className="w-full h-12 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 transition-all duration-200"
                  >
                    {isLoggingOut ? (
                      <>
                        <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                        Logout...
                      </>
                    ) : (
                      <>
                        <LogOut className="w-4 h-4 mr-2" />
                        Logout
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VerificaEmailStandalone;
