import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Trophy, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Ministero {
  id: string;
  nome: string;
  categoria: string;
  descrizione?: string;
}

export default function GestisciGoverno() {
  const [ministeri, setMinisteri] = useState<Ministero[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: '', categoria: '', descrizione: '' });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const fetchMinisteri = () => {
    setLoading(true);
    fetch("/api/ministeri")
      .then((res) => res.json())
      .then((data) => {
        setMinisteri(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setError("Errore nel caricamento dei ministeri");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchMinisteri();
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    if (!form.nome.trim() || !form.categoria.trim()) {
      setAddError('Nome e categoria sono obbligatori');
      return;
    }
    setAdding(true);
    try {
      const res = await fetch('/api/ministeri', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: form.nome.trim(),
          categoria: form.categoria.trim(),
          descrizione: form.descrizione.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setAddError(err.error || 'Errore nell\'aggiunta');
      } else {
        setForm({ nome: '', categoria: '', descrizione: '' });
        fetchMinisteri();
      }
    } catch {
      setAddError('Errore di rete');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      <div className="container mx-auto max-w-4xl">
        <Card className="mb-6">
          <CardHeader className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-600" />
            <CardTitle className="text-2xl font-bold">Gestisci Governo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Qui potrai gestire i dati e le funzionalità relative al Governo ideale.</p>
            <p className="text-muted-foreground mb-4">Lista attuale dei ministeri (letti da Firestore):</p>
            <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-2 mb-6 items-end">
              <Input
                name="nome"
                placeholder="Nome ministero"
                value={form.nome}
                onChange={handleInput}
                className="md:w-1/3"
                required
              />
              <Input
                name="categoria"
                placeholder="Categoria (slug)"
                value={form.categoria}
                onChange={handleInput}
                className="md:w-1/4"
                required
              />
              <Input
                name="descrizione"
                placeholder="Descrizione (opzionale)"
                value={form.descrizione}
                onChange={handleInput}
                className="md:w-1/3"
              />
              <Button type="submit" disabled={adding} className="bg-yellow-600 hover:bg-yellow-700">
                <Plus className="h-4 w-4 mr-1" /> Aggiungi
              </Button>
            </form>
            {addError && <p className="text-red-600 mb-2">{addError}</p>}
            {loading && <p>Caricamento...</p>}
            {error && <p className="text-red-600">{error}</p>}
            {!loading && !error && (
              <div className="overflow-x-auto">
                <table className="min-w-full border text-sm bg-white rounded shadow">
                  <thead>
                    <tr className="bg-yellow-100">
                      <th className="px-3 py-2 border-b text-left">Nome</th>
                      <th className="px-3 py-2 border-b text-left">Categoria</th>
                      <th className="px-3 py-2 border-b text-left">Descrizione</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ministeri.length === 0 && (
                      <tr><td colSpan={3} className="text-center py-4">Nessun ministero presente.</td></tr>
                    )}
                    {ministeri.map((m) => (
                      <tr key={m.id} className="hover:bg-yellow-50">
                        <td className="px-3 py-2 border-b font-medium">{m.nome}</td>
                        <td className="px-3 py-2 border-b">{m.categoria}</td>
                        <td className="px-3 py-2 border-b text-muted-foreground">{m.descrizione}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 