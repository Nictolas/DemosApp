import React, { useState, useEffect } from 'react';
import './UltimaNotificaRiquadro.css';
import { apiRequest } from '@/lib/queryClient';

const UltimaNotificaRiquadro = () => {
  const [notifica, setNotifica] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUltimaNotifica = async () => {
      try {
        console.log('🔍 UltimaNotificaRiquadro - Inizio fetch');
        
        // Ottieni il token dal localStorage
        const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || localStorage.getItem('authToken');
        
        if (!token) {
          console.log('⚠️ UltimaNotificaRiquadro - Token non trovato');
          setLoading(false);
          return;
        }
        
        console.log('🔍 UltimaNotificaRiquadro - Token trovato, effettuo richiesta');
        
        const response = await apiRequest('GET', '/api/notifiche/ultima');
        
        console.log('🔍 UltimaNotificaRiquadro - Risposta ricevuta:', {
          ok: response.ok,
          status: response.status,
          hasData: !!response.data
        });
        
        if (!response.ok) {
          throw new Error(`Errore HTTP: ${response.status}`);
        }

        const data = response.data;
        
        console.log('🔍 UltimaNotificaRiquadro - Dati parsati:', {
          success: data?.success,
          hasNotifica: !!data?.data
        });
        
        if (data.success && data.data) {
          console.log('✅ UltimaNotificaRiquadro - Notifica trovata:', data.data.titolo);
          setNotifica(data.data);
        } else {
          console.log('ℹ️ UltimaNotificaRiquadro - Nessuna notifica disponibile');
          setNotifica(null);
        }
      } catch (err) {
        console.error('❌ UltimaNotificaRiquadro - Errore:', err);
        setError('Errore nel caricamento della notifica');
      } finally {
        setLoading(false);
      }
    };

    fetchUltimaNotifica();
  }, []);

  if (loading) {
    return (
      <div className="ultima-notifica-riquadro loading">
        <p>Caricamento ultima notifica...</p>
      </div>
    );
  }

  if (error) {
    console.error('❌ UltimaNotificaRiquadro - Errore:', error);
    return null; // Non mostrare nulla se c'è un errore
  }

  if (!notifica) {
    console.log('ℹ️ UltimaNotificaRiquadro - Nessuna notifica disponibile, non mostro il riquadro');
    return null; // Non mostrare nulla se non c'è una notifica
  }

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

  const titoloOriginale = notifica.titolo || 'Notifica';
  const titolo = formattaTitoloCompatto(titoloOriginale);
  const messaggio = notifica.messaggio || notifica.testo || '';
  const messaggioBreve = messaggio.length > 100 ? `${messaggio.substring(0, 100)}...` : messaggio;

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
        <h3>🔔 Ultima Notifica</h3>
      </div>
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
    </div>
  );
};

export default UltimaNotificaRiquadro;
