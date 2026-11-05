/** Local, public classification. Never stores user answers or modifies opinion scopes. */
import topicData from "./opinionTopics.json";

export interface OpinionTopic {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly description: string;
}

export const OPINION_TOPICS: readonly OpinionTopic[] = Object.freeze(
  topicData.topics.map((topic) => Object.freeze({ ...topic })),
);

export const OPINION_TOPIC_BY_ID: Readonly<Record<string, string>> =
  Object.freeze({ ...topicData.opinionIdToTopic });

const topicIds = new Set(OPINION_TOPICS.map((topic) => topic.id));

export function getOpinionTopicId(opinionId: string): string | null {
  return Object.prototype.hasOwnProperty.call(OPINION_TOPIC_BY_ID, opinionId)
    ? OPINION_TOPIC_BY_ID[opinionId]
    : null;
}

/** Filters already-loaded published metadata; no fetch, storage or SQL. */
export function filterOpinionsByTopic<T extends { id: string }>(
  opinions: readonly T[],
  topicId: string,
): T[] {
  if (!topicIds.has(topicId)) return [];
  const seen = new Set<string>();
  return opinions.filter((opinion) => {
    if (seen.has(opinion.id) || getOpinionTopicId(opinion.id) !== topicId) {
      return false;
    }
    seen.add(opinion.id);
    return true;
  });
}
