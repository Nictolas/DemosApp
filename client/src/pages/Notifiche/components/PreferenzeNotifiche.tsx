import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Bell, Users, Building, MapPin, Home, Globe } from "lucide-react";
import { PreferenzeNotificheProps, PreferenzeRappresentanti } from "../types";

export const PreferenzeNotifiche: React.FC<PreferenzeNotificheProps> = ({
  fcmToken,
  fcmError,
  permission,
  onSwitch
}) => {
  const [preferenzeRappresentanti, setPreferenzeRappresentanti] = useState<PreferenzeRappresentanti>({
    eurodeputato: true,
    senatore: true,
    deputato: true,
    consigliere_regionale: true,
    consigliere_comunale: true,
    demos: true
  });

  const handleRappresentanteSwitch = (tipo: keyof PreferenzeRappresentanti, checked: boolean) => {
    console.log('🔍 DEBUG Switch - Click:', { tipo, checked });
    setPreferenzeRappresentanti(prev => ({
      ...prev,
      [tipo]: checked
    }));
    // Salva le preferenze localmente e invia al server
    onSwitch(tipo, checked);
  };

  const rappresentanti = [
    { key: 'eurodeputato' as const, label: 'Eurodeputato', icon: Globe, color: 'text-blue-600' },
    { key: 'senatore' as const, label: 'Senatore', icon: Building, color: 'text-red-600' },
    { key: 'deputato' as const, label: 'Deputato', icon: Building, color: 'text-green-600' },
    { key: 'consigliere_regionale' as const, label: 'Consigliere Regionale', icon: MapPin, color: 'text-purple-600' },
    { key: 'consigliere_comunale' as const, label: 'Consigliere Comunale', icon: Home, color: 'text-orange-600' },
    { key: 'demos' as const, label: 'Demos', icon: Users, color: 'text-indigo-600' }
  ];

  return (
    <Card className="mb-8 bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Preferenze Notifiche
        </CardTitle>
        <CardDescription id="preferenze-desc">
          Configura come vuoi ricevere le notifiche
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Notifiche per rappresentanti */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Notifiche Push per Rappresentanti</h3>
          <p className="text-sm text-gray-600">Scegli per quali rappresentanti ricevere notifiche push sul cellulare</p>
          
          <div className="space-y-3">
            {rappresentanti.map(({ key, label, icon: Icon, color }) => (
              <div key={key} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon className={`h-5 w-5 ${color}`} />
                  <span>{label}</span>
                </div>
                <Switch
                  checked={preferenzeRappresentanti[key]}
                  onCheckedChange={(checked) => handleRappresentanteSwitch(key, checked)}
                />
              </div>
            ))}
          </div>
        </div>

        {fcmError && (
          <Alert variant="destructive">
            <AlertDescription>
              Errore nelle notifiche push: {fcmError}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
