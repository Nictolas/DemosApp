import { useEffect, type Dispatch, type SetStateAction } from "react";
import { apiRequest } from "@/lib/queryClient";

export type ApprovedDirectorySubject = { id: string; title: string };
export type ApprovedDirectoryCategory = "attivisti" | "organizzazioni";

/**
 * Privacy: an approved third-party nomination may be withdrawn while a user has
 * its directory open in a suspended tab/WebView. Recheck ONLY on app resume or
 * window focus, never poll. The normal directory GET handles the initial load.
 *
 * Immediately hide old nominations on resume. If offline, unauthorized or if
 * the query fails, do not resurrect a withdrawn name from local React state.
 */
export function useApprovedSubjectResumeRefresh(
  category: ApprovedDirectoryCategory,
  setApprovedSubjects: Dispatch<SetStateAction<ApprovedDirectorySubject[]>>,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled || typeof document === "undefined" || typeof window === "undefined") return;

    let disposed = false;
    let current: AbortController | null = null;
    let lastResumeAt = 0;

    const resume = () => {
      if (disposed || document.visibilityState !== "visible") return;

      // Some devices dispatch focus + visibilitychange together. One GET,
      // no recurring timer or read on initial mount.
      const now = Date.now();
      if (now - lastResumeAt < 1500) return;
      lastResumeAt = now;

      current?.abort();
      const controller = new AbortController();
      current = controller;
      setApprovedSubjects([]);

      void (async () => {
        try {
          const response = await apiRequest(
            "GET",
            "/api/subject-proposals/approved?category=" + category,
            undefined,
            undefined,
            controller.signal,
          );
          const body = await response.json();
          if (!body?.success || !Array.isArray(body.data)) throw new Error("Elenco non valido");

          // Never copy unrelated/private JSON keys into view state.
          const approved: ApprovedDirectorySubject[] = body.data
            .filter((entry: unknown): entry is ApprovedDirectorySubject =>
              !!entry && typeof entry === "object" &&
              typeof (entry as ApprovedDirectorySubject).id === "string" &&
              typeof (entry as ApprovedDirectorySubject).title === "string")
            .map((entry: ApprovedDirectorySubject) => ({ id: entry.id, title: entry.title }));

          if (!disposed && !controller.signal.aborted) setApprovedSubjects(approved);
        } catch {
          // Fail closed for third-party published names. A future resume retries.
          if (!disposed && !controller.signal.aborted) setApprovedSubjects([]);
        } finally {
          if (current === controller) current = null;
        }
      })();
    };

    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    return () => {
      disposed = true;
      current?.abort();
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
    };
  }, [category, enabled, setApprovedSubjects]);
}
