import React, { useRef, useState } from "react";
import { Check, Minus, X } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";
import "./OpinioniSwipeDemo.css";

type DemoChoice = "contrario" | "indeciso" | "favorevole";
type PointerStart = { x: number; y: number; id: number };

const ANSWERS = [
  { value: "contrario", label: "Contrario", icon: X },
  { value: "indeciso", label: "Indeciso", icon: Minus },
  { value: "favorevole", label: "Favorevole", icon: Check },
] as const;

/**
 * Anteprima esclusivamente locale: non legge, scrive o invia opinioni politiche.
 * La navbar e la shell gestiscono l'altezza disponibile, senza scroll.
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
    if (!event.isPrimary) return;
    pointerStart.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      setDragX(Math.max(-125, Math.min(125, dx)));
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    setDragX(0);
    if (!start || start.id !== event.pointerId) return;
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
    <PageContainer className="opinioni-swipe-page bg-background text-foreground">
      <div className="opinioni-swipe-viewport">
        <div
          data-horizontal-swipe-region="true"
          className="opinioni-swipe-card"
          style={{ transform: `translateX(${dragX}px) rotate(${dragX / 28}deg)`, touchAction: "pan-y" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          aria-label="Energia nucleare: scorri a sinistra per Contrario, a destra per Favorevole"
        >
          <div className="opinioni-swipe-art">
            <img
              src="/images/opinioni/energia-nucleare-swipe.webp"
              alt="Due persone in stile avatar DEMOS discutono davanti a una centrale nucleare"
              width={240}
              height={320}
              draggable={false}
            />
            {dragX !== 0 && (
              <span className={`opinioni-swipe-drag-label ${dragX > 0 ? "opinioni-swipe-drag-label--yes" : "opinioni-swipe-drag-label--no"}`}>
                {dragX > 0 ? "Favorevole" : "Contrario"}
              </span>
            )}
          </div>
          <div className="opinioni-swipe-copy">
            <h1>Energia nucleare</h1>
            <p>Sei favorevole alla produzione di elettricità tramite centrali nucleari?</p>
          </div>
        </div>

        <div className="opinioni-swipe-actions" role="group" aria-label="Risposta dimostrativa">
          {ANSWERS.map(({ value, label, icon: Icon }) => (
            <button
              type="button"
              key={value}
              onClick={() => choose(value)}
              aria-pressed={choice === value}
              className={`opinioni-swipe-action opinioni-swipe-action--${value}${choice === value ? " is-selected" : ""}`}
            >
              <Icon aria-hidden="true" className="opinioni-swipe-action-icon" />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <span className="sr-only" role="status" aria-live="polite">
          {choice ? `Hai scelto ${choice}. È solo un'anteprima, nessun voto è stato salvato.` : ""}
        </span>
      </div>
    </PageContainer>
  );
}
