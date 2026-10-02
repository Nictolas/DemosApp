import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, ThumbsUp, ThumbsDown, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Vote, CheckCircle2, XCircle, MinusCircle, Users, Info, BookOpen, TrendingUp, TrendingDown, RefreshCw, Sparkles, AlertCircle, Calendar } from "lucide-react";

export const NotificaItem: React.FC<NotificaItemProps> = ({
  notifica,
  deleteSegnalazioneMutation,
  initialReazioni,
  initialUserReaction,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const hasBatchData = initialReazioni !== undefined || initialUserReaction !== undefined;
  const [userReaction, setUserReaction] = useState<string | null>(initialUserReaction ?? null);
  const [likes, setLikes] = useState(initialReazioni?.likes ?? notifica.likes ?? 0);
  const [dislikes, setDislikes] = useState(initialReazioni?.dislikes ?? notifica.dislikes ?? 0);

  const shouldLoadReactions = Boolean((notifica.tipo_notifica === 'voto_comune' || notifica.tipo_notifica === 'voto_parlamento' || notifica.tipo_notifica === 'comunicazione') && user?.id);
  const usePerItemQueries = shouldLoadReactions && !hasBatchData;

  const { data: reactionsData } = useQuery({
    queryKey: ['reazioni', notifica.id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/reazioni-comunicazioni/${notifica.id}`);
      return response?.data || { likes: 0, dislikes: 0 };
    },
    enabled: usePerItemQueries,
    refetchOnWindowFocus: false
  });

  const { data: userReactionData } = useQuery({
    queryKey: ['reazione-utente', user?.id, notifica.id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/reazioni-comunicazioni/user/${user?.id}/${notifica.id}`);
      return response?.data || null;
    },
    enabled: usePerItemQueries,
    refetchOnWindowFocus: false
  });

  useEffect(() => {
    if (hasBatchData) {
      if (initialReazioni != null) {
        setLikes(initialReazioni.likes ?? 0);
        setDislikes(initialReazioni.dislikes ?? 0);
      }
      if (initialUserReaction !== undefined) {
        setUserReaction(initialUserReaction);
      }
    }
  }, [hasBatchData, initialReazioni, initialUserReaction]);

  useEffect(() => {
    if (!hasBatchData && reactionsData) {
      setLikes(reactionsData.likes || 0);
      setDislikes(reactionsData.dislikes || 0);
    }
  }, [hasBatchData, reactionsData]);

  useEffect(() => {
    if (!hasBatchData && userReactionData !== undefined) {
      setUserReaction(userReactionData);
    }
  }, [hasBatchData, userReactionData]);

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
      queryClient.invalidateQueries({ queryKey: ['reazioni', notifica.id] });
      queryClient.invalidateQueries({ queryKey: ['reazione-utente', user?.id, notifica.id] });
      queryClient.invalidateQueries({ queryKey: ['reazioni-batch'] });
      queryClient.invalidateQueries({ queryKey: ['reazioni-user-batch'] });
      
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
    if (!user?.id || (notifica.tipo_notifica !== 'comunicazione' && notifica.tipo_notifica !== 'voto_comune' && notifica.tipo_notifica !== 'voto_parlamento')) return;
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
      case 'voto_parlamento':
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

  // Debug: log del tipo_notifica per verificare
  if (notifica.politico === 'Giuseppe Conte' || notifica.titolo?.includes('Giuseppe Conte')) {
    console.log('🔍 DEBUG NotificaItem - Giuseppe Conte:', {
      tipo_notifica: notifica.tipo_notifica,
      politico_avatar_config: notifica.politico_avatar_config ? 'Presente' : 'Mancante',
      politico_nome: notifica.politico_nome,
      politico_cognome: notifica.politico_cognome,
      politico: notifica.politico
    });
  }
  
  // Forza il tipo per voto_parlamento se mancante (fallback)
  const tipoNotifica = notifica.tipo_notifica || 
    (notifica.tabella_origine === 'notifiche_voti_parlamento' ? 'voto_parlamento' : 'default');
  
  const style = getNotificaStyle(tipoNotifica);
  const { toast } = useToast();
  const [dettagliVotazione, setDettagliVotazione] = useState<any>(null);
  const [loadingDettagli, setLoadingDettagli] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Funzione helper per formattare il titolo in modo compatto
  const formattaTitoloCompatto = (titolo: string): string => {
    if (!titolo) return titolo;
    
    // Pattern per "Disegno di legge n. XXXX"
    const patternDDL = /disegno\s+di\s+legge\s+n\.?\s*(\d+)/i;
    const matchDDL = titolo.match(patternDDL);
    
    if (matchDDL) {
      const numero = matchDDL[1];
      return `DDL ${numero}`;
    }
    
    // Pattern per "DDL XXXX" (già formato)
    const patternDDLGià = /^DDL\s+(\d+)/i;
    if (titolo.match(patternDDLGià)) {
      return titolo.match(patternDDLGià)?.[0] || titolo;
    }
    
    // Pattern per "Decreto-legge n. XXXX" o "DL n. XXXX"
    const patternDL = /(?:decreto\s*[-]?\s*legge|DL|D\.L\.)\s+n\.?\s*(\d+)/i;
    const matchDL = titolo.match(patternDL);
    if (matchDL) {
      const numero = matchDL[1];
      return `DL ${numero}`;
    }
    
    // Pattern per "Mozione n. XXXX"
    const patternMozione = /mozione\s+n\.?\s*(\d+)/i;
    const matchMozione = titolo.match(patternMozione);
    if (matchMozione) {
      const numero = matchMozione[1];
      return `Mozione ${numero}`;
    }
    
    return titolo;
  };

  // Funzione helper per verificare se una data è un riferimento a una legge/decreto (non una scadenza)
  const isRiferimentoLegge = (testoPrimaData: string): boolean => {
    const testoLower = testoPrimaData.toLowerCase();
    // Parole che indicano un riferimento normativo (non una scadenza)
    const riferimentiNormativi = [
      'legge', 'decreto', 'dl', 'ddl', 'd.l.', 'd.d.l.', 'decreto-legge',
      'decreto legge', 'legge n.', 'legge numero', 'd.lgs.', 'd.p.r.',
      'del decreto', 'della legge', 'dell\'articolo', 'dell\'art.',
      'articolo', 'art.', 'comma', 'alinea', 'lettera'
    ];
    
    // Controlla se nel testo prima della data c'è un riferimento normativo
    return riferimentiNormativi.some(rif => {
      // Cerca la parola seguita eventualmente da "n.", "numero", o direttamente dalla data
      const pattern = new RegExp(`\\b${rif}\\s*(?:n\\.?|numero|del|della|dell')?\\s*$`, 'i');
      return pattern.test(testoPrimaData);
    });
  };

  // Funzione helper per rilevare date nel testo e verificare se sono passate (solo scadenze, non riferimenti a leggi)
  const rilevaScadenzePassate = (testo: string): Array<{ data: string; testo: string; passata: boolean }> => {
    const scadenze: Array<{ data: string; testo: string; passata: boolean }> = [];
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    
    const patternDate = /(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})/gi;
    const patternDateSlash = /(\d{1,2})\/(\d{1,2})\/(\d{4})/g;
    const patternDateISO = /(\d{4})-(\d{1,2})-(\d{1,2})/g;
    
    const mesi: { [key: string]: number } = {
      'gennaio': 1, 'febbraio': 2, 'marzo': 3, 'aprile': 4, 'maggio': 5, 'giugno': 6,
      'luglio': 7, 'agosto': 8, 'settembre': 9, 'ottobre': 10, 'novembre': 11, 'dicembre': 12
    };
    
    let match;
    while ((match = patternDate.exec(testo)) !== null) {
      const giorno = parseInt(match[1]);
      const mese = mesi[match[2].toLowerCase()];
      const anno = parseInt(match[3]);
      const data = new Date(anno, mese - 1, giorno);
      data.setHours(0, 0, 0, 0);
      
      const inizioMatch = Math.max(0, match.index - 100);
      const testoPrimaData = testo.substring(inizioMatch, match.index);
      
      // Se è un riferimento a una legge/decreto, salta questa data
      if (isRiferimentoLegge(testoPrimaData)) {
        continue;
      }
      
      const fineMatch = Math.min(testo.length, match.index + match[0].length + 50);
      const contesto = testo.substring(inizioMatch, fineMatch);
      
      if (data < oggi) {
        scadenze.push({
          data: match[0],
          testo: contesto,
          passata: true
        });
      }
    }
    
    while ((match = patternDateSlash.exec(testo)) !== null) {
      const giorno = parseInt(match[1]);
      const mese = parseInt(match[2]);
      const anno = parseInt(match[3]);
      const data = new Date(anno, mese - 1, giorno);
      data.setHours(0, 0, 0, 0);
      
      const inizioMatch = Math.max(0, match.index - 100);
      const testoPrimaData = testo.substring(inizioMatch, match.index);
      
      // Se è un riferimento a una legge/decreto, salta questa data
      if (isRiferimentoLegge(testoPrimaData)) {
        continue;
      }
      
      const fineMatch = Math.min(testo.length, match.index + match[0].length + 50);
      const contesto = testo.substring(inizioMatch, fineMatch);
      
      if (data < oggi) {
        scadenze.push({
          data: match[0],
          testo: contesto,
          passata: true
        });
      }
    }
    
    while ((match = patternDateISO.exec(testo)) !== null) {
      const anno = parseInt(match[1]);
      const mese = parseInt(match[2]);
      const giorno = parseInt(match[3]);
      const data = new Date(anno, mese - 1, giorno);
      data.setHours(0, 0, 0, 0);
      
      const inizioMatch = Math.max(0, match.index - 100);
      const testoPrimaData = testo.substring(inizioMatch, match.index);
      
      // Se è un riferimento a una legge/decreto, salta questa data
      if (isRiferimentoLegge(testoPrimaData)) {
        continue;
      }
      
      const fineMatch = Math.min(testo.length, match.index + match[0].length + 50);
      const contesto = testo.substring(inizioMatch, fineMatch);
      
      if (data < oggi) {
        scadenze.push({
          data: match[0],
          testo: contesto,
          passata: true
        });
      }
    }
    
    return scadenze;
  };

  const renderTestoConScadenze = (testo: string, scadenze: Array<{ data: string; passata: boolean }>, evidenziaFreccia = false): React.ReactNode[] => {
    const datePassate = scadenze.filter(s => s.passata).map(s => s.data);
    const escapedDates = datePassate.map(data => data.replace(/[.*+?^$()|[\]\\]/g, '\\  // Handler per aprire il dialog con i dettagli della votazione
'));
    const patternParts = [...escapedDates, ...(evidenziaFreccia ? ['→'] : [])];
    const tokens = patternParts.length > 0 ? testo.split(new RegExp(`(${patternParts.join('|')})`, 'gi')) : [testo];

    return tokens.map((token, index) => {
      if (evidenziaFreccia && token === '→') {
        return <span key={index} className="text-blue-600 font-semibold">→</span>;
      }
      if (datePassate.some(data => data.toLowerCase() === token.toLowerCase())) {
        return (
          <span key={index} className="bg-red-200 text-red-900 font-semibold px-1 rounded">
            {token} ⚠️ (scadenza passata)
          </span>
        );
      }
      return <React.Fragment key={index}>{token}</React.Fragment>;
    });
  };
  // Handler per aprire il dialog con i dettagli della votazione
  const handleNotificaClick = async () => {
    if (tipoNotifica === 'voto_parlamento' && notifica.uri_votazione) {
      setDialogOpen(true);
      setLoadingDettagli(true);
      
      try {
        const encodedUri = encodeURIComponent(notifica.uri_votazione);
        const response = await apiRequest("GET", `/api/voti-politici/dettagli/${encodedUri}`);
        
        if (!response.ok) {
          throw new Error("Errore nel recupero dei dettagli");
        }
        
        const result = await response.json();
        setDettagliVotazione(result.data);
      } catch (error) {
        console.error("Errore nel caricamento dettagli:", error);
        toast({
          title: "Errore",
          description: "Impossibile caricare i dettagli della votazione",
          variant: "destructive",
        });
        setDialogOpen(false);
      } finally {
        setLoadingDettagli(false);
      }
    }
  };

  // Funzioni helper per formattazione (copiate da VotiParlamento)
  const formatDate = (date: string | null) => {
    if (!date) return "N/A";
    try {
      return new Date(date).toLocaleDateString('it-IT', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return date;
    }
  };

  const getCameraColor = (camera: string) => {
    return camera === 'Senato' ? 'bg-red-100 text-red-800 border-red-300' : 'bg-blue-100 text-blue-800 border-blue-300';
  };

  const getEsitoColor = (esito: string | null) => {
    if (!esito) return '';
    if (esito.toLowerCase().includes('approvato') || esito.toLowerCase().includes('favorevole')) {
      return 'bg-green-100 text-green-800 border-green-300';
    }
    if (esito.toLowerCase().includes('non approvato') || esito.toLowerCase().includes('contrario')) {
      return 'bg-red-100 text-red-800 border-red-300';
    }
    return '';
  };

  const handleRegenerateAnalysis = async () => {
    if (!notifica.uri_votazione) return;
    
    setLoadingDettagli(true);
    try {
      const encodedUri = encodeURIComponent(notifica.uri_votazione);
      const response = await apiRequest("GET", `/api/voti-politici/dettagli/${encodedUri}?force=true`);
      
      if (!response.ok) {
        throw new Error("Errore nella rigenerazione");
      }
      
      const result = await response.json();
      setDettagliVotazione(result.data);
      
      toast({
        title: "Analisi rigenerata",
        description: "L'analisi della legge è stata rigenerata con successo",
      });
    } catch (error) {
      console.error("Errore nella rigenerazione:", error);
      toast({
        title: "Errore",
        description: "Impossibile rigenerare l'analisi della legge",
        variant: "destructive",
      });
    } finally {
      setLoadingDettagli(false);
    }
  };

  return (
    <>
    <div
      className={`p-4 rounded-lg border-2 ${style.bgColor} ${style.textColor} shadow-sm hover:shadow-md transition-shadow ${tipoNotifica === 'voto_parlamento' && notifica.uri_votazione ? 'cursor-pointer' : ''}`}
      onClick={tipoNotifica === 'voto_parlamento' && notifica.uri_votazione ? handleNotificaClick : undefined}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            {/* Mostra avatar del politico per voti comuni e parlamentari, altrimenti emoji */}
            {(tipoNotifica === 'voto_comune' || tipoNotifica === 'voto_parlamento') && notifica.politico_avatar_config ? (
              <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border-2 border-blue-300">
                <CustomAvatar 
                  config={(() => {
                    try {
                      if (typeof notifica.politico_avatar_config === 'string') {
                        return JSON.parse(notifica.politico_avatar_config);
                      }
                      return notifica.politico_avatar_config;
                    } catch (e) {
                      console.error('Errore parsing avatar_config:', e);
                      return null;
                    }
                  })()} 
                  size={40} 
                />
              </div>
            ) : (
              <span className="text-2xl">{style.emoji}</span>
            )}
            {(() => {
              const titolo = getNotificaTitle(notifica.titolo);
              const titoloString = String(titolo || 'Notifica').trim() || 'Notifica';

              return (
                <h3 className={`font-semibold ${style.textColor}`}>
                  {titoloString}
                </h3>
              );
            })()}
          </div>
          
          {getNotificaMessage(notifica.messaggio) && (() => {
            const msg = getNotificaMessage(notifica.messaggio);
            return (
              <p className={`${style.textColor} opacity-90 mb-3`}>
                {msg}
              </p>
            );
          })()}

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
          
          {/* Pulsanti like/dislike per voto_comune e voto_parlamento (sopra l'orario) */}
          {(notifica.tipo_notifica === 'voto_comune' || notifica.tipo_notifica === 'voto_parlamento') && user?.id && (
            <div className="mb-3 flex items-center gap-2">
              <Button
                variant={userReaction === 'like' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleReaction('like')}
                disabled={reactionMutation.isPending}
                className="flex items-center gap-1"
              >
                <ThumbsUp className="h-4 w-4" />
                {Number(likes) || 0}
              </Button>
              <Button
                variant={userReaction === 'dislike' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleReaction('dislike')}
                disabled={reactionMutation.isPending}
                className="flex items-center gap-1"
              >
                <ThumbsDown className="h-4 w-4" />
                {Number(dislikes) || 0}
              </Button>
            </div>
          )}

          <div className={`flex items-center gap-4 text-sm ${style.textColor} opacity-70`}>
            <span>
              {formatDate(notifica.data_creazione || notifica.created_at || notifica.data || '')}
            </span>
          </div>

          {/* Pulsanti like/dislike per comunicazioni (sotto l'orario) */}
          {notifica.tipo_notifica === 'comunicazione' && user?.id && (
            <div className="mt-4 flex items-center gap-2">
              <Button
                variant={userReaction === 'like' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleReaction('like')}
                disabled={reactionMutation.isPending}
                className="flex items-center gap-1"
              >
                <ThumbsUp className="h-4 w-4" />
                {Number(likes) || 0}
              </Button>
              <Button
                variant={userReaction === 'dislike' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleReaction('dislike')}
                disabled={reactionMutation.isPending}
                className="flex items-center gap-1"
              >
                <ThumbsDown className="h-4 w-4" />
                {Number(dislikes) || 0}
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

    {/* Dialog Dettagli Votazione - Solo per notifiche voto_parlamento */}
    {tipoNotifica === 'voto_parlamento' && (
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="!max-w-[100vw] !w-[100vw] !h-[100vh] !max-h-[100vh] !m-0 !rounded-none !left-0 !top-0 !translate-x-0 !translate-y-0 overflow-hidden flex flex-col p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Vote className="h-6 w-6 text-green-600" />
              {formattaTitoloCompatto(dettagliVotazione?.titolo || notifica.titolo || "Dettagli Votazione")}
            </DialogTitle>
            <DialogDescription>
              Informazioni complete sulla votazione parlamentare
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <div className="pr-4">
            {loadingDettagli ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-green-600" />
                <p className="ml-4 text-muted-foreground">Caricamento dettagli...</p>
              </div>
            ) : dettagliVotazione ? (
              <div className="space-y-6 pb-4">
                {/* Analisi Legge - Mostra subito in alto */}
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <Sparkles className="h-6 w-6 text-purple-600" />
                      Analisi della Legge
                    </h2>
                    <Button
                      onClick={handleRegenerateAnalysis}
                      disabled={loadingDettagli}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      {loadingDettagli ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Rigenerazione...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4" />
                          Rigenera Analisi
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {/* Spiegazione Generale */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-blue-600" />
                        Spiegazione Generale
                      </h3>
                      {/* Data di approvazione */}
                      {dettagliVotazione.data_votazione && (
                        <Badge variant="outline" className="text-xs">
                          <Calendar className="h-3 w-3 mr-1" />
                          Approvata il {new Date(dettagliVotazione.data_votazione).toLocaleDateString('it-IT', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </Badge>
                      )}
                    </div>
                    <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-5 min-h-[120px]">
                      {dettagliVotazione.analisi_legge?.spiegazione_generale ? (
                        <>
                          <div className="text-sm text-blue-900 leading-relaxed">
                            {(() => {
                              const testo = dettagliVotazione.analisi_legge.spiegazione_generale;
                              const linee = testo.split('\n');
                              const risultato: JSX.Element[] = [];
                              let sezioneCorrente = '';
                              
                              linee.forEach((line, i) => {
                                const lineaTrim = line.trim();
                                if (!lineaTrim) return;
                                
                                // Rileva sezioni (COSA È, COSA FA, MISURE PREVISTE)
                                if (lineaTrim.match(/^(COSA È|COSA FA|MISURE PREVISTE):?$/i)) {
                                  sezioneCorrente = lineaTrim.toUpperCase();
                                  risultato.push(
                                    <h4 key={`header-${i}`} className="font-bold text-blue-800 mt-4 mb-2 first:mt-0">
                                      {lineaTrim.replace(/[:?]$/, '')}
                                    </h4>
                                  );
                                  return;
                                }
                                
                                // Rileva scadenze passate
                                const scadenze = rilevaScadenzePassate(lineaTrim);
                                const haScadenzePassate = scadenze.some(s => s.passata);
                                
                                // Formattazione per misure previste (formato compatto con →)
                                if (sezioneCorrente === 'MISURE PREVISTE' && lineaTrim.startsWith('•')) {
                                  risultato.push(
                                    <div key={i} className="mb-1.5 ml-4">
                                      {renderTestoConScadenze(lineaTrim, scadenze, true)}
                                    </div>
                                  );
                                  return;
                                }
                                
                                // Formattazione normale per altre sezioni
                                if (haScadenzePassate) {
                                  risultato.push(
                                    <p key={i} className="mb-1.5">
                                      {renderTestoConScadenze(lineaTrim, scadenze)}
                                    </p>
                                  );
                                } else if (lineaTrim.startsWith('•')) {
                                  risultato.push(
                                    <p key={i} className="mb-1.5 ml-4">{lineaTrim}</p>
                                  );
                                } else {
                                  risultato.push(
                                    <p key={i} className="mb-1.5">{lineaTrim}</p>
                                  );
                                }
                              });
                              
                              return risultato;
                            })()}
                          </div>
                          {dettagliVotazione.analisi_legge.numero_legge && (
                            <p className="text-xs text-blue-700 mt-3 font-semibold">
                              Legge n. {dettagliVotazione.analisi_legge.numero_legge}
                              {dettagliVotazione.analisi_legge.tipo_atto && ` - ${dettagliVotazione.analisi_legge.tipo_atto}`}
                            </p>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center justify-center h-full min-h-[80px]">
                          <p className="text-sm text-blue-700 italic">
                            {loadingDettagli ? (
                              <span className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Caricamento analisi...
                              </span>
                            ) : (
                              "Analisi in generazione. Ricarica la pagina tra qualche secondo."
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Effetti Positivi e Negativi */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Effetti Positivi */}
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                        Effetti Positivi
                      </h3>
                      <div className="bg-green-50 border-2 border-green-300 rounded-lg p-5 min-h-[200px]">
                        {dettagliVotazione.analisi_legge?.effetti_positivi ? (
                          <div className="text-sm text-green-900 leading-relaxed">
                            {dettagliVotazione.analisi_legge.effetti_positivi.split('\n').map((line, i) => {
                              const lineaTrim = line.trim();
                              if (!lineaTrim) return null;
                              
                              // Supporta formato ✓ o - o • o numeri
                              if (lineaTrim.match(/^[✓•-]\s/) || lineaTrim.match(/^\d+[\.)]\s/)) {
                                const testo = lineaTrim.replace(/^[✓•-]\s/, '').replace(/^\d+[\.)]\s/, '');
                                return (
                                  <div key={i} className="mb-1.5 flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                    <span>{testo}</span>
                                  </div>
                                );
                              }
                              // Se inizia già con ✓, mostra direttamente
                              if (lineaTrim.startsWith('✓')) {
                                return (
                                  <div key={i} className="mb-1.5 flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                    <span>{lineaTrim.substring(1).trim()}</span>
                                  </div>
                                );
                              }
                              return <p key={i} className="mb-1.5">{lineaTrim}</p>;
                            })}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full min-h-[150px]">
                            <p className="text-sm text-green-700 italic text-center">
                              {loadingDettagli ? (
                                <span className="flex items-center gap-2">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Caricamento...
                                </span>
                              ) : (
                                "Analisi in generazione. Ricarica tra qualche secondo."
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Effetti Negativi */}
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <TrendingDown className="h-5 w-5 text-red-600" />
                        Effetti Negativi
                      </h3>
                      <div className="bg-red-50 border-2 border-red-300 rounded-lg p-5 min-h-[200px]">
                        {dettagliVotazione.analisi_legge?.effetti_negativi ? (
                          <div className="text-sm text-red-900 leading-relaxed">
                            {dettagliVotazione.analisi_legge.effetti_negativi.split('\n').map((line, i) => {
                              const lineaTrim = line.trim();
                              if (!lineaTrim) return null;
                              
                              // Supporta formato ✗ o - o • o numeri
                              if (lineaTrim.match(/^[✗•-]\s/) || lineaTrim.match(/^\d+[\.)]\s/)) {
                                const testo = lineaTrim.replace(/^[✗•-]\s/, '').replace(/^\d+[\.)]\s/, '');
                                return (
                                  <div key={i} className="mb-1.5 flex items-start gap-2">
                                    <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                                    <span>{testo}</span>
                                  </div>
                                );
                              }
                              // Se inizia già con ✗, mostra direttamente
                              if (lineaTrim.startsWith('✗')) {
                                return (
                                  <div key={i} className="mb-1.5 flex items-start gap-2">
                                    <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                                    <span>{lineaTrim.substring(1).trim()}</span>
                                  </div>
                                );
                              }
                              return <p key={i} className="mb-1.5">{lineaTrim}</p>;
                            })}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full min-h-[150px]">
                            <p className="text-sm text-red-700 italic text-center">
                              {loadingDettagli ? (
                                <span className="flex items-center gap-2">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Caricamento...
                                </span>
                              ) : (
                                "Analisi in generazione. Ricarica tra qualche secondo."
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-center">
                  Impossibile caricare i dettagli della votazione
                </p>
              </div>
            )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    )}
    </>
  );
};
