import { Link } from "wouter";
import { ChevronRight, ClipboardList } from "lucide-react";
import { OPINION_TOPIC_BY_ID } from "@/lib/opinionTopics";

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

/** A single compact link: all editing takes place on the dedicated page. */
export function CompleteOpinionsCallout({ answers, visible }: Props) {
  if (!visible) return null;
  const counts = getIncompleteOpinionCount(answers);
  if (counts.total === 0) return null;

  return (
    <Link
      href="/opinioni-da-completare"
      aria-label={`Completa Opinioni: ${counts.total} da completare`}
      data-testid="completa-opinioni"
      className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-left shadow-sm transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
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
      <ChevronRight className="h-5 w-5 shrink-0 text-amber-800" aria-hidden="true" />
    </Link>
  );
}
