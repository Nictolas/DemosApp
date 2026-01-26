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
          hasIniziativa: !!data?.data,
          dataKeys: data?.data ? Object.keys(data.data) : [],
          fullData: data?.data
        });
        
        if (data.success && data.data) {
          console.log('✅ ProssimaIniziativaRiquadro - Iniziativa trovata:', {
            nome: data.data.nome || data.data.titolo,
            data_fine: data.data.data_fine || data.data.dataFine,
            firme: data.data.firme || data.data.firme_raccolte,
            source: data.data.source
          });
          setIniziativa(data.data);
        } else {
          console.log('ℹ️ ProssimaIniziativaRiquadro - Nessuna iniziativa disponibile', {
            success: data?.success,
            message: data?.message,
            dataIsNull: data?.data === null
          });
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
    // Mostra il riquadro anche in caso di errore, con un messaggio
  }

  if (!iniziativa && !error) {
    console.log('ℹ️ ProssimaIniziativaRiquadro - Nessuna iniziativa disponibile, mostro riquadro vuoto');
    // Mostra il riquadro anche se non c'è un'iniziativa, con un messaggio
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

  const nomeIniziativa = iniziativa?.nome || iniziativa?.titolo || 'Nessuna iniziativa disponibile';
  const firme = iniziativa?.firme_raccolte || iniziativa?.firme || 0;
  const emoji = iniziativa?.emoji || '📋';
  
  // Debug: verifica i campi disponibili
  console.log('🔍 ProssimaIniziativaRiquadro - Rendering con dati:', {
    nomeIniziativa,
    firme,
    emoji,
    data_fine: iniziativa?.data_fine || iniziativa?.dataFine,
    hasDataFine: !!(iniziativa?.data_fine || iniziativa?.dataFine),
    allKeys: iniziativa ? Object.keys(iniziativa) : [],
    hasIniziativa: !!iniziativa,
    hasError: !!error
  });

  return (
    <div 
      className="prossima-iniziativa-riquadro clickable transition-transform"
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
      <div className="prossima-iniziativa-header">
        <h3>{emoji} Iniziativa Popolare</h3>
      </div>
      <div className="prossima-iniziativa-content">
        <h4>{nomeIniziativa}</h4>
        
        {iniziativa ? (
          <div className="prossima-iniziativa-info">
            {(iniziativa.data_fine || iniziativa.dataFine) && (
              <p className="scadenza">
                <strong>⏰ Scadenza:</strong> {formattaData(iniziativa.data_fine || iniziativa.dataFine)}
              </p>
            )}
            
            <p className="firme">
              <strong>✍️ Firme raccolte:</strong> {formattaFirme(firme)}
            </p>
          </div>
        ) : (
          <div className="prossima-iniziativa-info">
            <p>Nessuna iniziativa popolare in corso al momento.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProssimaIniziativaRiquadro;
