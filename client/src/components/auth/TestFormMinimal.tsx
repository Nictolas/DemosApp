import React from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TestFormMinimal() {
  const [formVisible, setFormVisible] = React.useState(true);
  const [renderCount, setRenderCount] = React.useState(0);
  const [lastAction, setLastAction] = React.useState("");

  const form = useForm({
    defaultValues: {
      nome: "",
      genere: "",
    }
  });

  const watchGenere = form.watch("genere");

  // Incrementa il contatore ad ogni render
  React.useEffect(() => {
    setRenderCount(prev => prev + 1);
  });

  const handleGenereChange = (value: string) => {
    setLastAction(`Genere cambiato in: ${value}`);
    form.setValue("genere", value);
    
    // Test: forza un re-render per vedere se causa problemi
    setTimeout(() => {
      setLastAction(`Dopo timeout: ${value}`);
    }, 100);
  };

  const toggleForm = () => {
    setFormVisible(!formVisible);
    setLastAction(`Form ${!formVisible ? 'mostrato' : 'nascosto'}`);
  };

  const forceRerender = () => {
    setRenderCount(prev => prev + 1);
    setLastAction("Forzato re-render");
  };

  if (!formVisible) {
    return (
      <div className="p-4 bg-yellow-100 border border-yellow-400 rounded">
        <h3>Form Nascosto</h3>
        <Button onClick={toggleForm}>Mostra Form</Button>
      </div>
    );
  }

  return (
    <div className="p-4 border border-gray-300 rounded space-y-4">
      <div className="bg-blue-100 p-2 rounded text-sm">
        <p><strong>Render Count:</strong> {renderCount}</p>
        <p><strong>Last Action:</strong> {lastAction}</p>
        <p><strong>Form Visibile:</strong> Sì</p>
        <p><strong>Genere Attuale:</strong> {watchGenere || "Nessuno"}</p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">
          Nome:
          <Input
            {...form.register("nome")}
            placeholder="Inserisci nome"
            className="mt-1"
          />
        </label>

        <label className="block text-sm font-medium">
          Genere:
          <select
            value={watchGenere}
            onChange={(e) => handleGenereChange(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          >
            <option value="">Seleziona genere</option>
            <option value="uomo">Uomo</option>
            <option value="donna">Donna</option>
            <option value="altro">Altro</option>
          </select>
        </label>
      </div>

      <div className="flex gap-2">
        <Button onClick={toggleForm} variant="outline">
          Nascondi Form
        </Button>
        <Button onClick={forceRerender} variant="outline">
          Force Re-render
        </Button>
        <Button onClick={() => setLastAction("Pulsante cliccato")}>
          Test Pulsante
        </Button>
      </div>
    </div>
  );
}
