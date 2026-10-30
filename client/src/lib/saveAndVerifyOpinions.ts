import { apiRequest } from "@/lib/queryClient";

type OpinionGrade = "E" | "N" | "R" | "CO";

/**
 * The backend replies only after a database COMMIT. Verify that the authenticated
 * server acknowledged every changed ID. Never issue an extra GET just to confirm
 * the POST or reload the entire answer set after a save.
 *
 * Note: the backend's consent/revocation transaction gate in privacy PR #264
 * remains a hard rollout dependency for this optimization.
 */
export async function saveAndVerifyOpinions(
  _grade: OpinionGrade,
  opinions: Record<string, string>,
): Promise<void> {
  const entries = Object.entries(opinions);
  if (entries.length === 0 || entries.some(([, answer]) => !["f", "c", "i"].includes(answer))) {
    throw new Error("Nessuna risposta modificata valida da salvare.");
  }

  const response = await apiRequest("POST", "/api/opinioni/salva", { opinioni: opinions });
  const result = response.data;
  if (
    !response.ok ||
    !result?.success ||
    Number(result.savedCount) !== entries.length ||
    Number(result.errorCount ?? 0) !== 0
  ) {
    throw new Error("Il server non ha confermato il salvataggio di tutte le risposte.");
  }
}
