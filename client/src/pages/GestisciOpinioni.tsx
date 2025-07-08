import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, Trash2, Plus, Edit, MessageSquare, ThumbsUp, Check, X } from "lucide-react";
import { useLocation } from "wouter";

export default function GestisciOpinioni() {
  const [, setLocation] = useLocation();
  const [opinioni, setOpinioni] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newId, setNewId] = useState("");
  const [newText, setNewText] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [proposte, setProposte] = useState([]);
  const [loadingProposte, setLoadingProposte] = useState(true);
  const [processingId, setProcessingId] = useState("");

  const fetchOpinioni = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/opinioni-list");
      if (!res.ok) throw new Error("Errore nel recupero delle opinioni");
      setOpinioni(await res.json());
    } catch (e) {
      setError("Errore nel caricamento delle opinioni");
    } finally {
      setLoading(false);
    }
  };

  const fetchProposte = async () => {
    setLoadingProposte(true);
    try {
      const res = await fetch("/api/opinioni-proposte");
      if (!res.ok) throw new Error();
      setProposte(await res.json());
    } catch {
      setProposte([]);
    } finally {
      setLoadingProposte(false);
    }
  };

  useEffect(() => { fetchOpinioni(); }, []);
  useEffect(() => { fetchProposte(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newId.trim() || !newText.trim()) return;
    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/opinioni-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: newId.trim(), text: newText.trim() })
      });
      if (!res.ok) throw new Error("Errore nell'aggiunta");
      setNewId("");
      setNewText("");
      await fetchOpinioni();
    } catch (e) {
      setError("Errore nell'aggiunta dell'opinione");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Sei sicuro di voler eliminare questa opinione? Verrà rimossa da tutto il sistema.")) return;
    setDeleting(id);
    setError("");
    try {
      const res = await fetch(`/api/opinioni-list/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Errore nell'eliminazione");
      await fetchOpinioni();
    } catch (e) {
      setError("Errore nell'eliminazione dell'opinione");
    } finally {
      setDeleting("");
    }
  };

  const handleEdit = (op: any) => {
    setEditingId(op.id);
    setEditText(op.text);
  };

  const handleEditSave = async (op: any) => {
    setSavingEdit(true);
    setError("");
    try {
      const patchRes = await fetch(`/api/opinioni-list/${op.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editText.trim() })
      });
      if (!patchRes.ok) throw new Error("Errore nel salvataggio della modifica");
      setEditingId(null);
      setEditText("");
      await fetchOpinioni();
    } catch (e) {
      setError("Errore nella modifica dell'opinione");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditText("");
  };

  const handleAccetta = async (id: string) => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/opinioni-proposte/${id}/accetta`, { method: "POST" });
      await fetchProposte();
      await fetchOpinioni();
    } finally {
      setProcessingId("");
    }
  };
  const handleRifiuta = async (id: string) => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/opinioni-proposte/${id}`, { method: "DELETE" });
      await fetchProposte();
    } finally {
      setProcessingId("");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      <div className="container mx-auto max-w-3xl">
        <Button variant="ghost" className="mb-4 flex items-center" onClick={() => setLocation("/gestisci")}> <ArrowLeft className="mr-2 h-4 w-4" /> Torna a Gestisci </Button>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Gestisci Opinioni</CardTitle>
            <CardDescription>Aggiungi o elimina le opinioni disponibili per gli utenti</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Opinioni proposte dagli utenti */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-5 w-5 text-fuchsia-600" />
                <span className="font-semibold">Opinioni proposte dagli utenti</span>
              </div>
              {loadingProposte ? (
                <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Caricamento...</div>
              ) : proposte.length === 0 ? (
                <div className="text-muted-foreground text-sm">Nessuna opinione proposta in attesa.</div>
              ) : (
                <ul className="space-y-2">
                  {proposte.map((op: any) => (
                    <li key={op.id} className="flex items-center justify-between border rounded px-3 py-2 bg-fuchsia-50">
                      <div className="flex flex-col">
                        <span className="font-medium">{op.testo}</span>
                        <span className="text-xs text-muted-foreground">Voti: {op.voti}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="default" onClick={() => handleAccetta(op.id)} disabled={processingId === op.id}><Check className="h-4 w-4" /></Button>
                        <Button size="sm" variant="destructive" onClick={() => handleRifiuta(op.id)} disabled={processingId === op.id}><X className="h-4 w-4" /></Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {loading ? (
              <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
            ) : error ? (
              <div className="text-center text-red-500 py-8">{error}</div>
            ) : (
              <>
                <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-2 mb-6 items-center">
                  <Input placeholder="ID opinione (es. caccia)" value={newId} onChange={e => setNewId(e.target.value)} className="max-w-xs" />
                  <Input placeholder="Testo opinione (es. Caccia)" value={newText} onChange={e => setNewText(e.target.value)} className="flex-1" />
                  <Button type="submit" disabled={adding || !newId.trim() || !newText.trim()} className="flex-shrink-0">
                    {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}Aggiungi
                  </Button>
                </form>
                <div className="space-y-2">
                  {opinioni.map((op: any) => (
                    <div key={op.id} className="flex items-center justify-between border rounded-lg px-4 py-2 bg-white shadow-sm">
                      <span className="font-medium">{op.text} <span className="text-xs text-muted-foreground">({op.id})</span></span>
                      <div className="flex gap-2">
                        {editingId === op.id ? (
                          <>
                            <input
                              className="border rounded px-2 py-1 text-sm mr-2"
                              value={editText}
                              onChange={e => setEditText(e.target.value)}
                              disabled={savingEdit}
                              style={{ minWidth: 180 }}
                            />
                            <Button size="sm" variant="outline" onClick={() => handleEditSave(op)} disabled={savingEdit || !editText.trim()}>
                              Salva
                            </Button>
                            <Button size="sm" variant="ghost" onClick={handleEditCancel} disabled={savingEdit}>
                              Annulla
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" onClick={() => handleEdit(op)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="destructive" disabled={deleting === op.id} onClick={() => handleDelete(op.id)}>
                              {deleting === op.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 