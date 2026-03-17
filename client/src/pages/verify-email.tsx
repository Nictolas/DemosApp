import React, { useState, useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, Mail, AlertCircle } from 'lucide-react';

const VerifyEmail = () => {
  const [location] = useLocation();
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'expired'>('loading');
  const [message, setMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Estrai il token dall'URL
  const urlParams = new URLSearchParams(location.split('?')[1]);
  const token = urlParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Token di verifica mancante. Richiedi un nuovo link di verifica.');
      return;
    }

    // Verifica automaticamente l'email quando la pagina si carica
    verifyEmail();
  }, [token]);

  const verifyEmail = async () => {
    if (!token) return;

    setIsVerifying(true);
    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (data.success) {
        setStatus('success');
        setMessage(data.message);
        
        // Salva il token di login se fornito
        if (data.token) {
          localStorage.setItem('auth_token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
        }
      } else {
        if (data.error?.includes('scaduto') || data.error?.includes('non valido')) {
          setStatus('expired');
          setMessage('Il link di verifica è scaduto o non è più valido. Richiedi un nuovo link.');
        } else {
          setStatus('error');
          setMessage(data.error || 'Errore durante la verifica dell\'email');
        }
      }
    } catch (error) {
      console.error('Errore durante la verifica:', error);
      setStatus('error');
      setMessage('Errore di connessione. Riprova più tardi.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendVerification = async () => {
    // Per ora reindirizza alla pagina di login dove potrà richiedere il reinvio
    setLocation('/auth');
  };

  const handleGoToLogin = () => {
    setLocation('/auth');
  };

  const handleGoToHome = () => {
    setLocation('/');
  };

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Verifica in corso...</h2>
            <p className="text-gray-600">Stiamo verificando la tua email</p>
          </div>
        );

      case 'success':
        return (
          <div className="text-center">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-green-800 mb-2">Email verificata!</h2>
            <p className="text-gray-700 mb-6">{message}</p>
            <div className="space-y-3">
              <Button onClick={handleGoToHome} className="w-full">
                Vai alla Home
              </Button>
              <Button onClick={handleGoToLogin} variant="outline" className="w-full">
                Accedi
              </Button>
            </div>
          </div>
        );

      case 'expired':
        return (
          <div className="text-center">
            <XCircle className="h-16 w-16 text-orange-600 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-orange-800 mb-2">Link scaduto</h2>
            <p className="text-gray-700 mb-6">{message}</p>
            <div className="space-y-3">
              <Button onClick={handleResendVerification} className="w-full">
                Richiedi nuovo link
              </Button>
              <Button onClick={handleGoToLogin} variant="outline" className="w-full">
                Torna al login
              </Button>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="text-center">
            <AlertCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-red-800 mb-2">Errore di verifica</h2>
            <p className="text-gray-700 mb-6">{message}</p>
            <div className="space-y-3">
              <Button onClick={handleResendVerification} className="w-full">
                Richiedi nuovo link
              </Button>
              <Button onClick={handleGoToLogin} variant="outline" className="w-full">
                Torna al login
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-blue-100 rounded-full">
            <Mail className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Verifica Email</CardTitle>
          <CardDescription>
            Conferma la tua email per attivare il tuo account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderContent()}
          
          {status === 'loading' && (
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">
                Se la verifica non si completa automaticamente, clicca qui:
              </p>
              <Button 
                onClick={verifyEmail} 
                disabled={isVerifying}
                className="mt-2"
                variant="outline"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifica manuale
                  </>
                ) : (
                  'Verifica manuale'
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyEmail;
