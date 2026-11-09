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
import { DEMO_SUBJECT_PROPOSALS } from "./demoSubjectProposals";

type Proposal = {
  id: string; category: string; title: string; details: string; source_url: string | null;
  created_at: string;
};
type ApprovedSubject = { id: string; category: string; title: string; reviewed_at: string };
type WithdrawalNotice = { id: string; category: string; withdrawn_at: string | null; recipient_unavailable: boolean };
type UnconfirmedProposalNotice = {
  id: string; category: string; status: string; created_at: string; reviewed_at: string | null;
  submission_notification_sent: boolean | null; review_notification_sent: boolean | null;
  recipient_unavailable: boolean;
};

const SELF_PROFILE_CATEGORIES = new Set(["attivisti","organizzazioni"]);

const CATEGORY_LABELS: Record<string, string> = {
  capo_stato: "Capo di Stato", amnistia: "Amnistia",
  attivisti: "Attivisti", organizzazioni: "Organizzazioni"
};

export default function ProposteSoggetti() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [showDemo, setShowDemo] = useState(false);
  const [pending, setPending] = useState<Proposal[]>([]);
  const [pendingCursor, setPendingCursor] = useState<string | null>(null);
  const [approved, setApproved] = useState<ApprovedSubject[]>([]);
  const [approvedCursor, setApprovedCursor] = useState<string | null>(null);
  const [showApproved, setShowApproved] = useState(false);
  const [showUndelivered, setShowUndelivered] = useState(false);
  const [undelivered, setUndelivered] = useState<WithdrawalNotice[]>([]);
  const [unconfirmedProposals, setUnconfirmedProposals] = useState<UnconfirmedProposalNotice[]>([]);
  const [withdrawalAuditCursor, setWithdrawalAuditCursor] = useState<string | null>(null);
  const [proposalAuditCursor, setProposalAuditCursor] = useState<string | null>(null);
  const [loadingUndelivered, setLoadingUndelivered] = useState(false);
  const [loadingApproved, setLoadingApproved] = useState(false);
  const [undeliveredNotification, setUndeliveredNotification] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [videoVerified, setVideoVerified] = useState<Record<string, boolean>>({});
  const [representativeRole, setRepresentativeRole] = useState<Record<string, string>>({});
  const [roleEvidenceKind, setRoleEvidenceKind] = useState<Record<string, string>>({});
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
      setPendingCursor(d.next_cursor || null);
    } catch (_) {
      setPending([]);
      setPendingCursor(null);
      setError("Impossibile recuperare le proposte.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  const loadMorePending = async () => {
    if (!isAdmin || !pendingCursor || loading || submittingId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiRequest("GET",
        "/api/subject-proposals/admin?cursor=" + encodeURIComponent(pendingCursor));
      const next = await response.json();
      setPending(old => {
        const existing = new Set(old.map(item => item.id));
        return [...old, ...(next.proposals || []).filter((item: Proposal) => !existing.has(item.id))];
      });
      setPendingCursor(next.next_cursor || null);
    } catch (_) {
      setError("Impossibile caricare le richieste successive. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (isAdmin) void refresh(); }, [refresh, isAdmin]);

  const refreshApproved = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingApproved(true);
    setError(null);
    try {
      const r = await apiRequest("GET", "/api/subject-proposals/admin/approved");
      const d = await r.json();
      setApproved(d.proposals || []);
      setApprovedCursor(d.next_cursor || null);
    } catch (_) {
      setApproved([]);
      setApprovedCursor(null);
      setError("Impossibile recuperare le pubblicazioni.");
    } finally {
      setLoadingApproved(false);
    }
  }, [isAdmin]);

  const loadMoreApproved = async () => {
    if (!isAdmin || !approvedCursor || loadingApproved || submittingId) return;
    setLoadingApproved(true);
    setError(null);
    try {
      const response = await apiRequest("GET",
        "/api/subject-proposals/admin/approved?cursor=" + encodeURIComponent(approvedCursor));
      const next = await response.json();
      setApproved(old => {
        const existing = new Set(old.map(item => item.id));
        return [...old, ...(next.proposals || []).filter((item: ApprovedSubject) => !existing.has(item.id))];
      });
      setApprovedCursor(next.next_cursor || null);
    } catch (_) {
      setError("Impossibile caricare le pubblicazioni precedenti. Riprova.");
    } finally {
      setLoadingApproved(false);
    }
  };

  const refreshUndelivered = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingUndelivered(true);
    setError(null);
    try {
      const [withdrawalResponse, proposalResponse] = await Promise.all([
        apiRequest("GET", "/api/subject-proposals/admin/withdraw-notifications"),
        apiRequest("GET", "/api/subject-proposals/admin/notification-audit"),
      ]);
      const withdrawal = await withdrawalResponse.json();
      const proposals = await proposalResponse.json();
      setUndelivered(withdrawal.withdrawals || []);
      setUnconfirmedProposals(proposals.proposals || []);
      setWithdrawalAuditCursor(withdrawal.next_cursor || null);
      setProposalAuditCursor(proposals.next_cursor || null);
      setUndeliveredNotification((withdrawal.withdrawals || []).length > 0 || (proposals.proposals || []).length > 0);
    } catch (_) {
      // Do not display a stale "all sent" confirmation if the audit is unavailable.
      setError("Impossibile verificare gli avvisi delle proposte e dei ritiri.");
    } finally {
      setLoadingUndelivered(false);
    }
  }, [isAdmin]);

  // Both audit queues have independent cursors. Read only on explicit Admin action;
  // never retry a personal notification merely because an item is visible here.
  const loadMoreUndelivered = async () => {
    if (!isAdmin || loadingUndelivered || submittingId || (!withdrawalAuditCursor && !proposalAuditCursor)) return;
    setLoadingUndelivered(true);
    setError(null);
    try {
      const [withdrawal, proposals] = await Promise.all([
        withdrawalAuditCursor
          ? apiRequest("GET", "/api/subject-proposals/admin/withdraw-notifications?cursor=" +
              encodeURIComponent(withdrawalAuditCursor)).then(r => r.json())
          : Promise.resolve(null),
        proposalAuditCursor
          ? apiRequest("GET", "/api/subject-proposals/admin/notification-audit?cursor=" +
              encodeURIComponent(proposalAuditCursor)).then(r => r.json())
          : Promise.resolve(null),
      ]);
      if (withdrawal) {
        setUndelivered(old => {
          const existing = new Set(old.map(item => item.id));
          return [...old, ...(withdrawal.withdrawals || []).filter((item: WithdrawalNotice) => !existing.has(item.id))];
        });
        setWithdrawalAuditCursor(withdrawal.next_cursor || null);
      }
      if (proposals) {
        setUnconfirmedProposals(old => {
          const existing = new Set(old.map(item => item.id));
          return [...old, ...(proposals.proposals || []).filter((item: UnconfirmedProposalNotice) => !existing.has(item.id))];
        });
        setProposalAuditCursor(proposals.next_cursor || null);
      }
    } catch (_) {
      setError("Impossibile caricare gli avvisi precedenti. Riprova.");
    } finally {
      setLoadingUndelivered(false);
    }
  };

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
    if (!window.confirm("Ritirare «" + p.title + "» dall'elenco pubblico? La decisione originale e gli eventuali voti storici resteranno conservati, ma la voce non dovrà più ricevere nuovi voti.")) return;
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
          ? "La voce non sarà più inclusa negli elenchi pubblici. Gli eventuali voti storici sono conservati."
          : "La voce è stata ritirata; la notifica non è confermata. Gli eventuali voti storici sono conservati. Verificare con il DPO."
      });
    } catch (err: any) {
      toast({ title: "Ritiro non registrato", description: err?.data?.error || err?.message || "Riprova.", variant: "destructive" });
    } finally {
      setSubmittingId(null);
    }
  };

  const attestVideoVerification = async (p: Proposal) => {
    if (submittingId || !SELF_PROFILE_CATEGORIES.has(p.category)) return;
    const organization = p.category === "organizzazioni";
    const role = representativeRole[p.id] || "";
    const evidence = roleEvidenceKind[p.id] || "";
    if (organization && (!role || !evidence)) {
      toast({ title: "Verifica incompleta", description: "Indica la carica verificata e il tipo di riscontro ufficiale.", variant: "destructive" });
      return;
    }
    const message = organization
      ? "Confermi di avere svolto la videocall privata, confrontato il titolare CIE con la candidatura e verificato la carica mediante una fonte ufficiale? Non indicare qui dati o link della riunione."
      : "Confermi di avere svolto la videocall privata e verificato che il titolare CIE sia la persona candidata? La sola apertura di Google Meet non è una verifica.";
    if (!window.confirm(message)) return;
    setSubmittingId(p.id);
    try {
      const r = await apiRequest("POST", "/api/subject-proposals/admin/" + p.id + "/verify-profile", {
        identity_match_confirmed: true,
        ...(organization ? { representative_role: role, role_evidence_kind: evidence } : {})
      });
      const d = await r.json();
      if (d.success !== true || d.verification_recorded !== true) throw new Error("Verifica non registrata");
      setVideoVerified(old => ({ ...old, [p.id]: true }));
      toast({ title: "Verifica registrata", description: "L'Admin può ora valutare l'approvazione, subordinata ai controlli GDPR." });
    } catch (err: any) {
      toast({ title: "Verifica non registrata", description: err?.data?.error || err?.message || "Riprova.", variant: "destructive" });
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
      const response = await apiRequest("POST", "/api/subject-proposals/admin/" + p.id + "/decision", {
        decision, note: notes[p.id] || ""
      });
      const result = await response.json();
      setPending(old => old.filter(item => item.id !== p.id));
      if (result.notification_sent !== true) setUndeliveredNotification(true);
      toast({
        title: decision === "approve" ? "Proposta approvata" : "Proposta rifiutata",
        description: result.notification_sent === true ? "Esito registrato." :
          "Esito registrato, ma notifica non confermata. Verificare nel pannello Admin; non reinviare senza controllo."
      });
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
            Una o più notifiche relative alle proposte non sono confermate. Verificarle con il DPO; non reinviarle automaticamente.
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
        {!showApproved && !showUndelivered && (
          <div className="mb-3 shrink-0">
            <Button type="button" variant="outline" onClick={() => setShowDemo(value => !value)}
              aria-pressed={showDemo} disabled={!!submittingId}>
              {showDemo ? "Nascondi i 4 esempi TEST" : "Mostra i 4 esempi TEST"}
            </Button>
          </div>
        )}
        <div className="app-page-scroll min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pb-6" role="region" aria-label={showUndelivered ? "Avvisi delle proposte e dei ritiri da verificare" : showApproved ? "Pubblicazioni da gestire" : "Coda proposte"} tabIndex={0}>
          {!showApproved && !showUndelivered && loading && <p className="text-sm">Aggiornamento...</p>}
          {showApproved && loadingApproved && <p className="text-sm">Aggiornamento pubblicazioni...</p>}
          {showUndelivered && loadingUndelivered && <p className="text-sm">Verifica notifiche in corso...</p>}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          {!showApproved && !showUndelivered && !loading && !error && pending.length === 0 && <p className="text-sm text-slate-600">Nessuna proposta reale in attesa.</p>}
          {showApproved && !loadingApproved && !error && approved.length === 0 && <p className="text-sm text-slate-600">Nessuna pubblicazione gestibile qui. Le richieste Grazia conservano la propria coda separata.</p>}
          {!showApproved && !showUndelivered && showDemo && (
            <section className="space-y-3 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/60 p-3" aria-label="Esempi dimostrativi di proposte">
              <div role="status" className="text-sm text-blue-950">
                <p className="font-semibold">MODALITÀ TEST — 4 esempi fittizi dello staging</p>
                <p>Queste schede non sono proposte reali. Nessun utente o voto viene creato, nessun dato viene salvato e i comandi di moderazione sono disabilitati.</p>
              </div>
              {DEMO_SUBJECT_PROPOSALS.map(item => (
                <article key={item.id} className="space-y-2 rounded-xl border border-blue-200 bg-white p-3 shadow-sm">
                  <p className="text-xs font-semibold text-blue-800">TEST — {CATEGORY_LABELS[item.category]}</p>
                  <h2 className="break-words text-lg font-semibold">{item.title}</h2>
                  <p className="text-xs text-slate-600">Proponente: utente di prova dello staging, non un account di produzione.</p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" disabled>Approva (solo anteprima)</Button>
                    <Button type="button" variant="outline" disabled>Rifiuta (solo anteprima)</Button>
                  </div>
                </article>
              ))}
            </section>
          )}
          {!showApproved && !showUndelivered && pending.map(p => (
            <article key={p.id} className="space-y-2 rounded-xl border bg-white p-3 shadow-sm">
              <p className="text-xs font-medium text-slate-600">{CATEGORY_LABELS[p.category]}</p>
              <h2 className="break-words text-lg font-semibold">{p.title}</h2>
              {p.details && <p className="whitespace-pre-wrap break-words text-sm">{p.details}</p>}
              {p.source_url?.startsWith("https://") && (
                <a href={p.source_url} rel="noopener noreferrer" target="_blank" className="text-sm text-blue-700 underline">Fonte pubblica</a>
              )}
              <p className="text-xs text-slate-500">Inviata: {new Date(p.created_at).toLocaleDateString("it-IT")}</p>
              {SELF_PROFILE_CATEGORIES.has(p.category) && (
                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="font-medium">Prima approvazione: CIE e videocall obbligatorie</p>
                  <p className="text-slate-600">Apri Google Meet e svolgi la verifica privata prima di attestare l'esito. Non registrare la chiamata e non inserire link, documenti o dati del partecipante nel registro.</p>
                  <a href="https://meet.google.com/" rel="noopener noreferrer" target="_blank" className="inline-block text-blue-700 underline">Apri Google Meet</a>
                  {p.category === "organizzazioni" && (
                    <div className="space-y-2">
                      <label className="block text-slate-700">
                        Carica del referente
                        <select aria-label="Carica verificata" className="mt-1 w-full rounded border bg-white p-2" value={representativeRole[p.id] || ""}
                          onChange={e => setRepresentativeRole(old => ({...old,[p.id]:e.target.value}))}>
                          <option value="">Seleziona la carica verificata</option>
                          <option value="presidente">Presidente</option>
                          <option value="rappresentante_legale">Rappresentante legale</option>
                        </select>
                      </label>
                      <label className="block text-slate-700">
                        Metodo di verifica della carica
                        <select aria-label="Fonte verifica carica" className="mt-1 w-full rounded border bg-white p-2" value={roleEvidenceKind[p.id] || ""}
                          onChange={e => setRoleEvidenceKind(old => ({...old,[p.id]:e.target.value}))}>
                          <option value="">Seleziona il riscontro effettuato</option>
                          <option value="official_registry">Registro ufficiale</option>
                          <option value="official_document">Documento ufficiale</option>
                        </select>
                      </label>
                    </div>
                  )}
                  <Button type="button" variant="outline" onClick={() => void attestVideoVerification(p)}
                    disabled={!!submittingId || videoVerified[p.id] === true}>
                    {videoVerified[p.id] === true ? "Verifica registrata" : "Attesta videocall effettuata"}
                  </Button>
                </div>
              )}
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
          {!showApproved && !showUndelivered && pendingCursor && !loading && (
            <Button type="button" variant="outline" onClick={() => void loadMorePending()}
              disabled={!!submittingId} className="w-full">
              Carica altre richieste
            </Button>
          )}
          {showUndelivered && !loadingUndelivered && !error && undelivered.length === 0 && unconfirmedProposals.length === 0 && (
            <p className="text-sm text-slate-600">Nessun avviso di proposta o ritiro da verificare.</p>
          )}
          {showUndelivered && !loadingUndelivered && !error && (
            <p className="text-sm text-slate-600">
              Elenco caricato su richiesta. Gli avvisi non confermati, incluse le notifiche storiche di esito sconosciuto,
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
              <p className="text-xs text-slate-700">
                {item.recipient_unavailable
                  ? "Destinatario assente o non attivo: l'avviso personale non è inviabile. Non associarlo a un altro account."
                  : "Destinatario attivo: verificare con il DPO se l'avviso sia già stato inserito. Non reinviare senza controllo."}
              </p>
            </article>
          ))}
          {showUndelivered && !loadingUndelivered && !error && unconfirmedProposals.map(item => (
            <article key={item.id} className="rounded-xl border bg-white p-3 shadow-sm">
              <p className="text-sm font-medium">{CATEGORY_LABELS[item.category] || item.category}</p>
              <p className="text-xs text-slate-700">
                {item.submission_notification_sent !== true ? "Avviso iniziale non confermato. " : ""}
                {item.status !== "pending" && item.review_notification_sent !== true
                  ? "Comunicazione dell'esito non confermata." : ""}
              </p>
              <p className="text-xs text-slate-600">
                Registrata: {new Date(item.created_at).toLocaleDateString("it-IT")}
              </p>
              <p className="break-all font-mono text-xs text-slate-500">Riferimento {item.id}</p>
              <p className="text-xs text-slate-700">
                {item.status !== "pending" && item.review_notification_sent !== true && item.recipient_unavailable
                  ? "Esito senza destinatario attivo: comunicazione personale non applicabile. Non riassociare ad altri account."
                  : "Verificare con il DPO. Un avviso non confermato non prova la mancata consegna; non reinviare automaticamente."}
              </p>
            </article>
          ))}
          {showUndelivered && !loadingUndelivered && (withdrawalAuditCursor || proposalAuditCursor) && (
             <Button type="button" variant="outline" className="w-full"
               onClick={() => void loadMoreUndelivered()} disabled={!!submittingId}>
               Carica altri avvisi da verificare
             </Button>
           )}
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
          {showApproved && approvedCursor && !loadingApproved && (
            <Button type="button" variant="outline" onClick={() => void loadMoreApproved()}
              disabled={!!submittingId} className="w-full">
              Carica altre pubblicazioni
            </Button>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
