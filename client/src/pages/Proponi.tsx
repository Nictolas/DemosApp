import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link, Redirect } from "wouter";
import { ChevronRight, FileText, Globe2, Vote, PlusCircle } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";

const signatureOptions = [
  {
    title: "Iniziativa Popolare",
    description: "Firma qui per proporre una nuova legge.",
    href: "/iniziative-popolari",
    icon: FileText,
    cardClass: "border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 hover:border-emerald-300",
    iconClass: "from-emerald-500 to-teal-600",
    arrowClass: "text-emerald-500",
  },
  {
    title: "Referendum Abrogativo",
    description: "Firma qui per cancellare una legge ingiusta.",
    href: "/referendum-abrogativi",
    icon: Vote,
    cardClass: "border-red-200 bg-gradient-to-r from-red-50 to-pink-50 hover:from-red-100 hover:to-pink-100 hover:border-red-300",
    iconClass: "from-red-500 to-pink-600",
    arrowClass: "text-red-500",
  },
  {
    title: "ECI",
    description: "Firma qui per proporre una nuova legge europea.",
    href: "/eci",
    icon: Globe2,
    cardClass: "border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 hover:border-blue-300",
    iconClass: "from-blue-500 to-indigo-600",
    arrowClass: "text-blue-500",
  },
];

export default function Proponi() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <PageContainer className="bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </PageContainer>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <PageContainer className="page-with-navbar bg-gradient-to-br from-purple-50 via-indigo-50 to-pink-50">
      <div className="app-page-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl space-y-4 px-3 py-4 sm:px-4 sm:py-6">
          <header className="relative overflow-hidden rounded-2xl border border-purple-100 bg-white/95 p-4 shadow-sm sm:p-5">
            <div aria-hidden="true" className="absolute -right-10 -top-12 h-32 w-32 rounded-full bg-gradient-to-br from-blue-400/15 to-purple-500/15" />
            <div className="relative flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-md">
                <FileText className="h-6 w-6 text-white" aria-hidden="true" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Firma</h1>
            </div>
            <p className="relative mt-3 text-sm font-medium leading-relaxed text-gray-600 sm:text-base">
              Utilizza gli strumenti di Democrazia Diretta per modificare la Legge!
            </p>
          </header>

          <section aria-label="Strumenti di firma" className="space-y-3">
            {signatureOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.href}
                  type="button"
                  className={`group flex min-h-[5.75rem] w-full items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 ${option.cardClass}`}
                  onClick={() => { window.location.href = option.href; }}
                  onContextMenu={(event) => event.preventDefault()}
                >
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-md transition-transform duration-200 group-hover:scale-105 ${option.iconClass}`}>
                    <Icon className="h-6 w-6 text-white" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-bold leading-tight text-gray-900 sm:text-lg">{option.title}</span>
                    <span className="mt-1 block text-sm leading-snug text-gray-600">{option.description}</span>
                  </span>
                  <ChevronRight className={`h-5 w-5 shrink-0 ${option.arrowClass}`} aria-hidden="true" />
                </button>
              );
            })}
          </section>

          <section aria-label="Proponi nuovi soggetti" className="border-t border-slate-200 pt-3">
            <Link
              href="/proponi-soggetto"
              className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-left transition-colors hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <PlusCircle className="h-6 w-6 shrink-0 text-blue-700" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-900">Proponi un soggetto</span>
                <span className="block text-xs text-slate-600">
                  Presidente della Repubblica, Grazia, Amnistia, Attivisti o Organizzazioni.
                </span>
              </span>
              <ChevronRight className="h-5 w-5 text-blue-700" aria-hidden="true" />
            </Link>
          </section>
        </div>
      </div>
    </PageContainer>
  );
}
