import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, ThumbsUp, ThumbsDown, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth-neon";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { NotificaItemProps } from "../types";
import { CustomAvatar } from "@/components/avatar/CustomAvatar";
import { 
  getNotificaBackground,
  getNotificaTitle,
  getNotificaMessage,
  formatDate
} from "../utils/notificheUtils";

export const NotificaItem: React.FC<NotificaItemProps> = ({
  notifica,
  deleteSegnalazioneMutation
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [userReaction, setUserReaction] = useState<string | null>(null);
  const [likes, setLikes] = useState(notifica.likes || 0);
  const [dislikes, setDislikes] = useState(notifica.dislikes || 0);

  // Carica reazioni e reazione utente per voto_comune e comunicazione
  const shouldLoadReactions = Boolean((notifica.tipo_notifica === 'voto_comune' || notifica.tipo_notifica === 'comunicazione') && user?.id);

  const { data: reactionsData } = useQuery({
    queryKey: ['reazioni', notifica.id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/reazioni-comunicazioni/${notifica.id}`);
      return response?.data || { likes: 0, dislikes: 0 };
    },
    enabled: shouldLoadReactions,
    refetchOnWindowFocus: false
  });

  const { data: userReactionData } = useQuery({
    queryKey: ['reazione-utente', user?.id, notifica.id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/reazioni-comunicazioni/user/${user?.id}/${notifica.id}`);
      return response?.data || null;
    },
    enabled: shouldLoadReactions,
    refetchOnWindowFocus: false
  });

  // Aggiorna likes/dislikes quando arrivano i dati
  useEffect(() => {
    if (reactionsData) {
      setLikes(reactionsData.likes || 0);
      setDislikes(reactionsData.dislikes || 0);
    }
  }, [reactionsData]);

  // Aggiorna reazione utente quando arrivano i dati
  useEffect(() => {
    if (userReactionData !== undefined) {
      setUserReaction(userReactionData);
    }
  }, [userReactionData]);

  // Mutazione per gestire like/dislike
  const reactionMutation = useMutation({
    mutationFn: async (tipo: 'like' | 'dislike') => {
      const response = await apiRequest("POST", "/api/reazioni-comunicazioni", {
        comunicazione_id: notifica.id,
        utente_id: user?.id,
        tipo
      });
      if (!response || !response.success) {
        throw new Error(response?.error || "Errore nella reazione");
      }
      return response;
    },
    onSuccess: (data) => {
      // Invalida le query per ricaricare i dati
      queryClient.invalidateQueries({ queryKey: ['reazioni', notifica.id] });
      queryClient.invalidateQueries({ queryKey: ['reazione-utente', user?.id, notifica.id] });
      
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
    if (!user?.id || (notifica.tipo_notifica !== 'comunicazione' && notifica.tipo_notifica !== 'voto_comune')) return;
    reactionMutation.mutate(tipo);
  };

  const handleDeleteSegnalazione = () => {
    if (deleteSegnalazioneMutation && notifica.tipo_notifica === 'segnalazione_problema') {
      deleteSegnalazioneMutation.mutate(notifica.id);
    }
  };
  // Funzione per ottenere emoji e colori basati sul tipo di notifica
  const getNotificaStyle = (tipo: string) => {
    switch (tipo) {
      case 'voto_comune':
        return {
          emoji: '🗳️',
          bgColor: 'bg-blue-50 border-blue-200',
          textColor: 'text-blue-900',
          accentColor: 'text-blue-600'
        };
      case 'demos':
        return {
          emoji: '📢',
          bgColor: 'bg-pink-50 border-pink-200',
          textColor: 'text-pink-900',
          accentColor: 'text-pink-600'
        };
      case 'comunale':
        return {
          emoji: '🏛️',
          bgColor: 'bg-green-50 border-green-200',
          textColor: 'text-green-900',
          accentColor: 'text-green-600'
        };
      case 'segnalazione_problema':
        return {
          emoji: '⚠️',
          bgColor: 'bg-orange-50 border-orange-200',
          textColor: 'text-orange-900',
          accentColor: 'text-orange-600'
        };
      case 'avvistamento':
        // Determina l'emoji in base al tipo_avvistamento (usa le stesse emoji della pagina avvistamenti)
        const tipoAvvistamento = notifica.tipo_avvistamento?.toLowerCase() || '';
        let emoji = '🐺'; // Default: lupo (come nella pagina avvistamenti)
        if (tipoAvvistamento.includes('cinghiale') || tipoAvvistamento.includes('cinghiali')) {
          emoji = '🐗'; // Cinghiale (come nella pagina avvistamenti)
        } else if (tipoAvvistamento.includes('volpe') || tipoAvvistamento.includes('volpi')) {
          emoji = '🦊'; // Volpe (come nella pagina avvistamenti)
        } else if (tipoAvvistamento.includes('lupo') || tipoAvvistamento.includes('lupi')) {
          emoji = '🐺'; // Lupo (come nella pagina avvistamenti)
        }
        return {
          emoji: emoji,
          bgColor: 'bg-amber-50 border-amber-200',
          textColor: 'text-amber-900',
          accentColor: 'text-amber-600'
        };
      default:
        return {
          emoji: '📬',
          bgColor: 'bg-gray-50 border-gray-200',
          textColor: 'text-gray-900',
          accentColor: 'text-gray-600'
        };
    }
  };

  const style = getNotificaStyle(notifica.tipo_notifica || 'default');

  return (
    <div
      className={`p-4 rounded-lg border-2 ${style.bgColor} ${style.textColor} shadow-sm hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            {/* Mostra avatar del politico per voti comuni, altrimenti emoji */}
            {notifica.tipo_notifica === 'voto_comune' && notifica.politico_avatar_config ? (
              <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border-2 border-blue-300">
                <CustomAvatar 
                  config={typeof notifica.politico_avatar_config === 'string' 
                    ? JSON.parse(notifica.politico_avatar_config) 
                    : notifica.politico_avatar_config} 
                  size={40} 
                />
              </div>
            ) : (
              <span className="text-2xl">{style.emoji}</span>
            )}
            <h3 className={`font-semibold ${style.textColor}`}>
              {getNotificaTitle(notifica.titolo)}
            </h3>
          </div>
          
          {getNotificaMessage(notifica.messaggio) && (
            <p className={`${style.textColor} opacity-90 mb-3`}>
              {getNotificaMessage(notifica.messaggio)}
            </p>
          )}

          {/* Mostra "Segnalato da" per notifiche di avvistamento */}
          {notifica.tipo_notifica === 'avvistamento' && (notifica.utente_nome || notifica.utente_cognome) && (
            <p className={`${style.textColor} opacity-80 text-sm mb-3`}>
              Segnalato da {notifica.utente_nome || ''} {notifica.utente_cognome || ''}
            </p>
          )}

          {/* Informazioni aggiuntive per tutti i tipi di notifiche (escluso Demos, Avvistamento e Voto Comune che non hanno informazioni aggiuntive) */}
          {(notifica.tipo_notifica === 'comunicazione' || 
            notifica.tipo_notifica === 'comunale') && (
            <div className={`mb-3 p-3 rounded-lg ${style.bgColor} border ${style.textColor} opacity-80`}>
              {/* Mostra autore solo se presente */}
              {notifica.autore && (
                <div className={`text-sm ${style.textColor} mb-2`}>
                  <strong>Autore:</strong> {notifica.autore.nome} {notifica.autore.cognome} 
                  <span className={`ml-2 text-xs px-2 py-1 rounded ${style.bgColor} border`}>
                    {notifica.autore.ruolo}
                  </span>
                </div>
              )}
              
              {/* Mostra voto per comunicazioni (non per voto_comune) */}
              {notifica.voto && notifica.tipo_notifica === 'comunicazione' && (
                <div className={`text-sm ${style.textColor}`}>
                  <strong>Voto:</strong> 
                  <span className={`ml-2 px-2 py-1 rounded text-xs ${
                    notifica.voto === 'Favorevole' ? 'bg-green-100 text-green-800' :
                    notifica.voto === 'Contrario' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {notifica.voto}
                  </span>
                </div>
              )}
              
              {/* Mostra data se presente (non per Demos e Avvistamento, l'orario è mostrato in basso) */}
              {notifica.data && notifica.tipo_notifica !== 'demos' && notifica.tipo_notifica !== 'avvistamento' && (
                <div className={`text-sm ${style.textColor} mt-1`}>
                  <strong>Data:</strong> {new Date(notifica.data).toLocaleDateString('it-IT')}
                </div>
              )}
              
              {/* Mostra comune se presente (non per notifiche Demos e Avvistamento) */}
              {notifica.comune_residenza && notifica.tipo_notifica !== 'demos' && notifica.tipo_notifica !== 'avvistamento' && (
                <div className={`text-sm ${style.textColor} mt-1`}>
                  <strong>Comune:</strong> {notifica.comune_residenza}
                </div>
              )}
              
              {/* Mostra likes/dislikes solo per notifiche che non sono voto_comune (voto_comune mostra i pulsanti di voto) */}
              {notifica.tipo_notifica !== 'voto_comune' && 
               ((notifica.likes !== undefined && notifica.likes > 0) || 
                (notifica.dislikes !== undefined && notifica.dislikes > 0)) && (
                <div className={`text-sm ${style.textColor} mt-1 flex items-center gap-4`}>
                  {notifica.likes !== undefined && (
                    <span>👍 {notifica.likes}</span>
                  )}
                  {notifica.dislikes !== undefined && (
                    <span>👎 {notifica.dislikes}</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Informazioni dettagliate per segnalazioni */}
          {notifica.tipo_notifica === 'segnalazione_problema' && (
            <div className="mb-3 p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Tipo di segnalazione */}
                {notifica.tipo_segnalazione && (
                  <div className="text-sm">
                    <strong className="text-orange-800">Tipo:</strong>
                    <span className="ml-2 px-2 py-1 rounded text-xs bg-orange-100 text-orange-800">
                      {notifica.tipo_segnalazione === 'bug' ? '🐛 Bug' :
                       notifica.tipo_segnalazione === 'feature' ? '💡 Suggerimento' :
                       notifica.tipo_segnalazione === 'ui' ? '🎨 Interfaccia' :
                       notifica.tipo_segnalazione === 'performance' ? '⚡ Prestazioni' :
                       notifica.tipo_segnalazione === 'security' ? '🔒 Sicurezza' :
                       notifica.tipo_segnalazione === 'other' ? '❓ Altro' :
                       notifica.tipo_segnalazione}
                    </span>
                  </div>
                )}

                {/* Priorità */}
                {notifica.priorita && (
                  <div className="text-sm">
                    <strong className="text-orange-800">Priorità:</strong>
                    <span className={`ml-2 px-2 py-1 rounded text-xs ${
                      notifica.priorita === 'critical' ? 'bg-red-100 text-red-800' :
                      notifica.priorita === 'high' ? 'bg-orange-100 text-orange-800' :
                      notifica.priorita === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {notifica.priorita === 'critical' ? '🔴 Critica' :
                       notifica.priorita === 'high' ? '🟠 Alta' :
                       notifica.priorita === 'medium' ? '🟡 Media' :
                       notifica.priorita === 'low' ? '🟢 Bassa' :
                       notifica.priorita}
                    </span>
                  </div>
                )}

                {/* Browser */}
                {notifica.browser && (
                  <div className="text-sm">
                    <strong className="text-orange-800">Browser:</strong>
                    <span className="ml-2 text-gray-700">{notifica.browser}</span>
                  </div>
                )}

                {/* Dispositivo */}
                {notifica.dispositivo && (
                  <div className="text-sm">
                    <strong className="text-orange-800">Dispositivo:</strong>
                    <span className="ml-2 text-gray-700">{notifica.dispositivo}</span>
                  </div>
                )}
              </div>

              {/* Passaggi per riprodurre */}
              {notifica.passaggi && (
                <div className="mt-3 text-sm">
                  <strong className="text-orange-800 block mb-1">Passaggi per riprodurre:</strong>
                  <div className="bg-white p-2 rounded border text-gray-700 whitespace-pre-line">
                    {notifica.passaggi}
                  </div>
                </div>
              )}

              {/* Comportamento atteso vs effettivo */}
              {(notifica.comportamento_atteso || notifica.comportamento_effettivo) && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {notifica.comportamento_atteso && (
                    <div>
                      <strong className="text-green-800 block mb-1">✅ Comportamento atteso:</strong>
                      <div className="bg-green-50 p-2 rounded border text-gray-700">
                        {notifica.comportamento_atteso}
                      </div>
                    </div>
                  )}
                  {notifica.comportamento_effettivo && (
                    <div>
                      <strong className="text-red-800 block mb-1">❌ Comportamento effettivo:</strong>
                      <div className="bg-red-50 p-2 rounded border text-gray-700">
                        {notifica.comportamento_effettivo}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          <div className={`flex items-center gap-4 text-sm ${style.textColor} opacity-70`}>
            <span>
              {notifica.tipo_notifica === 'demos' && notifica.data ? (
                new Date(notifica.data).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
              ) : (
                formatDate(notifica.data || notifica.created_at || notifica.data_creazione || '')
              )}
            </span>
          </div>

          {/* Pulsanti like/dislike per comunicazioni e voto_comune */}
          {(notifica.tipo_notifica === 'comunicazione' || notifica.tipo_notifica === 'voto_comune') && user?.id && (
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
        
        {/* Pulsante di cancellazione per segnalazioni (solo per admin) */}
        {notifica.tipo_notifica === 'segnalazione_problema' && (user?.ruolo === "AD" || user?.ruolo === "AD") && deleteSegnalazioneMutation && (
          <div className="ml-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  disabled={deleteSegnalazioneMutation.isPending}
                >
                  {deleteSegnalazioneMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-white">
                <AlertDialogHeader>
                  <AlertDialogTitle>Conferma cancellazione</AlertDialogTitle>
                  <AlertDialogDescription>
                    Sei sicuro di voler cancellare questa segnalazione? Questa azione non può essere annullata.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteSegnalazione}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Cancella
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
        
      </div>
    </div>
  );
};
