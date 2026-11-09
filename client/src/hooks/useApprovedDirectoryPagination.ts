import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { apiRequest } from "@/lib/queryClient";
import type { ApprovedDirectoryCategory, ApprovedDirectorySubject } from "./useApprovedSubjectResumeRefresh";

export function useApprovedDirectoryPagination(
  category: ApprovedDirectoryCategory,
  setApprovedSubjects: Dispatch<SetStateAction<ApprovedDirectorySubject[]>>,
) {
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageError, setPageError] = useState(false);
  const version = useRef(0);
  const pending = useRef<AbortController | null>(null);

  const reset = useCallback((cursor: string | null) => {
    version.current++;
    pending.current?.abort();
    pending.current = null;
    setNextCursor(typeof cursor === "string" && cursor.length > 0 ? cursor : null);
    setLoadingMore(false);
    setPageError(false);
  }, []);

  useEffect(() => () => {
    version.current++;
    pending.current?.abort();
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    const expected = version.current;
    const controller = new AbortController();
    pending.current = controller;
    setLoadingMore(true);
    setPageError(false);
    try {
      const response = await apiRequest(
        "GET",
        "/api/subject-proposals/approved?category=" + category +
          "&cursor=" + encodeURIComponent(nextCursor),
        undefined, undefined, controller.signal,
      );
      if (!response.ok) throw new Error("Elenco non disponibile");
      const body = await response.json();
      if (!body?.success || !Array.isArray(body.data)) throw new Error("Elenco non valido");
      const approved: ApprovedDirectorySubject[] = body.data
        .filter((item: unknown): item is ApprovedDirectorySubject =>
          !!item && typeof item === "object" &&
          typeof (item as ApprovedDirectorySubject).id === "string" &&
          typeof (item as ApprovedDirectorySubject).title === "string")
        .map((item: ApprovedDirectorySubject) => ({ id: item.id, title: item.title }));
      if (version.current !== expected || controller.signal.aborted) return;
      setApprovedSubjects(previous => {
        const known = new Set(previous.map(item => item.id));
        return [...previous, ...approved.filter(item => !known.has(item.id))];
      });
      setNextCursor(typeof body.next_cursor === "string" ? body.next_cursor : null);
    } catch {
      if (version.current === expected && !controller.signal.aborted) setPageError(true);
    } finally {
      if (pending.current === controller) pending.current = null;
      if (version.current === expected) setLoadingMore(false);
    }
  }, [category, loadingMore, nextCursor, setApprovedSubjects]);

  return { nextCursor, loadingMore, pageError, reset, loadMore };
}
