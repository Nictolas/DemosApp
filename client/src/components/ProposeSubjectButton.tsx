import React, { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export type ProposalCategory = "capo_stato" | "grazia" | "amnistia" | "attivisti" | "organizzazioni";

const LABELS: Record<ProposalCategory, string> = {
  capo_stato: "un candidato a Capo di Stato",
  grazia: "una persona per Grazia",
  amnistia: "un reato per Amnistia",
  attivisti: "un attivista",
  organizzazioni: "un'organizzazione"
};

export function ProposeSubjectButton({ category }: { category: ProposalCategory }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [canSubmit, setCanSubmit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");

  const show = async () => {
    setOpen(true);
    setChecking(true);
    setCanSubmit(false);
    try {
      // No new personal read on page load; verify pending status only when + is clicked.
      const r = await apiRequest("GET", "/api/subject-proposals/mine?category=" + category);
      const data = await r.json();
      setPending(data.pending?.title ?? null);
      setCanSubmit(!data.pending);
    } catch (_) {
      setCanSubmit(false); // No accidental bypass if the status check is unavailable.
      toast({ title: "Verifica non disponibile", description: "Impossibile controllare le proposte in attesa.", variant: "destructive" });
    } finally {
      setChecking(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || saving || title.trim().length < 3) return;
    setSaving(true);
    try {
      await apiRequest("POST", "/api/subject-proposals", {
        category, title: title.trim(), details: details.trim(), source_url: sourceUrl.trim()
      });
      setPending(title.trim());
      setCanSubmit(false);
      toast({ title: "Proposta inviata", description: "L'amministratore deve approvarla prima che sia pubblicata." });
      setOpen(false);
      setTitle("");
      setDetails("");
      setSourceUrl("");
    } catch (error: any) {
      toast({
        title: "Proposta non inviata",
        description: error?.data?.message || error?.message || "Controlla i dati e riprova.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={show}
        aria-label={"Proponi " + LABELS[category]}
        title={"Proponi " + LABELS[category]}
        className="h-10 w-10 shrink-0 rounded-full border-primary/30 bg-white text-primary shadow-sm"
      >
        <Plus className="h-5 w-5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Proponi {LABELS[category]}</DialogTitle>
            <DialogDescription>
              Un elemento nuovo non sarà pubblico finché l'amministratore non avrà approvato la proposta.
              È consentita una sola proposta in attesa per categoria.
            </DialogDescription>
          </DialogHeader>
          {checking ? (
            <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : pending ? (
            <p className="rounded-lg border bg-muted p-3 text-sm">
              Hai già una proposta in attesa: <strong>{pending}</strong>. Potrai inviarne un'altra dopo la decisione dell'admin.
            </p>
          ) : canSubmit ? (
            <form onSubmit={submit} className="space-y-3">
              <label className="block space-y-1 text-sm font-medium">
                Nome o titolo
                <Input required minLength={3} maxLength={150} value={title} onChange={e => setTitle(e.target.value)} placeholder="Nome del soggetto" />
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Informazioni utili (facoltative)
                <Textarea maxLength={1000} rows={3} value={details} onChange={e => setDetails(e.target.value)} placeholder="Perché inserirlo? Indica solo informazioni pubbliche." />
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Fonte pubblica HTTPS (facoltativa)
                <Input type="url" maxLength={2048} value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://..." />
              </label>
              <Button type="submit" className="w-full" disabled={saving || title.trim().length < 3}>
                {saving ? "Invio..." : "Invia per approvazione"}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-destructive">Non è possibile inviare proposte in questo momento.</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
