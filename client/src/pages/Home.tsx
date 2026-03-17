import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";

export default function Home() {
  const { user } = useAuth();

  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="min-h-screen page-with-navbar">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="overflow-hidden">
          <CardContent className="px-4 py-5 sm:p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">Benvenuto in DEMOS</h2>
            <p className="text-gray-600 mb-4">
              Sei già registrato e autenticato. Per gestire il tuo account, vai su:
            </p>
            <div className="space-y-2">
              <p className="text-gray-600">
                • <strong>Menu</strong> → <strong>Profilo</strong> per modificare i tuoi dati
              </p>
              <p className="text-gray-600">
                • <strong>Menu</strong> per accedere alle funzionalità dell'app
              </p>
            </div>
          </CardContent>
        </Card>
      </main>

      <footer className="bg-gray-100 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6 md:flex md:items-center md:justify-between">
            <div className="text-center md:text-left">
              <p className="text-base text-gray-500">&copy; 2023 DEMOS. Tutti i diritti riservati.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
