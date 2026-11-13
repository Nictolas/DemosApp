import React, { useEffect, useRef, useState } from "react";
import { Check, CircleHelp, Ellipsis, RotateCcw, X } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";
import "./OpinioniSwipeDemo.css";

type DemoChoice = "contrario" | "indeciso" | "favorevole";
type PointerStart = { x: number; y: number; id: number };

const EXIT_DURATION_MS = 250;
const CARDS = [
  {
    id: "energia_nucleare",
    title: "Energia nucleare",
    question: "Sei favorevole alla produzione di elettricità tramite centrali nucleari?",
    image: "/images/opinioni/energia-nucleare-swipe.webp",
    alt: "Due persone in stile DEMOS discutono davanti a una centrale nucleare",
    context: "La proposta riguarda la produzione di elettricità tramite nuove centrali nucleari.",
    pro: "Continuità della produzione elettrica e basse emissioni operative di CO₂.",
    con: "Costi e tempi di realizzazione, gestione delle scorie e sicurezza degli impianti.",
  },
  {
    id: "legalizzazione_canapa",
    title: "Legalizzazione canapa",
    question: "Sei favorevole a legalizzare e regolamentare la cannabis per uso adulto?",
    image: "/images/opinioni/legalizzazione-canapa-swipe.avif",
    alt: "Due persone diverse in stile DEMOS discutono di cannabis e legislazione davanti a un tribunale",
    context: "La proposta riguarda la legalizzazione e la regolamentazione della cannabis per uso adulto.",
    pro: "Controlli sulla vendita, sulla qualità e un possibile ridimensionamento del mercato illegale.",
    con: "Rischi sanitari e dubbi sugli effetti della maggiore accessibilità.",
  },
] as const;

type SwipeCard = (typeof CARDS)[number];

const ANSWERS = [
  { value: "contrario", label: "Contrario", icon: X },
  { value: "indeciso", label: "Indeciso", icon: Ellipsis },
  { value: "favorevole", label: "Favorevole", icon: Check },
] as const;

function CardContent({ card, expanded = false }: { card: SwipeCard; expanded?: boolean }) {
  return (
    <>
      <div className="opinioni-swipe-art">
        <img
          src={card.image}
          alt={card.alt}
          width={240}
          height={320}
          loading="eager"
          decoding="async"
          draggable={false}
        />
      </div>
      <div className="opinioni-swipe-copy">
        <h1>{card.title}</h1>
        <p>{card.question}</p>
      </div>
      {expanded && (
        <section className="opinioni-swipe-details" id="opinioni-swipe-details" aria-label={`Approfondimento: ${card.title}`}>
          <p>{card.context}</p>
          <p><strong>Argomenti a favore:</strong> {card.pro}</p>
          <p><strong>Argomenti contrari:</strong> {card.con}</p>
          <small>Sintesi dimostrativa: non sostituisce le fonti.</small>
        </section>
      )}
    </>
  );
}

/**
 * Due schede sovrapposte: durante il gesto quella successiva è già visibile.
 * Solo la scheda corrente e la successiva scaricano l'immagine; nessuna
 * risposta viene letta, salvata o inviata (prototipo).
 */
