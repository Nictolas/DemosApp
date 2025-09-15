import React, { useState, useEffect } from 'react';
import { useLocation, useRouter } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Home, LogIn, AlertCircle } from 'lucide-react';

const ConfermaEmail: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    message: string;
    userEmail?: string;
  } | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const location = useLocation();

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        // Estrai token e email dai parametri URL usando window.location
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        const email = urlParams.get('email');
        
        console.log('🔍 URL completo:', window.location.href);
        console.log('🔍 Search params:', window.location.search);
        console.log('🔍 Token estratto:', token);
        console.log('🔍 Email estratta:', email);
        
        if (!token) {
          console.error('❌ Token non trovato nell\'URL');
          setVerificationResult({
            success: false,
            message: 'Token di verifica non trovato. Il link potrebbe essere non valido.'
          });
          setIsLoading(false);
          return;
        }

        // Chiama l'API per verificare l'email
        console.log('📡 Invio richiesta verifica email...');
        const response = await fetch('https://demos-c7k0.onrender.com/api/auth/verify-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        console.log('📡 Risposta ricevuta:', response.status, response.statusText);
        const result = await response.json();
        console.log('📊 Risultato verifica:', result);

        if (response.ok && result.success) {
          setVerificationResult({
            success: true,
            message: 'La tua email è stata verificata con successo!',
            userEmail: email || result.user?.email
          });
          
          // Mostra toast di successo
          toast({
            title: "Email verificata!",
            description: "La tua email è stata verificata con successo. Ora puoi accedere al menu.",
          });
          
          // Aggiorna lo status dell'utente nel localStorage
          localStorage.setItem('user_status', 'verified');
          
        } else {
          setVerificationResult({
            success: false,
            message: result.message || 'Errore durante la verifica dell\'email. Il token potrebbe essere scaduto o non valido.'
          });
        }
      } catch (error) {
        console.error('Errore nella verifica email:', error);
        setVerificationResult({
          success: false,
          message: 'Impossibile verificare l\'email. Riprova più tardi.'
        });
      } finally {
        setIsLoading(false);
      }
    };

    verifyEmail();
  }, [location, toast]);

  const handleGoHome = () => {
    router.push('/');
  };

  const handleGoToLogin = () => {
    router.push('/auth');
  };

  const handleGoToMenu = () => {
    router.push('/menu');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="text-center pb-6">
              <div className="mx-auto mb-6 w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Verifica in corso...
              </CardTitle>
              <CardDescription className="text-lg text-gray-600 mt-2">
                Stiamo verificando la tua email, attendi un momento.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-6">
            <div className={`mx-auto mb-6 w-20 h-20 rounded-full flex items-center justify-center shadow-lg ${
              verificationResult?.success 
                ? 'bg-gradient-to-br from-green-500 to-emerald-600' 
                : 'bg-gradient-to-br from-red-500 to-red-600'
            }`}>
              {verificationResult?.success ? (
                <CheckCircle className="w-10 h-10 text-white" />
              ) : (
                <AlertCircle className="w-10 h-10 text-white" />
              )}
            </div>
            <CardTitle className={`text-3xl font-bold bg-clip-text text-transparent ${
              verificationResult?.success 
                ? 'bg-gradient-to-r from-green-600 to-emerald-600' 
                : 'bg-gradient-to-r from-red-600 to-red-600'
            }`}>
              {verificationResult?.success ? 'Email Verificata!' : 'Errore nella Verifica'}
            </CardTitle>
            <CardDescription className="text-lg text-gray-600 mt-2">
              {verificationResult?.message}
            </CardDescription>
            {verificationResult?.userEmail && (
              <div className="mt-4">
                <span className="font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full inline-block">
                  {verificationResult.userEmail}
                </span>
              </div>
            )}
          </CardHeader>
          
          <CardContent className="space-y-6 px-6 pb-6">
            {verificationResult?.success ? (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="text-sm">
                    <p className="font-semibold text-green-900 mb-3">Perfetto! Cosa puoi fare ora:</p>
                    <ol className="space-y-2 text-green-800">
                      <li className="flex items-start space-x-2">
                        <span className="flex-shrink-0 w-5 h-5 bg-green-200 text-green-800 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                        <span>Accedi al tuo account</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <span className="flex-shrink-0 w-5 h-5 bg-green-200 text-green-800 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                        <span>Esplora tutte le funzionalità della piattaforma</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <span className="flex-shrink-0 w-5 h-5 bg-green-200 text-green-800 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                        <span>Inizia a partecipare alle discussioni e votazioni</span>
                      </li>
                    </ol>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-red-50 to-red-50 border border-red-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="text-sm">
                    <p className="font-semibold text-red-900 mb-3">Cosa puoi fare:</p>
                    <ol className="space-y-2 text-red-800">
                      <li className="flex items-start space-x-2">
                        <span className="flex-shrink-0 w-5 h-5 bg-red-200 text-red-800 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                        <span>Controlla che il link sia completo e non sia stato modificato</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <span className="flex-shrink-0 w-5 h-5 bg-red-200 text-red-800 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                        <span>Prova a richiedere un nuovo link di verifica</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <span className="flex-shrink-0 w-5 h-5 bg-red-200 text-red-800 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                        <span>Contatta il supporto se il problema persiste</span>
                      </li>
                    </ol>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {verificationResult?.success ? (
                <>
                  <Button
                    onClick={handleGoToMenu}
                    className="w-full h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    <CheckCircle className="w-5 h-5 mr-3" />
                    Vai al Menu
                  </Button>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={handleGoToLogin}
                      variant="outline"
                      className="h-12 border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-400 transition-all duration-200"
                    >
                      <LogIn className="w-4 h-4 mr-2" />
                      Accedi
                    </Button>
                    
                    <Button
                      onClick={handleGoHome}
                      variant="outline"
                      className="h-12 border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
                    >
                      <Home className="w-4 h-4 mr-2" />
                      Homepage
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Button
                    onClick={handleGoToLogin}
                    className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    <LogIn className="w-5 h-5 mr-3" />
                    Prova ad Accedere
                  </Button>
                  
                  <Button
                    onClick={handleGoHome}
                    variant="outline"
                    className="w-full h-12 border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
                  >
                    <Home className="w-4 h-4 mr-2" />
                    Torna alla Homepage
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ConfermaEmail;
