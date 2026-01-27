import React, { useState, useEffect } from 'react';
import './ProssimoReferendumRiquadro.css';
import { apiRequest } from '@/lib/queryClient';

const ProssimoReferendumRiquadro = () => {
  const [referendum, setReferendum] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProssimoReferendum = async () => {
      try {
        console.log('🔍 ProssimoReferendumRiquadro - Inizio fetch');
        
        // Ottieni il token dal localStorage
        const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || localStorage.getItem('authToken');
        
        if (!token) {
          console.log('⚠️ ProssimoReferendumRiquadro - Token non trovato');
          setLoading(false);
          return;
        }
        
        console.log('🔍 ProssimoReferendumRiquadro - Token trovato, effettuo richiesta');
        
        const response = await apiRequest('GET', '/api/referendum-abrogativi/prossima');
        
        console.log('🔍 ProssimoReferendumRiquadro - Risposta ricevuta:', {
          ok: response.ok,
          status: response.status,
          hasData: !!response.data
        });
        
        if (!response.ok) {
          throw new Error(`Errore HTTP: ${response.status}`);
        }

        const data = response.data;
        
        console.log('🔍 ProssimoReferendumRiquadro - Dati parsati:', {
          success: data?.success,
          hasReferendum: !!data?.data,
          dataKeys: data?.data ? Object.keys(data.data) : [],
          fullData: data?.data
        });
        
        if (data.success && data.data) {
          console.log('✅ ProssimoReferendumRiquadro - Referendum trovato:', {
            nome: data.data.nome || data.data.titolo,
            data_fine: data.data.data_fine || data.data.dataFine,
            firme: data.data.firme || data.data.firme_raccolte,
            source: data.data.source
          });
          setReferendum(data.data);
        } else {
          console.log('ℹ️ ProssimoReferendumRiquadro - Nessun referendum disponibile', {
            success: data?.success,
            message: data?.message,
            dataIsNull: data?.data === null
          });
          setReferendum(null);
        }
      } catch (err) {
        console.error('❌ ProssimoReferendumRiquadro - Errore:', err);
        setError('Errore nel caricamento del referendum');
      } finally {
        setLoading(false);
      }
    };

    fetchProssimoReferendum();
  }, []);

  if (loading) {
    return (
      <div className="prossimo-referendum-riquadro loading">
        <p>Caricamento referendum...</p>
      </div>
    );
  }

  if (error) {
    console.error('❌ ProssimoReferendumRiquadro - Errore:', error);
    // Mostra il riquadro anche in caso di errore, con un messaggio
  }

  if (!referendum && !error) {
    console.log('ℹ️ ProssimoReferendumRiquadro - Nessun referendum disponibile, mostro riquadro vuoto');
    // Mostra il riquadro anche se non c'è un referendum, con un messaggio
  }

  // Formatta la data in formato DD/MM/YYYY
  const formattaData = (dataString: string) => {
    if (!dataString) return '';
    const data = new Date(dataString);
    const giorno = String(data.getDate()).padStart(2, '0');
    const mese = String(data.getMonth() + 1).padStart(2, '0');
    const anno = data.getFullYear();
    return `${giorno}/${mese}/${anno}`;
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
    // Naviga alla pagina referendum abrogativi
    if (typeof window !== 'undefined') {
      window.location.href = '/referendum-abrogativi';
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

  const nomeReferendum = referendum?.nome || referendum?.titolo || 'Nessun referendum disponibile';
  const firme = referendum?.firme_raccolte || referendum?.firme || 0;
  const emoji = referendum?.emoji || '🗳️';
  
  // Debug: verifica i campi disponibili
  console.log('🔍 ProssimoReferendumRiquadro - Rendering con dati:', {
    nomeReferendum,
    firme,
    emoji,
    data_fine: referendum?.data_fine || referendum?.dataFine,
    hasDataFine: !!(referendum?.data_fine || referendum?.dataFine),
    allKeys: referendum ? Object.keys(referendum) : [],
    hasReferendum: !!referendum,
    hasError: !!error
  });

  return (
    <div 
      className="prossimo-referendum-riquadro clickable transition-transform"
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
      <div className="prossimo-referendum-header">
        <h3>Referendum</h3>
      </div>
      <div className="prossimo-referendum-content">
        <h4>{nomeReferendum}</h4>
        
        {referendum ? (
          <div className="prossimo-referendum-info">
            {(referendum.data_fine || referendum.dataFine) && (
              <p className="scadenza-firme">
                {formattaData(referendum.data_fine || referendum.dataFine)}
                <span className="ml-2">{formattaFirme(firme)}</span>
              </p>
            )}
          </div>
        ) : (
          <div className="prossimo-referendum-info">
            <p>Nessun referendum in corso al momento.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProssimoReferendumRiquadro;
