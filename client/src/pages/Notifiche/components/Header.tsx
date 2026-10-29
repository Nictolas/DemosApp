import React from "react";
import { Bell, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface HeaderProps {
  total: number;
  isLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({ total, isLoading }) => {
  const [, setLocation] = useLocation();

  return (
    <header className="shrink-0 border-b border-slate-200/80 bg-white/90 px-4 pb-3 pt-3 sm:px-6 sm:pt-4">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-center justify-between gap-3">
          <h1 className="flex min-w-0 items-center gap-2.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Bell className="h-6 w-6" aria-hidden="true" />
            </span>
            Notifiche
          </h1>
          <Button
            variant="outline"
            size="sm"
            className="h-10 shrink-0 gap-1.5 rounded-xl border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-none hover:bg-slate-50"
            onClick={() => setLocation("/notifiche/preferenze")}
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            Preferenze
          </Button>
        </div>
        <p className="mt-2 pl-1 text-xs font-medium text-slate-500" aria-live="polite">
          {isLoading ? "Caricamento notifiche…" : `${total} ${total === 1 ? "notifica" : "notifiche"}`}
        </p>
      </div>
    </header>
  );
};
