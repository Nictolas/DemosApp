import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown } from "lucide-react"

// Test specifico per mobile che simula il comportamento problematico
export function SelectMobileTest() {
  const [value, setValue] = React.useState("")
  const [isOpen, setIsOpen] = React.useState(false)
  const [testStep, setTestStep] = React.useState(0)
  const [testResults, setTestResults] = React.useState<string[]>([])
  const [isVisible, setIsVisible] = React.useState(true)

  // Simula il comportamento problematico dell'utente
  const runMobileTest = async () => {
    setTestResults([])
    setTestStep(1)
    
    // Step 1: Apri il Select
    setTestResults(prev => [...prev, "1. Apro il Select..."])
    setIsOpen(true)
    
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Step 2: Seleziona un'opzione
    setTestStep(2)
    setTestResults(prev => [...prev, "2. Seleziono 'Uomo'..."])
    setValue("uomo")
    setIsOpen(false)
    
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Step 3: Cambia valore (simula cambio genere)
    setTestStep(3)
    setTestResults(prev => [...prev, "3. Cambio in 'Donna'..."])
    setValue("donna")
    
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Step 4: Verifica visibilità
    setTestStep(4)
    setTestResults(prev => [...prev, "4. Verifico visibilità..."])
    
    // Simula il problema: nascondi temporaneamente
    setIsVisible(false)
    setTestResults(prev => [...prev, "🚨 PROBLEMA: Select è invisibile!"])
    
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Step 5: Ripristina visibilità
    setTestStep(5)
    setIsVisible(true)
    setTestResults(prev => [...prev, "5. Ripristino visibilità..."])
    
    setTestStep(0)
  }

  // Test di stabilità con touch events
  const testTouchStability = () => {
    setTestResults(prev => [...prev, "🧪 Test stabilità touch..."])
    
    // Simula multiple touch events
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        setValue(prev => prev === "uomo" ? "donna" : "uomo")
        setTestResults(prev => [...prev, `Touch ${i + 1}: Cambio valore`])
      }, i * 200)
    }
  }

  // Test di orientamento
  const testOrientation = () => {
    setTestResults(prev => [...prev, "📱 Test cambio orientamento..."])
    
    // Simula cambio orientamento
    const event = new Event('orientationchange')
    window.dispatchEvent(event)
    
    setTestResults(prev => [...prev, "Evento orientationchange inviato"])
  }

  // Test di zoom
  const testZoom = () => {
    setTestResults(prev => [...prev, "🔍 Test zoom..."])
    
    // Simula zoom
    const event = new Event('resize')
    window.dispatchEvent(event)
    
    setTestResults(prev => [...prev, "Evento resize inviato"])
  }

  return (
    <div className="p-4 border-4 border-green-500 bg-green-50 rounded-lg">
      <h3 className="text-xl font-bold text-green-700 mb-4">📱 SELECT MOBILE TEST - SIMULAZIONE PROBLEMA UTENTE</h3>
      
      {/* Test Results */}
      <div className="mb-4 p-3 bg-white rounded border">
        <h4 className="font-semibold mb-2">Risultati Test:</h4>
        <div className="space-y-1">
          {testResults.map((result, index) => (
            <div key={index} className="text-sm p-1 bg-gray-50 rounded">
              {result}
            </div>
          ))}
        </div>
      </div>

      {/* Test Controls */}
      <div className="mb-4 space-y-2">
        <button
          onClick={runMobileTest}
          className="px-4 py-2 bg-green-500 text-white rounded font-semibold"
          disabled={testStep > 0}
        >
          🚀 Esegui Test Mobile Completo
        </button>
        
        <button
          onClick={testTouchStability}
          className="px-4 py-2 bg-blue-500 text-white rounded ml-2"
        >
          🧪 Test Stabilità Touch
        </button>
        
        <button
          onClick={testOrientation}
          className="px-4 py-2 bg-purple-500 text-white rounded ml-2"
        >
          📱 Test Orientamento
        </button>
        
        <button
          onClick={testZoom}
          className="px-4 py-2 bg-orange-500 text-white rounded ml-2"
        >
          🔍 Test Zoom
        </button>
      </div>

      {/* Select di Test Mobile */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          Select Mobile Test {testStep > 0 && `(Step ${testStep})`}:
        </label>
        
        {isVisible ? (
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
                border: '2px solid green',
                position: 'relative',
                zIndex: 1
              }}
            >
              <SelectPrimitive.Value placeholder="Seleziona genere..." />
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
                  border: '2px solid green',
                  zIndex: 99999
                }}
              >
                <SelectPrimitive.Viewport className="p-1">
                  <SelectPrimitive.Item
                    value="uomo"
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
                    <SelectPrimitive.ItemText>Uomo</SelectPrimitive.ItemText>
                  </SelectPrimitive.Item>

                  <SelectPrimitive.Item
                    value="donna"
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
                    <SelectPrimitive.ItemText>Donna</SelectPrimitive.ItemText>
                  </SelectPrimitive.Item>

                  <SelectPrimitive.Item
                    value="altro"
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
                    <SelectPrimitive.ItemText>Altro</SelectPrimitive.ItemText>
                  </SelectPrimitive.Item>
                </SelectPrimitive.Viewport>
              </SelectPrimitive.Content>
            </SelectPrimitive.Portal>
          </SelectPrimitive.Root>
        ) : (
          <div className="h-10 w-full border-2 border-red-500 bg-red-100 flex items-center justify-center text-red-700 font-semibold">
            🚨 SELECT INVISIBILE - PROBLEMA SIMULATO!
          </div>
        )}
      </div>

      {/* Stato attuale */}
      <div className="p-3 bg-white rounded border">
        <h4 className="font-semibold mb-2">Stato Attuale:</h4>
        <p><strong>Valore:</strong> {value || 'Nessuno'}</p>
        <p><strong>Is Open:</strong> {isOpen ? 'Sì' : 'No'}</p>
        <p><strong>Visibile:</strong> {isVisible ? 'Sì' : 'No'}</p>
        <p><strong>Test Step:</strong> {testStep}</p>
        <p><strong>Timestamp:</strong> {new Date().toLocaleTimeString()}</p>
      </div>
    </div>
  )
}
