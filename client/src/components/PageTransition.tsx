import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";

interface PageTransitionProps {
  children: React.ReactNode;
  location?: string;
}

/**
 * Componente che fornisce transizioni fluide tra le pagine
 * Mostra un effetto di dissolvenza quando si naviga tra le pagine
 */
export function PageTransition({ children, location }: PageTransitionProps) {
  const [currentLocation] = useLocation();
  const [isVisible, setIsVisible] = useState(false);
  
  // Se viene passata una location specifica, usiamo quella, altrimenti quella corrente
  const actualLocation = location || currentLocation;
  
  // Quando cambia la location, facciamo la transizione
  useEffect(() => {
    // Nasconde immediatamente il contenuto
    setIsVisible(false);
    
    // Utilizziamo un setTimeout per permettere all'animazione di completarsi
    // prima di mostrare il nuovo contenuto
    const showTimer = setTimeout(() => {
      setIsVisible(true);
    }, 50);
    
    // Pulizia dei timer quando il componente viene smontato
    return () => {
      clearTimeout(showTimer);
    };
  }, [actualLocation]);

  return (
    <div 
      className={`page-transition ${isVisible ? 'page-visible' : 'page-hidden'}`}
    >
      {children}
    </div>
  );
}