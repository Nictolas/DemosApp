import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Bell, Wifi, Smartphone } from "lucide-react";
import { PreferenzeNotificheProps } from "../types";

export const PreferenzeNotifiche: React.FC<PreferenzeNotificheProps> = ({
  fcmToken,
  fcmError,
  permission,
  onSwitch
}) => {
  return (
    <Card className="mb-8 bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Preferenze Notifiche
        </CardTitle>
        <CardDescription>
          Configura come vuoi ricevere le notifiche
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wifi className="h-5 w-5 text-blue-600" />
            <span>Notifiche in-app</span>
          </div>
          <Switch
            checked={true}
            onCheckedChange={(checked) => onSwitch('app', checked)}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Smartphone className="h-5 w-5 text-green-600" />
            <span>Notifiche push</span>
            {fcmError && (
              <Badge variant="destructive" className="text-xs">
                Errore
              </Badge>
            )}
          </div>
          <Switch
            checked={permission === 'granted'}
            onCheckedChange={(checked) => onSwitch('push', checked)}
            disabled={permission !== 'granted'}
          />
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
