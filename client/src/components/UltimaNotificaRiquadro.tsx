import React, { useState, useEffect } from 'react';
import './UltimaNotificaRiquadro.css';
import { apiRequest } from '@/lib/queryClient';

const UltimaNotificaRiquadro = () => {
  const [notifica, setNotifica] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUltimaNotifica = async () => {
      try {
        console.log('🔍 UltimaNotificaRiquadro - Inizio fetch');
        
        // Ottieni il token dal localStorage
        const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || localStorage.getItem('authToken');
        
        if (!token) {
          console.log('⚠️ UltimaNotificaRiquadro - Token non trovato');
          setLoading(false);
          return;
        }
        
        console.log('🔍 UltimaNotificaRiquadro - Token trovato, effettuo richiesta');
        
        const response = await apiRequest('GET', '/api/notifiche/ultima');
        
        console.log('🔍 UltimaNotificaRiquadro - Risposta ricevuta:', {
          ok: response.ok,
          status: response.status,
          hasData: !!response.data
        });
        
        if (!response.ok) {
          throw new Error(`Errore HTTP: ${response.status}`);
        }

        const data = response.data;
        
        console.log('🔍 UltimaNotificaRiquadro - Dati parsati:', {
          success: data?.success,
          hasNotifica: !!data?.data
        });
        
        if (data.success && data.data) {
          console.log('✅ UltimaNotificaRiquadro - Notifica trovata:', data.data.titolo);
          setNotifica(data.data);
        } else {
          console.log('ℹ️ UltimaNotificaRiquadro - Nessuna notifica disponibile');
          setNotifica(null);
        }
      } catch (err) {
        console.error('❌ UltimaNotificaRiquadro - Errore:', err);
        setError('Errore nel caricamento della notifica');
      } finally {
        setLoading(false);
      }
    };

    fetchUltimaNotifica();
  }, []);

  if (loading) {
    return (
      <div className="ultima-notifica-riquadro loading">
        <p>Caricamento ultima notifica...</p>
      </div>
    );
  }

  if (error) {
    console.error('❌ UltimaNotificaRiquadro - Errore:', error);
    return null; // Non mostrare nulla se c'è un errore
  }

  if (!notifica) {
    console.log('ℹ️ UltimaNotificaRiquadro - Nessuna notifica disponibile, non mostro il riquadro');
    return null; // Non mostrare nulla se non c'è una notifica
  }

  // Formatta la data
  const formattaData = (dataString: string) => {
    if (!dataString) return 'Data non disponibile';
    const data = new Date(dataString);
    const oggi = new Date();
    const ieri = new Date(oggi);
    ieri.setDate(ieri.getDate() - 1);
    
    // Se è oggi, mostra "Oggi"
    if (data.toDateString() === oggi.toDateString()) {
      return `Oggi alle ${data.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // Se è ieri, mostra "Ieri"
    if (data.toDateString() === ieri.toDateString()) {
      return `Ieri alle ${data.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // Altrimenti mostra la data completa
    return data.toLocaleDateString('it-IT', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleClick = () => {
    // Naviga alla pagina notifiche
    if (typeof window !== 'undefined') {
      window.location.href = '/notifiche';
    }
  };

  const titolo = notifica.titolo || 'Notifica';
  const messaggio = notifica.messaggio || notifica.testo || '';
  const messaggioBreve = messaggio.length > 100 ? `${messaggio.substring(0, 100)}...` : messaggio;

  return (
    <div 
      className="ultima-notifica-riquadro clickable"
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
      <div className="ultima-notifica-header">
        <h3>🔔 Ultima Notifica</h3>
      </div>
      <div className="ultima-notifica-content">
        <h4>{titolo}</h4>
        
        <div className="ultima-notifica-info">
          {notifica.data_creazione && (
            <p className="data">
              <strong>📅 Data:</strong> {formattaData(notifica.data_creazione)}
            </p>
          )}
          
          {messaggio && (
            <p className="messaggio">
              {messaggioBreve}
            </p>
          )}
        </div>
        
        <div className="vedi-tutte-notifiche-btn">
          Vedi tutte le notifiche →
        </div>
      </div>
    </div>
  );
};

export default UltimaNotificaRiquadro;
