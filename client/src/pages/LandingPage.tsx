import { Link, Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useMobile } from "@/hooks/use-mobile";
import { AuthCard } from "@/components/AuthCard";
import { ArrowRight, Loader2 } from "lucide-react";
import "./landing-mobile.css";
import appIcon from "/icona.png";

export default function LandingPage() {
  const { user, isLoading } = useAuth();
  const isMobileLayout = useMobile();

  if (user && !isLoading) {
    return <Redirect to="/profilo" />;
  }

  if (isLoading) {
    return (
      <div className="min-h-full flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }


  if (isMobileLayout) {
    return (
      <div className="landing-mobile">
        <header className="landing-mobile__brand" aria-label="DEMOS">
          <div className="landing-mobile__logo-frame" aria-hidden="true">
            <img src={appIcon} alt="" className="landing-mobile__logo" />
          </div>
          <span className="landing-mobile__wordmark">DEMOS</span>
        </header>

        <main className="landing-mobile__center">
          <div className="landing-mobile__intro">
            <h1 className="landing-mobile__title">La democrazia nelle tue mani.</h1>
            <p className="landing-mobile__subtitle">
              Esprimi le tue opinioni, scopri i politici più vicini alle tue idee e partecipa alla vita democratica.
            </p>
          </div>

          <section className="landing-mobile__auth" aria-label="Accedi o registrati">
            <AuthCard embedded compact />
            <p className="landing-mobile__auth-note">Accedi o registrati per iniziare</p>
          </section>
        </main>

        <footer className="landing-mobile__footer">
          <Link href="/scopri-demos" className="landing-mobile__learn-more">
            Cos&apos;è DEMOS? <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <nav className="landing-mobile__legal" aria-label="Informazioni legali">
            <Link href="/privacy-policy">Privacy</Link>
            <Link href="/terms-of-service">Termini</Link>
            <Link href="/cookie-policy">Cookie</Link>
          </nav>
        </footer>
      </div>
    );
  }

  return (
    <div className="landing-page min-h-full bg-gradient-to-b from-blue-50 to-white">
      <main>
        <section className="py-10 md:py-16">
          <div className="container mx-auto px-4">
            <div className={`mx-auto ${!isMobileLayout ? "max-w-6xl" : "max-w-3xl"}`}>
              <div className={`${!isMobileLayout ? "md:grid md:grid-cols-2 md:gap-12 md:items-start" : ""}`}>
                <div className={`text-center ${!isMobileLayout ? "md:text-left" : ""} mb-10 md:mb-0`}>
                  <img src={appIcon} alt="Logo Demos" className={`w-24 h-24 mb-6 ${!isMobileLayout ? "mx-auto md:mx-0" : "mx-auto"}`} />
                  <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                    <span
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"
                      style={{ WebkitTextStroke: "1px #2563eb" }}
                    >
                      DEMOS
                    </span>
                  </h1>
                  <p className="text-lg md:text-xl text-gray-700 mb-4 leading-relaxed">
                    Demos è un sistema operativo per la democrazia: una piattaforma che collega cittadini,
                    elettori e rappresentanti politici in un unico spazio digitale partecipativo.
                  </p>
                  <p className="text-base text-gray-600 mb-6 leading-relaxed">
                    Scopri le opinioni dei politici, segui votazioni ed eventi, trova i candidati più
                    compatibili con le tue idee e partecipa attivamente alla vita democratica italiana.
                  </p>
                </div>

                <div className={`flex justify-center ${!isMobileLayout ? "md:justify-end" : ""}`}>
                  <AuthCard embedded />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-14 bg-white border-t border-blue-100">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-10 text-gray-900">
              Cosa puoi fare con Demos
            </h2>
            <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
              <div className="bg-blue-50 rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-3 text-gray-900">Come cittadino</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-2 text-sm leading-relaxed">
                  <li>Trova politici e candidati compatibili con le tue idee</li>
                  <li>Consulta le opinioni sui temi che ti interessano</li>
                  <li>Resta aggiornato su votazioni ed eventi dei tuoi rappresentanti</li>
                </ul>
              </div>

              <div className="bg-blue-50 rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-3 text-gray-900">Come politico o candidato</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-2 text-sm leading-relaxed">
                  <li>Amplia il tuo bacino di elettori e sostenitori</li>
                  <li>Analizza le preferenze per zona, genere e fasce d&apos;età</li>
                  <li>Comunica eventi, votazioni e iniziative in tempo reale</li>
                </ul>
              </div>

              <div className="bg-blue-50 rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-3 text-gray-900">Partecipazione democratica</h3>
                <p className="text-gray-700 text-sm leading-relaxed">
                  Vota, proponi, discuti e partecipa alle attività democratiche come elettore, candidato
                  o sostenitore — tutto da un&apos;unica piattaforma.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-12 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              Diventa protagonista della democrazia digitale
            </h2>
            <p className="text-lg max-w-2xl mx-auto opacity-95">
              Accedi con Google, Apple o passkey e inizia subito.
            </p>
          </div>
        </section>
      </main>

      <footer className="bg-gray-100 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:flex md:items-center md:justify-between">
          <p className="text-center md:text-left text-sm text-gray-500">
            &copy; {new Date().getFullYear()} DEMOS. Tutti i diritti riservati.
          </p>
          <div className="mt-4 md:mt-0 text-center md:text-right space-x-4">
            <Link href="/privacy-policy" className="text-sm text-gray-500 hover:text-gray-700 underline">
              Privacy Policy
            </Link>
            <Link href="/terms-of-service" className="text-sm text-gray-500 hover:text-gray-700 underline">
              Termini di Servizio
            </Link>
            <Link href="/cookie-policy" className="text-sm text-gray-500 hover:text-gray-700 underline">
              Cookie Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
