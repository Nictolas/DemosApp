import { useEffect, useRef, useState } from 'react'

export function useGlobalRecovery() {
  const [recoveryCount, setRecoveryCount] = useState(0)
  const [lastRecovery, setLastRecovery] = useState<string>('')
  const [isRecovering, setIsRecovering] = useState(false)
  const recoveryTimeoutRef = useRef<NodeJS.Timeout>()
  const checkIntervalRef = useRef<NodeJS.Timeout>()
  const lastKnownStateRef = useRef<any>(null)
  
  // 🎯 SALVA STATO COMPLETO DELLA PAGINA
  const savePageState = () => {
    try {
      const currentState = {
        timestamp: Date.now(),
        url: window.location.href,
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
        scrollY: window.scrollY,
        formData: getFormData(),
        pageTitle: document.title,
        bodyContent: document.body.innerHTML.substring(0, 1000) // Primi 1000 caratteri per debug
      }
      
      lastKnownStateRef.current = currentState
      localStorage.setItem('app-page-state', JSON.stringify(currentState))
      console.log('💾 Stato pagina salvato:', currentState)
      
      return currentState
    } catch (error) {
      console.error('❌ Errore nel salvare stato pagina:', error)
      return null
    }
  }
  
  // 🎯 RIPRISTINA STATO COMPLETO DELLA PAGINA
  const restorePageState = () => {
    try {
      const savedState = localStorage.getItem('app-page-state')
      if (!savedState) {
        console.log('❌ Nessuno stato salvato trovato')
        return false
      }
      
      const state = JSON.parse(savedState)
      console.log('🔄 Ripristino stato pagina:', state)
      
      // Ripristina scroll
      if (state.scrollY) {
        window.scrollTo(0, state.scrollY)
      }
      
      // Ripristina focus su primo input
      setTimeout(() => {
        const firstInput = document.querySelector('input, select, textarea')
        if (firstInput) {
          (firstInput as HTMLElement).focus()
        }
      }, 100)
      
      return true
    } catch (error) {
      console.error('❌ Errore nel ripristinare stato:', error)
      return false
    }
  }
  
  // 🚨 RECOVERY CON RIPRISTINO ROTTA
  const recoverWithRouteRestore = () => {
    console.log('🚨 RECOVERY CON RIPRISTINO ROTTA ATTIVATO')
    
    try {
      // 1. Salva stato corrente
      const currentState = savePageState()
      if (!currentState) {
        console.log('❌ Impossibile salvare stato, ricarico diretto')
        window.location.reload()
        return
      }
      
      // 2. Ricarica la pagina
      console.log('🔄 Ricarico pagina per ripristino completo')
      window.location.reload()
      
    } catch (error) {
      console.error('❌ Errore nel recovery con ripristino rotta:', error)
      window.location.reload()
    }
  }
  
  const forceGlobalRerender = () => {
    console.log('🔄 FORCE GLOBAL RERENDER ATTIVATO')
    setRecoveryCount(prev => prev + 1)
    setLastRecovery(new Date().toLocaleTimeString())
    
    // Forza un re-render globale
    window.dispatchEvent(new Event('force-rerender'))
    
    // Salva stato prima del re-render
    savePageState()
  }
  
  const recoverPage = () => {
    if (isRecovering) return
    
    setIsRecovering(true)
    console.log('🛡️ RECOVERY AUTOMATICO ATTIVATO')
    
    setRecoveryCount(prev => prev + 1)
    setLastRecovery(new Date().toLocaleTimeString())
    
    // Salva stato e attiva recovery
    savePageState()
    recoverWithRouteRestore()
    
    setIsRecovering(false)
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
  
  useEffect(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    
    // 5. Monitora errori JavaScript (su TUTTI i dispositivi: PC/Chrome crashano, iPhone no - serve recovery anche su desktop)
    const errorHandler = (event: ErrorEvent) => {
      console.error('🚨 Errore JavaScript rilevato:', event.error)
      setTimeout(() => {
        if (checkPageIntegrity()) {
          if (isMobile) console.log('✅ Pagina integra dopo errore')
        } else {
          console.log('🚨 Pagina corrotta dopo errore, attivo recovery')
          recoverPage()
        }
      }, 100)
    }
    
    // 6. Monitora promise rejection (su TUTTI i dispositivi)
    const unhandledRejectionHandler = (event: PromiseRejectionEvent) => {
      console.error('🚨 Promise rejection rilevata:', event.reason)
      setTimeout(() => {
        if (checkPageIntegrity()) {
          if (isMobile) console.log('✅ Pagina integra dopo promise rejection')
        } else {
          console.log('🚨 Pagina corrotta dopo promise rejection, attivo recovery')
          recoverPage()
        }
      }, 100)
    }
    
    window.addEventListener('error', errorHandler)
    window.addEventListener('unhandledrejection', unhandledRejectionHandler)
    
    // Su desktop ci fermiamo qui: error + unhandledrejection per tentare recovery in caso di crash
    if (!isMobile) {
      return () => {
        window.removeEventListener('error', errorHandler)
        window.removeEventListener('unhandledrejection', unhandledRejectionHandler)
      }
    }
    
    console.log('🛡️ SISTEMA DI RECOVERY GLOBALE ATTIVATO (mobile)')
    
    // 🎯 RIPRISTINA STATO SE DISPONIBILE (dopo reload) - solo mobile
    const restoreOnLoad = () => {
      try {
        const savedState = localStorage.getItem('app-page-state')
        if (savedState) {
          const state = JSON.parse(savedState)
          
          // Se siamo sulla stessa rotta, ripristina stato
          if (state.pathname === window.location.pathname) {
            console.log('🔄 Ripristino stato dopo reload:', state.pathname)
            setTimeout(() => {
              restorePageState()
            }, 500) // Aspetta che la pagina si carichi
          } else {
            console.log('🔄 Rotta diversa, pulisco stato salvato')
            localStorage.removeItem('app-page-state')
          }
        }
      } catch (error) {
        console.error('❌ Errore nel ripristino stato onload:', error)
      }
    }
    
    // Esegui ripristino quando la pagina si carica
    if (document.readyState === 'complete') {
      restoreOnLoad()
    } else {
      window.addEventListener('load', restoreOnLoad)
    }
    
    // 1. Monitora SOLO eventi critici che potrebbero corrompere la pagina
    const criticalEvents = [
      'orientationchange', 'resize', 'visibilitychange', 'pagehide', 'pageshow'
    ]
    
    const eventHandlers = criticalEvents.map(event => {
      const handler = () => {
        // Salva lo stato dopo ogni evento critico
        try {
          const currentState = {
            timestamp: Date.now(),
            event,
            url: window.location.href,
            pathname: window.location.pathname,
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
    
    // 2. Monitora mutazioni del DOM (più conservativo)
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.removedNodes.length > 20) {
          // Solo se vengono rimossi MOLTI nodi (probabilmente corruzione)
          console.log('⚠️ Molti nodi rimossi, controllo integrità')
          setTimeout(checkPageIntegrity, 100)
        }
      })
    })
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    })
    
    // 3. Controllo periodico dell'integrità della pagina (meno frequente)
    checkIntervalRef.current = setInterval(() => {
      checkPageIntegrity()
    }, 5000) // Ogni 5 secondi invece di 2
    
    // 4. Listener per eventi di recovery manuale
    const forceRerenderHandler = () => {
      console.log('🔄 Evento force-rerender ricevuto')
      forceGlobalRerender()
    }
    
    window.addEventListener('force-rerender', forceRerenderHandler)
    
    // Cleanup (mobile: error/unhandledrejection già registrati in cima all'effect)
    return () => {
      window.removeEventListener('error', errorHandler)
      window.removeEventListener('unhandledrejection', unhandledRejectionHandler)
      eventHandlers.forEach(({ event, handler }) => {
        window.removeEventListener(event, handler)
      })
      observer.disconnect()
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
      }
      window.removeEventListener('force-rerender', forceRerenderHandler)
      window.removeEventListener('load', restoreOnLoad)
    }
  }, [])
  
  return {
    recoveryCount,
    lastRecovery,
    isRecovering,
    forceGlobalRerender,
    recoverPage,
    checkPageIntegrity,
    recoverWithRouteRestore, // 🎯 NUOVO METODO CON RIPRISTINO ROTTA
    savePageState,
    restorePageState
  }
}
