import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { NotificaItemProps } from "../types";
import { 
  getStatusColor, 
  getStatusText, 
  getNotificaBackground,
  getNotificaTitle,
  getNotificaMessage,
  getNotificaType,
  formatDate
} from "../utils/notificheUtils";

export const NotificaItem: React.FC<NotificaItemProps> = ({
  notifica,
  onMarkAsRead,
  isPending
}) => {
  return (
    <div
      className={`p-4 rounded-lg border ${getNotificaBackground(notifica.status)}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-semibold text-gray-900">
              {getNotificaTitle(notifica.titolo)}
            </h3>
            <Badge className={getStatusColor(notifica.status)}>
              {getStatusText(notifica.status)}
            </Badge>
            {notifica.priorita && (
              <Badge variant="outline">
                {notifica.priorita}
              </Badge>
            )}
          </div>
          
          <p className="text-gray-700 mb-3">
            {getNotificaMessage(notifica.messaggio)}
          </p>
          
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>Tipo: {getNotificaType(notifica.tipo)}</span>
            <span>
              {formatDate(notifica.created_at || notifica.data_creazione || '')}
            </span>
          </div>
        </div>
        
        {notifica.status === 'non_letta' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onMarkAsRead(notifica.id)}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Segna come letta'
            )}
          </Button>
        )}
      </div>
    </div>
  );
};
