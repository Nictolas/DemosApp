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
            {notifica.tipo_notifica === 'comunicazione' && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                Comunicazione Votazione
              </Badge>
            )}
          </div>
          
          <p className="text-gray-700 mb-3">
            {getNotificaMessage(notifica.messaggio)}
          </p>

          {/* Informazioni aggiuntive per comunicazioni */}
          {notifica.tipo_notifica === 'comunicazione' && notifica.autore && (
            <div className="mb-3 p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600 mb-2">
                <strong>Autore:</strong> {notifica.autore.nome} {notifica.autore.cognome} 
                <span className="ml-2 text-xs bg-gray-200 px-2 py-1 rounded">
                  {notifica.autore.ruolo}
                </span>
              </div>
              {notifica.voto_dato && (
                <div className="text-sm text-gray-600">
                  <strong>Voto:</strong> 
                  <span className={`ml-2 px-2 py-1 rounded text-xs ${
                    notifica.voto_dato === 'Favorevole' ? 'bg-green-100 text-green-800' :
                    notifica.voto_dato === 'Contrario' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {notifica.voto_dato}
                  </span>
                </div>
              )}
              {notifica.vincitore && (
                <div className="text-sm text-gray-600 mt-1">
                  <strong>Risultato:</strong> 
                  <span className={`ml-2 px-2 py-1 rounded text-xs ${
                    notifica.vincitore === 'Approvata' ? 'bg-green-100 text-green-800' :
                    notifica.vincitore === 'Respinta' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {notifica.vincitore}
                  </span>
                </div>
              )}
              {notifica.commento && (
                <div className="text-sm text-gray-600 mt-1">
                  <strong>Commento:</strong> {notifica.commento}
                </div>
              )}
            </div>
          )}
          
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>Tipo: {getNotificaType(notifica.tipo || notifica.tipo_notifica)}</span>
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
