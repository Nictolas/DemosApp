import React, { useEffect, useState } from 'react';
import { useFCM } from '../hooks/useFCM';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';

interface NotificationTestProps {
  userId?: string;
}

export function NotificationTest({ userId }: NotificationTestProps) {
  const { token, error, permission, message } = useFCM();
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Salva il token FCM quando disponibile
  useEffect(() => {
    if (token && userId) {
      saveFCMToken();
    }
  }, [token, userId]);

  // Mostra notifiche in foreground
  useEffect(() => {
    if (message) {
      // Mostra una notifica in-app
      setTestResult(`Notifica ricevuta: ${message.notification?.title} - ${message.notification?.body}`);
      
      // Opzionale: mostra anche una notifica del browser
      if (permission === 'granted') {
        new Notification(message.notification?.title || 'DEMOS', {
          body: message.notification?.body,
          icon: '/icona.png'
        });
      }
    }
  }, [message, permission]);

  const saveFCMToken = async () => {
    if (!token || !userId) return;

    try {
      const response = await fetch('/api/notifications/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          fcmToken: token
        })
      });

      const result = await response.json();
      if (result.success) {
        setTestResult('Token FCM salvato con successo!');
      } else {
        setTestResult(`Errore salvataggio token: ${result.error}`);
      }
    } catch (error) {
      setTestResult(`Errore di rete: ${error}`);
    }
  };

  const testNotification = async () => {
    if (!userId) {
      setTestResult('Errore: userId non fornito');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/notifications/send/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          title: 'Test Notifica DEMOS',
          body: 'Questa è una notifica di test inviata alle ' + new Date().toLocaleTimeString(),
          data: {
            type: 'test',
            timestamp: Date.now().toString()
          }
        })
      });

      const result = await response.json();
      if (result.success) {
        setTestResult('Notifica di test inviata con successo!');
      } else {
        setTestResult(`Errore invio notifica: ${result.error}`);
      }
    } catch (error) {
      setTestResult(`Errore di rete: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const requestPermission = () => {
    Notification.requestPermission().then((perm) => {
      if (perm === 'granted') {
        setTestResult('Permesso notifiche concesso!');
      } else {
        setTestResult('Permesso notifiche negato.');
      }
    });
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🔔 Test Notifiche Push
          <Badge variant={permission === 'granted' ? 'default' : 'secondary'}>
            {permission || 'Non richiesto'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {token && (
          <Alert>
            <AlertDescription>
              Token FCM: {token.substring(0, 20)}...
            </AlertDescription>
          </Alert>
        )}

        {testResult && (
          <Alert>
            <AlertDescription>{testResult}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          {permission !== 'granted' && (
            <Button onClick={requestPermission} className="w-full">
              Richiedi Permesso Notifiche
            </Button>
          )}

          {permission === 'granted' && userId && (
            <Button 
              onClick={testNotification} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Invio in corso...' : 'Invia Notifica di Test'}
            </Button>
          )}

          {!userId && (
            <Alert>
              <AlertDescription>
                Effettua il login per testare le notifiche
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="text-sm text-muted-foreground">
          <p><strong>Stato:</strong></p>
          <ul className="list-disc list-inside space-y-1">
            <li>Permesso: {permission || 'Non richiesto'}</li>
            <li>Token: {token ? 'Disponibile' : 'Non disponibile'}</li>
            <li>Service Worker: {navigator.serviceWorker ? 'Supportato' : 'Non supportato'}</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
} 