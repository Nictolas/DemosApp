import { OPINION_TOPIC_BY_ID, OPINION_TOPIC_DEFINITIONS, type OpinionTopicId } from "./opinionTopics";
import type { PersistedProfile, OpinionCategorySection } from "@/pages/Profilo/utils/encryptedProfileVault";

type Question = { id: string; userAnswer?: string | null };
export type TopicProgress = Readonly<{ completed: number; total: number; percent: number }>;
export type TopicsProgress = Readonly<Record<OpinionTopicId, TopicProgress>>;
const valid = (x: unknown) => x === "f" || x === "c" || x === "i";
const opinionIds = Object.keys(OPINION_TOPIC_BY_ID);

/** Takes confirmed userAnswer values, never unsaved editor drafts. */
export function calculateOpinionTopicProgress(questions: readonly Question[]): TopicsProgress {
  const answers = new Map<string, boolean>();
  for (const question of questions) {
    if (Object.prototype.hasOwnProperty.call(OPINION_TOPIC_BY_ID, question.id) && !answers.has(question.id)) {
      answers.set(question.id, valid(question.userAnswer));
    }
  }
  return Object.fromEntries(OPINION_TOPIC_DEFINITIONS.map(topic => {
    const ids = opinionIds.filter(id => OPINION_TOPIC_BY_ID[id] === topic.id);
    const completed = ids.filter(id => answers.get(id) === true).length;
    return [topic.id, { completed, total: ids.length, percent: ids.length ? Math.round(completed * 100 / ids.length) : 0 }];
  })) as Record<OpinionTopicId, TopicProgress>;
}

/** Does not fetch: incomplete, stale or unauthorized local data yields unknown progress. */
export function topicProgressFromEncryptedProfile(
  profile: PersistedProfile | null,
  epoch: string | null,
): TopicsProgress | null {
  if (!epoch || profile?.consent?.granted !== true || profile.consent.timestamp !== epoch) return null;
  const sections: readonly (readonly [OpinionCategorySection, "E" | "N" | "R" | "CO"])[] =
    [["opinionE", "E"], ["opinionN", "N"], ["opinionR", "R"], ["opinionCO", "CO"]];
  const byId = new Map<string, Question>();
  let revision: string | null = null;
  for (const [section, grade] of sections) {
    const saved = profile[section];
    if (!saved || saved.version !== 1 || saved.grade !== grade ||
        !/^[a-f0-9]{64}$/.test(saved.catalogRevision) || !Array.isArray(saved.questions)) return null;
    if (revision !== null && revision !== saved.catalogRevision) return null;
    revision = saved.catalogRevision;
    for (const q of saved.questions) {
      if (!q || !Object.prototype.hasOwnProperty.call(OPINION_TOPIC_BY_ID, q.id)) return null;
      const previous = byId.get(q.id);
      if (previous && previous.userAnswer !== q.userAnswer) return null;
      byId.set(q.id, q);
    }
  }
  if (byId.size !== opinionIds.length) return null;
  return calculateOpinionTopicProgress([...byId.values()]);
}