export default function OpinioniSwipeDemo() {
  const [cardIndex, setCardIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState<DemoChoice | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [history, setHistory] = useState<number[]>([]);
  const pointerStart = useRef<PointerStart | null>(null);

  const current = CARDS[cardIndex];
  const next = CARDS[cardIndex + 1];

  useEffect(() => {
    if (!exiting) return;
    const timeout = window.setTimeout(() => {
      setCardIndex((previous) => Math.min(previous + 1, CARDS.length - 1));
      setExiting(null);
      setDragX(0);
    }, EXIT_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [exiting]);

  const choose = (value: DemoChoice) => {
    if (completed || exiting) return;
    pointerStart.current = null;
    setDragging(false);
    setDetailsOpen(false);
    setHistory((previous) => [...previous, cardIndex]);
    if (!next) {
      // Ultima scheda: niente carta fittizia sullo sfondo.
      setDragX(0);
      setCompleted(true);
      return;
    }
    setExiting(value);
  };

  const undo = () => {
    if (exiting || history.length === 0) return;
    const previousIndex = history[history.length - 1];
    pointerStart.current = null;
    setCardIndex(previousIndex);
    setHistory((previous) => previous.slice(0, -1));
    setCompleted(false);
    setDetailsOpen(false);
    setDragX(0);
    setDragging(false);
  };

  const restart = () => {
    pointerStart.current = null;
    setCardIndex(0);
    setCompleted(false);
    setExiting(null);
    setDragX(0);
    setDragging(false);
    setDetailsOpen(false);
    setHistory([]);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (completed || exiting || detailsOpen || !event.isPrimary) return;
    pointerStart.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;
    if (!start || start.id !== event.pointerId || completed || exiting || detailsOpen) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      setDragX(Math.max(-260, Math.min(260, dx)));
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    setDragging(false);
    if (!start || start.id !== event.pointerId || completed || exiting || detailsOpen) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) >= 75 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      choose(dx > 0 ? "favorevole" : "contrario");
    } else {
      setDragX(0);
    }
  };

  const handlePointerCancel = () => {
    pointerStart.current = null;
    setDragging(false);
    setDragX(0);
  };

  const previewAmount = exiting ? 1 : Math.min(Math.abs(dragX) / 140, 1);
  const frontTransform = exiting === "contrario"
    ? "translateX(calc(-100vw - 100%)) rotate(-20deg)"
    : exiting === "favorevole"
      ? "translateX(calc(100vw + 100%)) rotate(20deg)"
      : exiting === "indeciso"
        ? "translateY(-125%) scale(0.96)"
        : `translateX(${dragX}px) rotate(${dragX / 25}deg)`;

  return (
    <PageContainer className="opinioni-swipe-page bg-background text-foreground">
      <div className="opinioni-swipe-viewport">
        <div className="opinioni-swipe-stack">
          {next && !completed && (
            <div
              className="opinioni-swipe-card opinioni-swipe-card--behind"
              aria-hidden="true"
              style={{
                transform: `translateY(${8 * (1 - previewAmount)}px) scale(${0.965 + previewAmount * 0.035})`,
                opacity: 0.88 + previewAmount * 0.12,
              }}
            >
              <CardContent card={next} />
            </div>
          )}

          <div
            key={current.id}
            data-horizontal-swipe-region="true"
            className={`opinioni-swipe-card opinioni-swipe-card--front${dragging ? " is-dragging" : ""}${exiting ? " is-exiting" : ""}${detailsOpen ? " is-details-open" : ""}`}
            style={{ transform: frontTransform, touchAction: "pan-y" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            aria-label={`${current.title}: trascina a sinistra per Contrario, a destra per Favorevole`}
          >
            <CardContent card={current} expanded={detailsOpen && !completed} />
            {dragX !== 0 && !exiting && (
              <span
                className={`opinioni-swipe-drag-label ${dragX > 0 ? "opinioni-swipe-drag-label--yes" : "opinioni-swipe-drag-label--no"}`}
                aria-hidden="true"
              >
                {dragX > 0 ? "Favorevole" : "Contrario"}
              </span>
            )}
          </div>
        </div>

        {completed ? (
          <div className="opinioni-swipe-actions" role="group" aria-label="Anteprima completata">
            <button
              type="button"
              className="opinioni-swipe-action opinioni-swipe-action--secondary opinioni-swipe-action--undo"
              onClick={undo}
              disabled={history.length === 0}
              aria-label="Annulla ultima scelta"
              title="Annulla ultima scelta"
            >
              <RotateCcw aria-hidden="true" className="opinioni-swipe-action-icon" />
            </button>
            <button type="button" className="opinioni-swipe-restart" onClick={restart}>
              <RotateCcw aria-hidden="true" className="opinioni-swipe-action-icon" />
              <span>Ricomincia</span>
            </button>
          </div>
        ) : (
          <div className="opinioni-swipe-actions" role="group" aria-label="Risposta dimostrativa">
            <button
              type="button"
              onClick={undo}
              disabled={history.length === 0 || Boolean(exiting)}
              className="opinioni-swipe-action opinioni-swipe-action--secondary opinioni-swipe-action--undo"
              aria-label="Annulla ultima scelta"
              title="Annulla ultima scelta"
            >
              <RotateCcw aria-hidden="true" className="opinioni-swipe-action-icon" />
            </button>
            {ANSWERS.map(({ value, label, icon: Icon }) => (
              <button
                type="button"
                key={value}
                onClick={() => choose(value)}
                disabled={Boolean(exiting)}
                aria-label={label}
                title={label}
                className={`opinioni-swipe-action opinioni-swipe-action--${value}`}
              >
                <Icon aria-hidden="true" className="opinioni-swipe-action-icon" />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setDetailsOpen((previous) => !previous)}
              disabled={Boolean(exiting)}
              aria-label={detailsOpen ? "Chiudi approfondimento" : "Approfondisci opinione"}
              title={detailsOpen ? "Chiudi approfondimento" : "Approfondisci"}
              aria-expanded={detailsOpen}
              className={`opinioni-swipe-action opinioni-swipe-action--secondary opinioni-swipe-action--details${detailsOpen ? " is-selected" : ""}`}
            >
              <CircleHelp aria-hidden="true" className="opinioni-swipe-action-icon" />
            </button>
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
