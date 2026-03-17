import React from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import './ProssimaIniziativaRiquadro.css';
import { apiRequest } from '@/lib/queryClient';

const ProssimaIniziativaRiquadro = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') || localStorage.getItem('token') || localStorage.getItem('authToken') : null;
  const { data: iniziativa, isLoading: loading, isError } = useQuery({
    queryKey: ['menu-prossima-iniziativa'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/iniziative-popolari/prossima');
      if (!response.ok) throw new Error(`Errore HTTP: ${response.status}`);
      const data = response.data;
      return data.success && data.data ? data.data : null;
    },
    enabled: !!token,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const error = isError ? 'Errore nel caricamento dell\'iniziativa' : null;

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

  // Solo il contenuto interno si aggiorna; riquadro e titolo sono sempre visibili
  const renderContent = () => {
    if (loading) {
      return (
        <div className="prossima-iniziativa-content prossima-iniziativa-content-loading">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-border" />
          <p>Caricamento...</p>
        </div>
      );
    }
    if (error) {
      return (
        <div className="prossima-iniziativa-content">
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      );
    }
    if (!iniziativa) {
      return (
        <div className="prossima-iniziativa-content">
          <div className="prossima-iniziativa-info">
            <p>Nessuna iniziativa popolare in corso al momento.</p>
          </div>
        </div>
      );
    }
    const firmeRaccolte = firme;
    const totaleMinimo = 50000;
    const percentuale = Math.min((firmeRaccolte / totaleMinimo) * 100, 100);
    const haSuperatoQuorum = firmeRaccolte >= totaleMinimo;

    return (
      <div className="prossima-iniziativa-content">
        <h4>{nomeIniziativa}</h4>
        <div className="prossima-iniziativa-info">
          {(iniziativa.data_fine || iniziativa.dataFine) && (
            <p className="scadenza-firme">
              {formattaData(iniziativa.data_fine || iniziativa.dataFine)}
              <span className="ml-2">{formattaFirme(firme)}</span>
            </p>
          )}
        </div>
        <div className="prossima-iniziativa-progress" style={{ marginTop: '8px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            fontSize: '0.75em',
            marginBottom: '4px',
            opacity: 0.9,
            color: '#333'
          }}>
            <span>Progresso verso quorum</span>
            <span style={{ fontWeight: 600 }}>{percentuale.toFixed(1)}%</span>
          </div>
          <div style={{
            width: '100%',
            backgroundColor: 'rgba(255, 255, 255, 0.3)',
            borderRadius: '10px',
            height: '6px',
            overflow: 'hidden'
          }}>
            <div
              style={{
                height: '100%',
                borderRadius: '10px',
                transition: 'width 0.5s ease, background-color 0.5s ease',
                width: `${percentuale}%`,
                backgroundColor: haSuperatoQuorum ? '#10b981' : '#3b82f6'
              }}
            />
          </div>
        </div>
      </div>
    );
  };

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
        <h3>Iniziativa Popolare</h3>
      </div>
      {renderContent()}
    </div>
  );
};

export default ProssimaIniziativaRiquadro;
