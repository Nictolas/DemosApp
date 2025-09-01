import React, { useState } from "react";
import { useElezioni } from "./hooks/useElezioni";
import { useElezioneForm } from "./hooks/useElezioneForm";
import { useElezioneActions } from "./hooks/useElezioneActions";
import { Header } from "./components/Header";
import { StatsCards } from "./components/StatsCards";
import { ElezioneForm } from "./components/ElezioneForm";
import { ElezioniList } from "./components/ElezioniList";

export default function GestisciElezioni() {
  const { elezioni, loading, loadElezioni } = useElezioni();
  const { handleEdit } = useElezioneForm(loadElezioni);
  const { handleDelete } = useElezioneActions(loadElezioni);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 page-with-navbar" style={{ paddingBottom: '6rem' }}>
      <div className="container mx-auto max-w-7xl p-6">
        {/* Header */}
        <Header />

        {/* Stats Cards */}
        <StatsCards elezioni={elezioni} />

        {/* Form Dialog */}
        <div className="mb-8">
          <ElezioneForm onSuccess={loadElezioni} />
        </div>

        {/* Lista Elezioni */}
        <ElezioniList 
          elezioni={elezioni}
          loading={loading}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
}
