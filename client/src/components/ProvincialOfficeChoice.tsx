import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import {
  PROVINCIAL_UI_RELEASED,
  provincialOfficeFromResidence,
  type ProvincialOffice,
} from "@/lib/provincialSelection";

export function ProvincialOfficeChoice({ kind }: { kind: "candidate" | "representative" }) {
  const { user, isSessionVerified, verifiedPoliticalConsent } = useAuth();
  const [, navigate] = useLocation();
  const canRead = PROVINCIAL_UI_RELEASED && !!user?.id &&
    isSessionVerified && verifiedPoliticalConsent?.granted === true;
  const { data: office } = useQuery<ProvincialOffice | null>({
    queryKey: ["provincialOfficeForAccount", user?.id],
    enabled: canRead,
    retry: false,
    staleTime: 60_000,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/users/me");
      if (!response?.ok || !response?.data?.success) return null;
      return provincialOfficeFromResidence(response.data.user);
    },
  });

  if (!canRead || !office) return null;

  return (
    <button
      type="button"
      className="provincial-office-choice relative flex w-full h-full min-h-0 flex-col items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-2 py-2 text-center shadow-md"
      aria-label={`Scegli ${kind === "candidate" ? "candidato" : "rappresentante"} per il ${office.label}`}
      onClick={() => navigate(`${kind === "candidate" ? "/candidati" : "/scegli-rappresentante"}/${office.category}`)}
    >
      <span className="text-base font-semibold leading-tight text-amber-900">{office.label}</span>
      <span className="mt-1 text-xs text-amber-800">Scelta provinciale</span>
    </button>
  );
}
