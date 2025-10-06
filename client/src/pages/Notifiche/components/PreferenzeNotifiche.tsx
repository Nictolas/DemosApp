import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Bell, Users, Building, MapPin, Home, Globe, Heart } from "lucide-react";
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
    attivisti: true,
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
    { key: 'attivisti' as const, label: 'Attivisti', icon: Heart, color: 'text-pink-600' },
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
        {/* Notifiche per rappresentanti e attivisti */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Notifiche Push per Rappresentanti e Attivisti</h3>
          <p className="text-sm text-gray-600">Scegli per quali rappresentanti e attivisti ricevere notifiche push sul cellulare</p>
          
          <div className="space-y-4">
            {rappresentanti.map(({ key, label, icon: Icon, color }) => (
              <div key={key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-full bg-white shadow-sm border ${color.replace('text-', 'border-')}`}>
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">{label}</span>
                    <p className="text-sm text-gray-500">
                      {key === 'attivisti' 
                        ? 'Notifiche da attivisti che segui'
                        : key === 'demos'
                        ? 'Notifiche generali della piattaforma'
                        : `Notifiche dal tuo ${label.toLowerCase()}`
                      }
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${preferenzeRappresentanti[key] ? 'text-green-600' : 'text-gray-400'}`}>
                    {preferenzeRappresentanti[key] ? 'Attivo' : 'Disattivo'}
                  </span>
                  <Switch
                    checked={preferenzeRappresentanti[key]}
                    onCheckedChange={(checked) => handleRappresentanteSwitch(key, checked)}
                    className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-300"
                  />
                </div>
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
