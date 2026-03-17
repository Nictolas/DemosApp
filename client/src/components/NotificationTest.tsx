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
  const { token, error, permission, message, isLoading, requestPermission } = useFCM();
  const [testResult, setTestResult] = useState<string | null>(null);

  // Controllo supporto notifiche e service worker
  const isNotificationSupported = typeof window !== 'undefined' && 'Notification' in window;
  const isServiceWorkerSupported = typeof window !== 'undefined' && 'serviceWorker' in navigator;

  // Salva il token FCM quando disponibile
  useEffect(() => {
    if (token && userId) {
      // RIMOSSO: la funzione saveFCMToken non è più necessaria perché la sincronizzazione avviene tramite useSyncFcmToken
    }
  }, [token, userId]);

  // Mostra notifiche in foreground
  useEffect(() => {
    if (message) {
      // Mostra una notifica in-app
      setTestResult(`Notifica ricevuta: ${message.notification?.title} - ${message.notification?.body}`);
      // RIMOSSO: non mostrare più una notifica locale con new Notification per evitare doppie notifiche
    }
  }, [message, permission]);

  // Mostra alert se manca userId ma il permesso è granted
  useEffect(() => {
    if (permission === 'granted' && !userId) {
      setTestResult('Permesso notifiche concesso, ma non sei loggato. Effettua il login per ricevere notifiche.');
    }
  }, [permission, userId]);

  // Mostra alert se il salvataggio token fallisce
  // RIMOSSO: la funzione saveFCMToken non è più necessaria perché la sincronizzazione avviene tramite useSyncFcmToken

  // Mostra alert se si tenta di inviare una notifica senza token valido
  const testNotification = async () => {
    if (!userId) {
      setTestResult('Errore: userId non fornito');
      return;
    }
    if (!token) {
      setTestResult('Errore: token FCM non disponibile. Non puoi inviare notifiche di test.');
      return;
    }
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
    }
  };

  // Rimuovo la vecchia funzione requestPermission e uso quella dell'hook

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
        {!isNotificationSupported && (
          <Alert variant="destructive">
            <AlertDescription>
              Il tuo browser non supporta le notifiche push.<br />
              Prova con un browser più recente o aggiorna il sistema.
            </AlertDescription>
          </Alert>
        )}
        {!isServiceWorkerSupported && (
          <Alert variant="destructive">
            <AlertDescription>
              Il tuo browser non supporta i Service Worker.<br />
              Le notifiche push non possono funzionare su questo dispositivo.
            </AlertDescription>
          </Alert>
        )}
        {permission === 'default' && isNotificationSupported && (
          <Alert variant="default">
            <AlertDescription>
              Devi autorizzare le notifiche push per ricevere avvisi dall'app DEMOS.
            </AlertDescription>
          </Alert>
        )}
        {permission === 'denied' && (
          <Alert variant="destructive">
            <AlertDescription>
              Permesso notifiche <b>negato</b>.<br />
              Vai su <b>Impostazioni &gt; Notifiche &gt; DEMOS</b> e abilita le notifiche per ricevere gli avvisi push.
            </AlertDescription>
          </Alert>
        )}
        {permission === 'granted' && !token && (
          <Alert variant="destructive">
            <AlertDescription>
              Permesso notifiche concesso, ma token FCM non disponibile.<br />
              Potrebbe esserci un problema di rete o di configurazione.<br />
              Prova a ricaricare la pagina o a ripetere la procedura.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {testResult && (
          <Alert>
            <AlertDescription>{testResult}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          {permission !== 'granted' && (
            <Button 
              onClick={requestPermission} 
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-white flex items-center gap-2"
              aria-label="Richiedi permesso notifiche"
              disabled={isLoading || !isNotificationSupported}
            >
              <span role="img" aria-label="campanella">🔔</span>
              {isLoading ? 'Attivazione in corso...' : 'Attiva Notifiche Push'}
            </Button>
          )}

          {permission === 'granted' && userId && (
            <Button 
              onClick={testNotification} 
              disabled={isLoading || !token || !!error}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
              aria-label="Invia notifica di test"
            >
              <span role="img" aria-label="campanella con check">🔔✅</span>
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
            <li>
              Permesso: {permission === 'granted' ? (
                <Badge className="bg-green-600 text-white">granted</Badge>
              ) : permission === 'denied' ? (
                <Badge className="bg-red-600 text-white">denied</Badge>
              ) : (
                <Badge className="bg-gray-400 text-white">{permission || 'Non richiesto'}</Badge>
              )}
            </li>
            <li>Token: {token ? 'Disponibile' : 'Non disponibile'}</li>
            <li>Service Worker: {navigator.serviceWorker ? 'Supportato' : 'Non supportato'}</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
} 
