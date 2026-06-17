import { Link, Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Loader2, Download, Smartphone } from "lucide-react";
import appIcon from '/icona.png';
// import { adminAuth } from './firebase-config'; // Rimosso Firebase

export default function LandingPage() {
  const { user, isLoading } = useAuth();
  const { isInstallable, isInstalled, isMobile, installApp, showInstallInstructions } = usePWAInstall();
  
  
  // Redirect: tutti gli utenti autenticati vanno ai preferiti
  if (user && !isLoading) {
    return <Redirect to="/preferiti" />;
  }

  // Show loading indicator while checking auth state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-white">
      
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <img 
                src={appIcon} 
                alt="Logo Demos" 
                className="w-28 h-28 mx-auto mb-6" 
              />
              <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent" style={{ WebkitTextStroke: '1px #2563eb' }}>DEMOS</span>
              </h1>
              <p className="text-xl text-gray-700 mb-8">
                Demos è un sistema operativo per la Democrazia, una piattaforma innovativa che permette di collegare elettori e rappresentanti politici.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                {user ? (
                  <Link href="/preferiti">
                    <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                      Vai ai Preferiti
                    </Button>
                  </Link>
                ) : (
                  <Link href="/auth">
                    <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white">
                      Inizia ora
                    </Button>
                  </Link>
                )}
                
                {/* Pulsante Aggiungi a Schermata Home - Solo su Mobile */}
                {!isInstalled && isMobile && (
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto border-blue-600 text-blue-600 hover:bg-blue-50"
                    onClick={isInstallable ? installApp : showInstallInstructions}
                  >
                    {isInstallable ? (
                      <>
                        <Download className="w-5 h-5 mr-2" />
                        Aggiungi a Schermata Home
                      </>
                    ) : (
                      <>
                        <Smartphone className="w-5 h-5 mr-2" />
                        Aggiungi a Schermata Home
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">Cosa puoi fare con DEMOS</h2>
            <div className="max-w-3xl mx-auto text-lg text-gray-700 mb-8">
              <p className="mb-2"></p>
              <ul className="list-disc list-inside">
              </ul>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-blue-50 rounded-lg p-6 shadow-md">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">Registrazione Utente</h3>
                <p className="text-gray-600">
                  Crea il tuo profilo civico per accedere a tutte le funzionalità della piattaforma.
                </p>
                <div className="mt-4 text-gray-700 text-base">
                  <ul className="list-disc list-inside mb-2">
                    <li>Trova i politici e i candidati più compatibili con le tue idee,</li>
                    <li>Scopri le opinioni dei politici su tutti gli argomenti più importanti,</li>
                    <li>Essere costantemente aggiornato sulle votazioni ed eventi dei tuoi rappresentanti;</li>
                  </ul>
                </div>
              </div>
              
              <div className="bg-blue-50 rounded-lg p-6 shadow-md">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">Se sei un politico o un candidato puoi:</h3>
                <ul className="list-disc list-inside text-gray-700 mb-2">
                  <li>allargare il tuo bacino di elettori;</li>
                  <li>scopri le preferenze delle persone sugli argomenti importanti;</li>
                  <li>monitora le opinioni per zone, genere, fasce d'età, etc.</li>
                  <li>tenere sempre aggiornati i tuoi sostenitori sui tuoi eventi, votazioni, etc.</li>
                </ul>
              </div>
              
              <div className="bg-blue-50 rounded-lg p-6 shadow-md">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">Elezione e Candidatura</h3>
                <p className="text-gray-600">
                  Partecipa come elettore, candidato o sostenitore alle elezioni e alle attività democratiche.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="py-16 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">Unisciti a DEMOS e diventa protagonista della democrazia digitale italiana</h2>
            <p className="text-xl mb-8 max-w-2xl mx-auto">
              Vota, proponi, discuti, partecipa: la democrazia italiana ti aspetta!
            </p>
            {!user && (
              <Link href="/auth">
                <Button size="lg" variant="secondary" className="font-semibold">
                  Registrati ora
                </Button>
              </Link>
            )}
          </div>
        </section>
      </main>

      <footer className="bg-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6 md:flex md:items-center md:justify-between">
            <div className="text-center md:text-left">
              <p className="text-base text-gray-500">&copy; 2023 DEMOS. Tutti i diritti riservati.</p>
            </div>
            <div className="mt-4 md:mt-0 text-center md:text-right space-x-4">
              <Link 
                href="/privacy-policy" 
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Privacy Policy
              </Link>
              <Link 
                href="/terms-of-service" 
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Termini di Servizio
              </Link>
              <Link 
                href="/cookie-policy" 
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Cookie Policy
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
