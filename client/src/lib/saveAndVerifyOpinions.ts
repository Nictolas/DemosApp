import { apiRequest } from "@/lib/queryClient";

type PoliticalAnswer = "f" | "c" | "i";
type OpinionGrade = "E" | "N" | "R" | "CO";

interface SavedQuestion {
  id: string;
  userAnswer: PoliticalAnswer | null;
}

/**
 * A successful POST is not sufficient evidence that the answers will appear
 * after the user returns to the page. Confirm that a fresh authenticated GET
 * reads back every submitted answer before displaying a success message.
 */
export async function saveAndVerifyOpinions(
  grade: OpinionGrade,
  opinions: Record<string, string>,
): Promise<void> {
  const entries = Object.entries(opinions);
  if (entries.length === 0 || entries.some(([, answer]) => !["f", "c", "i"].includes(answer))) {
    throw new Error("Nessuna risposta valida da salvare.");
  }

  const response = await apiRequest("POST", "/api/opinioni/salva", { opinioni: opinions });
  const result = response.data;
  if (
    !result?.success ||
    Number(result.savedCount) !== entries.length ||
    Number(result.errorCount ?? 0) !== 0
  ) {
    throw new Error("Il server non ha confermato il salvataggio di tutte le risposte.");
  }

  // Read directly from the API, bypassing any React Query cache.
  const verified = await apiRequest("GET", `/api/opinioni-list?grado=${grade}`);
  const questions: SavedQuestion[] | undefined = verified.data?.data;
  if (!verified.data?.success || !Array.isArray(questions)) {
    throw new Error("Salvataggio inviato, ma verifica delle risposte non riuscita.");
  }

  const actual = new Map(questions.map(({ id, userAnswer }) => [id, userAnswer]));
  if (entries.some(([id, answer]) => actual.get(id) !== answer)) {
    throw new Error("Alcune risposte non risultano salvate. Ricarica la pagina e riprova.");
  }
}
