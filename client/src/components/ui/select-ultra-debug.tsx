import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown } from "lucide-react"

// Componente di debug ultra-dettagliato per analizzare il problema
export function SelectUltraDebug() {
  const [value, setValue] = React.useState("")
  const [isOpen, setIsOpen] = React.useState(false)
  const [debugInfo, setDebugInfo] = React.useState<any>({})
  const [cssInfo, setCssInfo] = React.useState<any>({})

  // Debug info dettagliato
  React.useEffect(() => {
    // Ottieni informazioni CSS in tempo reale
    const getCssInfo = () => {
      const trigger = document.querySelector('[data-radix-select-trigger]')
      const content = document.querySelector('[data-radix-select-content]')
      
      if (trigger) {
        const styles = window.getComputedStyle(trigger)
        setCssInfo({
          trigger: {
            backgroundColor: styles.backgroundColor,
            color: styles.color,
            opacity: styles.opacity,
            visibility: styles.visibility,
            display: styles.display,
            zIndex: styles.zIndex,
            position: styles.position,
            transform: styles.transform,
            filter: styles.filter,
            backdropFilter: styles.backdropFilter
          }
        })
      }
      
      if (content) {
        const styles = window.getComputedStyle(content)
        setCssInfo(prev => ({
          ...prev,
          content: {
            backgroundColor: styles.backgroundColor,
            color: styles.color,
            opacity: styles.opacity,
            visibility: styles.visibility,
            display: styles.display,
            zIndex: styles.zIndex,
            position: styles.position,
            transform: styles.transform,
            filter: styles.filter,
            backdropFilter: styles.backdropFilter
          }
        }))
      }
    }

    setDebugInfo({
      value,
      isOpen,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
      devicePixelRatio: window.devicePixelRatio,
      orientation: window.screen.orientation?.type || 'unknown'
    })

    // Aggiorna CSS info quando cambia lo stato
    setTimeout(getCssInfo, 100)
  }, [value, isOpen])

  // Forza aggiornamento CSS info
  const refreshCssInfo = () => {
    setTimeout(() => {
      const trigger = document.querySelector('[data-radix-select-trigger]')
      const content = document.querySelector('[data-radix-select-content]')
      
      if (trigger) {
        const styles = window.getComputedStyle(trigger)
        setCssInfo(prev => ({
          ...prev,
          trigger: {
            backgroundColor: styles.backgroundColor,
            color: styles.color,
            opacity: styles.opacity,
            visibility: styles.visibility,
            display: styles.display,
            zIndex: styles.zIndex,
            position: styles.position,
            transform: styles.transform,
            filter: styles.filter,
            backdropFilter: styles.backdropFilter
          }
        }))
      }
    }, 100)
  }

  return (
    <div className="p-4 border-4 border-purple-500 bg-purple-50 rounded-lg">
      <h3 className="text-xl font-bold text-purple-700 mb-4">🔬 SELECT ULTRA DEBUG</h3>
      
      {/* Info di debug ultra-dettagliate */}
      <div className="mb-4 p-3 bg-white rounded border">
        <h4 className="font-semibold mb-2">Debug Info Ultra:</h4>
        <pre className="text-xs overflow-auto">
          {JSON.stringify(debugInfo, null, 2)}
        </pre>
      </div>

      {/* Info CSS in tempo reale */}
      <div className="mb-4 p-3 bg-white rounded border">
        <h4 className="font-semibold mb-2">CSS Info Realtime:</h4>
        <button 
          onClick={refreshCssInfo}
          className="mb-2 px-2 py-1 bg-purple-500 text-white rounded text-xs"
        >
          🔄 Refresh CSS Info
        </button>
        <pre className="text-xs overflow-auto">
          {JSON.stringify(cssInfo, null, 2)}
        </pre>
      </div>

      {/* Select di test ultra-semplice */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Select Ultra Test:</label>
        <SelectPrimitive.Root 
          value={value} 
          onValueChange={setValue}
          onOpenChange={setIsOpen}
        >
          <SelectPrimitive.Trigger
            className="flex h-10 w-full items-center justify-between rounded-md border border-input px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: 'white',
              color: 'black',
              border: '2px solid red',
              position: 'relative',
              zIndex: 1
            }}
          >
            <SelectPrimitive.Value placeholder="Seleziona..." />
            <SelectPrimitive.Icon>
              <ChevronDown className="h-4 w-4" />
            </SelectPrimitive.Icon>
          </SelectPrimitive.Trigger>

          <SelectPrimitive.Portal>
            <SelectPrimitive.Content
              className="relative min-w-[8rem] overflow-hidden rounded-md border shadow-md"
              style={{
                backgroundColor: 'white',
                color: 'black',
                border: '2px solid blue',
                zIndex: 99999,
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)'
              }}
            >
              <SelectPrimitive.Viewport className="p-1">
                <SelectPrimitive.Item
                  value="opzione1"
                  className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none"
                  style={{
                    backgroundColor: 'white',
                    color: 'black',
                    border: '1px solid green'
                  }}
                >
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    <SelectPrimitive.ItemIndicator>
                      <Check className="h-4 w-4" />
                    </SelectPrimitive.ItemIndicator>
                  </span>
                  <SelectPrimitive.ItemText>Opzione 1</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>

                <SelectPrimitive.Item
                  value="opzione2"
                  className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none"
                  style={{
                    backgroundColor: 'white',
                    color: 'black',
                    border: '1px solid green'
                  }}
                >
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    <SelectPrimitive.ItemIndicator>
                      <Check className="h-4 w-4" />
                    </SelectPrimitive.ItemIndicator>
                  </span>
                  <SelectPrimitive.ItemText>Opzione 2</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              </SelectPrimitive.Viewport>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>
      </div>

      {/* Controlli manuali avanzati */}
      <div className="space-y-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="px-3 py-2 bg-purple-500 text-white rounded text-sm"
        >
          Toggle Open: {isOpen ? 'CHIUSO' : 'APERTO'}
        </button>
        
        <button
          onClick={() => setValue('opzione1')}
          className="px-3 py-2 bg-green-500 text-white rounded text-sm ml-2"
        >
          Set Opzione 1
        </button>
        
        <button
          onClick={() => setValue('')}
          className="px-3 py-2 bg-red-500 text-white rounded text-sm ml-2"
        >
          Clear
        </button>

        <button
          onClick={() => {
            // Forza refresh della pagina
            window.location.reload()
          }}
          className="px-3 py-2 bg-orange-500 text-white rounded text-sm ml-2"
        >
          🔄 Reload Page
        </button>
      </div>

      {/* Stato attuale ultra-dettagliato */}
      <div className="mt-4 p-3 bg-white rounded border">
        <h4 className="font-semibold mb-2">Stato Attuale Ultra:</h4>
        <p><strong>Valore:</strong> {value || 'Nessuno'}</p>
        <p><strong>Is Open:</strong> {isOpen ? 'Sì' : 'No'}</p>
        <p><strong>Timestamp:</strong> {new Date().toLocaleTimeString()}</p>
        <p><strong>CSS Trigger:</strong> {cssInfo.trigger ? 'Caricato' : 'Non caricato'}</p>
        <p><strong>CSS Content:</strong> {cssInfo.content ? 'Caricato' : 'Non caricato'}</p>
      </div>
    </div>
  )
}
