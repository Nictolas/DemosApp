import React, { useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Check, Minus, RotateCcw, X } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";

type DemoChoice = "contrario" | "indeciso" | "favorevole";
type PointerStart = { x: number; y: number; id: number };

const CHOICES: Record<DemoChoice, { label: string; message: string; classes: string }> = {
  contrario: {
    label: "Contrario",
    message: "Hai scelto Contrario.",
    classes: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/30 dark:text-rose-200 dark:border-rose-900",
  },
  indeciso: {
    label: "Indeciso",
    message: "Hai scelto Indeciso.",
    classes: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700",
  },
  favorevole: {
    label: "Favorevole",
    message: "Hai scelto Favorevole.",
    classes: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-200 dark:border-emerald-900",
  },
};

/**
 * Prototipo UX: nessun dato politico viene letto, salvato o trasmesso.
 * La scheda usa l'illustrazione DEMOS in locale, non servizi esterni.
 */
export default function OpinioniSwipeDemo() {
  const [choice, setChoice] = useState<DemoChoice | null>(null);
  const [dragX, setDragX] = useState(0);
  const pointerStart = useRef<PointerStart | null>(null);

  const choose = (value: DemoChoice) => {
    setChoice(value);
    setDragX(0);
    pointerStart.current = null;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (choice || !event.isPrimary) return;
    pointerStart.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;
    if (!start || start.id !== event.pointerId || choice) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    // Non catturare lo scorrimento verticale della pagina.
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      setDragX(Math.max(-125, Math.min(125, dx)));
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    setDragX(0);
    if (!start || start.id !== event.pointerId || choice) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) >= 75 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      choose(dx > 0 ? "favorevole" : "contrario");
    }
  };

  const handlePointerCancel = () => {
    pointerStart.current = null;
    setDragX(0);
  };

  return (
    <PageContainer className="overflow-y-auto overscroll-contain bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-3 pb-6 pt-3 sm:px-4">
        <header className="flex items-center justify-between gap-2">
          <Link
            href="/opinioni"
            className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            Opinioni
          </Link>
          <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-foreground">
            Anteprima · 1 di 1
          </span>
        </header>

        <div className="space-y-1 text-center">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Opinioni Swipe</h1>
          <p className="text-xs text-muted-foreground">
            Trascina la scheda oppure scegli una risposta.
          </p>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className="h-full w-full rounded-full bg-blue-600" />
        </div>

        <div
          data-horizontal-swipe-region="true"
          className="mx-auto w-full max-w-[350px] select-none overflow-hidden rounded-3xl border border-border bg-card shadow-lg"
          style={{ transform: `translateX(${dragX}px) rotate(${dragX / 28}deg)`, touchAction: "pan-y" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          aria-label="Scheda dimostrativa: scorri a sinistra per Contrario o a destra per Favorevole"
        >
          <div className="relative">
            <img
              src="/images/opinioni/energia-nucleare-swipe.webp"
              alt="Due persone in stile avatar DEMOS discutono davanti a una centrale nucleare"
              width="240"
              height="320"
              draggable={false}
              className="aspect-[3/4] w-full object-cover"
            />
            {dragX !== 0 && !choice && (
              <div
                className={`pointer-events-none absolute left-3 top-3 rounded-lg border-2 px-3 py-1 text-sm font-extrabold uppercase shadow-sm ${
                  dragX > 0 ? "border-emerald-700 bg-white text-emerald-800" : "border-rose-700 bg-white text-rose-800"
                }`}
              >
                {dragX > 0 ? "Favorevole" : "Contrario"}
              </div>
            )}
          </div>
          <div className="space-y-1 px-4 pb-4 pt-3 text-center">
            <h2 className="text-lg font-bold">Energia nucleare</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Sei favorevole alla produzione di elettricità tramite centrali nucleari?
            </p>
            <p className="pt-1 text-[11px] text-muted-foreground">Domanda dimostrativa</p>
          </div>
        </div>

        {!choice ? (
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Risposta dimostrativa">
            <button
              type="button"
              onClick={() => choose("contrario")}
              className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border border-rose-200 bg-rose-50 px-1 text-xs font-semibold text-rose-800 transition active:scale-95 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
            >
              <X className="h-6 w-6" aria-hidden="true" />
              Contrario
            </button>
            <button
              type="button"
              onClick={() => choose("indeciso")}
              className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border border-slate-300 bg-slate-100 px-1 text-xs font-semibold text-slate-800 transition active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <Minus className="h-6 w-6" aria-hidden="true" />
              Indeciso
            </button>
            <button
              type="button"
              onClick={() => choose("favorevole")}
              className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border border-emerald-200 bg-emerald-50 px-1 text-xs font-semibold text-emerald-800 transition active:scale-95 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
            >
              <Check className="h-6 w-6" aria-hidden="true" />
              Favorevole
            </button>
          </div>
        ) : (
          <div className={`rounded-2xl border px-3 py-3 text-center ${CHOICES[choice].classes}`} role="status" aria-live="polite">
            <p className="text-sm font-bold">{CHOICES[choice].message}</p>
            <p className="mt-1 text-xs">È soltanto una prova: nessun voto è stato salvato.</p>
            <button
              type="button"
              onClick={() => chooseAgain()}
              className="mx-auto mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-current px-3 text-sm font-semibold"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Cambia risposta
            </button>
          </div>
        )}

        {!choice && (
          <p className="text-center text-xs text-muted-foreground" aria-live="polite">
            ← Contrario · Indeciso con il pulsante · Favorevole →
          </p>
        )}
        <p className="text-center text-xs text-muted-foreground">
          Modalità sperimentale: non modifica le tue opinioni e non invia dati al server.
        </p>
      </div>
    </PageContainer>
  );

  function chooseAgain() {
    setChoice(null);
    setDragX(0);
  }
}
