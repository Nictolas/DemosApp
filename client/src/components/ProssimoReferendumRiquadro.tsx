import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import './ProssimoReferendumRiquadro.css';
import { apiRequest } from '@/lib/queryClient';

const ProssimoReferendumRiquadro = () => {
  const [referendum, setReferendum] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProssimoReferendum = async () => {
      try {
        const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || localStorage.getItem('authToken');
        
        if (!token) {
          setLoading(false);
          return;
        }
        
        const response = await apiRequest('GET', '/api/referendum-abrogativi/prossima');
        
        if (!response.ok) {
          throw new Error(`Errore HTTP: ${response.status}`);
        }

        const data = response.data;
        
        if (data.success && data.data) {
          setReferendum(data.data);
        } else {
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

  // Solo il contenuto interno si aggiorna; riquadro e titolo sono sempre visibili
  const renderContent = () => {
    if (loading) {
      return (
        <div className="prossimo-referendum-content prossimo-referendum-content-loading">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-border" />
          <p>Caricamento...</p>
        </div>
      );
    }
    if (error) {
      return (
        <div className="prossimo-referendum-content">
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      );
    }
    if (!referendum) {
      return (
        <div className="prossimo-referendum-content">
          <div className="prossimo-referendum-info">
            <p>Nessun referendum in corso al momento.</p>
          </div>
        </div>
      );
    }
    return (
      <div className="prossimo-referendum-content">
        <h4>{nomeReferendum}</h4>
        <div className="prossimo-referendum-info">
          {(referendum.data_fine || referendum.dataFine) && (
            <p className="scadenza-firme">
              {formattaData(referendum.data_fine || referendum.dataFine)}
              <span className="ml-2">{formattaFirme(firme)}</span>
            </p>
          )}
        </div>
      </div>
    );
  };

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
      {renderContent()}
    </div>
  );
};

export default ProssimoReferendumRiquadro;
