import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { apiRequest } from "@/lib/queryClient";
import type { UserInfo } from "@/types/profile";
import type { OpinionQuestion } from "../types";
import { extractBaseOpinions } from "../utils/opinionUtils";
import {
  loadEncryptedProfile, patchEncryptedProfile, clearEncryptedProfile, profileSectionRevision,
  filterPersistedFullProfile, type ProfileChosenVotes,
} from "../utils/encryptedProfileVault";
import {
  PROFILE_SUMMARY_TTL_MS,
  readProfileSummary,
  storeProfileSummary,
  clearProfileSummary,
} from "../utils/profileSummaryCache";

// The authenticated owner's encrypted IndexedDB cache has no age-based expiry.
// These values remain in RAM as well for fast panel toggling.
const PROFILE_CACHE_FRESH = Infinity;
const PROFILE_CACHE_GC = Infinity;

export type ProfilePanels = {
  edit: boolean;
  representatives: boolean;
  candidates: boolean;
  government: boolean;
  opinions: boolean;
};
export const CLOSED_PROFILE_PANELS: ProfilePanels = {
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
  const { user, isLoading, isSessionVerified, verifiedPoliticalConsent } = useAuth();
  const authReady = useAuthReady();
  const client = useQueryClient();
  const [vaultOwner, setVaultOwner] = useState<string | null>(null);
  const ownerId = user?.id || "";
  const targetId = userId || ownerId;
  const ownProfile = !!ownerId && targetId === ownerId;
  const enabled = !!ownerId && !!targetId && authReady && !isLoading;
  const vaultReady = !ownProfile || vaultOwner === ownerId;

  useEffect(() => {
    if (!ownProfile || !enabled || !isSessionVerified || !verifiedPoliticalConsent) {
      setVaultOwner(null);
      return;
    }
    let active = true;
    setVaultOwner(null);
    void loadEncryptedProfile(ownerId).then(async snapshot => {
      if (!active) return;
      const currentEpoch = verifiedPoliticalConsent.timestamp || "legacy";
      // The authorization version is supplied by the already mandatory
      // /auth/me request; a revoked/regranted consent cannot revive old data.
      const matches = snapshot?.consent?.granted === true &&
        verifiedPoliticalConsent.granted === true &&
        (snapshot?.consent?.timestamp || "legacy") === currentEpoch;
      if (!matches) {
        if (snapshot) await clearEncryptedProfile(ownerId);
        if (!active) return;
        client.removeQueries({ queryKey: ["profilePolitical", ownerId] });
        client.removeQueries({ queryKey: ["profileFull", ownerId] });
        // Initialize the new authorization epoch BEFORE requesting any panels.
        // Without this write every browser reload treats the encrypted vault
        // as untrusted and unnecessarily re-fetches all six profile endpoints.
        if (verifiedPoliticalConsent.granted) {
          await patchEncryptedProfile(ownerId, {
            consent: {
              granted: true,
              timestamp: verifiedPoliticalConsent.timestamp || null,
            },
          });
        }
      } else if (snapshot) {
        client.setQueryData(["profileFull", ownerId, currentEpoch], snapshot.full || undefined);
        client.setQueryData(["profileFull", ownerId, "personal"], snapshot.full || undefined);
        // Older encrypted snapshots may contain the initiative UUID instead of
        // its title. Migrate that ONE cached section once; all valid cached
        // choices remain available without any profile API request.
        const legacyInitiativeId = snapshot.preferences?.iniziativaPopolare?.some(
          value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim())
        ) === true;
        const sections = [
          ["government", snapshot.government],
          ["representatives", snapshot.representatives],
          ["candidates", snapshot.candidates],
          // Catalog-only snapshots created by older releases had no personal
          // answers; never treat their empty map as a verified result.
          ["opinions", snapshot.opinions?.answersLoaded === true ? snapshot.opinions : null],
          ["preferences", legacyInitiativeId ? null : snapshot.preferences || null],
        ] as const;
        for (const [section, payload] of sections) {
          if (payload !== null) client.setQueryData(
            ["profilePolitical", ownerId, currentEpoch, section], payload,
          );
        }
      }
      if (active) setVaultOwner(ownerId);
    }).catch(() => { if (active) setVaultOwner(ownerId); });
    return () => { active = false; };
  }, [ownerId, ownProfile, enabled, isSessionVerified,
      verifiedPoliticalConsent?.granted, verifiedPoliticalConsent?.timestamp, client]);

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
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const payload = await getPayload(
        ownProfile ? "/api/users/me" : `/api/users/${encodeURIComponent(targetId)}`,
      );
      const full = (payload.user || payload.data || payload) as UserInfo;
      if (ownProfile && full?.id === ownerId) {
        storeProfileSummary(ownerId, full);
        // Preserve rich data in RAM only; it is never written to localStorage.
        client.setQueryData(["profileFull", ownerId, "personal"], full);
      }
      return full;
    },
  });

  const politicalPanelOpen = panels.representatives || panels.candidates ||
    panels.government || panels.opinions;
  // The mandatory session authentication already includes the consent
  // grant and epoch. Opening panels must not trigger a separate consent GET.
  const consentVerified = isSessionVerified && verifiedPoliticalConsent !== null;
  const politicalAllowed = ownProfile && vaultReady && consentVerified &&
    verifiedPoliticalConsent?.granted === true;
  const politicalEpoch = verifiedPoliticalConsent?.timestamp || "legacy";
  const consent = {
    isPending: !consentVerified,
    isFetching: !isSessionVerified,
    isSuccess: consentVerified,
    data: verifiedPoliticalConsent,
  };

  const needFull = panels.edit ||
    ((panels.representatives || panels.candidates || panels.opinions) && politicalAllowed);
  const full = useQuery<UserInfo>({
    queryKey: ["profileFull", ownerId, politicalPanelOpen ? politicalEpoch : "personal"],
    enabled: enabled && ownProfile && vaultReady && needFull,
    queryFn: async () => {
      const revision = profileSectionRevision(ownerId, "full");
      const payload = await getPayload("/api/users/me");
      const loaded = (payload.user || payload.data || payload) as UserInfo;
      await patchEncryptedProfile(ownerId, { full: filterPersistedFullProfile(loaded) }, { full: revision });
      return loaded;
    },
    staleTime: PROFILE_CACHE_FRESH,
    gcTime: PROFILE_CACHE_GC,
    refetchOnWindowFocus: false,
  });

  const preferences = useQuery<ProfileChosenVotes>({
    queryKey: ["profilePolitical", ownerId, politicalEpoch, "preferences"],
    enabled: enabled && vaultReady && politicalAllowed,
    queryFn: async () => {
      const revision = profileSectionRevision(ownerId, "preferences");
      const payload = await getPayload("/api/user/profile-selections");
      const value = payload.data as ProfileChosenVotes;
      await patchEncryptedProfile(ownerId, { preferences: value }, { preferences: revision });
      return value;
    },
    staleTime: PROFILE_CACHE_FRESH,
    gcTime: PROFILE_CACHE_GC,
    refetchOnWindowFocus: false,
  });

  const government = useQuery<Record<string, string>>({
    queryKey: ["profilePolitical", ownerId, politicalEpoch, "government"],
    enabled: enabled && vaultReady && politicalAllowed && panels.government,
    queryFn: async () => {
      const revision = profileSectionRevision(ownerId, "government");
      const result = (await getPayload("/api/governo/ideale")).data || {};
      await patchEncryptedProfile(ownerId, { government: result }, { government: revision });
      return result;
    },
    staleTime: PROFILE_CACHE_FRESH,
    gcTime: PROFILE_CACHE_GC,
  });
  const representatives = useQuery<Record<string, any>>({
    queryKey: ["profilePolitical", ownerId, politicalEpoch, "representatives"],
    enabled: enabled && vaultReady && politicalAllowed && panels.representatives,
    queryFn: async () => {
      const revision = profileSectionRevision(ownerId, "representatives");
      const result = (await getPayload("/api/rappresentanti")).data?.rappresentanti || {};
      await patchEncryptedProfile(ownerId, { representatives: result }, { representatives: revision });
      return result;
    },
    staleTime: PROFILE_CACHE_FRESH,
    gcTime: PROFILE_CACHE_GC,
  });
  const candidates = useQuery<Record<string, any>>({
    queryKey: ["profilePolitical", ownerId, politicalEpoch, "candidates"],
    enabled: enabled && vaultReady && politicalAllowed && panels.candidates,
    queryFn: async () => {
      const revision = profileSectionRevision(ownerId, "candidates");
      const result = (await getPayload("/api/candidati/selezioni")).data?.candidati || {};
      await patchEncryptedProfile(ownerId, { candidates: result }, { candidates: revision });
      return result;
    },
    staleTime: PROFILE_CACHE_FRESH,
    gcTime: PROFILE_CACHE_GC,
  });
  const opinions = useQuery<{ questions: OpinionQuestion[]; userAnswers: Record<string, string>; answersLoaded: true }>({
    queryKey: ["profilePolitical", ownerId, politicalEpoch, "opinions"],
    enabled: enabled && vaultReady && politicalAllowed && panels.opinions,
    queryFn: async () => {
      const revision = profileSectionRevision(ownerId, "opinions");
      // The normal catalog endpoint intentionally excludes personal answers.
      // Explicit opt-in is mandatory here; an old backend response lacking
      // userAnswers must fail rather than silently showing all scores as zero.
      const payload = (await getPayload("/api/opinioni/profile?includeAnswers=1")).data || {};
      if (!payload.userAnswers || typeof payload.userAnswers !== "object" ||
          Array.isArray(payload.userAnswers)) {
        throw new Error("Risposte personali non disponibili");
      }
      const result = { questions: Array.isArray(payload.questions) ? payload.questions : [],
        userAnswers: payload.userAnswers as Record<string, string>, answersLoaded: true as const };
      await patchEncryptedProfile(ownerId, { opinions: result }, { opinions: revision });
      return result;
    },
    staleTime: PROFILE_CACHE_FRESH,
    gcTime: PROFILE_CACHE_GC,
  });

  useEffect(() => {
    if (ownProfile && isSessionVerified && verifiedPoliticalConsent?.granted === false) {
      client.removeQueries({ queryKey: ["profilePolitical", ownerId] });
      client.removeQueries({ queryKey: ["profileFull", ownerId] });
      void clearEncryptedProfile(ownerId);
    }
  }, [client, ownProfile, ownerId, isSessionVerified, verifiedPoliticalConsent?.granted]);

  const fetchAllProfileData = useCallback(async () => {
    if (!enabled) return;
    if (ownProfile) {
      clearProfileSummary(ownerId);
      client.removeQueries({ queryKey: ["profileFull", ownerId] });
      client.removeQueries({ queryKey: ["profilePolitical", ownerId] });
      client.invalidateQueries({ queryKey: ["user"] });
      await clearEncryptedProfile(ownerId);
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
    chosenVotes: politicalAllowed ? (preferences.data || null) : null,
    chosenVotesLoading: politicalAllowed && preferences.isPending,
    chosenVotesError: politicalAllowed && preferences.isError,
    userOpinions: storedOpinions,
    opinionsError: politicalAllowed && panels.opinions && opinions.isError,
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
