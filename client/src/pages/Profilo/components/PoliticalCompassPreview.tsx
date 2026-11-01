import { useMemo, useState } from "react";
import {
  calculatePoliticalCompass,
  COMPASS_QUESTIONS,
  readCompassAnswer,
  type CompassAxisResult,
} from "@/lib/politicalCompassModel";

interface PoliticalCompassPreviewProps {
  answers: Record<string, string>;
}

const resultLabel = (result: CompassAxisResult) =>
  result.score === null ? "Dati insufficienti" : String(result.score);

const answerLabel = (value: unknown) => {
  const answer = readCompassAnswer(value);
  return answer === 1 ? "Favorevole" : answer === -1 ? "Contrario" :
    answer === 0 ? "Indeciso" : "Non espresso";
};

export function PoliticalCompassPreview({ answers }: PoliticalCompassPreviewProps) {
  const [visible, setVisible] = useState(false);
  // Nessuna richiesta di rete: si riusano ESCLUSIVAMENTE le Opinioni gia
  // caricate nel Profilo, dopo la verifica del consenso esistente.
  const compass = useMemo(
    () => visible ? calculatePoliticalCompass(answers) : null,
    [answers, visible],
  );
  const ready = compass?.economy.score !== null && compass?.economy.score !== undefined &&
    compass?.freedom.score !== null && compass?.freedom.score !== undefined;

  return (
    <section className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3" aria-label="Compasso politico sperimentale">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900">La tua posizione politica</h3>
          <p className="text-xs text-slate-600">Compasso sperimentale, privato e facoltativo</p>
        </div>
        <button
          type="button"
          className="rounded-lg bg-indigo-700 px-3 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          onClick={() => setVisible((current) => !current)}
          aria-expanded={visible}
        >
          {visible ? "Nascondi compasso" : "Prova il compasso"}
        </button>
      </div>
      {visible && compass && (
        <div className="mt-3 space-y-3">
          <p className="text-xs leading-relaxed text-slate-700">
            È una rappresentazione esplorativa, non un test scientificamente validato.
            Non assegna partiti, etichette personali o indicazioni di voto.
            Il calcolo avviene sul dispositivo e non viene salvato.
          </p>

          {ready ? (
            <figure className="rounded-xl border border-slate-200 bg-white p-2">
              <svg
                viewBox="0 0 360 350"
                className="mx-auto block h-auto w-full max-w-sm"
                role="img"
                aria-label="Posizione stimata su due assi: intervento pubblico verso ruolo del mercato, restrizioni verso libertà individuali"
              >
                <rect x="55" y="35" width="250" height="250" fill="#f8fafc" stroke="#cbd5e1" />
                <line x1="180" y1="35" x2="180" y2="285" stroke="#64748b" strokeWidth="1.5" />
                <line x1="55" y1="160" x2="305" y2="160" stroke="#64748b" strokeWidth="1.5" />
                <line x1="117.5" y1="35" x2="117.5" y2="285" stroke="#e2e8f0" />
                <line x1="242.5" y1="35" x2="242.5" y2="285" stroke="#e2e8f0" />
                <line x1="55" y1="97.5" x2="305" y2="97.5" stroke="#e2e8f0" />
                <line x1="55" y1="222.5" x2="305" y2="222.5" stroke="#e2e8f0" />
                <text x="180" y="20" fontSize="12" textAnchor="middle" fill="#334155">
                  Maggiori libertà individuali
                </text>
                <text x="180" y="305" fontSize="12" textAnchor="middle" fill="#334155">
                  Maggiori restrizioni
                </text>
                <text x="55" y="330" fontSize="11" fill="#334155">Intervento pubblico</text>
                <text x="305" y="345" fontSize="11" fill="#334155" textAnchor="end">
                  Maggior ruolo del mercato
                </text>
                <circle
                  cx={180 + (compass.economy.score || 0) * 1.25}
                  cy={160 - (compass.freedom.score || 0) * 1.25}
                  r="9" fill="#4338ca" stroke="white" strokeWidth="3"
                />
              </svg>
              <figcaption className="mt-1 text-center text-xs text-slate-600">
                Punto stimato da un sottoinsieme delle 94 Opinioni.
              </figcaption>
            </figure>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="status">
              Non ci sono ancora risposte sufficienti per posizionare il punto:
              servono almeno 5 risposte Favorevole/Contrario per ciascun asse,
              comprese domande di entrambe le direzioni. Le risposte Indeciso
              non sono considerate posizioni centrali.
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <h4 className="font-semibold text-sm text-slate-900">Economia</h4>
              <p className="mt-1 text-xs text-slate-600">Pubblico (−100) · Mercato (+100)</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{resultLabel(compass.economy)}</p>
              <p className="text-xs text-slate-600">
                {compass.economy.answered} su {compass.economy.total} posizioni nette · {compass.economy.undecided} indecise
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <h4 className="font-semibold text-sm text-slate-900">Libertà individuali</h4>
              <p className="mt-1 text-xs text-slate-600">Restrizioni (−100) · Libertà (+100)</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{resultLabel(compass.freedom)}</p>
              <p className="text-xs text-slate-600">
                {compass.freedom.answered} su {compass.freedom.total} posizioni nette · {compass.freedom.undecided} indecise
              </p>
            </div>
          </div>

          <details className="rounded-lg border border-slate-200 bg-white p-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-900">
              Quali Opinioni vengono usate e come?
            </summary>
            <p className="my-2 text-xs text-slate-600">
              Sono incluse {COMPASS_QUESTIONS.length} Opinioni. Favorevole e
              Contrario hanno segno opposto rispetto alla proposta; Indeciso
              non influisce sul punteggio. Ogni polo pesa quanto l'altro,
              indipendentemente dal numero di domande che contiene.
              La scelta di includere una domanda e assegnarla a un polo resta
              un'ipotesi metodologica da validare.
            </p>
            <ul className="space-y-1 text-xs text-slate-700">
              {COMPASS_QUESTIONS.map((item) => (
                <li key={item.id} className="flex flex-wrap justify-between gap-1 border-t border-slate-100 py-1">
                  <span>{item.label} · {item.axis === "economia" ? "Economia" : "Libertà"}</span>
                  <span className="font-medium">{answerLabel(answers[item.id])}</span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </section>
  );
}
