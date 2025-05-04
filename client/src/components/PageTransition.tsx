import React, { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";

interface PageTransitionProps {
  children: React.ReactNode;
  location?: string;
  type?: 'default' | 'fade-up' | 'fade-side';
  delay?: number;
}

/**
 * Componente che fornisce transizioni fluide tra le pagine
 * Mostra un effetto di dissolvenza quando si naviga tra le pagine
 */
export function PageTransition({ 
  children, 
  location, 
  type = 'default',
  delay = 50 
}: PageTransitionProps) {
  const [currentLocation] = useLocation();
  const [isVisible, setIsVisible] = useState(false);
  const [content, setContent] = useState(children);
  const isPending = useRef(false);
  
  // Se viene passata una location specifica, usiamo quella, altrimenti quella corrente
  const actualLocation = location || currentLocation;
  
  // Mappa del tipo di transizione alle classi CSS
  const transitionClasses = {
    'default': {
      base: 'page-transition',
      visible: 'page-visible',
      hidden: 'page-hidden'
    },
    'fade-up': {
      base: 'fade-up-transition',
      visible: 'fade-up-visible',
      hidden: ''
    },
    'fade-side': {
      base: 'fade-side-transition',
      visible: 'fade-side-visible',
      hidden: ''
    }
  };
  
  // Ottieni le classi CSS per il tipo di transizione corrente
  const classes = transitionClasses[type];
  
  // Quando cambia la location o i contenuti, facciamo la transizione
  useEffect(() => {
    if (isPending.current) return;
    
    // Memorizza il nuovo contenuto mentre manteniamo quello vecchio visibile
    const newContent = children;
    
    // Inizia la transizione di uscita
    isPending.current = true;
    setIsVisible(false);
    
    // Aspetta che l'animazione di uscita si completi
    const hideTimer = setTimeout(() => {
      // Aggiorna il contenuto 
      setContent(newContent);
      
      // Inizia l'animazione di entrata dopo un breve ritardo
      const showTimer = setTimeout(() => {
        setIsVisible(true);
        isPending.current = false;
      }, 20);
      
      return () => clearTimeout(showTimer);
    }, delay);
    
    return () => clearTimeout(hideTimer);
  }, [actualLocation, children, delay]);

  return (
    <div 
      className={`${classes.base} ${isVisible ? classes.visible : classes.hidden}`}
      aria-live="polite"
    >
      {content}
    </div>
  );
}