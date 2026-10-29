import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { apiRequest } from "@/lib/queryClient";
import type { UserInfo } from "@/types/profile";
import type { OpinionQuestion } from "../types";
import { extractBaseOpinions } from "../utils/opinionUtils";
import {
  PROFILE_SUMMARY_TTL_MS,
  readProfileSummary,
  storeProfileSummary,
  clearProfileSummary,
} from "../utils/profileSummaryCache";

export type ProfilePanels = {
  personal: boolean;
  edit: boolean;
  representatives: boolean;
  candidates: boolean;
  government: boolean;
  opinions: boolean;
};
export const CLOSED_PROFILE_PANELS: ProfilePanels = {
  personal: false,
  edit: false,
  representatives: false,
  candidates: false,
  government: false,
  opinions: false,
};

async function getPayload(url: string): Promise<any> {
  const response = await apiRequest("GET", url);
  if (!response.ok || response.data?.success === false) {
    throw new Error(response.data?.error || "Errore nel caricamento del profilo");
  }
  return response.data;
}

function avatarFrom(user: UserInfo | null): any {
  if (!user?.avatar_config) return null;
  try {
    let value = user.avatar_config;
    if (typeof value === "string") value = JSON.parse(value);
    if (typeof value === "string") value = JSON.parse(value);
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

function normalizeAnswer(value: unknown): string | null {
  if (value === "f" || value === "Favorevole") return "Favorevole";
  if (value === "c" || value === "Contrario") return "Contrario";
  if (value === "i" || value === "Indeciso") return "Indeciso";
  return null;
}

function normalizedAnswers(raw: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const normalized = normalizeAnswer(value);
    if (normalized) result[key] = normalized;
  }
  return result;
}

export const useProfileData = (userId?: string, panels: ProfilePanels = CLOSED_PROFILE_PANELS) => {
  const { user, isLoading } = useAuth();
  const authReady = useAuthReady();
  const client = useQueryClient();
  const ownerId = user?.id || "";
  const targetId = userId || ownerId;
  const ownProfile = !!ownerId && targetId === ownerId;
  const enabled = !!ownerId && !!targetId && authReady && !isLoading;

  const saved = useMemo(
    () => ownProfile ? readProfileSummary(ownerId) : null,
    [ownerId, ownProfile],
  );

  // This is the only query enabled when opening the owner profile. It gets
  // initial data from a per-account allowlisted cache stored on the device.
  const summary = useQuery<UserInfo>({
    queryKey: ["profileSummary", ownerId, targetId],
    enabled,
    initialData: ownProfile ? saved?.user : undefined,
    initialDataUpdatedAt: ownProfile ? saved?.savedAt : undefined,
    staleTime: ownProfile ? PROFILE_SUMMARY_TTL_MS : 0,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const payload = await getPayload(
        ownProfile ? "/api/users/me" : `/api/users/${encodeURIComponent(targetId)}`,
      );
      const full = (payload.user || payload.data || payload) as UserInfo;
      if (ownProfile && full?.id === ownerId) {
        storeProfileSummary(ownerId, full);
        // Preserve rich data in RAM only; it is never written to localStorage.
        client.setQueryData(["profileFull", ownerId], full);
      }
      return full;
    },
  });

  const politicalPanelOpen = panels.representatives || panels.candidates ||
    panels.government || panels.opinions;
  // One consent request on opening a political section. The result is NOT
  // persisted and is rechecked after reopening or returning to the app.
  const consent = useQuery<{ granted: boolean; timestamp: string | null }>({
    queryKey: ["profileConsent", ownerId],
    enabled: enabled && ownProfile && politicalPanelOpen,
    queryFn: async () => {
      const payload = await getPayload("/api/user/political-opinions-consent");
      return {
        granted: payload.consent?.granted === true,
        timestamp: payload.consent?.timestamp || null,
      };
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
  const politicalAllowed = ownProfile && consent.isSuccess &&
    !consent.isFetching && consent.data?.granted === true;

  const needFull = panels.personal || panels.edit ||
    ((panels.representatives || panels.candidates || panels.opinions) && politicalAllowed);
  const full = useQuery<UserInfo>({
    queryKey: ["profileFull", ownerId],
    enabled: enabled && ownProfile && needFull,
    queryFn: async () => {
      const payload = await getPayload("/api/users/me");
      return (payload.user || payload.data || payload) as UserInfo;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  const government = useQuery<Record<string, string>>({
    queryKey: ["profilePolitical", ownerId, "government"],
    enabled: enabled && politicalAllowed && panels.government,
    queryFn: async () => (await getPayload("/api/governo/ideale")).data || {},
    staleTime: 0,
    gcTime: 0,
  });
  const representatives = useQuery<Record<string, any>>({
    queryKey: ["profilePolitical", ownerId, "representatives"],
    enabled: enabled && politicalAllowed && panels.representatives,
    queryFn: async () => (await getPayload("/api/rappresentanti")).data?.rappresentanti || {},
    staleTime: 0,
    gcTime: 0,
  });
  const candidates = useQuery<Record<string, any>>({
    queryKey: ["profilePolitical", ownerId, "candidates"],
    enabled: enabled && politicalAllowed && panels.candidates,
    queryFn: async () => (await getPayload("/api/candidati/selezioni")).data?.candidati || {},
    staleTime: 0,
    gcTime: 0,
  });
  const opinions = useQuery<{ questions: OpinionQuestion[]; userAnswers: Record<string, string> }>({
    queryKey: ["profilePolitical", ownerId, "opinions"],
    enabled: enabled && politicalAllowed && panels.opinions,
    queryFn: async () => {
      const payload = (await getPayload("/api/opinioni/profile")).data || {};
      return { questions: Array.isArray(payload.questions) ? payload.questions : [],
        userAnswers: payload.userAnswers || {} };
    },
    staleTime: 0,
    gcTime: 0,
  });

  useEffect(() => {
    if (ownProfile && consent.isSuccess && consent.data?.granted === false) {
      // No old political results may remain accessible after local revocation.
      client.removeQueries({ queryKey: ["profilePolitical", ownerId] });
      client.removeQueries({ queryKey: ["profileFull", ownerId] });
    }
  }, [client, ownProfile, ownerId, consent.data?.granted, consent.isSuccess]);

  const fetchAllProfileData = useCallback(async () => {
    if (!enabled) return;
    if (ownProfile) {
      clearProfileSummary(ownerId);
      client.removeQueries({ queryKey: ["profileFull", ownerId] });
      client.removeQueries({ queryKey: ["profilePolitical", ownerId] });
      client.removeQueries({ queryKey: ["profileConsent", ownerId] });
    }
    await summary.refetch();
  }, [client, enabled, ownProfile, ownerId, summary.refetch]);

  const userInfo: UserInfo | null = (ownProfile && full.data && needFull
    ? full.data : summary.data) || null;
  const storedOpinions = politicalAllowed && panels.opinions
    ? normalizedAnswers({
        ...(full.data ? extractBaseOpinions(full.data) : {}),
        ...(opinions.data?.userAnswers || {}),
      }) : {};

  return {
    userInfo,
    isLoadingInfo: !authReady || isLoading || (enabled && summary.isPending),
    error: summary.error instanceof Error ? summary.error.message : null,
    userOpinions: storedOpinions,
    opinionQuestions: politicalAllowed && panels.opinions ? (opinions.data?.questions || []) : [],
    avatarConfig: avatarFrom(userInfo),
    governoIdeale: politicalAllowed && panels.government ? (government.data || {}) : {},
    rappresentantiDetails: politicalAllowed && panels.representatives ? (representatives.data || {}) : {},
    candidatiDetails: politicalAllowed && panels.candidates ? (candidates.data || {}) : {},
    sectionsLoading: {
      personal: needFull && full.isPending,
      representatives: panels.representatives && (consent.isPending || consent.isFetching || full.isPending || representatives.isPending),
      candidates: panels.candidates && (consent.isPending || consent.isFetching || full.isPending || candidates.isPending),
      government: panels.government && (consent.isPending || consent.isFetching || government.isPending),
      opinions: panels.opinions && (consent.isPending || consent.isFetching || full.isPending || opinions.isPending),
    },
    consentGranted: politicalAllowed,
    consentChecked: consent.isSuccess && !consent.isFetching,
    fetchAllProfileData,
    isLoading,
    authReady,
  };
};
