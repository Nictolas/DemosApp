import { useEffect, useRef, useState } from 'react'

// Hook globale per recovery automatico su mobile
export function useGlobalRecovery() {
  const [recoveryCount, setRecoveryCount] = useState(0)
  const [lastRecovery, setLastRecovery] = useState<string>('')
  const [isRecovering, setIsRecovering] = useState(false)
  const recoveryTimeoutRef = useRef<NodeJS.Timeout>()
  const checkIntervalRef = useRef<NodeJS.Timeout>()
  
  // Funzione per forzare re-render globale
  const forceGlobalRerender = () => {
    console.log('🔄 FORZANDO RE-RENDER GLOBALE...')
    setRecoveryCount(prev => prev + 1)
    setLastRecovery('Global Rerender')
    
    // Forza re-render di tutti i componenti
    window.dispatchEvent(new Event('force-rerender'))
    
    // Scroll forzato per riattivare il rendering
    window.scrollTo(0, window.scrollY + 1)
    window.scrollTo(0, window.scrollY - 1)
  }
  
  // Funzione per ripristinare la pagina
  const recoverPage = () => {
    console.log('🚨 RECOVERY AUTOMATICO ATTIVATO!')
    setIsRecovering(true)
    setLastRecovery('Auto Recovery')
    
    // 1. Forza re-render globale
    forceGlobalRerender()
    
    // 2. Ripristina focus e scroll
    setTimeout(() => {
      if (document.activeElement) {
        document.activeElement.blur()
      }
      window.scrollTo(0, 0)
    }, 100)
    
    // 3. Reset dello stato di recovery
    setTimeout(() => {
      setIsRecovering(false)
    }, 500)
  }
  
  // Funzione per controllare se la pagina è "corrotta"
  const checkPageIntegrity = () => {
    // Controlla se ci sono elementi visibili
    const visibleElements = document.querySelectorAll('input, select, button, form')
    const hasVisibleElements = Array.from(visibleElements).some(el => {
      const rect = el.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    })
    
    // Se non ci sono elementi visibili, la pagina è corrotta
    if (!hasVisibleElements) {
      console.log('🚨 PAGINA CORROTTA RILEVATA! Nessun elemento visibile trovato.')
      recoverPage()
      return false
    }
    
    // Controlla se i form sono accessibili
    const forms = document.querySelectorAll('form')
    const formsAccessible = Array.from(forms).every(form => {
      const inputs = form.querySelectorAll('input, select')
      return inputs.length > 0
    })
    
    if (!formsAccessible) {
      console.log('🚨 FORM INACCESSIBILI RILEVATI!')
      recoverPage()
      return false
    }
    
    return true
  }
  
  useEffect(() => {
    // Solo su mobile
    if (!/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      return
    }
    
    console.log('🛡️ SISTEMA DI RECOVERY GLOBALE ATTIVATO')
    
    // 1. Monitora eventi che potrebbero corrompere la pagina
    const handlePotentiallyCorruptingEvent = (eventType: string) => {
      console.log(`⚠️ EVENTO POTENZIALMENTE CORRUTTORE: ${eventType}`)
      
      // Aspetta un po' per vedere se la pagina si corrompe
      setTimeout(() => {
        if (!checkPageIntegrity()) {
          console.log(`🚨 CORRUZIONE RILEVATA DOPO ${eventType}`)
        }
      }, 200)
    }
    
    // Eventi che potrebbero corrompere la pagina
    const corruptingEvents = [
      'resize', 'orientationchange', 'focus', 'blur', 'input', 'change',
      'touchstart', 'touchend', 'touchmove', 'keydown', 'keyup',
      'beforeinput', 'compositionstart', 'compositionend',
      'focusin', 'focusout', 'select', 'selectstart',
      'visibilitychange', 'pagehide', 'pageshow'
    ]
    
    // Aggiungi listener per tutti gli eventi
    corruptingEvents.forEach(eventType => {
      window.addEventListener(eventType, () => handlePotentiallyCorruptingEvent(eventType), { passive: true })
      document.addEventListener(eventType, () => handlePotentiallyCorruptingEvent(eventType), { passive: true })
    })
    
    // 2. Monitora mutazioni del DOM
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' || mutation.type === 'attributes') {
          // Controlla se la mutazione ha corrotto la pagina
          setTimeout(() => {
            checkPageIntegrity()
          }, 100)
        }
      })
    })
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    })
    
    // 3. Controllo periodico dell'integrità della pagina
    checkIntervalRef.current = setInterval(() => {
      checkPageIntegrity()
    }, 2000) // Controlla ogni 2 secondi
    
    // 4. Listener per eventi di recovery manuale
    const handleForceRerender = () => {
      console.log('🔄 RE-RENDER GLOBALE RICHIESTO MANUALMENTE')
      forceGlobalRerender()
    }
    
    window.addEventListener('force-rerender', handleForceRerender)
    
    // 5. Monitora errori JavaScript
    const handleError = (event: ErrorEvent) => {
      console.log('🚨 ERRORE JAVASCRIPT RILEVATO:', event.error)
      setTimeout(() => {
        recoverPage()
      }, 100)
    }
    
    window.addEventListener('error', handleError)
    
    // 6. Monitora promise rejection
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.log('🚨 PROMISE REJECTION RILEVATA:', event.reason)
      setTimeout(() => {
        recoverPage()
      }, 100)
    }
    
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    
    // Cleanup
    return () => {
      corruptingEvents.forEach(eventType => {
        window.removeEventListener(eventType, () => handlePotentiallyCorruptingEvent(eventType))
        document.removeEventListener(eventType, () => handlePotentiallyCorruptingEvent(eventType))
      })
      
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
      }
      
      if (recoveryTimeoutRef.current) {
        clearTimeout(recoveryTimeoutRef.current)
      }
      
      observer.disconnect()
      window.removeEventListener('force-rerender', handleForceRerender)
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])
  
  return {
    recoveryCount,
    lastRecovery,
    isRecovering,
    forceGlobalRerender,
    recoverPage,
    checkPageIntegrity
  }
}
