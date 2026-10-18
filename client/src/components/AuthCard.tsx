import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound, Loader2 } from "lucide-react";
import appIcon from "/icona.png";
import { useAuthLogin } from "@/hooks/useAuthLogin";

interface AuthCardProps {
  embedded?: boolean;
  compact?: boolean;
}

export function AuthCard({ embedded = false, compact = false }: AuthCardProps) {
  const {
    oauthLoading,
    oauthConfigLoading,
    showGoogle,
    showApple,
    showPasskey,
    showAnyAuth,
    oauthBusy,
    handleGoogleLogin,
    handleAppleLogin,
    handlePasskeyLogin,
  } = useAuthLogin();

  return (
    <Card className={compact ? "auth-card-compact w-full max-w-sm border-0 bg-transparent shadow-none" : "w-full max-w-md shadow-xl bg-white"}>
      <CardHeader className={compact ? "sr-only" : "text-center space-y-4"}>
        {!embedded && (
          <div className="flex flex-col items-center">
            <img src={appIcon} alt="Logo Demos" className="w-20 h-20 mb-2" />
            <h1 className="text-3xl font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                DEMOS
              </span>
            </h1>
          </div>
        )}
        <div className="space-y-1">
          <CardTitle className="text-2xl font-bold text-gray-800">
            {embedded ? "Accedi o registrati" : "Benvenuto su Demos"}
          </CardTitle>
          {!embedded && (
            <CardDescription className="text-center text-gray-600">
              Demos è un sistema operativo per la Democrazia, una piattaforma che collega elettori e
              rappresentanti politici.
            </CardDescription>
          )}
          <p className="text-xs text-gray-500">
            Registrati o accedi per continuare e usare tutte le funzionalità.
          </p>
        </div>
      </CardHeader>

      <CardContent className={compact ? "space-y-2.5 p-0" : "space-y-4"}>
        {oauthConfigLoading && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Caricamento metodi di accesso…
          </div>
        )}

        {showGoogle && (
          <Button
            type="button"
            size="lg"
            className="w-full h-14 text-base font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/30 border border-blue-600"
            disabled={oauthBusy}
            onClick={handleGoogleLogin}
          >
            {oauthLoading === "google" ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            Continua con Google
          </Button>
        )}

        {showApple && (
          <Button
            type="button"
            size="lg"
            className="w-full h-14 text-base font-semibold bg-black hover:bg-gray-900 text-white"
            disabled={oauthBusy}
            onClick={handleAppleLogin}
          >
            {oauthLoading === "apple" ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
            )}
            Continua con Apple
          </Button>
        )}

        {showPasskey && (
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="w-full h-14 text-base font-semibold"
            disabled={oauthBusy}
            onClick={handlePasskeyLogin}
          >
            {oauthLoading === "passkey" ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <KeyRound className="mr-2 h-5 w-5" />
            )}
            Accedi con passkey
          </Button>
        )}

        {!oauthConfigLoading && !showAnyAuth && (
          <p className="text-sm text-center text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-4">
            Accesso temporaneamente non disponibile. Riprova più tardi.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
