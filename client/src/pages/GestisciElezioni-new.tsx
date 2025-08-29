import React, { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  ElectionsHeader, 
  ElectionsStats, 
  ElectionForm, 
  ElectionsList,
  type Elezione,
  type ElezioneForm
} from "@/components/gestisci-elezioni";

export default function GestisciElezioni() {
  const [elezioni, setElezioni] = useState<Elezione[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingElezione, setEditingElezione] = useState<Elezione | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  // Carica le elezioni
  const loadElezioni = async () => {
    setLoading(true);
    try {
      const response = await apiRequest("GET", "/api/elezioni");
      if (!response.ok) throw new Error("Errore nel caricamento.");
      const result = await response.json();
      
      if (result.success && Array.isArray(result.data)) {
        setElezioni(result.data);
      } else {
        console.error('❌ DEBUG: Formato risposta API non valido:', result);
        setElezioni([]);
      }
    } catch (error) {
      console.error('❌ DEBUG: Errore nel caricamento elezioni:', error);
      toast({ title: "Errore", description: "Impossibile caricare le elezioni", variant: "destructive" });
      setElezioni([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadElezioni();
  }, []);

  // Gestisce il submit del form
  const handleSubmit = async (data: ElezioneForm) => {
    setSubmitting(true);
    try {
      let response;
      
      if (editingElezione) {
        // Aggiorna elezione esistente
        response = await apiRequest("PUT", `/api/elezioni/${editingElezione.id}`, data);
        if (!response.ok) throw new Error("Errore nell'aggiornamento.");
        
        toast({ title: "Successo", description: "Elezione aggiornata con successo" });
      } else {
        // Crea nuova elezione
        response = await apiRequest("POST", "/api/elezioni", data);
        if (!response.ok) throw new Error("Errore nella creazione.");
        
        toast({ title: "Successo", description: "Elezione creata con successo" });
      }
      
      // Ricarica le elezioni
      await loadElezioni();
      
      // Chiudi il dialog e resetta l'editing
      setIsDialogOpen(false);
      setEditingElezione(null);
      
    } catch (error) {
      console.error('❌ DEBUG: Errore nel salvataggio:', error);
      toast({ 
        title: "Errore", 
        description: "Impossibile salvare l'elezione", 
        variant: "destructive" 
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Gestisce l'apertura del dialog per aggiungere nuova elezione
  const handleAddNew = () => {
    setEditingElezione(null);
    setIsDialogOpen(true);
  };

  // Gestisce l'editing di un'elezione
  const handleEdit = (elezione: Elezione) => {
    setEditingElezione(elezione);
    setIsDialogOpen(true);
  };

  // Gestisce la cancellazione di un'elezione
  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa elezione?")) return;
    
    try {
      const response = await apiRequest("DELETE", `/api/elezioni/${id}`);
      if (!response.ok) throw new Error("Errore nell'eliminazione.");
      
      toast({ title: "Successo", description: "Elezione eliminata con successo" });
      await loadElezioni();
      
    } catch (error) {
      console.error('❌ DEBUG: Errore nell\'eliminazione:', error);
      toast({ 
        title: "Errore", 
        description: "Impossibile eliminare l'elezione", 
        variant: "destructive" 
      });
    }
  };

  // Gestisce la chiusura del dialog
  const handleCancel = () => {
    setIsDialogOpen(false);
    setEditingElezione(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 page-with-navbar">
      <div className="container mx-auto max-w-7xl p-6">
        {/* Header con navigazione e pulsante aggiungi */}
        <ElectionsHeader onAddNew={handleAddNew} />
        
        {/* Statistiche generali */}
        <ElectionsStats elezioni={elezioni} />
        
        {/* Lista Elezioni */}
        <ElectionsList 
          elezioni={elezioni}
          loading={loading}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
        
        {/* Dialog per form di creazione/modifica */}
        {isDialogOpen && (
          <ElectionForm
            editingElezione={editingElezione}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            submitting={submitting}
          />
        )}
      </div>
    </div>
  );
}
