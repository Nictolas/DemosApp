import { useMemo, useState } from "react";
import { FlaskConical, Globe2, Landmark, Leaf, Scale, UsersRound } from "lucide-react";
import {
  calculatePoliticalCompass,
  calculatePoliticalAxes,
  POLITICAL_AXES,
} from "@/lib/politicalCompassModel";

interface PoliticalCompassPreviewProps {
  answers: Record<string, string>;
  standalone?: boolean;
}

// Simboli neutri: identificano i temi, non attribuiscono un giudizio politico.
const AXIS_ICONS = {
  economia: Scale,
  stato: Landmark,
  costumi: UsersRound,
  ambiente: Leaf,
  immigrazione: Globe2,
} as const;

export function PoliticalCompassPreview({ answers, standalone = false }: PoliticalCompassPreviewProps) {
  // La navigazione verso questa pagina e una scelta esplicita di visualizzare il risultato.
  const [visible, setVisible] = useState(standalone);
  // Nessuna richiesta di rete: si riusano ESCLUSIVAMENTE le Opinioni gia
  // caricate nel Profilo, dopo la verifica del consenso esistente.
  const compass = useMemo(
    () => visible ? calculatePoliticalCompass(answers) : null,
    [answers, visible],
  );
  const axes = useMemo(
    () => visible ? calculatePoliticalAxes(answers) : null,
    [answers, visible],
  );
  const ready = compass?.economy.score !== null && compass?.economy.score !== undefined &&
    compass?.freedom.score !== null && compass?.freedom.score !== undefined;
  const economicPreview = compass?.economy.previewScore ?? null;
  const freedomPreview = compass?.freedom.previewScore ?? null;
  const hasDraft = economicPreview !== null || freedomPreview !== null;
  const totalCompassAnswers = (compass?.economy.answered ?? 0) + (compass?.freedom.answered ?? 0);

  return (
    <section className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3" aria-label="Compasso politico">
      <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5" role="note" aria-label="Sezione sperimentale">
        <FlaskConical aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" />
        <div>
          <p className="text-sm font-semibold text-amber-950">Sezione sperimentale</p>
          <p className="text-xs leading-relaxed text-amber-900">
            È una rappresentazione esplorativa, non un test scientificamente validato.
            I risultati non definiscono con certezza il tuo orientamento politico.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900">La tua posizione politica</h3>
          <p className="text-xs text-slate-600">Compasso privato e facoltativo</p>
        </div>
        {!standalone && (
          <button
            type="button"
            className="rounded-lg bg-indigo-700 px-3 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            onClick={() => setVisible((current) => !current)}
            aria-expanded={visible}
          >
            {visible ? "Nascondi compasso" : "Prova il compasso"}
          </button>
        )}
      </div>
      {visible && compass && (
        <div className="mt-3 space-y-3">
          <p className="text-xs leading-relaxed text-slate-700">
            Il compasso rappresenta solo le proposte selezionate. Non assegna partiti,
            etichette personali o indicazioni di voto. Il calcolo avviene sul dispositivo
            e non viene salvato.
          </p>

          {(ready || hasDraft) ? (
            <figure className="rounded-xl border border-slate-200 bg-white p-2">
              <svg
                viewBox="0 0 360 320"
                className="mx-auto block h-auto w-full max-w-sm"
                role="img"
                aria-label="Posizione stimata su due assi esplorativi: Sinistra (interventi pubblici), Destra (soluzioni private), Autorità (restrizioni) e Libertà (libertà individuali)"
              >
                {/* Disposizione CLASSICA del Political Compass: rosso/blu sopra, verde/viola sotto.
                    L'asse verticale resta metodologicamente esplorativo, non una diagnosi ideologica. */}
                <rect x="55" y="35" width="125" height="125" fill="#ef4444" data-quadrant="restrizioni-interventi-pubblici" />
                <rect x="180" y="35" width="125" height="125" fill="#3b82f6" data-quadrant="restrizioni-soluzioni-private" />
                <rect x="55" y="160" width="125" height="125" fill="#22c55e" data-quadrant="liberta-interventi-pubblici" />
                <rect x="180" y="160" width="125" height="125" fill="#a855f7" data-quadrant="liberta-soluzioni-private" />
                <rect x="55" y="35" width="250" height="250" fill="none" stroke="#334155" strokeWidth="1" />
                <line x1="180" y1="35" x2="180" y2="285" stroke="#334155" strokeWidth="1.75" />
                <line x1="55" y1="160" x2="305" y2="160" stroke="#334155" strokeWidth="1.75" />
                <line x1="117.5" y1="35" x2="117.5" y2="285" stroke="#ffffff" strokeOpacity="0.55" />
                <line x1="242.5" y1="35" x2="242.5" y2="285" stroke="#ffffff" strokeOpacity="0.55" />
                <line x1="55" y1="97.5" x2="305" y2="97.5" stroke="#ffffff" strokeOpacity="0.55" />
                <line x1="55" y1="222.5" x2="305" y2="222.5" stroke="#ffffff" strokeOpacity="0.55" />
                <text x="180" y="20" fontSize="14" fontWeight="600" textAnchor="middle" fill="#0f172a">Autorità</text>
                <text x="180" y="307" fontSize="14" fontWeight="600" textAnchor="middle" fill="#0f172a">Libertà</text>
                <text x="30" y="160" transform="rotate(-90 30 160)" fontSize="14" fontWeight="600" textAnchor="middle" fill="#0f172a">Sinistra</text>
                <text x="330" y="160" transform="rotate(90 330 160)" fontSize="14" fontWeight="600" textAnchor="middle" fill="#0f172a">Destra</text>
                {ready ? (
                  <circle
                    cx={180 + (compass.economy.score || 0) * 1.25}
                    cy={160 + (compass.freedom.score || 0) * 1.25}
                    r="9" fill="#111827" stroke="#ffffff" strokeWidth="3"
                  />
                ) : economicPreview !== null && freedomPreview !== null ? (
                  <circle
                    cx={180 + economicPreview * 1.25}
                    cy={160 + freedomPreview * 1.25}
                    r="10" fill="#ffffff" fillOpacity="0.85"
                    stroke="#111827" strokeWidth="3" strokeDasharray="4 3"
                    data-testid="compass-draft-point"
                  />
                ) : economicPreview !== null ? (
                  <line
                    x1={180 + economicPreview * 1.25}
                    x2={180 + economicPreview * 1.25}
                    y1="36" y2="284" stroke="#111827" strokeWidth="3"
                    strokeDasharray="7 6" data-testid="compass-draft-economy-line"
                  />
                ) : freedomPreview !== null ? (
                  <line
                    x1="56" x2="304"
                    y1={160 + freedomPreview * 1.25}
                    y2={160 + freedomPreview * 1.25}
                    stroke="#111827" strokeWidth="3" strokeDasharray="7 6"
                    data-testid="compass-draft-freedom-line"
                  />
                ) : null}
              </svg>
              <figcaption className="mt-1 text-center text-xs text-slate-600">
                {ready
                  ? "Punto stimato da un sottoinsieme delle 94 Opinioni."
                  : "Bozza provvisoria: " + totalCompassAnswers + " rispost" +
                    (totalCompassAnswers === 1 ? "a" : "e") +
                    " pertinenti. " +
                    (economicPreview !== null && freedomPreview !== null
                      ? "Il cerchio tratteggiato è una posizione preliminare."
                      : economicPreview !== null
                        ? "La linea verticale indica solo Economia; Libertà non è ancora determinata."
                        : "La linea orizzontale indica solo Libertà; Economia non è ancora determinata.")}
              </figcaption>
            </figure>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="status">
              Nessuna delle risposte disponibili determina ancora una posizione
              sui due assi del compasso. Basta una risposta Favorevole o Contrario
              a una delle proposte utilizzate per ottenere un abbozzo.
              Le risposte Indeciso non vengono trattate come posizioni centrali.
            </div>
          )}

          {axes && (
            <section
              aria-label="I tuoi orientamenti politici"
              className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4"
            >
              <h4 className="text-sm font-bold text-slate-900">I tuoi orientamenti politici</h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Cinque indicatori esplorativi calcolati soltanto dalle Opinioni già espresse.
                Non sono un test validato né una classificazione personale. Le percentuali
                rappresentano il punteggio sui quesiti selezionati, non percentuali di cittadini.
              </p>
              <div className="mt-4 space-y-4">
                {POLITICAL_AXES.map((axis) => {
                  const result = axes[axis.id];
                  const left = result.leftPercent ?? result.previewLeftPercent;
                  const right = result.rightPercent ?? result.previewRightPercent;
                  const draft = result.score === null && left !== null;
                  const AxisIcon = AXIS_ICONS[axis.id];
                  return (
                    <div key={axis.id} className="border-t border-slate-100 pt-3 first:border-0 first:pt-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h5 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700" aria-hidden="true">
                            <AxisIcon className="h-4 w-4" />
                          </span>
                          {axis.title}
                        </h5>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-700">
                          {axis.leftLabel}{left === null ? "" : ` · ${draft ? "≈" : ""}${left}%`}
                        </span>
                        <span className="text-right text-slate-700">
                          {axis.rightLabel}{right === null ? "" : ` · ${draft ? "≈" : ""}${right}%`}
                        </span>
                      </div>
                      {left === null ? (
                        <div className="mt-2" role="status">
                          <div className="h-3 rounded-full bg-slate-200" aria-hidden="true" />
                          <p className="mt-1 text-xs text-slate-500">
                            Dati insufficienti · {result.answered} risposte nette su {result.total};
                            esprimi almeno una risposta Favorevole o Contrario a una proposta di questo asse per vedere una bozza.
                          </p>
                        </div>
                      ) : (
                        <>
                          <div
                            className={`relative mt-2 h-3 overflow-hidden rounded-full bg-violet-400 ${draft ? "opacity-60" : ""}`}
                            role="meter"
                            aria-label={`${axis.title}: ${axis.leftLabel}`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={left}
                          >
                            <span
                              className="block h-full bg-emerald-500"
                              style={{ width: `${left}%` }}
                              aria-hidden="true"
                            />
                            <span
                              className="absolute top-0 h-3 w-1 rounded bg-slate-950"
                              style={{
                                left: `${Math.max(1, Math.min(99, left))}%`,
                                transform: "translateX(-50%)",
                              }}
                              aria-hidden="true"
                            />
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {draft ? "Bozza provvisoria · " : ""}{result.answered} risposte nette su {result.total}
                            {result.undecided > 0 ? ` · ${result.undecided} indecise escluse dal calcolo` : ""}
                            {draft ? " · aggiungendo Opinioni il risultato può cambiare molto" : ""}
                          </p>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

        </div>
      )}
    </section>
  );
}
