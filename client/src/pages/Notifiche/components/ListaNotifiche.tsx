import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Bell } from "lucide-react";
import { NotificheData } from "../types";
import { NotificaItem } from "./NotificaItem";

interface ListaNotificheProps {
  data: NotificheData | undefined;
  isLoading: boolean;
  error: any;
  onMarkAsRead: (id: string) => void;
  isPending: boolean;
}

export const ListaNotifiche: React.FC<ListaNotificheProps> = ({
  data,
  isLoading,
  error,
  onMarkAsRead,
  isPending
}) => {
  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Le tue Notifiche
        </CardTitle>
        <CardDescription>
          {data?.notifiche?.length || 0} notifiche totali
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertDescription>
              Errore nel caricamento delle notifiche: {error.message}
            </AlertDescription>
          </Alert>
        ) : !data?.notifiche || data.notifiche.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Bell className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>Nessuna notifica disponibile</p>
            <p className="text-sm">Le tue notifiche appariranno qui</p>
          </div>
        ) : (
          <div className="space-y-4">
            {data.notifiche.map((notifica) => (
              <NotificaItem
                key={notifica.id}
                notifica={notifica}
                onMarkAsRead={onMarkAsRead}
                isPending={isPending}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
