import { useState, useEffect, useRef } from 'react';

// 🚨 SISTEMA DI MONITORAGGIO SELECT SPECIFICO
export function useSelectVisibilityMonitor() {
  const [isVisible, setIsVisible] = useState(true);
  const [lastChange, setLastChange] = useState<string>('');
  const visibilityCheckRef = useRef<NodeJS.Timeout>();
  
  const checkVisibility = () => {
    try {
      // Controlla se i componenti principali sono visibili
      const form = document.querySelector('form');
      const inputs = document.querySelectorAll('input, select, textarea');
      const labels = document.querySelectorAll('label');
      
      if (!form || inputs.length === 0 || labels.length === 0) {
        console.log('🚨 COMPONENTI FORM NON TROVATI');
        setIsVisible(false);
        return false;
      }
      
      // Controlla se gli elementi sono visibili
      const hasVisibleElements = Array.from([form, ...inputs, ...labels]).some(el => {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0' &&
               rect.width > 0 && 
               rect.height > 0;
      });
      
      if (!hasVisibleElements) {
        console.log('🚨 COMPONENTI FORM NON VISIBILI - RIPRISTINO IMMEDIATO');
        setIsVisible(false);
        return false;
      }
      
      setIsVisible(true);
      return true;
    } catch (error) {
      console.error('❌ Errore nel controllo visibilità:', error);
      setIsVisible(false);
      return false;
    }
  };
  
  const forceVisibilityRestore = () => {
    console.log('🔄 RIPRISTINO VISIBILITÀ FORZATO');
    
    try {
      // 1. Forza re-render di tutti i componenti form
      const form = document.querySelector('form');
      if (form) {
        form.style.display = 'none';
        setTimeout(() => {
          form.style.display = 'block';
        }, 10);
      }
      
      // 2. Forza re-render di tutti gli input
      const inputs = document.querySelectorAll('input, select, textarea');
      inputs.forEach(input => {
        const el = input as HTMLElement;
        el.style.opacity = '0';
        setTimeout(() => {
          el.style.opacity = '1';
        }, 10);
      });
      
      // 3. Forza re-render di tutte le label
      const labels = document.querySelectorAll('label');
      labels.forEach(label => {
        const el = label as HTMLElement;
        el.style.visibility = 'hidden';
        setTimeout(() => {
          el.style.visibility = 'visible';
        }, 10);
      });
      
      // 4. Verifica che il ripristino sia avvenuto
      setTimeout(() => {
        checkVisibility();
      }, 100);
      
    } catch (error) {
      console.error('❌ Errore nel ripristino visibilità:', error);
    }
  };
  
  useEffect(() => {
    // Controlla visibilità ogni volta che cambia qualcosa
    const checkInterval = setInterval(checkVisibility, 1000);
    
    return () => {
      if (checkInterval) {
        clearInterval(checkInterval);
      }
    };
  }, []);
  
  return {
    isVisible,
    lastChange,
    checkVisibility,
    forceVisibilityRestore
  };
}
