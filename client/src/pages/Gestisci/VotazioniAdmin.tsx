import React from "react";
import { useLocation, Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { hasAdminCapability } from "@/lib/admin-access";
import { PageContainer } from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, ChevronRight, Landmark, Globe, Activity } from "lucide-react";

const VoteLink = ({ href, title, description }: { href: string; title: string; description: string }) => (
  <a href={href} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm hover:border-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600">
    <span className="min-w-0">
      <strong className="block text-sm font-semibold">{title}</strong>
      <span className="mt-1 block text-xs leading-relaxed text-slate-600">{description}</span>
    </span>
    <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
  </a>
);

export default function VotazioniAdmin() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  if (isLoading) return <PageContainer><p role="status" className="p-4">Verifica autorizzazioni…</p></PageContainer>;
  if (!user) return <Redirect to="/auth" />;
  if (!hasAdminCapability(user)) return <Redirect to="/preferiti" />;

  return (
    <PageContainer className="overflow-y-auto overscroll-contain bg-gradient-to-br from-slate-50 to-indigo-50">
      <main className="mx-auto w-full max-w-4xl space-y-4 px-4 py-5 pb-12">
        <Button variant="ghost" className="gap-2" onClick={() => navigate("/gestisci")}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Torna a Gestisci
        </Button>
        <header className="rounded-xl border border-indigo-100 bg-white/85 p-4">
          <h1 className="text-2xl font-bold text-slate-900">Votazioni</h1>
          <p className="mt-1 text-sm text-slate-600">
            Un unico ingresso alle votazioni nazionali ed europee. Le viste dettagliate
            continuano a usare le rispettive fonti e regole di verifica.
          </p>
        </header>
        <Tabs defaultValue="nazionali" className="space-y-3">
          <TabsList className="grid h-auto w-full grid-cols-3">
            <TabsTrigger value="nazionali" className="gap-1 px-1 py-2 text-xs sm:text-sm"><Landmark className="h-4 w-4" aria-hidden="true" /> Nazionali</TabsTrigger>
            <TabsTrigger value="europee" className="gap-1 px-1 py-2 text-xs sm:text-sm"><Globe className="h-4 w-4" aria-hidden="true" /> Europee</TabsTrigger>
            <TabsTrigger value="diagnostica" className="gap-1 px-1 py-2 text-xs sm:text-sm"><Activity className="h-4 w-4" aria-hidden="true" /> Diagnostica</TabsTrigger>
          </TabsList>
          <TabsContent value="nazionali" className="space-y-3">
            <VoteLink href="/voti-politici" title="Votazioni finali di Camera e Senato" description="Elenco delle sole votazioni finali recenti e verificate, con data, esito e collegamento alla fonte." />
            <p className="text-xs text-slate-600">L'esito finale di una singola Camera non implica automaticamente l'approvazione definitiva di una legge.</p>
          </TabsContent>
          <TabsContent value="europee" className="space-y-3">
            <VoteLink href="/voti-parlamento-europeo" title="Votazioni del Parlamento europeo" description="Consulta i dettagli disponibili dalle fonti europee senza confonderli con i voti nazionali." />
          </TabsContent>
          <TabsContent value="diagnostica" className="space-y-3">
            <VoteLink href="/voti-parlamento" title="Vista tecnica delle votazioni parlamentari" description="Esamina le fonti Camera/Senato e le eventuali differenze tra i feed; non equivale all'elenco delle sole votazioni finali." />
            <p className="text-xs text-slate-600">Le viste diagnostiche esistenti restano disponibili agli amministratori; nessun dato viene cancellato o migrato.</p>
          </TabsContent>
        </Tabs>
      </main>
    </PageContainer>
  );
}
