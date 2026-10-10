import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { apiRequest } from "@/lib/queryClient";
import { UserInfo } from "@/types/profile";
import { OpinionQuestion } from "../types";
import { extractBaseOpinions } from "../utils/opinionUtils";

const normalizeOpinionValue = (value: unknown): string | null => {
  if (value === "f" || value === "Favorevole" || value === "Sì") return "Favorevole";
  if (value === "c" || value === "Contrario" || value === "No") return "Contrario";
  if (value === "i" || value === "Indeciso" || value === "Non lo so") return "Non lo so";
  return null;
};

const parseAvatar = (value: unknown) => {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try {
    let parsed: any = JSON.parse(value);
    if (typeof parsed === "string") parsed = JSON.parse(parsed);
    return parsed;
  } catch {
    return null;
  }
};

export const useProfileData = (userId?: string) => {
  const authReady = useAuthReady();
  const { user, isLoading } = useAuth();

  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userOpinions, setUserOpinions] = useState<Record<string, string>>({});
  const [avatarConfig, setAvatarConfig] = useState<any>(null);
  const [governoIdeale, setGovernoIdeale] = useState<Record<string, string>>({});
  const [opinionQuestions, setOpinionQuestions] = useState<OpinionQuestion[]>([]);
  const [rappresentantiDetails, setRappresentantiDetails] = useState<Record<string, any>>({});
  const [candidatiDetails, setCandidatiDetails] = useState<Record<string, any>>({});

  const fetchAllProfileData = async () => {
    if (!user) return;

    setIsLoadingInfo(true);
    setError(null);
    setUserOpinions({});
    setOpinionQuestions([]);
    setGovernoIdeale({});
    setRappresentantiDetails({});
    setCandidatiDetails({});

    try {
      const targetUserId = userId || user.id;
      const isOwnProfile = String(targetUserId) === String(user.id);

      let userData: any;
      if (isOwnProfile) {
        const response = await apiRequest("GET", "/api/users/me");
        if (!response.ok || !response.data?.success) {
          throw new Error(response.data?.error || response.data?.message || "Errore nel caricamento del profilo");
        }
        userData = response.data.user;
      } else {
        const response = await apiRequest("GET", `/api/users/${targetUserId}/public-profile`);
        if (!response.ok || !response.data?.success) {
          throw new Error(response.data?.error || response.data?.message || "Profilo pubblico non disponibile");
        }
        userData = response.data.user;
        setRappresentantiDetails(response.data.public?.rappresentanti || {});
        setCandidatiDetails(response.data.public?.candidati || {});
        setGovernoIdeale(response.data.public?.governoIdeale || {});
      }

      setUserInfo(userData as UserInfo);
      setAvatarConfig(parseAvatar(userData.avatar_config));
      setUserOpinions(extractBaseOpinions(userData));

      try {
        const opinionsResponse = isOwnProfile
          ? await apiRequest("GET", "/api/opinioni/profile")
          : await apiRequest("GET", `/api/users/${targetUserId}/opinioni`);

        if (opinionsResponse?.ok && opinionsResponse?.data?.success && opinionsResponse.data.data) {
          const payload = opinionsResponse.data.data;

          if (Array.isArray(payload.opinioni)) {
            const questions: OpinionQuestion[] = payload.opinioni.map((item: any) => ({
              id: String(item.id),
              text: String(item.text || item.id),
            }));
            const answers: Record<string, string> = {};
            for (const item of payload.opinioni) {
              const normalized = normalizeOpinionValue(item.userAnswer);
              if (normalized) answers[String(item.id)] = normalized;
            }
            setOpinionQuestions(questions);
            setUserOpinions((previous) => ({ ...previous, ...answers }));
          } else {
            setOpinionQuestions(Array.isArray(payload.questions) ? payload.questions : []);
            if (payload.userAnswers) {
              const answers: Record<string, string> = {};
              for (const [key, value] of Object.entries(payload.userAnswers)) {
                const normalized = normalizeOpinionValue(value);
                if (normalized) answers[key] = normalized;
              }
              setUserOpinions((previous) => ({ ...previous, ...answers }));
            }
          }
        }
      } catch (opinionsError) {
        console.warn("Impossibile caricare le opinioni del profilo:", opinionsError);
      }

      if (isOwnProfile) {
        const [governoResponse, rappresentantiResponse, candidatiResponse] = await Promise.allSettled([
          apiRequest("GET", "/api/governo/ideale"),
          apiRequest("GET", "/api/rappresentanti"),
          apiRequest("GET", "/api/candidati/selezioni"),
        ]);

        if (
          governoResponse.status === "fulfilled" &&
          governoResponse.value?.ok &&
          governoResponse.value?.data?.success
        ) {
          setGovernoIdeale(governoResponse.value.data.data || {});
        }
        if (
          rappresentantiResponse.status === "fulfilled" &&
          rappresentantiResponse.value?.ok &&
          rappresentantiResponse.value?.data?.success
        ) {
          setRappresentantiDetails(rappresentantiResponse.value.data.data?.rappresentanti || {});
        }
        if (
          candidatiResponse.status === "fulfilled" &&
          candidatiResponse.value?.ok &&
          candidatiResponse.value?.data?.success
        ) {
          setCandidatiDetails(candidatiResponse.value.data.data?.candidati || {});
        }
      }
    } catch (profileError) {
      console.error("Errore nel caricamento del profilo:", profileError);
      setUserInfo(null);
      setAvatarConfig(null);
      setError(profileError instanceof Error ? profileError.message : "Errore sconosciuto");
    } finally {
      setIsLoadingInfo(false);
    }
  };

  useEffect(() => {
    if (authReady && user && !isLoading) {
      fetchAllProfileData();
    }
  }, [authReady, user, isLoading, userId]);

  return {
    userInfo,
    isLoadingInfo,
    error,
    userOpinions,
    avatarConfig,
    governoIdeale,
    opinionQuestions,
    rappresentantiDetails,
    candidatiDetails,
    setUserInfo,
    setIsLoadingInfo,
    setError,
    setUserOpinions,
    setAvatarConfig,
    setGovernoIdeale,
    setOpinionQuestions,
    setRappresentantiDetails,
    setCandidatiDetails,
    fetchAllProfileData,
    isLoading,
    authReady,
  };
};
