import React, { useCallback, useEffect, useState } from "react";
import { Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { hasAdminCapability } from "@/lib/admin-access";
import { apiRequest } from "@/lib/queryClient";
import { PageContainer } from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Check, X, RefreshCw } from "lucide-react";

type Proposal = {
  id: string; category: string; title: string; details: string; source_url: string | null;
  proposer_user_id: string; created_at: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  capo_stato: "Capo di Stato", amnistia: "Amnistia",
  attivisti: "Attivisti", organizzazioni: "Organizzazioni"
};

export default function ProposteSoggetti() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [pending, setPending] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const isAdmin = hasAdminCapability(user);

  const refresh = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const r = await apiRequest("GET", "/api/subject-proposals/admin");
      const d = await r.json();
      setPending(d.proposals || []);
    } catch (_) {
      setError("Impossibile recuperare le proposte.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { if (isAdmin) void refresh(); }, [refresh, isAdmin]);

  const review = async (p: Proposal, decision: "approve" | "reject") => {
    if (submittingId) return;
    if (!window.confirm(decision === "approve"
      ? "Approvare e pubblicare «" + p.title + "» in " + CATEGORY_LABELS[p.category] + "?"
      : "Rifiutare la proposta «" + p.title + "»?")) return;
    setSubmittingId(p.id);
    try {
      await apiRequest("POST", "/api/subject-proposals/admin/" + p.id + "/decision", {
        decision, note: notes[p.id] || ""
      });
      setPending(old => old.filter(item => item.id !== p.id));
      toast({ title: decision === "approve" ? "Proposta approvata" : "Proposta rifiutata" });
    } catch (err: any) {
      toast({
        title: "Decisione non registrata",
        description: err?.data?.error || err?.message || "Riprova.",
        variant: "destructive"
      });
    } finally {
      setSubmittingId(null);
    }
  };

  if (isLoading) return <PageContainer className="flex items-center justify-center">Caricamento...</PageContainer>;
  if (!user) return <Redirect to="/auth" />;
  if (!isAdmin) return <Redirect to="/preferiti" />;

  return (
    <PageContainer className="overflow-hidden bg-slate-50">
      <div className="flex h-full min-h-0 flex-col px-4 py-3">
        <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Proposte di nuovi soggetti</h1>
            <p className="text-sm text-slate-600">Solo l'admin può rendere pubbliche le proposte.</p>
          </div>
          <Button variant="outline" onClick={refresh} disabled={loading} aria-label="Aggiorna proposte">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <div className="app-page-scroll min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pb-6" role="region" aria-label="Coda proposte" tabIndex={0}>
          {loading && <p className="text-sm">Aggiornamento...</p>}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          {!loading && !error && pending.length === 0 && <p className="text-sm text-slate-600">Nessuna proposta in attesa.</p>}
          {pending.map(p => (
            <article key={p.id} className="space-y-2 rounded-xl border bg-white p-3 shadow-sm">
              <p className="text-xs font-medium text-slate-600">{CATEGORY_LABELS[p.category]}</p>
              <h2 className="break-words text-lg font-semibold">{p.title}</h2>
              {p.details && <p className="whitespace-pre-wrap break-words text-sm">{p.details}</p>}
              {p.source_url?.startsWith("https://") && (
                <a href={p.source_url} rel="noopener noreferrer" target="_blank" className="text-sm text-blue-700 underline">Fonte pubblica</a>
              )}
              <p className="text-xs text-slate-500">Inviata: {new Date(p.created_at).toLocaleDateString("it-IT")}</p>
              <Input maxLength={500} placeholder="Motivazione facoltativa" value={notes[p.id] ?? ""} onChange={e => setNotes(prev => ({ ...prev, [p.id]: e.target.value }))} />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => review(p, "approve")} disabled={!!submittingId}>
                  <Check className="mr-1 h-4 w-4" /> Approva
                </Button>
                <Button variant="outline" onClick={() => review(p, "reject")} disabled={!!submittingId}>
                  <X className="mr-1 h-4 w-4" /> Rifiuta
                </Button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
