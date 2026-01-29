import React from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import './ProssimoEventoRiquadro.css';
import { apiRequest } from '@/lib/queryClient';

const ProssimoEventoRiquadro = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') || localStorage.getItem('token') || localStorage.getItem('authToken') : null;
  const { data: evento, isLoading: loading, isError } = useQuery({
    queryKey: ['menu-prossimo-evento'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/eventi/prossimo');
      if (!response.ok) throw new Error(`Errore HTTP: ${response.status}`);
      const data = response.data;
      return data.success && data.data ? data.data : null;
    },
    enabled: !!token,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const error = isError ? 'Errore nel caricamento dell\'evento' : null;

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

  // Contenuto dinamico: solo questa parte si aggiorna (titolo riquadro sempre visibile)
  const renderContent = () => {
    if (loading) {
      return (
        <div className="prossimo-evento-content prossimo-evento-content-loading">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-border" />
          <p>Caricamento...</p>
        </div>
      );
    }
    if (error) {
      return (
        <div className="prossimo-evento-content">
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      );
    }
    if (!evento) {
      return (
        <div className="prossimo-evento-content">
          <p className="text-sm text-muted-foreground">Nessun evento in programma.</p>
        </div>
      );
    }
    return (
      <div className="prossimo-evento-content">
        <h4>{evento.nome_evento}</h4>
        <div className="prossimo-evento-info">
          {(evento.comune_evento || evento.indirizzo_evento) && (
            <p className="luogo-indirizzo">
              {evento.comune_evento}
              {evento.indirizzo_evento && ` - ${evento.indirizzo_evento}`}
            </p>
          )}
          <p className="data">
            {formattaData(evento.giorno_inizio)}
          </p>
          {evento.orario_inizio && (
            <p className="orario">
              {formattaOrario(evento.orario_inizio)}
              {evento.orario_fine && ` - ${formattaOrario(evento.orario_fine)}`}
            </p>
          )}
        </div>
      </div>
    );
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
      {renderContent()}
    </div>
  );
};

export default ProssimoEventoRiquadro;
