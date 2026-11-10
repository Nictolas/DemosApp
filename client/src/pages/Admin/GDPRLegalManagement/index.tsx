import React, { useEffect, useState } from "react";
import { Redirect, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { hasAdminCapability } from "@/lib/admin-access";
import { apiRequest } from "@/lib/queryClient";
import { PageContainer } from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ClipboardList, FileText, ShieldCheck, Clock } from "lucide-react";

type GdprOverview = {
  role: "Admin" | "DPO";
  gdpr_requests_total: number;
  gdpr_requests_pending: number;
  gdpr_requests_processing: number;
  gdpr_requests_completed: number;
  gdpr_requests_migration_excluded: number;
  retention_policy: string;
};

export default function GDPRLegalManagement() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const isAdmin = hasAdminCapability(user);
  const [summary, setSummary] = useState<GdprOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || !isAdmin) return;
    let active = true;
    apiRequest("GET", "/dpo/overview")
      .then(response => {
        if (!active) return;
        const data = response.data;
        if (!response.ok || data?.success !== true || data?.data?.role !== "Admin") {
          throw new Error("Riepilogo non disponibile.");
        }
        setSummary(data.data);
      })
      .catch(() => { if (active) setError("Indicatori GDPR non disponibili: nessun dato dimostrativo verrà mostrato."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authLoading, isAdmin]);

  if (authLoading) return <PageContainer><p role="status">Verifica autorizzazioni…</p></PageContainer>;
  if (!user) return <Redirect to="/auth" />;
  if (!isAdmin) return <Redirect to="/preferiti" />;

  const cards = [
    { label: "Richieste operative", value: summary?.gdpr_requests_total },
    { label: "In attesa", value: summary?.gdpr_requests_pending },
    { label: "In lavorazione", value: summary?.gdpr_requests_processing },
    { label: "Completate", value: summary?.gdpr_requests_completed },
  ];

  return (
    <PageContainer className="overflow-y-auto overscroll-contain bg-slate-50">
      <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-5 pb-12">
        <Button variant="ghost" onClick={() => navigate("/admin/ops-center")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Torna a Sistema e sicurezza
        </Button>
        <header className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">GDPR e documenti legali</h1>
          <p className="text-sm text-slate-600">
            Riepiloghi verificabili, senza valori o date dimostrative. I conteggi riguardano
            soltanto le richieste operative registrate nel sistema, non tutti i canali di contatto.
          </p>
        </header>
        {error && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
        <section aria-label="Richieste GDPR aggregate" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cards.map(card => (
            <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-600">{card.label}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
                {loading ? "…" : typeof card.value === "number" ? card.value : "N/D"}
              </p>
            </div>
          ))}
        </section>
        {summary && <p className="text-xs text-slate-600">
          Esclusi {summary.gdpr_requests_migration_excluded} record iniziali di migrazione.
          Stato delle regole di conservazione: {summary.retention_policy === "pending_approval" ? "in attesa di approvazione" : "da verificare"}.
        </p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <a href="/dpo" className="flex items-start gap-3 rounded-xl border bg-white p-4 text-slate-900 hover:border-indigo-300">
            <ShieldCheck className="h-6 w-6 shrink-0 text-indigo-700" />
            <span><strong className="block">Pannello DPO</strong><span className="text-sm text-slate-600">Supervisione in sola lettura e indicatori aggregati.</span></span>
          </a>
          <a href="/data-retention" className="flex items-start gap-3 rounded-xl border bg-white p-4 text-slate-900 hover:border-indigo-300">
            <Clock className="h-6 w-6 shrink-0 text-indigo-700" />
            <span><strong className="block">Conservazione dei dati</strong><span className="text-sm text-slate-600">Controllo delle politiche e dello stato delle procedure.</span></span>
          </a>
          <a href="/legal-documents" className="flex items-start gap-3 rounded-xl border bg-white p-4 text-slate-900 hover:border-indigo-300">
            <FileText className="h-6 w-6 shrink-0 text-indigo-700" />
            <span><strong className="block">Documenti pubblicati</strong><span className="text-sm text-slate-600">Accesso alle informative effettivamente presenti nell'app.</span></span>
          </a>
          <a href="/audit-dashboard" className="flex items-start gap-3 rounded-xl border bg-white p-4 text-slate-900 hover:border-indigo-300">
            <ClipboardList className="h-6 w-6 shrink-0 text-indigo-700" />
            <span><strong className="block">Audit amministrativo</strong><span className="text-sm text-slate-600">Consultazione delle operazioni registrate nel sistema.</span></span>
          </a>
        </div>
        <p className="text-xs text-slate-500">
          Nessuno di questi indicatori certifica automaticamente la conformità al GDPR.
          Le funzioni tecniche e le operazioni che modificano dati restano riservate all'Admin.
        </p>
      </main>
    </PageContainer>
  );
}
