import React from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import './UltimaNotificaRiquadro.css';
import { apiRequest } from '@/lib/queryClient';

const UltimaNotificaRiquadro = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') || localStorage.getItem('token') || localStorage.getItem('authToken') : null;
  const { data: notifica, isLoading: loading, isError } = useQuery({
    queryKey: ['menu-ultima-notifica'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/notifiche/ultima');
      if (!response.ok) throw new Error(`Errore HTTP: ${response.status}`);
      const data = response.data;
      return data.success && data.data ? data.data : null;
    },
    enabled: !!token,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const errorMsg = isError ? 'Errore nel caricamento della notifica' : null;

  // Funzione helper per formattare il titolo in modo compatto (stessa logica di NotificaItem.tsx)
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

  // Formatta la data in formato DD/MM/YYYY
  const formattaData = (dataString: string) => {
    if (!dataString) return '';
    const data = new Date(dataString);
    const giorno = String(data.getDate()).padStart(2, '0');
    const mese = String(data.getMonth() + 1).padStart(2, '0');
    const anno = data.getFullYear();
    return `${giorno}/${mese}/${anno}`;
  };

  // Formatta l'orario
  const formattaOrario = (dataString: string) => {
    if (!dataString) return '';
    const data = new Date(dataString);
    return data.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  };

  const handleClick = () => {
    // Naviga alla pagina notifiche
    if (typeof window !== 'undefined') {
      window.location.href = '/notifiche';
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.classList.add('scale-95', 'shadow-md');
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove('scale-95', 'shadow-md');
    handleClick();
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove('scale-95', 'shadow-md');
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.add('scale-95', 'shadow-md');
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.remove('scale-95', 'shadow-md');
    handleClick();
  };

  // Funzione per sostituire Favorevole/Contrario/Indeciso con emoji
  const sostituisciVotoConEmoji = (testo: string): string => {
    if (!testo) return testo;
    return testo
      .replace(/\bFavorevole\b/gi, '👍')
      .replace(/\bContrario\b/gi, '👎')
      .replace(/\bIndeciso\b/gi, '🤷');
  };

  // Solo il contenuto interno si aggiorna; riquadro e titolo sono sempre visibili
  const renderContent = () => {
    if (loading) {
      return (
        <div className="ultima-notifica-content ultima-notifica-content-loading">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-border" />
          <p>Caricamento...</p>
        </div>
      );
    }
    if (errorMsg) {
      return (
        <div className="ultima-notifica-content">
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
        </div>
      );
    }
    if (!notifica) {
      return (
        <div className="ultima-notifica-content">
          <p className="text-sm text-muted-foreground">Nessuna notifica recente.</p>
        </div>
      );
    }
    const titoloOriginale = notifica.titolo || 'Notifica';
    const titolo = formattaTitoloCompatto(titoloOriginale);
    const messaggio = notifica.messaggio || notifica.testo || '';
    const messaggioConEmoji = sostituisciVotoConEmoji(messaggio);
    const messaggioBreve = messaggioConEmoji.length > 100 ? `${messaggioConEmoji.substring(0, 100)}...` : messaggioConEmoji;

    return (
      <div className="ultima-notifica-content">
        <h4>{titolo}</h4>
        <div className="ultima-notifica-info">
          {notifica.data_creazione && (
            <p className="data-orario">
              {formattaData(notifica.data_creazione)}
              <span className="ml-2">{formattaOrario(notifica.data_creazione)}</span>
            </p>
          )}
          {messaggio && (
            <p className="messaggio">
              {messaggioBreve}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div 
      className="ultima-notifica-riquadro clickable transition-transform"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className="ultima-notifica-header">
        <h3>Ultima Notifica</h3>
      </div>
      {renderContent()}
    </div>
  );
};

export default UltimaNotificaRiquadro;
