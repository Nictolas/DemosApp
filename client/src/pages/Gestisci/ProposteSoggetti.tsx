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
  created_at: string;
};
type ApprovedSubject = { id: string; category: string; title: string; reviewed_at: string };
type WithdrawalNotice = { id: string; category: string; withdrawn_at: string | null };

const CATEGORY_LABELS: Record<string, string> = {
  capo_stato: "Capo di Stato", amnistia: "Amnistia",
  attivisti: "Attivisti", organizzazioni: "Organizzazioni"
};

export default function ProposteSoggetti() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [pending, setPending] = useState<Proposal[]>([]);
  const [approved, setApproved] = useState<ApprovedSubject[]>([]);
  const [showApproved, setShowApproved] = useState(false);
  const [showUndelivered, setShowUndelivered] = useState(false);
  const [undelivered, setUndelivered] = useState<WithdrawalNotice[]>([]);
  const [loadingUndelivered, setLoadingUndelivered] = useState(false);
  const [loadingApproved, setLoadingApproved] = useState(false);
  const [undeliveredNotification, setUndeliveredNotification] = useState(false);
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

  const refreshApproved = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingApproved(true);
    setError(null);
    try {
      const r = await apiRequest("GET", "/api/subject-proposals/admin/approved");
      const d = await r.json();
      setApproved(d.proposals || []);
    } catch (_) {
      setError("Impossibile recuperare le pubblicazioni.");
    } finally {
      setLoadingApproved(false);
    }
  }, [isAdmin]);

  const refreshUndelivered = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingUndelivered(true);
    setError(null);
    try {
      const r = await apiRequest("GET", "/api/subject-proposals/admin/withdraw-notifications");
      const d = await r.json();
      setUndelivered(d.withdrawals || []);
      setUndeliveredNotification((d.withdrawals || []).length > 0);
    } catch (_) {
      // Do not display a stale "all sent" confirmation if the audit is unavailable.
      setError("Impossibile verificare le notifiche dei ritiri.");
    } finally {
      setLoadingUndelivered(false);
    }
  }, [isAdmin]);

  const switchPending = () => {
    setShowApproved(false);
    setShowUndelivered(false);
    setError(null);
  };
  const switchApproved = () => {
    if (showApproved) return;
    setShowApproved(true);
    setShowUndelivered(false);
    void refreshApproved();
  };
  const switchUndelivered = () => {
    if (showUndelivered) return;
    setShowApproved(false);
    setShowUndelivered(true);
    void refreshUndelivered();
  };

  const withdraw = async (p: ApprovedSubject) => {
    if (submittingId) return;
    const note = (notes[p.id] || "").trim();
    if (note.length < 3 || note.length > 500) {
      toast({ title: "Inserisci una motivazione da 3 a 500 caratteri", variant: "destructive" });
      return;
    }
    if (!window.confirm("Ritirare «" + p.title + "» dall'elenco pubblico? La decisione originale resterà tracciata.")) return;
    setSubmittingId(p.id);
    try {
      const response = await apiRequest("POST", "/api/subject-proposals/admin/" + p.id + "/withdraw", { note });
      const result = await response.json();
      setApproved(old => old.filter(item => item.id !== p.id));
      setNotes(old => { const next = { ...old }; delete next[p.id]; return next; });
      if (result.notification_sent !== true) setUndeliveredNotification(true);
      toast({
        title: "Pubblicazione ritirata",
        description: result.notification_sent === true
          ? "La voce non sarà più inclusa negli elenchi pubblici."
          : "La voce è stata ritirata, ma la notifica non è stata consegnata. Segnalare al DPO."
      });
    } catch (err: any) {
      toast({ title: "Ritiro non registrato", description: err?.data?.error || err?.message || "Riprova.", variant: "destructive" });
    } finally {
      setSubmittingId(null);
    }
  };

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
          <Button variant="outline" onClick={() => showUndelivered ? void refreshUndelivered() : showApproved ? void refreshApproved() : void refresh()} disabled={showUndelivered ? loadingUndelivered : showApproved ? loadingApproved : loading} aria-label="Aggiorna proposte">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        {undeliveredNotification && (
          <p role="alert" className="mb-3 shrink-0 rounded-lg border border-amber-400 bg-amber-50 p-2 text-sm text-amber-900">
            Almeno un ritiro è riuscito senza notifica al proponente. Segnalarlo al DPO per la gestione della comunicazione.
          </p>
        )}
        <div className="mb-3 flex shrink-0 gap-2">
          <Button type="button" variant={!showApproved && !showUndelivered ? "default" : "outline"} onClick={switchPending} disabled={!!submittingId}>
            In attesa
          </Button>
          <Button type="button" variant={showApproved ? "default" : "outline"} onClick={switchApproved} disabled={!!submittingId}>
            Pubblicate
          </Button>
          <Button type="button" variant={showUndelivered ? "default" : "outline"} onClick={switchUndelivered} disabled={!!submittingId}>
            Avvisi da verificare
          </Button>
        </div>
        <div className="app-page-scroll min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pb-6" role="region" aria-label={showUndelivered ? "Notifiche di ritiro da verificare" : showApproved ? "Pubblicazioni da gestire" : "Coda proposte"} tabIndex={0}>
          {!showApproved && !showUndelivered && loading && <p className="text-sm">Aggiornamento...</p>}
          {showApproved && loadingApproved && <p className="text-sm">Aggiornamento pubblicazioni...</p>}
          {showUndelivered && loadingUndelivered && <p className="text-sm">Verifica notifiche in corso...</p>}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          {!showApproved && !showUndelivered && !loading && !error && pending.length === 0 && <p className="text-sm text-slate-600">Nessuna proposta in attesa.</p>}
          {showApproved && !loadingApproved && !error && approved.length === 0 && <p className="text-sm text-slate-600">Nessuna pubblicazione gestibile qui. Capo di Stato e Amnistia richiedono un percorso separato.</p>}
          {!showApproved && !showUndelivered && pending.map(p => (
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
          {showUndelivered && !loadingUndelivered && !error && undelivered.length === 0 && (
            <p className="text-sm text-slate-600">Nessuna notifica di ritiro da verificare.</p>
          )}
          {showUndelivered && !loadingUndelivered && !error && (
            <p className="text-sm text-slate-600">
              Elenco caricato su richiesta. Le notifiche non confermate, incluse quelle storiche di esito sconosciuto,
              richiedono verifica DPO: non verranno reinviate automaticamente.
            </p>
          )}
          {showUndelivered && !loadingUndelivered && !error && undelivered.map(item => (
            <article key={item.id} className="rounded-xl border bg-white p-3 shadow-sm">
              <p className="text-sm font-medium">{CATEGORY_LABELS[item.category] || item.category}</p>
              <p className="text-xs text-slate-600">
                Ritiro: {item.withdrawn_at ? new Date(item.withdrawn_at).toLocaleDateString("it-IT") : "Data da verificare"}
              </p>
              <p className="break-all font-mono text-xs text-slate-500">Riferimento {item.id}</p>
              <p className="text-xs text-slate-700">Verificare la comunicazione con il DPO. Non reinviare senza controllo.</p>
            </article>
          ))}
          {showApproved && approved.map(p => (
            <article key={p.id} className="space-y-2 rounded-xl border bg-white p-3 shadow-sm">
              <p className="text-xs font-medium text-slate-600">{CATEGORY_LABELS[p.category]}</p>
              <h2 className="break-words text-base font-semibold">{p.title}</h2>
              <p className="text-xs text-slate-500">Approvata: {new Date(p.reviewed_at).toLocaleDateString("it-IT")}</p>
              <Input maxLength={500} placeholder="Motivazione ritiro (obbligatoria, senza dati personali)"
                aria-label={"Motivazione del ritiro di " + p.title} value={notes[p.id] ?? ""}
                onChange={e => setNotes(prev => ({ ...prev, [p.id]: e.target.value }))} />
              <Button variant="destructive" type="button" disabled={!!submittingId}
                onClick={() => void withdraw(p)}>
                <X className="mr-1 h-4 w-4" /> Ritira dall'elenco pubblico
              </Button>
            </article>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
