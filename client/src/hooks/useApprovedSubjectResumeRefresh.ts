import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
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
  // Keep the foreground signal across loading/filter transitions. Both
  // directories intentionally disable fresh reads while their initial GET
  // is running, but must not forget a withdrawal that happened meanwhile.
  const pendingResume = useRef(false);
  const currentRequest = useRef<AbortController | null>(null);
  const lastResumeAt = useRef(0);

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") return;

    let disposed = false;

    const resume = (replay = false) => {
      if (disposed || document.visibilityState !== "visible") return;
      if (!enabled) {
        pendingResume.current = true;
        return;
      }

      // Focus and visibilitychange often arrive together; do not poll.
      // A deferred resume must run after a stale initial/filter fetch,
      // even if it becomes ready within the normal deduplication window.
      const now = Date.now();
      if (!replay && now - lastResumeAt.current < 1500) return;
      lastResumeAt.current = now;
      pendingResume.current = false;

      currentRequest.current?.abort();
      const controller = new AbortController();
      currentRequest.current = controller;
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
          if (!disposed && !controller.signal.aborted) setApprovedSubjects([]);
        } finally {
          if (currentRequest.current === controller) currentRequest.current = null;
        }
      })();
    };

    const onResume = () => resume();
    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("focus", onResume);
    if (enabled && pendingResume.current) resume(true);

    return () => {
      disposed = true;
      // If a new directory/search load disabled this hook mid-refresh,
      // the next ready render must revalidate after the late result.
      if (currentRequest.current) {
        if (!currentRequest.current.signal.aborted) pendingResume.current = true;
        currentRequest.current.abort();
        currentRequest.current = null;
      }
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("focus", onResume);
    };
  }, [category, enabled, setApprovedSubjects]);
}
