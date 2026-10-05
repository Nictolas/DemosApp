import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Informazioni() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-linear-to-b from-blue-50 to-white p-4 page-with-navbar">
      <div className="max-w-xl w-full text-center">
        <h1 className="text-3xl font-bold mb-6">Informazioni su DEMOS</h1>
        <div className="text-lg text-gray-700 space-y-6 mb-8">
          <p>
            <strong>DEMOS</strong> è stato creato da <strong>Nicolas Micheletti</strong>, attivista per i diritti umani, animali e dell'ambiente, con l'obiettivo di offrire uno strumento innovativo e trasparente per la partecipazione democratica.
          </p>
          <p>
            La piattaforma si sostiene grazie alle <strong>pubblicità</strong> e alle <strong>donazioni</strong> degli utenti. Questi contributi sono fondamentali per coprire i costi dei server e permettere lo sviluppo continuo di nuove funzionalità, garantendo così una democrazia sempre più accessibile e trasparente per tutti.
          </p>
          <p>
            La filosofia di DEMOS, il sistema operativo della democrazia, è quella di mettere al centro le <strong>persone</strong> e non i partiti. Per questo motivo, in tutta l'applicazione i partiti non vengono mai nominati: l'obiettivo è favorire il dialogo diretto tra cittadini e rappresentanti, superando le logiche di appartenenza e promuovendo la partecipazione attiva e consapevole.
          </p>
        </div>
        <Link href="/impostazioni">
          <Button variant="outline">Torna alle Impostazioni</Button>
        </Link>
      </div>
    </div>
  );
} 
