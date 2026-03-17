import React, { useState, useEffect } from 'react';
import './ProssimaIniziativaRiquadro.css';

const ProssimaIniziativaRiquadro = () => {
  const [iniziativa, setIniziativa] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProssimaIniziativa = async () => {
      try {
        // Ottieni il token dal localStorage o dal tuo sistema di autenticazione
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        
        if (!token) {
          console.log('Token non trovato, riquadro iniziativa non caricato');
          setLoading(false);
          return;
        }
        
        const response = await fetch('https://www.demos.community/api/iniziative-popolari/prossima', {
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
          setIniziativa(data.data);
        } else {
          setIniziativa(null);
        }
      } catch (err) {
        console.error('Errore nel recupero iniziativa più rilevante:', err);
        setError('Errore nel caricamento dell\'iniziativa');
      } finally {
        setLoading(false);
      }
    };

    fetchProssimaIniziativa();
  }, []);

  if (loading) {
    return (
      <div className="prossima-iniziativa-riquadro loading">
        <p>Caricamento iniziativa...</p>
      </div>
    );
  }

  if (error || !iniziativa) {
    return null; // Non mostrare nulla se non c'è un'iniziativa o c'è un errore
  }

  // Formatta la data
  const formattaData = (dataString) => {
    if (!dataString) return 'Data non disponibile';
    const data = new Date(dataString);
    return data.toLocaleDateString('it-IT', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Formatta il numero di firme
  const formattaFirme = (firme) => {
    if (!firme || firme === 0) return '0';
    if (firme >= 1000000) {
      return `${(firme / 1000000).toFixed(1)}M`;
    }
    if (firme >= 1000) {
      return `${(firme / 1000).toFixed(1)}K`;
    }
    return firme.toLocaleString('it-IT');
  };

  const handleClick = () => {
    // Naviga alla pagina iniziative popolari
    if (typeof window !== 'undefined') {
      window.location.href = '/iniziative-popolari';
    }
  };

  const nomeIniziativa = iniziativa.nome || iniziativa.titolo || 'Iniziativa Popolare';
  const firme = iniziativa.firme_raccolte || iniziativa.firme || 0;
  const emoji = iniziativa.emoji || '📋';

  return (
    <div 
      className="prossima-iniziativa-riquadro clickable"
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
      <div className="prossima-iniziativa-header">
        <h3>{emoji} Iniziativa Popolare</h3>
      </div>
      <div className="prossima-iniziativa-content">
        <h4>{nomeIniziativa}</h4>
        
        <div className="prossima-iniziativa-info">
          {iniziativa.data_fine && (
            <p className="scadenza">
              <strong>⏰ Scadenza:</strong> {formattaData(iniziativa.data_fine)}
            </p>
          )}
          
          <p className="firme">
            <strong>✍️ Firme raccolte:</strong> {formattaFirme(firme)}
          </p>
          
          {iniziativa.descrizione && (
            <p className="descrizione">
              {iniziativa.descrizione.length > 150 
                ? `${iniziativa.descrizione.substring(0, 150)}...` 
                : iniziativa.descrizione}
            </p>
          )}
        </div>
        
        <div className="vedi-tutte-iniziative-btn">
          Vedi tutte le iniziative →
        </div>
      </div>
    </div>
  );
};

export default ProssimaIniziativaRiquadro;
