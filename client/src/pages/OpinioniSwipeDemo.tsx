import React, { useRef, useState } from "react";
import { Check, Minus, RotateCcw, X } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";
import "./OpinioniSwipeDemo.css";

type DemoChoice = "contrario" | "indeciso" | "favorevole";
type PointerStart = { x: number; y: number; id: number };

const CARDS = [
  {
    id: "energia_nucleare",
    title: "Energia nucleare",
    question: "Sei favorevole alla produzione di elettricità tramite centrali nucleari?",
    image: "/images/opinioni/energia-nucleare-swipe.webp",
    alt: "Due persone in stile DEMOS discutono davanti a una centrale nucleare",
  },
  {
    id: "legalizzazione_canapa",
    title: "Legalizzazione canapa",
    question: "Sei favorevole a legalizzare e regolamentare la cannabis per uso adulto?",
    image: "/images/opinioni/legalizzazione-canapa-swipe.avif",
    alt: "Due persone diverse in stile DEMOS discutono di cannabis e legislazione davanti a un tribunale",
  },
] as const;

const ANSWERS = [
  { value: "contrario", label: "Contrario", icon: X },
  { value: "indeciso", label: "Indeciso", icon: Minus },
  { value: "favorevole", label: "Favorevole", icon: Check },
] as const;

/**
 * Anteprima esclusivamente locale: risposte effimere, nessun dato politico
 * letto, salvato, registrato o trasmesso. Carica solo la scheda visualizzata.
 */
export default function OpinioniSwipeDemo() {
  const [cardIndex, setCardIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [dragX, setDragX] = useState(0);
  const pointerStart = useRef<PointerStart | null>(null);
  const current = CARDS[cardIndex];

  const choose = (_value: DemoChoice) => {
    if (completed) return;
    setDragX(0);
    pointerStart.current = null;
    if (cardIndex < CARDS.length - 1) {
      setCardIndex((previous) => previous + 1);
    } else {
      setCompleted(true);
    }
  };

  const restart = () => {
    setCardIndex(0);
    setCompleted(false);
    setDragX(0);
    pointerStart.current = null;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (completed || !event.isPrimary) return;
    pointerStart.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;
    if (!start || start.id !== event.pointerId || completed) return;
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
    if (!start || start.id !== event.pointerId || completed) return;
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
          key={current.id}
          data-horizontal-swipe-region="true"
          className="opinioni-swipe-card"
          style={{ transform: `translateX(${dragX}px) rotate(${dragX / 28}deg)`, touchAction: "pan-y" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          aria-label={`${current.title}: trascina a sinistra per Contrario, a destra per Favorevole`}
        >
          <div className="opinioni-swipe-art">
            <img
              src={current.image}
              alt={current.alt}
              width={240}
              height={320}
              loading="eager"
              decoding="async"
              draggable={false}
            />
            {dragX !== 0 && (
              <span className={`opinioni-swipe-drag-label ${dragX > 0 ? "opinioni-swipe-drag-label--yes" : "opinioni-swipe-drag-label--no"}`}>
                {dragX > 0 ? "Favorevole" : "Contrario"}
              </span>
            )}
          </div>
          <div className="opinioni-swipe-copy">
            <h1>{current.title}</h1>
            <p>{current.question}</p>
          </div>
        </div>

        {completed ? (
          <div className="opinioni-swipe-actions" role="group" aria-label="Anteprima completata">
            <button type="button" className="opinioni-swipe-restart" onClick={restart}>
              <RotateCcw aria-hidden="true" className="opinioni-swipe-action-icon" />
              <span>Ricomincia</span>
            </button>
          </div>
        ) : (
          <div className="opinioni-swipe-actions" role="group" aria-label="Risposta dimostrativa">
            {ANSWERS.map(({ value, label, icon: Icon }) => (
              <button
                type="button"
                key={value}
                onClick={() => choose(value)}
                className={`opinioni-swipe-action opinioni-swipe-action--${value}`}
              >
                <Icon aria-hidden="true" className="opinioni-swipe-action-icon" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
        <span className="sr-only" role="status" aria-live="polite">
          {completed
            ? "Anteprima completata. Nessuna risposta è stata salvata. Puoi ricominciare."
            : `Domanda ${cardIndex + 1} di ${CARDS.length}: ${current.title}. Le risposte non vengono salvate.`}
        </span>
      </div>
    </PageContainer>
  );
}
