import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

// Componente Select completamente isolato - NO React Hook Form
export function SelectIsolated() {
  const [value, setValue] = React.useState("")
  const [isOpen, setIsOpen] = React.useState(false)
  const [renderCount, setRenderCount] = React.useState(0)
  const [debugInfo, setDebugInfo] = React.useState<any>({})

  // Debug info
  React.useEffect(() => {
    setRenderCount(prev => prev + 1)
    
    setDebugInfo({
      value,
      isOpen,
      renderCount: renderCount + 1,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
      devicePixelRatio: window.devicePixelRatio
    })
  }, [value, isOpen])

  // Forza re-render per test
  const forceReRender = () => {
    setRenderCount(prev => prev + 1)
  }

  // Reset completo
  const resetAll = () => {
    setValue("")
    setIsOpen(false)
    setRenderCount(0)
  }

  return (
    <div className="p-4 border-4 border-orange-500 bg-orange-50 rounded-lg">
      <h3 className="text-xl font-bold text-orange-700 mb-4">🔒 SELECT ISOLATO - NO REACT HOOK FORM</h3>
      
      {/* Debug Info */}
      <div className="mb-4 p-3 bg-white rounded border">
        <h4 className="font-semibold mb-2">Debug Info Isolato:</h4>
        <pre className="text-xs overflow-auto">
          {JSON.stringify(debugInfo, null, 2)}
        </pre>
      </div>

      {/* Contatori */}
      <div className="mb-4 p-3 bg-white rounded border">
        <p><strong>Render Count:</strong> {renderCount}</p>
        <p><strong>Valore:</strong> {value || 'Nessuno'}</p>
        <p><strong>Is Open:</strong> {isOpen ? 'Sì' : 'No'}</p>
      </div>

      {/* Select completamente isolato */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Select Isolato:</label>
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
              border: '2px solid orange',
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
                border: '2px solid orange',
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
                    border: '1px solid orange'
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
                    border: '1px solid orange'
                  }}
                >
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    <SelectPrimitive.ItemIndicator>
                      <Check className="h-4 w-4" />
                    </SelectPrimitive.ItemIndicator>
                  </span>
                  <SelectPrimitive.ItemText>Opzione 2</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>

                <SelectPrimitive.Item
                  value="opzione3"
                  className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none"
                  style={{
                    backgroundColor: 'white',
                    color: 'black',
                    border: '1px solid orange'
                  }}
                >
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    <SelectPrimitive.ItemIndicator>
                      <Check className="h-4 w-4" />
                    </SelectPrimitive.ItemIndicator>
                  </span>
                  <SelectPrimitive.ItemText>Opzione 3</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              </SelectPrimitive.Viewport>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>
      </div>

      {/* Controlli */}
      <div className="space-y-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="px-3 py-2 bg-orange-500 text-white rounded text-sm"
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
          onClick={() => setValue('opzione2')}
          className="px-3 py-2 bg-blue-500 text-white rounded text-sm ml-2"
        >
          Set Opzione 2
        </button>
        
        <button
          onClick={() => setValue('opzione3')}
          className="px-3 py-2 bg-purple-500 text-white rounded text-sm ml-2"
        >
          Set Opzione 3
        </button>
        
        <button
          onClick={forceReRender}
          className="px-3 py-2 bg-red-500 text-white rounded text-sm ml-2"
        >
          🔄 Force Re-render
        </button>
        
        <button
          onClick={resetAll}
          className="px-3 py-2 bg-gray-500 text-white rounded text-sm ml-2"
        >
          Reset All
        </button>
      </div>

      {/* Test di stabilità */}
      <div className="mt-4 p-3 bg-white rounded border">
        <h4 className="font-semibold mb-2">Test di Stabilità:</h4>
        <p><strong>Render Count:</strong> {renderCount}</p>
        <p><strong>Ultimo Valore:</strong> {value || 'Nessuno'}</p>
        <p><strong>Stato Aperto:</strong> {isOpen ? 'Sì' : 'No'}</p>
        <p><strong>Timestamp:</strong> {new Date().toLocaleTimeString()}</p>
      </div>
    </div>
  )
}
