import React, { useState, useEffect } from 'react';
import './ProssimaIniziativaRiquadro.css';
import { apiRequest } from '@/lib/queryClient';

const ProssimaIniziativaRiquadro = () => {
  const [iniziativa, setIniziativa] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProssimaIniziativa = async () => {
      try {
        console.log('🔍 ProssimaIniziativaRiquadro - Inizio fetch');
        
        // Ottieni il token dal localStorage
        const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || localStorage.getItem('authToken');
        
        if (!token) {
          console.log('⚠️ ProssimaIniziativaRiquadro - Token non trovato');
          setLoading(false);
          return;
        }
        
        console.log('🔍 ProssimaIniziativaRiquadro - Token trovato, effettuo richiesta');
        
        const response = await apiRequest('GET', '/api/iniziative-popolari/prossima');
        
        console.log('🔍 ProssimaIniziativaRiquadro - Risposta ricevuta:', {
          ok: response.ok,
          status: response.status,
          hasData: !!response.data
        });
        
        if (!response.ok) {
          throw new Error(`Errore HTTP: ${response.status}`);
        }

        const data = response.data;
        
        console.log('🔍 ProssimaIniziativaRiquadro - Dati parsati:', {
          success: data?.success,
          hasIniziativa: !!data?.data
        });
        
        if (data.success && data.data) {
          console.log('✅ ProssimaIniziativaRiquadro - Iniziativa trovata:', data.data.nome || data.data.titolo);
          setIniziativa(data.data);
        } else {
          console.log('ℹ️ ProssimaIniziativaRiquadro - Nessuna iniziativa disponibile');
          setIniziativa(null);
        }
      } catch (err) {
        console.error('❌ ProssimaIniziativaRiquadro - Errore:', err);
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

  if (error) {
    console.error('❌ ProssimaIniziativaRiquadro - Errore:', error);
    return null; // Non mostrare nulla se c'è un errore
  }

  if (!iniziativa) {
    console.log('ℹ️ ProssimaIniziativaRiquadro - Nessuna iniziativa disponibile, non mostro il riquadro');
    return null; // Non mostrare nulla se non c'è un'iniziativa
  }

  // Formatta la data
  const formattaData = (dataString: string) => {
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
  const formattaFirme = (firme: number) => {
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
