import { useState } from "react";
import { Link } from "wouter";
import { ChevronDown, ChevronRight, ClipboardList } from "lucide-react";
import { OPINION_TOPIC_BY_ID, OPINION_TOPIC_DEFINITIONS } from "@/lib/opinionTopics";

type OpinionQuestion = { id: string; text: string };
type OpinionAnswer = "answered" | "undecided" | "unanswered";

function statusOf(answer: unknown): OpinionAnswer {
  if (answer === "f" || answer === "c" || answer === "Favorevole" || answer === "Contrario") return "answered";
  if (answer === "i" || answer === "Indeciso") return "undecided";
  return "unanswered";
}

/** Count published opinions only. An explicit Indeciso is not an unanswered question. */
export function getIncompleteOpinionCount(answers: Record<string, string>) {
  let undecided = 0;
  let unanswered = 0;
  for (const id of Object.keys(OPINION_TOPIC_BY_ID)) {
    const status = statusOf(answers[id]);
    if (status === "undecided") undecided++;
    if (status === "unanswered") unanswered++;
  }
  return { undecided, unanswered, total: undecided + unanswered };
}

interface Props {
  answers: Record<string, string>;
  questions: OpinionQuestion[];
  /** This private component must never appear before political consent and verified answers. */
  visible: boolean;
}

export function CompleteOpinionsCallout({ answers, questions, visible }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (!visible) return null;

  const counts = getIncompleteOpinionCount(answers);
  if (counts.total === 0) return null;

  const labels = new Map(questions.map(question => [question.id, question.text]));
  const unresolved = Object.keys(OPINION_TOPIC_BY_ID).filter(id => statusOf(answers[id]) !== "answered");
  const topics = new Map(OPINION_TOPIC_DEFINITIONS.map(topic => [topic.id, topic.title]));

  return (
    <section aria-label="Completa le tue Opinioni" className="overflow-hidden rounded-xl border border-amber-300 bg-amber-50 shadow-sm" data-testid="completa-opinioni">
      <button
        type="button"
        onClick={() => setExpanded(current => !current)}
        aria-expanded={expanded}
        aria-controls="completa-opinioni-elenco"
        className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-inset"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-200 text-amber-800">
          <ClipboardList className="h-6 w-6" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold text-slate-900">Completa Opinioni</span>
          <span className="block text-sm text-slate-700">Sei ancora indeciso su {counts.total} opinioni.</span>
          <span className="mt-1 block text-xs text-amber-950">
            {counts.unanswered} senza risposta · {counts.undecided} segnate «Indeciso»
          </span>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-amber-800 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {expanded && (
        <div id="completa-opinioni-elenco" className="border-t border-amber-200 bg-white/80 p-3">
          <p className="mb-2 text-xs text-slate-600">Scegli un'opinione per esprimerla o modificarla. Le risposte si salvano nella relativa sezione.</p>
          <ul className="max-h-72 space-y-1 overflow-y-auto overscroll-contain" aria-label="Opinioni da completare">
            {unresolved.map(id => {
              const topicId = OPINION_TOPIC_BY_ID[id];
              return (
                <li key={id}>
                  <Link
                    href={`/opinioni-argomento/${topicId}`}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm text-slate-900 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{labels.get(id) || id.replaceAll("_", " ")}</span>
                      <span className="block text-xs text-slate-500">
                        {topics.get(topicId)} · {statusOf(answers[id]) === "undecided" ? "Indeciso" : "Senza risposta"}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
