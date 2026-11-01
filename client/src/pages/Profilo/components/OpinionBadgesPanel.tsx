import {
  BADGE_RULES,
  evaluateOpinionBadge,
  type BadgeAccess,
  type BadgeResult,
  type BadgeRule,
} from "../../../lib/opinionBadgesModel";

/**
 * SOLO COMPONENTE DI PROTOTIPO, NON IMPORTATO DALL'APP.
 * Nessun caricamento delle Opinioni, tracking o persistenza. Tutte le regole
 * distribuite hanno approved:false: il pannello non e attivabile.
 */
interface BadgePanelProps {
  readonly answers: Readonly<Record<string, unknown>>;
  readonly access: BadgeAccess;
  readonly opinionLabels?: Readonly<Record<string, string>>;
}

interface EvidenceCardProps {
  readonly rule: BadgeRule;
  readonly result: BadgeResult;
  readonly opinionLabels?: Readonly<Record<string, string>>;
}

const readableAnswer = (answer: "f" | "c"): string =>
  answer === "f" ? "Favorevole" : "Contrario";

/**
 * Componente puramente presentazionale; le schermate reali devono passare
 * esclusivamente risultati ottenuti tramite evaluateOpinionBadge e gate verificati.
 */
export function OpinionBadgeEvidenceCard({
  rule, result, opinionLabels = {},
}: EvidenceCardProps) {
  const status = result.eligible
    ? "Indicazione tematica disponibile"
    : "Risposte insufficienti o discordanti";
  const caption = result.eligible
    ? "Queste risposte sono coerenti con alcune proposte del tema, non definiscono la tua identità."
    : "Il sistema non ha elementi sufficienti per suggerire questa targhetta.";

  return (
    <article
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      aria-labelledby={`badge-heading-${rule.id}`}
    >
      <div className="space-y-1">
        <h3 id={`badge-heading-${rule.id}`} className="text-base font-semibold text-slate-900">
          {rule.label}
        </h3>
        <p className="text-sm font-medium text-slate-700" role="status">{status}</p>
        <p className="text-xs leading-relaxed text-slate-600">{caption}</p>
      </div>
      <p className="mt-3 text-xs text-slate-600">
        {result.decisive} risposte nette su {rule.questions.length} proposte considerate.
        {result.undecided > 0 && ` ${result.undecided} indecise.`}
      </p>
      <details className="mt-3 rounded-lg border border-slate-200 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
          Perché vedo questo risultato?
        </summary>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          Le risposte sono interpretate solo rispetto alle proposte indicate.
          Favorevole e Contrario sono posizioni nette; Indeciso non è un voto contrario.
          Nessuna percentuale misura quanto una persona sia animalista, ambientalista
          o appartenga a una determinata corrente politica.
        </p>
        {result.evidence.length === 0 ? (
          <p className="mt-2 text-xs text-slate-600">Non ci sono risposte nette da mostrare.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-xs text-slate-700">
            {result.evidence.map((item) => (
              <li key={item.opinionId} className="flex flex-wrap items-start justify-between gap-2 border-t border-slate-100 pt-2">
                <span className="min-w-0 flex-1">
                  {opinionLabels[item.opinionId] || item.opinionId.replace(/_/g, " ")}
                </span>
                <span className="font-semibold">
                  {readableAnswer(item.answer)}
                  {" · "}
                  {item.supportsBadge ? "coerente" : "discordante"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </details>
    </article>
  );
}

export function OpinionBadgesPanel({ answers, access, opinionLabels }: BadgePanelProps) {
  // Il controllo viene prima di qualsiasi accesso alle risposte; la presenza
  // del consenso alle Opinioni non costituisce consenso alle targhette.
  if (!access.isOwner ||
      !access.politicalConsentVerified ||
      !access.badgeConsentVerified ||
      !access.releaseGateApproved) {
    return null;
  }

  // Finche approved:false per tutte le regole, non viene calcolato nulla.
  const approvedRules = BADGE_RULES.filter((rule) => rule.approved === true);
  if (approvedRules.length === 0) return null;

  return (
    <section aria-label="Le tue targhette tematiche" className="space-y-3">
      <div className="rounded-xl border border-indigo-100 bg-white p-4">
        <h2 className="text-lg font-bold text-slate-900">Le tue targhette tematiche</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Sono indicazioni esplorative ricavate solo dalle tue Opinioni.
          Sono private e facoltative, non definiscono la tua identità o il tuo voto.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {approvedRules.map((rule) => {
          const result = evaluateOpinionBadge(rule, answers, access);
          return result ? (
            <OpinionBadgeEvidenceCard
              key={rule.id}
              rule={rule}
              result={result}
              opinionLabels={opinionLabels}
            />
          ) : null;
        })}
      </div>
    </section>
  );
}
