import React from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ExternalLink, FileText, Shield, Cookie, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/PageContainer";

const documents = [
  { title: "Privacy Policy", description: "Informativa sulla privacy pubblicata nell'app", route: "/privacy-policy", icon: Shield },
  { title: "Termini di servizio", description: "Condizioni di utilizzo pubblicate nell'app", route: "/terms-of-service", icon: Scale },
  { title: "Cookie Policy", description: "Informativa sui cookie pubblicata nell'app", route: "/cookie-policy", icon: Cookie },
];

export default function LegalDocuments() {
  const [, navigate] = useLocation();
  return (
    <PageContainer className="overflow-y-auto overscroll-contain bg-slate-50">
      <main className="mx-auto w-full max-w-4xl space-y-5 px-4 py-5">
        <Button variant="ghost" onClick={() => navigate("/admin/gdpr-legal")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Torna a GDPR e documenti legali
        </Button>
        <header>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><FileText className="h-6 w-6" /> Documenti legali pubblicati</h1>
          <p className="mt-2 text-sm text-slate-600">
            Questi collegamenti aprono il testo effettivamente pubblicato.
            Date, versioni e conformità non vengono presunte senza una verifica documentale.
          </p>
        </header>
        <div className="grid gap-3">
          {documents.map(document => {
            const Icon = document.icon;
            return (
              <a key={document.route} href={document.route}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-slate-900 hover:border-indigo-300">
                <Icon className="h-5 w-5 shrink-0 text-indigo-700" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <strong className="block">{document.title}</strong>
                  <span className="text-sm text-slate-600">{document.description}</span>
                </span>
                <ExternalLink className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              </a>
            );
          })}
        </div>
        <p className="text-xs text-slate-600">
          La modifica, la pubblicazione e il download dei documenti non sono operazioni disponibili
          in questa schermata. Sono stati rimossi i relativi comandi dimostrativi.
        </p>
      </main>
    </PageContainer>
  );
}
