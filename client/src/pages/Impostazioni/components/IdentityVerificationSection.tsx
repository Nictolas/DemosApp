import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, Shield } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

type IdentityStatusResponse = {
  success: boolean;
  identity: {
    verified: boolean;
    provider?: string;
  };
};

export const IdentityVerificationSection: React.FC = () => {
  const [isStartingCie, setIsStartingCie] = React.useState(false);
  const { data, isLoading, isError } = useQuery<IdentityStatusResponse>({
    queryKey: ["/auth/identity/status"],
  });

  const isVerified =
    data?.success === true &&
    data.identity?.verified === true;

  const provider = isVerified ? data.identity?.provider : undefined;
  const verificationLabel = isVerified
    ? provider
      ? `Verificata con ${provider}`
      : "Verificata"
    : "Non verificata";

  const handleStartCie = async () => {
    if (isStartingCie || isVerified) return;

    setIsStartingCie(true);

    try {
      const response = await apiRequest.get("/auth/identity/cie/start");
      const payload = await response.json();
      const authorizationUrl = payload?.authorizationUrl;

      if (typeof authorizationUrl !== "string") {
        throw new Error("Authorization URL CIE mancante");
      }

      const target = new URL(authorizationUrl);
      if (target.protocol !== "https:") {
        throw new Error("Authorization URL CIE non sicuro");
      }

      window.location.assign(target.toString());
    } catch (error: any) {
      const alreadyActive =
        error?.status === 409 &&
        error?.data?.code === "CIE_TRANSACTION_ALREADY_ACTIVE";
      const alreadyVerified =
        error?.status === 409 &&
        error?.data?.code === "ACCOUNT_ALREADY_VERIFIED";

      if (alreadyVerified) {
        toast({
          title: "Account già verificato",
          description: "Questo account DEMOS risulta già associato a un'identità verificata.",
          variant: "destructive"
        });
      } else if (alreadyActive) {
        toast({
          title: "Verifica CIE già in corso",
          description: "Hai già una verifica CIE in corso. Completa quella aperta oppure riprova tra qualche minuto.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Verifica CIE non disponibile",
          description: "Non è stato possibile avviare la verifica con CIE. Riprova più tardi.",
          variant: "destructive"
        });
      }

      setIsStartingCie(false);
    }
  };

  return (
    <Card className="border border-slate-200 bg-white/80 shadow-sm">
      <CardContent className="flex items-center gap-3 p-4">
        {isLoading ? (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-slate-500" />
        ) : isVerified ? (
          <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
        ) : (
          <Shield className="h-5 w-5 shrink-0 text-slate-500" />
        )}

        <div className="min-w-0 flex-1">
          <div className="font-semibold text-gray-900">Identità</div>
          <div className="text-sm text-gray-600">
            {isLoading
              ? "Controllo dello stato..."
              : isError
                ? "Stato non disponibile"
                : verificationLabel}
          </div>
        </div>

        {!isLoading && !isError && !isVerified && (
          <Button
            type="button"
            size="sm"
            onClick={handleStartCie}
            disabled={isStartingCie}
          >
            {isStartingCie && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Verifica con CIE
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
