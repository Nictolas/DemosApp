import { CheckCircle, HelpCircle, XCircle } from "lucide-react";
import { categorizeOpinions } from "../utils/opinionUtils";
import type { OpinionQuestion } from "../types";

interface ProfileOpinionsProps {
  userOpinions: Record<string, string>;
  opinionQuestions: OpinionQuestion[];
}

export const ProfileOpinions = ({ userOpinions, opinionQuestions }: ProfileOpinionsProps) => {
  if (!userOpinions || Object.keys(userOpinions).length === 0) return null;

  const categorized = categorizeOpinions(userOpinions, opinionQuestions);
  const groups = [
    { title: "Favorevole", rows: categorized.favorevoli, icon: CheckCircle, color: "text-emerald-700", bg: "bg-emerald-50" },
    { title: "Indeciso", rows: categorized.indecisi, icon: HelpCircle, color: "text-amber-700", bg: "bg-amber-50" },
    { title: "Contrario", rows: categorized.contrari, icon: XCircle, color: "text-rose-700", bg: "bg-rose-50" },
  ];

  return (
    <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
      {groups.map(({ title, rows, icon: Icon, color, bg }) => (
        <section key={title} className="min-w-0 rounded-lg border border-slate-100 p-3">
          <h3 className={`flex items-center gap-2 text-sm font-semibold ${color}`}>
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
            {title} <span className="ml-auto text-xs">{rows.length}</span>
          </h3>
          {rows.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {rows.map(({ id, label }) => (
                <li key={id} className={`break-words rounded-md px-2 py-1.5 text-sm text-slate-800 ${bg}`}>
                  {label}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-slate-500">Nessuna opinione</p>
          )}
        </section>
      ))}
    </div>
  );
};
