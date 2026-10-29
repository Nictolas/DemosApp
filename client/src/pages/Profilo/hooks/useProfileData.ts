import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { apiRequest } from "@/lib/queryClient";
import type { UserInfo } from "@/types/profile";
import type { OpinionQuestion } from "../types";
import { extractBaseOpinions } from "../utils/opinionUtils";

type ProfileSnapshot = {
  userInfo: UserInfo;
  consentFingerprint?: string;
  userOpinions: Record<string, string>;
  avatarConfig: unknown;
  governoIdeale: Record<string, string>;
  opinionQuestions: OpinionQuestion[];
  rappresentantiDetails: Record<string, any>;
  candidatiDetails: Record<string, any>;
};

function normalizeOpinionValue(value: unknown): string | null {
  if (value === "f" || value === "Sì" || value === "Favorevole") return "Favorevole";
  if (value === "c" || value === "No" || value === "Contrario") return "Contrario";
  if (value === "i" || value === "Indeciso" || value === "Non lo so") return "Indeciso";
  return null;
}

function normalizeOpinionAnswers(raw: Record<string, unknown>): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [id, answer] of Object.entries(raw)) {
    const normalized = normalizeOpinionValue(answer);
    if (normalized) output[id] = normalized;
  }
  return output;
}

function consentFingerprint(payload: any): string {
  const state = payload?.consent;
  // Both the boolean and the consent-grant timestamp are needed: a
  // revoke-and-regrant on another device must not resurrect old choices.
  if (!state || typeof state.granted !== "boolean") {
    throw new Error("Stato del consenso non verificabile");
  }
  return JSON.stringify([state.granted, state.timestamp || null]);
}

