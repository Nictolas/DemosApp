import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ThumbsUp, ThumbsDown } from "lucide-react";
import { useAuth } from "@/hooks/use-auth-neon";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [userReaction, setUserReaction] = useState<string | null>(null);
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);

  // Mutazione per gestire like/dislike
  const reactionMutation = useMutation({
    mutationFn: async (tipo: 'like' | 'dislike') => {
      const response = await apiRequest("POST", "/api/reazioni-comunicazioni", {
        comunicazione_id: notifica.id,
        utente_id: user?.uid,
        tipo
      });
      if (!response.ok) throw new Error("Errore nella reazione");
      return response.json();
    },
    onSuccess: (data) => {
      // Aggiorna lo stato locale
      if (data.action === 'added') {
        setUserReaction(data.data.tipo);
        if (data.data.tipo === 'like') {
          setLikes(prev => prev + 1);
        } else {
          setDislikes(prev => prev + 1);
        }
      } else if (data.action === 'removed') {
        setUserReaction(null);
        if (userReaction === 'like') {
          setLikes(prev => Math.max(0, prev - 1));
        } else {
          setDislikes(prev => Math.max(0, prev - 1));
        }
      } else if (data.action === 'updated') {
        // Cambia da like a dislike o viceversa
        if (userReaction === 'like') {
          setLikes(prev => Math.max(0, prev - 1));
          setDislikes(prev => prev + 1);
        } else {
          setDislikes(prev => Math.max(0, prev - 1));
          setLikes(prev => prev + 1);
        }
        setUserReaction(data.data.tipo);
      }
    },
    onError: (error) => {
      console.error("Errore nella reazione:", error);
    }
  });

  const handleReaction = (tipo: 'like' | 'dislike') => {
    if (!user?.uid || notifica.tipo_notifica !== 'comunicazione') return;
    reactionMutation.mutate(tipo);
  };
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

          {/* Pulsanti like/dislike per comunicazioni */}
          {notifica.tipo_notifica === 'comunicazione' && user?.uid && (
            <div className="mt-4 flex items-center gap-2">
              <Button
                variant={userReaction === 'like' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleReaction('like')}
                disabled={reactionMutation.isPending}
                className="flex items-center gap-1"
              >
                <ThumbsUp className="h-4 w-4" />
                {likes}
              </Button>
              <Button
                variant={userReaction === 'dislike' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleReaction('dislike')}
                disabled={reactionMutation.isPending}
                className="flex items-center gap-1"
              >
                <ThumbsDown className="h-4 w-4" />
                {dislikes}
              </Button>
            </div>
          )}
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
