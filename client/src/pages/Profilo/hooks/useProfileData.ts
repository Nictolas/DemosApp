import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { apiRequest } from "@/lib/queryClient";
import type { UserInfo } from "@/types/profile";
import type { OpinionQuestion } from "../types";
import { extractBaseOpinions } from "../utils/opinionUtils";

type ProfileSnapshot = {
  userInfo: UserInfo;
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

async function getProfilePayload(path: string): Promise<any> {
  const response = await apiRequest("GET", path);
  if (!response?.ok || !response?.data || response.data.success === false) {
    throw new Error("Impossibile caricare il profilo");
  }
  return response.data;
}

async function getOptionalPayload(path: string): Promise<any | null> {
  try {
    return await getProfilePayload(path);
  } catch {
    // Una sezione accessoria non deve rendere irraggiungibile il profilo.
    return null;
  }
}

async function loadOwnProfile(): Promise<ProfileSnapshot> {
  const payload = await getProfilePayload("/api/users/me");
  const userInfo = (payload.user || payload.data || payload) as UserInfo;

  // Queste letture non devono essere ripetute ad ogni montaggio della pagina.
  // In caso di salvataggio le mutation invalidano il gruppo profileSnapshot.
  const [opinions, government, representatives, candidates] = await Promise.all([
    getOptionalPayload("/api/opinioni/profile"),
    getOptionalPayload("/api/governo/ideale"),
    getOptionalPayload("/api/rappresentanti"),
    getOptionalPayload("/api/candidati/selezioni"),
  ]);

  const opinionData = opinions?.data;
  return {
    userInfo,
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

async function loadOtherProfile(targetUserId: string): Promise<ProfileSnapshot> {
  // I dati di un altro utente NON sono quelli dell'account visitatore.
  // Usare esclusivamente la proiezione pubblica server-side; non /api/users/:id admin.
  const payload = await getProfilePayload(
    `/api/users/${encodeURIComponent(targetUserId)}/public-profile`,
  );
  const userInfo = payload.user as UserInfo;
  const opinions = await getOptionalPayload(
    `/api/users/${encodeURIComponent(targetUserId)}/opinioni`,
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
    queryFn: () => ownProfile ? loadOwnProfile() : loadOtherProfile(targetId!),
    staleTime: ownProfile ? 10 * 60 * 1000 : 0,
    gcTime: ownProfile ? 30 * 60 * 1000 : 0,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const fetchAllProfileData = useCallback(async () => {
    if (ownerId && targetId) await query.refetch();
  }, [ownerId, targetId, query.refetch]);

  return {
    userInfo: query.data?.userInfo || null,
    isLoadingInfo: query.isPending && query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    userOpinions: query.data?.userOpinions || {},
    avatarConfig: query.data?.avatarConfig || null,
    governoIdeale: query.data?.governoIdeale || {},
    opinionQuestions: query.data?.opinionQuestions || [],
    rappresentantiDetails: query.data?.rappresentantiDetails || {},
    candidatiDetails: query.data?.candidatiDetails || {},
    fetchAllProfileData,
    isLoading,
    authReady,
  };
};
