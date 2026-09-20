import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ShieldCheck, Shield } from "lucide-react";

type IdentityStatusResponse = {
  success: boolean;
  identity: {
    verified: boolean;
    provider?: string;
  };
};

export const IdentityVerificationSection: React.FC = () => {
  const { data, isLoading, isError } = useQuery<IdentityStatusResponse>({
    queryKey: ["/auth/identity/status"],
  });

  const verifiedWithCie =
    data?.success === true &&
    data.identity?.verified === true &&
    data.identity?.provider === "CIE";

  return (
    <Card className="border border-slate-200 bg-white/80 shadow-sm">
      <CardContent className="flex items-center gap-3 p-4">
        {isLoading ? (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-slate-500" />
        ) : verifiedWithCie ? (
          <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
        ) : (
          <Shield className="h-5 w-5 shrink-0 text-slate-500" />
        )}

        <div className="min-w-0">
          <div className="font-semibold text-gray-900">Identità</div>
          <div className="text-sm text-gray-600">
            {isLoading
              ? "Controllo dello stato..."
              : isError
                ? "Stato non disponibile"
                : verifiedWithCie
                  ? "Verificata con CIE"
                  : "Non verificata"}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
