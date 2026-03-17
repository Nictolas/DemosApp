import React, { useState, useEffect } from 'react';
import './ProssimoEventoRiquadro.css';

const ProssimoEventoRiquadro = () => {
  const [evento, setEvento] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProssimoEvento = async () => {
      try {
        // Ottieni il token dal localStorage o dal tuo sistema di autenticazione
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        
        if (!token) {
          console.log('Token non trovato, riquadro evento non caricato');
          setLoading(false);
          return;
        }
        
        const response = await fetch('https://www.demos.community/api/eventi/prossimo', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Errore HTTP: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success && data.data) {
          setEvento(data.data);
        } else {
          setEvento(null);
        }
      } catch (err) {
        console.error('Errore nel recupero prossimo evento:', err);
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

  if (error || !evento) {
    return null; // Non mostrare nulla se non c'è un evento o c'è un errore
  }

  // Formatta la data
  const formattaData = (dataString) => {
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

  return (
    <div 
      className="prossimo-evento-riquadro clickable"
      onClick={handleClick}
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
        <p className="tipologia">{evento.tipologia_evento}</p>
        
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
        
        <div className="vedi-tutti-eventi-btn">
          Vedi tutti gli eventi →
        </div>
      </div>
    </div>
  );
};

export default ProssimoEventoRiquadro;
