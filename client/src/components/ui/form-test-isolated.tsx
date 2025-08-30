import React, { useState } from "react"

// Form di test completamente isolato per capire il problema
export function FormTestIsolated() {
  const [formData, setFormData] = useState({
    nome: "",
    cognome: "",
    genere: "",
    cittadinanza: "",
    ruolo: ""
  })
  
  const [renderCount, setRenderCount] = useState(0)
  const [lastAction, setLastAction] = useState("")
  const [isVisible, setIsVisible] = useState(true)
  
  // Forza re-render
  const forceRender = () => {
    setRenderCount(prev => prev + 1)
    setLastAction("Force Render")
  }
  
  // Toggle visibilità
  const toggleVisibility = () => {
    setIsVisible(!isVisible)
    setLastAction("Toggle Visibility")
  }
  
  // Reset form
  const resetForm = () => {
    setFormData({
      nome: "",
      cognome: "",
      genere: "",
      cittadinanza: "",
      ruolo: ""
    })
    setLastAction("Reset Form")
  }
  
  // Simula crash
  const simulateCrash = () => {
    setLastAction("Simulate Crash")
    // Simula un errore che potrebbe causare il problema
    setTimeout(() => {
      setFormData({ nome: "", cognome: "", genere: "", cittadinanza: "", ruolo: "" })
      setIsVisible(false)
    }, 100)
  }
  
  // Recupera form
  const recoverForm = () => {
    setIsVisible(true)
    setFormData({
      nome: "Recuperato",
      cognome: "Recuperato", 
      genere: "uomo",
      cittadinanza: "italiana",
      ruolo: "cittadino"
    })
    setLastAction("Recover Form")
  }
  
  if (!isVisible) {
    return (
      <div className="p-4 bg-red-100 border border-red-300 rounded-lg">
        <h3 className="text-lg font-bold text-red-800 mb-2">🚨 FORM SPARITO!</h3>
        <p className="text-red-700 mb-4">Il form è stato reso invisibile. Clicca "Recupera Form" per ripristinarlo.</p>
        <button
          onClick={recoverForm}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          🔄 Recupera Form
        </button>
      </div>
    )
  }
  
  return (
    <div className="p-6 bg-blue-50 border border-blue-300 rounded-lg max-w-md mx-auto">
      <h2 className="text-xl font-bold text-blue-800 mb-4">🧪 FORM TEST ISOLATO</h2>
      
      {/* Info di debug */}
      <div className="mb-4 p-3 bg-blue-100 rounded text-sm">
        <p><strong>Render Count:</strong> {renderCount}</p>
        <p><strong>Last Action:</strong> {lastAction}</p>
        <p><strong>Form Visible:</strong> {isVisible ? "✅ Sì" : "❌ No"}</p>
      </div>
      
      {/* Controlli di test */}
      <div className="mb-4 space-y-2">
        <button
          onClick={forceRender}
          className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          🔄 Force Render
        </button>
        <button
          onClick={toggleVisibility}
          className="w-full px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
        >
          👁️ Toggle Visibility
        </button>
        <button
          onClick={resetForm}
          className="w-full px-3 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm"
        >
          🔄 Reset Form
        </button>
        <button
          onClick={simulateCrash}
          className="w-full px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
        >
          💥 Simula Crash
        </button>
      </div>
      
      {/* Form semplice */}
      <form className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nome
          </label>
          <input
            type="text"
            value={formData.nome}
            onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Inserisci nome"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cognome
          </label>
          <input
            type="text"
            value={formData.cognome}
            onChange={(e) => setFormData(prev => ({ ...prev, cognome: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Inserisci cognome"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Genere
          </label>
          <select
            value={formData.genere}
            onChange={(e) => setFormData(prev => ({ ...prev, genere: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Seleziona genere</option>
            <option value="uomo">Uomo</option>
            <option value="donna">Donna</option>
            <option value="altro">Altro</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cittadinanza
          </label>
          <select
            value={formData.cittadinanza}
            onChange={(e) => setFormData(prev => ({ ...prev, cittadinanza: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Seleziona cittadinanza</option>
            <option value="italiana">Italiana</option>
            <option value="straniera">Straniera</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ruolo
          </label>
          <select
            value={formData.ruolo}
            onChange={(e) => setFormData(prev => ({ ...prev, ruolo: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Seleziona ruolo</option>
            <option value="cittadino">Cittadino</option>
            <option value="candidato">Candidato</option>
            <option value="candidato_politico">Candidato Politico</option>
          </select>
        </div>
        
        <button
          type="submit"
          className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          ✅ Invia Form
        </button>
      </form>
      
      {/* Stato del form */}
      <div className="mt-4 p-3 bg-gray-100 rounded text-xs">
        <p><strong>Form Data:</strong></p>
        <pre className="text-xs overflow-auto">
          {JSON.stringify(formData, null, 2)}
        </pre>
      </div>
    </div>
  )
}