function parseAvatar(value: unknown): unknown {
  if (!value) return null;
  try {
    let parsed: unknown = typeof value === "string" ? JSON.parse(value) : value;
    if (typeof parsed === "string") parsed = JSON.parse(parsed);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

async function getProfilePayload(path: string, signal: AbortSignal): Promise<any> {
  const response = await apiRequest("GET", path, undefined, undefined, signal);
  if (!response?.ok || !response?.data || response.data.success === false) {
    throw new Error("Impossibile caricare il profilo");
  }
  return response.data;
}

async function getOptionalPayload(path: string, signal: AbortSignal): Promise<any | null> {
  try {
    return await getProfilePayload(path, signal);
  } catch (error: any) {
    // In una richiesta annullata non salvare uno snapshot parziale in cache.
    if (signal.aborted || error?.name === "AbortError") throw error;
    // Accesso non consentito o sezione non trovata: non mostrare i dati.
    if (error?.status === 403 || error?.status === 404) return null;
    // Guasti transitori non devono diventare uno snapshot vuoto valido 10 minuti.
    throw error;
  }
}

async function loadOwnProfile(signal: AbortSignal): Promise<ProfileSnapshot> {
  const payload = await getProfilePayload("/api/users/me", signal);
  const userInfo = (payload.user || payload.data || payload) as UserInfo;

  // Queste letture non devono essere ripetute ad ogni montaggio della pagina.
  // In caso di salvataggio le mutation invalidano il gruppo profileSnapshot.
  const [opinions, government, representatives, candidates, consent] = await Promise.all([
    getOptionalPayload("/api/opinioni/profile", signal),
    getOptionalPayload("/api/governo/ideale", signal),
    getOptionalPayload("/api/rappresentanti", signal),
    getOptionalPayload("/api/candidati/selezioni", signal),
    getProfilePayload("/api/user/political-opinions-consent", signal),
  ]);

  const opinionData = opinions?.data;
  return {
    userInfo,
    consentFingerprint: consentFingerprint(consent),
    avatarConfig: parseAvatar(userInfo.avatar_config),
    userOpinions: normalizeOpinionAnswers({
      ...extractBaseOpinions(userInfo),
      ...(opinionData?.userAnswers || {}),
    }),
    opinionQuestions: Array.isArray(opinionData?.questions) ? opinionData.questions : [],
    governoIdeale: government?.data?.success === false ? {} : (government?.data || {}),
    rappresentantiDetails: representatives?.data?.rappresentanti || {},
    candidatiDetails: candidates?.data?.candidati || {},
  };
}

async function loadOtherProfile(targetUserId: string, signal: AbortSignal): Promise<ProfileSnapshot> {
  // I dati di un altro utente NON sono quelli dell'account visitatore.
  // Usare esclusivamente la proiezione pubblica server-side; non /api/users/:id admin.
  const payload = await getProfilePayload(
    `/api/users/${encodeURIComponent(targetUserId)}/public-profile`, signal,
  );
  const userInfo = payload.user as UserInfo;
  const opinions = await getOptionalPayload(
    `/api/users/${encodeURIComponent(targetUserId)}/opinioni`, signal,
  );
  const opinionData = opinions?.data;
  const publicOpinions = Array.isArray(opinionData?.opinioni) ? opinionData.opinioni : [];
  const answers: Record<string, string> = {};
  const questions: OpinionQuestion[] = [];
  for (const item of publicOpinions) {
    if (typeof item?.id !== "string") continue;
    const normalized = normalizeOpinionValue(item.userAnswer);
    if (!normalized) continue;
    answers[item.id] = normalized;
    questions.push({ id: item.id, text: String(item.text || "") });
  }
  return {
    userInfo,
    avatarConfig: parseAvatar(userInfo.avatar_config),
    userOpinions: answers,
    opinionQuestions: questions,
    governoIdeale: payload.public?.governoIdeale || {},
    rappresentantiDetails: payload.public?.rappresentanti || {},
    candidatiDetails: payload.public?.candidati || {},
  };
}

export const useProfileData = (userId?: string) => {
  const authReady = useAuthReady();
  const { user, isLoading } = useAuth();
  const ownerId = user?.id;
  const targetId = userId || ownerId;
  const ownProfile = !!ownerId && targetId === ownerId;

  // Cache SOLO in memoria React Query: nessuna opinione/scelta politica in localStorage.
  // Le chiavi includono il visitatore e il soggetto: mai riusare dati tra account.
  const query = useQuery<ProfileSnapshot>({
    queryKey: ["profileSnapshot", ownerId ?? null, targetId ?? null],
    enabled: Boolean(authReady && !isLoading && ownerId && targetId),
    queryFn: ({ signal }) => ownProfile ? loadOwnProfile(signal) : loadOtherProfile(targetId!, signal),
    staleTime: ownProfile ? 10 * 60 * 1000 : 0,
    gcTime: ownProfile ? 30 * 60 * 1000 : 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: false,
  });

  // The owner snapshot may contain political choices. On re-entry from RAM
  // or when returning from another app, validate only consent (one small GET)
  // before showing any cached snapshot. Never persist this state on device.
  type Verification = { key: string; status: "pending" | "approved" | "blocked" };
  const [verification, setVerification] = useState<Verification | null>(null);
  const inFlight = useRef(false);
  const previousFocusAt = useRef(0);
  const identityKey = ownProfile ? ownerId + "::" + targetId : "";
  const hasCachedSnapshot = ownProfile && !!query.data && !query.isFetchedAfterMount;
  const explicitlyPending = verification?.key === identityKey && verification.status === "pending";
  const explicitlyBlocked = verification?.key === identityKey && verification.status === "blocked";
  const verifiedForIdentity = verification?.key === identityKey && verification.status === "approved";
  const needsVerification = Boolean(
    ownProfile && query.data &&
    !explicitlyBlocked &&
    (explicitlyPending || (hasCachedSnapshot && !verifiedForIdentity))
  );
  const isPoliticalSnapshotSafe = !ownProfile || (
    !explicitlyPending && !explicitlyBlocked && (!hasCachedSnapshot || verifiedForIdentity)
  );

  useEffect(() => {
    if (!ownProfile || !ownerId || !query.data) return;
    const onReturn = () => {
      if (document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - previousFocusAt.current < 1000) return;
      previousFocusAt.current = now;
      setVerification({ key: identityKey, status: "pending" });
    };
    const onVisible = () => { if (document.visibilityState === "visible") onReturn(); };
    window.addEventListener("focus", onReturn);
    window.addEventListener("online", onReturn);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onReturn);
      window.removeEventListener("online", onReturn);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ownProfile, ownerId, identityKey, Boolean(query.data)]);

  useEffect(() => {
    if (!needsVerification || !query.data?.consentFingerprint || inFlight.current) return;
    inFlight.current = true;
    const controller = new AbortController();
    const expectedFingerprint = query.data.consentFingerprint;
    const key = identityKey;
    const verify = async () => {
      try {
        const payload = await getProfilePayload("/api/user/political-opinions-consent", controller.signal);
        if (controller.signal.aborted) return;
        const observed = consentFingerprint(payload);
        if (observed !== expectedFingerprint) {
          // A different device revoked/regranted consent. Keep the cached
          // snapshot hidden until fresh server-gated values replace it.
          const fresh = await query.refetch();
          if (fresh.isError) throw fresh.error;
        }
        setVerification({ key, status: "approved" });
      } catch {
        // Fail closed. Offline/5xx must never display old political choices.
        if (!controller.signal.aborted) setVerification({ key, status: "blocked" });
      } finally {
        inFlight.current = false;
      }
    };
    void verify();
    return () => controller.abort();
  }, [needsVerification, identityKey, query.dataUpdatedAt]);

  const fetchAllProfileData = useCallback(async () => {
    if (ownerId && targetId) await query.refetch();
  }, [ownerId, targetId, query.refetch]);

  return {
    userInfo: isPoliticalSnapshotSafe ? (query.data?.userInfo || null) : null,
    isLoadingInfo: !authReady || (Boolean(ownerId && targetId) && query.isPending) || !isPoliticalSnapshotSafe,
    error: query.error instanceof Error ? query.error.message : null,
    userOpinions: isPoliticalSnapshotSafe ? (query.data?.userOpinions || {}) : {},
    avatarConfig: isPoliticalSnapshotSafe ? (query.data?.avatarConfig || null) : null,
    governoIdeale: isPoliticalSnapshotSafe ? (query.data?.governoIdeale || {}) : {},
    opinionQuestions: isPoliticalSnapshotSafe ? (query.data?.opinionQuestions || []) : [],
    rappresentantiDetails: isPoliticalSnapshotSafe ? (query.data?.rappresentantiDetails || {}) : {},
    candidatiDetails: isPoliticalSnapshotSafe ? (query.data?.candidatiDetails || {}) : {},
    fetchAllProfileData,
    isLoading,
    authReady,
  };
};
