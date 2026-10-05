import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

// Componente Select di debug per analizzare il problema
export function SelectDebug({ 
  value, 
  onValueChange, 
  placeholder = "Seleziona...",
  options = [
    { value: "opzione1", label: "Opzione 1" },
    { value: "opzione2", label: "Opzione 2" },
    { value: "opzione3", label: "Opzione 3" }
  ]
}: {
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  options?: { value: string; label: string }[]
}) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [debugInfo, setDebugInfo] = React.useState<any>({})

  // Debug info
  React.useEffect(() => {
    setDebugInfo({
      value,
      isOpen,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    })
  }, [value, isOpen])

  return (
    <div className="p-4 border-2 border-red-500 bg-red-50 rounded-lg">
      <h3 className="text-lg font-bold text-red-700 mb-4">🔍 SELECT DEBUG</h3>
      
      {/* Info di debug */}
      <div className="mb-4 p-3 bg-white rounded-sm border">
        <h4 className="font-semibold mb-2">Debug Info:</h4>
        <pre className="text-xs overflow-auto">
          {JSON.stringify(debugInfo, null, 2)}
        </pre>
      </div>

      {/* Select di test */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Select di Test:</label>
        <SelectPrimitive.Root 
          value={value} 
          onValueChange={onValueChange}
          onOpenChange={setIsOpen}
        >
          <SelectPrimitive.Trigger
            className={cn(
              "flex h-10 w-full items-center justify-between rounded-md border border-input bg-white text-black px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              "bg-white text-black"
            )}
            style={{
              backgroundColor: 'white',
              color: 'black',
              border: '1px solid #d1d5db'
            }}
          >
            <SelectPrimitive.Value placeholder={placeholder} />
            <SelectPrimitive.Icon>
              <ChevronDown className="h-4 w-4" />
            </SelectPrimitive.Icon>
          </SelectPrimitive.Trigger>

          <SelectPrimitive.Portal>
            <SelectPrimitive.Content
              className="relative z-9999 min-w-32 overflow-hidden rounded-md border bg-white text-black shadow-md"
              style={{
                backgroundColor: 'white',
                color: 'black',
                border: '1px solid #e5e7eb',
                zIndex: 9999
              }}
            >
              <SelectPrimitive.Viewport className="p-1">
                {options.map((option) => (
                  <SelectPrimitive.Item
                    key={option.value}
                    value={option.value}
                    className="relative flex w-full cursor-default select-none items-center rounded-xs py-1.5 pl-8 pr-2 text-sm outline-hidden hover:bg-gray-100 focus:bg-blue-50"
                    style={{
                      backgroundColor: 'white',
                      color: 'black'
                    }}
                  >
                    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                      <SelectPrimitive.ItemIndicator>
                        <Check className="h-4 w-4" />
                      </SelectPrimitive.ItemIndicator>
                    </span>
                    <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.Viewport>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>
      </div>

      {/* Controlli manuali */}
      <div className="space-y-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="px-3 py-2 bg-blue-500 text-white rounded-sm text-sm"
        >
          Toggle Open: {isOpen ? 'CHIUSO' : 'APERTO'}
        </button>
        
        <button
          onClick={() => onValueChange?.('opzione1')}
          className="px-3 py-2 bg-green-500 text-white rounded-sm text-sm ml-2"
        >
          Set Opzione 1
        </button>
        
        <button
          onClick={() => onValueChange?.('')}
          className="px-3 py-2 bg-red-500 text-white rounded-sm text-sm ml-2"
        >
          Clear
        </button>
      </div>

      {/* Stato attuale */}
      <div className="mt-4 p-3 bg-white rounded-sm border">
        <h4 className="font-semibold mb-2">Stato Attuale:</h4>
        <p><strong>Valore:</strong> {value || 'Nessuno'}</p>
        <p><strong>Is Open:</strong> {isOpen ? 'Sì' : 'No'}</p>
        <p><strong>Timestamp:</strong> {new Date().toLocaleTimeString()}</p>
      </div>
    </div>
  )
}
