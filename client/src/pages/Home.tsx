import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import UserRegistrationForm from "@/components/UserRegistrationForm";

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-3xl font-bold text-primary">DEMOS</h1>
            <span className="text-gray-500 text-sm">Sistema di Registrazione</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="overflow-hidden">
          <CardContent className="px-4 py-5 sm:p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">Registrazione Utente</h2>
            <UserRegistrationForm />
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
