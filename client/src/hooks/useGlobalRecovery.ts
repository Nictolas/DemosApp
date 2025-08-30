import { useEffect, useRef, useState } from 'react'

export function useGlobalRecovery() {
  const [recoveryCount, setRecoveryCount] = useState(0)
  const [lastRecovery, setLastRecovery] = useState<string>('')
  const [isRecovering, setIsRecovering] = useState(false)
  const recoveryTimeoutRef = useRef<NodeJS.Timeout>()
  const checkIntervalRef = useRef<NodeJS.Timeout>()
  const lastKnownStateRef = useRef<any>(null)
  const componentBackupRef = useRef<any>(null)
  
  // 🛡️ SISTEMA DI RECOVERY PREVENTIVO
  const preventCorruption = () => {
    try {
      // 1. Salva backup dei componenti critici
      const criticalElements = document.querySelectorAll('form, input, select, textarea, button')
      componentBackupRef.current = Array.from(criticalElements).map(el => ({
        tagName: el.tagName,
        className: el.className,
        id: el.id,
        name: (el as any).name,
        value: (el as any).value,
        type: (el as any).type,
        placeholder: (el as any).placeholder,
        innerHTML: el.innerHTML
      }))
      
      // 2. Forza re-render preventivo ogni 5 secondi
      setInterval(() => {
        try {
          // Verifica integrità componenti
          const currentElements = document.querySelectorAll('form, input, select, textarea, button')
          if (currentElements.length < 5) { // Troppo pochi elementi = corruzione
            console.log('⚠️ PREVENZIONE CORRUZIONE - Forzo re-render')
            window.dispatchEvent(new Event('force-rerender'))
          }
        } catch (error) {
          console.error('❌ Errore prevenzione:', error)
        }
      }, 5000)
      
      console.log('🛡️ Sistema di prevenzione corruzione attivato')
    } catch (error) {
      console.error('❌ Errore nell\'attivare prevenzione:', error)
    }
  }
  
  const forceGlobalRerender = () => {
    console.log('🔄 FORCE GLOBAL RERENDER ATTIVATO')
    setRecoveryCount(prev => prev + 1)
    setLastRecovery(new Date().toLocaleTimeString())
    
    // Forza un re-render globale
    window.dispatchEvent(new Event('force-rerender'))
    
    // Ripristina lo stato se disponibile
    if (lastKnownStateRef.current) {
      try {
        localStorage.setItem('app-recovery-state', JSON.stringify(lastKnownStateRef.current))
        console.log('💾 Stato di recovery salvato')
      } catch (error) {
        console.error('❌ Errore nel salvare lo stato di recovery:', error)
      }
    }
  }
  
  const recoverPage = () => {
    if (isRecovering) return
    
    setIsRecovering(true)
    console.log('🛡️ RECOVERY AUTOMATICO ATTIVATO')
    
    setRecoveryCount(prev => prev + 1)
    setLastRecovery(new Date().toLocaleTimeString())
    
    // 1. Salva lo stato corrente
    try {
      const currentState = {
        timestamp: Date.now(),
        url: window.location.href,
        scrollY: window.scrollY,
        formData: getFormData()
      }
      lastKnownStateRef.current = currentState
      localStorage.setItem('app-recovery-state', JSON.stringify(currentState))
      console.log('💾 Stato salvato per recovery:', currentState)
    } catch (error) {
      console.error('❌ Errore nel salvare lo stato:', error)
    }
    
    // 2. Forza re-render globale
    forceGlobalRerender()
    
    // 3. Ripristina focus e scroll
    setTimeout(() => {
      try {
        // Ripristina scroll
        if (lastKnownStateRef.current?.scrollY) {
          window.scrollTo(0, lastKnownStateRef.current.scrollY)
        }
        
        // Ripristina focus
        const firstInput = document.querySelector('input, select, textarea')
        if (firstInput) {
          (firstInput as HTMLElement).focus()
        }
        
        console.log('✅ Recovery completato')
      } catch (error) {
        console.error('❌ Errore nel completare recovery:', error)
      } finally {
        setIsRecovering(false)
      }
    }, 100)
  }
  
  const getFormData = () => {
    try {
      const forms = document.querySelectorAll('form')
      const formData: any = {}
      
      forms.forEach((form, index) => {
        const formElements = form.querySelectorAll('input, select, textarea')
        formElements.forEach((element) => {
          const input = element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
          if (input.name || input.id) {
            const key = input.name || input.id
            formData[key] = input.value
          }
        })
      })
      
      return formData
    } catch (error) {
      console.error('❌ Errore nel raccogliere form data:', error)
      return {}
    }
  }
  
  const checkPageIntegrity = () => {
    try {
      // Controlla se ci sono elementi visibili
      const visibleElements = document.querySelectorAll('input, select, textarea, button, h1, h2, h3, p, div')
      const hasVisibleContent = Array.from(visibleElements).some(el => {
        const style = window.getComputedStyle(el)
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
      })
      
      // Controlla se ci sono form attivi
      const forms = document.querySelectorAll('form')
      const hasActiveForms = forms.length > 0
      
      // Controlla se la pagina è "vuota"
      const bodyText = document.body.innerText || document.body.textContent || ''
      const isPageEmpty = bodyText.trim().length < 50 // Meno di 50 caratteri = pagina vuota
      
      console.log('🔍 Controllo integrità pagina:', {
        hasVisibleContent,
        hasActiveForms,
        isPageEmpty,
        visibleElementsCount: visibleElements.length,
        formsCount: forms.length,
        bodyTextLength: bodyText.length
      })
      
      // Se la pagina è corrotta, attiva recovery
      if (!hasVisibleContent || isPageEmpty) {
        console.log('🚨 PAGINA CORROTTA RILEVATA - ATTIVO RECOVERY')
        recoverPage()
        return false
      }
      
      return true
    } catch (error) {
      console.error('❌ Errore nel controllo integrità:', error)
      // Se c'è un errore, probabilmente la pagina è corrotta
      recoverPage()
      return false
    }
  }
  
  // 🚨 RECOVERY ULTRA-AGGRESSIVO
  const forcePageRestore = () => {
    console.log('🚨 RECOVERY ULTRA-AGGRESSIVO ATTIVATO')
    
    try {
      // 1. Ripristina componenti dal backup se disponibile
      if (componentBackupRef.current) {
        console.log('🔄 Ripristino componenti dal backup')
        // Forza re-render globale
        window.dispatchEvent(new Event('force-rerender'))
        
        // Se non funziona entro 3 secondi, ricarica
        setTimeout(() => {
          if (!checkPageIntegrity()) {
            console.log('🔄 Recovery fallito, ricarico pagina')
            window.location.reload()
          }
        }, 3000)
      } else {
        // 2. Se non c'è backup, ricarica direttamente
        console.log('🔄 Nessun backup disponibile, ricarico pagina')
        window.location.reload()
      }
    } catch (error) {
      console.error('❌ Errore nel recovery ultra-aggressivo:', error)
      window.location.reload()
    }
  }
  
  useEffect(() => {
    // Solo su mobile
    if (!/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      return
    }
    
    console.log('🛡️ SISTEMA DI RECOVERY GLOBALE ATTIVATO')
    
    // 🛡️ ATTIVA PREVENZIONE CORRUZIONE
    preventCorruption()
    
    // 1. Monitora eventi che potrebbero corrompere la pagina
    const events = [
      'resize', 'orientationchange', 'focus', 'blur', 'input', 'change',
      'touchstart', 'touchend', 'touchmove', 'keydown', 'keyup', 'keypress',
      'beforeinput', 'compositionstart', 'compositionend', 'compositionupdate',
      'focusin', 'focusout', 'select', 'selectstart', 'selectionchange',
      'visibilitychange', 'pagehide', 'pageshow', 'beforeunload', 'load', 'unload',
      'abort', 'error', 'online', 'offline'
    ]
    
    const eventHandlers = events.map(event => {
      const handler = () => {
        // Salva lo stato dopo ogni evento importante
        try {
          const currentState = {
            timestamp: Date.now(),
            event,
            url: window.location.href,
            scrollY: window.scrollY
          }
          lastKnownStateRef.current = currentState
        } catch (error) {
          console.error('❌ Errore nel salvare stato evento:', error)
        }
      }
      
      window.addEventListener(event, handler, { passive: true })
      return { event, handler }
    })
    
    // 2. Monitora mutazioni del DOM
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
          // Se vengono rimossi molti nodi, potrebbe essere un problema
          if (mutation.removedNodes.length > 10) {
            console.log('⚠️ Molti nodi rimossi, controllo integrità')
            setTimeout(checkPageIntegrity, 100)
          }
        }
      })
    })
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    })
    
    // 3. Controllo periodico dell'integrità della pagina
    checkIntervalRef.current = setInterval(() => {
      checkPageIntegrity()
    }, 2000) // Ogni 2 secondi
    
    // 4. Listener per eventi di recovery manuale
    const forceRerenderHandler = () => {
      console.log('🔄 Evento force-rerender ricevuto')
      forceGlobalRerender()
    }
    
    window.addEventListener('force-rerender', forceRerenderHandler)
    
    // 5. Monitora errori JavaScript
    const errorHandler = (event: ErrorEvent) => {
      console.error('🚨 Errore JavaScript rilevato:', event.error)
      setTimeout(() => {
        if (checkPageIntegrity()) {
          console.log('✅ Pagina integra dopo errore')
        } else {
          console.log('🚨 Pagina corrotta dopo errore, attivo recovery')
          recoverPage()
        }
      }, 100)
    }
    
    window.addEventListener('error', errorHandler)
    
    // 6. Monitora promise rejection
    const unhandledRejectionHandler = (event: PromiseRejectionEvent) => {
      console.error('🚨 Promise rejection rilevata:', event.reason)
      setTimeout(() => {
        if (checkPageIntegrity()) {
          console.log('✅ Pagina integra dopo promise rejection')
        } else {
          console.log('🚨 Pagina corrotta dopo promise rejection, attivo recovery')
          recoverPage()
        }
      }, 100)
    }
    
    window.addEventListener('unhandledrejection', unhandledRejectionHandler)
    
    // 7. Ripristina stato se disponibile
    try {
      const savedState = localStorage.getItem('app-recovery-state')
      if (savedState) {
        const parsedState = JSON.parse(savedState)
        if (parsedState.url === window.location.href) {
          lastKnownStateRef.current = parsedState
          console.log('💾 Stato di recovery ripristinato:', parsedState)
        }
      }
    } catch (error) {
      console.error('❌ Errore nel ripristinare stato:', error)
    }
    
    // Cleanup
    return () => {
      // Rimuovi event listeners
      eventHandlers.forEach(({ event, handler }) => {
        window.removeEventListener(event, handler)
      })
      
      // Ferma observer
      observer.disconnect()
      
      // Ferma intervalli
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
      }
      
      // Rimuovi event listeners personalizzati
      window.removeEventListener('force-rerender', forceRerenderHandler)
      window.removeEventListener('error', errorHandler)
      window.removeEventListener('unhandledrejection', unhandledRejectionHandler)
    }
  }, [])
  
  return {
    recoveryCount,
    lastRecovery,
    isRecovering,
    forceGlobalRerender,
    recoverPage,
    checkPageIntegrity,
    forcePageRestore // 🚨 NUOVO METODO ULTRA-AGGRESSIVO
  }
}
