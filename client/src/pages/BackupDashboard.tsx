import React from "react";
import { useLocation } from "wouter";
import { AlertTriangle, ArrowLeft, Database, FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/PageContainer";

export default function BackupDashboard() {
  const [, navigate] = useLocation();
  return (
    <PageContainer className="overflow-y-auto overscroll-contain bg-slate-50">
      <main className="mx-auto w-full max-w-4xl space-y-5 px-4 py-5">
        <Button variant="ghost" onClick={() => navigate("/admin/ops-center")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Torna a Sistema e sicurezza
        </Button>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Database className="h-6 w-6" /> Backup e ripristino
        </h1>
        <section role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-5">
          <h2 className="flex items-center gap-2 font-semibold text-amber-950">
            <AlertTriangle className="h-5 w-5" /> Backup applicativo legacy ritirato
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-amber-950">
            Il precedente formato JSON non rappresenta l'intero database DEMOS e non è
            utilizzabile per creare o ripristinare copie affidabili. Le relative azioni
            sono state disabilitate anche nel backend.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-amber-950">
            Questa schermata non prova né esclude l'esistenza di backup gestiti dal fornitore
            del database: stato, frequenza e capacità di ripristino vanno verificati
            direttamente presso il provider e documentati separatamente.
          </p>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <FileWarning className="h-5 w-5 text-slate-500" /> Esportazione non equivale a backup
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Per scaricare dati a fini di analisi resta disponibile lo strumento di export,
            ma non va presentato come un ripristino completo del sistema.
          </p>
          <Button variant="outline" className="mt-3" onClick={() => navigate("/admin/data-export")}>
            Apri esportazione dati
          </Button>
        </section>
      </main>
    </PageContainer>
  );
}
