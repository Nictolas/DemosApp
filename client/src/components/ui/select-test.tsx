import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown } from "lucide-react"

// Componente Select di test molto semplice
export function SelectTest() {
  const [value, setValue] = React.useState<string>("")

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Test Select Component</h2>
      
      <div className="space-y-2">
        <label className="text-sm font-medium">Test Select:</label>
        <SelectPrimitive.Root value={value} onValueChange={setValue}>
          <SelectPrimitive.Trigger 
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-white text-black px-3 py-2 text-sm"
            style={{
              backgroundColor: 'white',
              color: 'black',
              border: '1px solid #d1d5db'
            }}
          >
            <SelectPrimitive.Value placeholder="Seleziona..." />
            <SelectPrimitive.Icon>
              <ChevronDown className="h-4 w-4" />
            </SelectPrimitive.Icon>
          </SelectPrimitive.Trigger>
          
          <SelectPrimitive.Portal>
            <SelectPrimitive.Content 
              className="relative z-50 min-w-32 overflow-hidden rounded-md border bg-white text-black shadow-md"
              style={{
                backgroundColor: 'white',
                color: 'black',
                border: '1px solid #e5e7eb',
                zIndex: 9999
              }}
            >
              <SelectPrimitive.Viewport className="p-1">
                <SelectPrimitive.Item 
                  value="opzione1"
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
                  <SelectPrimitive.ItemText>Opzione 1</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
                
                <SelectPrimitive.Item 
                  value="opzione2"
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
                  <SelectPrimitive.ItemText>Opzione 2</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              </SelectPrimitive.Viewport>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>
        
        <p className="text-sm text-gray-600">Valore selezionato: {value || "Nessuno"}</p>
      </div>
    </div>
  )
}
