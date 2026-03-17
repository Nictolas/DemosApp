import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
  duration?: number; // Durata in millisecondi
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ 
  onComplete, 
  duration = 2500 
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [logoLoaded, setLogoLoaded] = useState(false);

  useEffect(() => {
    // Simula il caricamento del logo
    const logoTimer = setTimeout(() => {
      setLogoLoaded(true);
    }, 300);

    // Timer principale per la durata della splash screen
    const mainTimer = setTimeout(() => {
      setIsVisible(false);
      
      // Chiama onComplete dopo l'animazione di uscita
      setTimeout(() => {
        onComplete();
      }, 500); // Durata dell'animazione di uscita
    }, duration);

    return () => {
      clearTimeout(logoTimer);
      clearTimeout(mainTimer);
    };
  }, [onComplete, duration]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className={`splash-screen ${logoLoaded ? 'logo-loaded' : ''}`}>
      <div className="splash-content">
        <div className="splash-logo-container">
          <img 
            src="/icona.png" 
            alt="DEMOS" 
            className="splash-logo"
            onLoad={() => setLogoLoaded(true)}
          />
        </div>
        <div className="splash-brand">
          <h1 className="splash-title">DEMOS</h1>
          <p className="splash-subtitle">Democrazia Partecipativa</p>
        </div>
      </div>
      
      {/* Indicatore di caricamento sottile */}
      <div className="splash-loader">
        <div className="splash-loader-bar"></div>
      </div>
    </div>
  );
};
