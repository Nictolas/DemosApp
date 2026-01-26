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

  // Formatta la data
  const formattaData = (dataString: string) => {
    const data = new Date(dataString);
    return data.toLocaleDateString('it-IT', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
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
        <h3>📅 Prossimo Evento</h3>
      </div>
      <div className="prossimo-evento-content">
        <h4>{evento.nome_evento}</h4>
        
        <div className="prossimo-evento-info">
          <p className="data">
            <strong>📆 Data:</strong> {formattaData(evento.giorno_inizio)}
          </p>
          
          {evento.orario_inizio && (
            <p className="orario">
              <strong>🕐 Orario:</strong> {evento.orario_inizio}
              {evento.orario_fine && ` - ${evento.orario_fine}`}
            </p>
          )}
          
          {evento.comune_evento && (
            <p className="luogo">
              <strong>📍 Luogo:</strong> {evento.comune_evento}
              {evento.provincia_evento && `, ${evento.provincia_evento}`}
              {evento.regione_evento && ` (${evento.regione_evento})`}
            </p>
          )}
          
          {evento.indirizzo_evento && (
            <p className="indirizzo">
              <strong>🏠 Indirizzo:</strong> {evento.indirizzo_evento}
            </p>
          )}
          
          {evento.organizzatore && (
            <p className="organizzatore">
              <strong>👤 Organizzatore:</strong> {evento.organizzatore}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProssimoEventoRiquadro;
