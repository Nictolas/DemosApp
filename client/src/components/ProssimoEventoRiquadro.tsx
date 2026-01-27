import React, { useState, useEffect } from 'react';
import './ProssimoEventoRiquadro.css';
import { apiRequest } from '@/lib/queryClient';

const ProssimoEventoRiquadro = () => {
  const [evento, setEvento] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProssimoEvento = async () => {
      try {
        console.log('🔍 ProssimoEventoRiquadro - Inizio fetch');
        
        // Ottieni il token dal localStorage
        const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || localStorage.getItem('authToken');
        
        if (!token) {
          console.log('⚠️ ProssimoEventoRiquadro - Token non trovato');
          setLoading(false);
          return;
        }
        
        console.log('🔍 ProssimoEventoRiquadro - Token trovato, effettuo richiesta');
        
        const response = await apiRequest('GET', '/api/eventi/prossimo');
        
        console.log('🔍 ProssimoEventoRiquadro - Risposta ricevuta:', {
          ok: response.ok,
          status: response.status,
          hasData: !!response.data
        });
        
        if (!response.ok) {
          throw new Error(`Errore HTTP: ${response.status}`);
        }

        const data = response.data;
        
        console.log('🔍 ProssimoEventoRiquadro - Dati parsati:', {
          success: data?.success,
          hasEvento: !!data?.data
        });
        
        if (data.success && data.data) {
          console.log('✅ ProssimoEventoRiquadro - Evento trovato:', data.data.nome_evento);
          setEvento(data.data);
        } else {
          console.log('ℹ️ ProssimoEventoRiquadro - Nessun evento disponibile');
          setEvento(null);
        }
      } catch (err) {
        console.error('❌ ProssimoEventoRiquadro - Errore:', err);
        setError('Errore nel caricamento dell\'evento');
      } finally {
        setLoading(false);
      }
    };

    fetchProssimoEvento();
  }, []);

  if (loading) {
    return (
      <div className="prossimo-evento-riquadro loading">
        <p>Caricamento prossimo evento...</p>
      </div>
    );
  }

  if (error) {
    console.error('❌ ProssimoEventoRiquadro - Errore:', error);
    return null; // Non mostrare nulla se c'è un errore
  }

  if (!evento) {
    console.log('ℹ️ ProssimoEventoRiquadro - Nessun evento disponibile, non mostro il riquadro');
    return null; // Non mostrare nulla se non c'è un evento
  }

  // Formatta la data in formato DD/MM/YYYY
  const formattaData = (dataString: string) => {
    const data = new Date(dataString);
    const giorno = String(data.getDate()).padStart(2, '0');
    const mese = String(data.getMonth() + 1).padStart(2, '0');
    const anno = data.getFullYear();
    return `${giorno}/${mese}/${anno}`;
  };

  // Formatta l'orario rimuovendo i secondi
  const formattaOrario = (orario: string) => {
    if (!orario) return '';
    // Se l'orario è in formato HH:MM:SS, rimuovi i secondi
    if (orario.includes(':') && orario.split(':').length === 3) {
      return orario.substring(0, 5); // Prende solo HH:MM
    }
    return orario;
  };

  const handleClick = () => {
    // Naviga alla pagina eventi
    if (typeof window !== 'undefined') {
      window.location.href = '/eventi';
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

  return (
    <div 
      className="prossimo-evento-riquadro clickable transition-transform"
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
      <div className="prossimo-evento-header">
        <h3>Prossimo Evento</h3>
      </div>
      <div className="prossimo-evento-content">
        <h4>{evento.nome_evento}</h4>
        
        <div className="prossimo-evento-info">
          {(evento.comune_evento || evento.indirizzo_evento) && (
            <p className="luogo-indirizzo">
              {evento.comune_evento}
              {evento.indirizzo_evento && ` - ${evento.indirizzo_evento}`}
            </p>
          )}
          <p className="data-orario">
            {formattaData(evento.giorno_inizio)}
            {evento.orario_inizio && (
              <span className="ml-2">
                {formattaOrario(evento.orario_inizio)}
                {evento.orario_fine && ` - ${formattaOrario(evento.orario_fine)}`}
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProssimoEventoRiquadro;
