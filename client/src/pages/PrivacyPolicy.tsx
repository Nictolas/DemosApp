import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4">
      <div className="max-w-xl w-full text-center">
        <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
        <div className="text-lg text-gray-700 space-y-6 mb-8">
          <p>
            La tua privacy è importante per noi. In questa pagina troverai tutte le informazioni su come vengono trattati i tuoi dati personali all'interno della piattaforma DEMOS.
          </p>
          <p>
            <strong>Raccolta dati:</strong> DEMOS raccoglie solo i dati strettamente necessari per il funzionamento della piattaforma e per garantire la sicurezza degli utenti.
          </p>
          <p>
            <strong>Utilizzo dei dati:</strong> I dati raccolti vengono utilizzati esclusivamente per fornire i servizi della piattaforma e non vengono ceduti a terzi per fini commerciali.
          </p>
          <p>
            <strong>Diritti dell'utente:</strong> Puoi richiedere in qualsiasi momento la modifica o la cancellazione dei tuoi dati scrivendo all'indirizzo email ufficiale di DEMOS.
          </p>
          <p>
            Per maggiori dettagli consulta la versione completa della Privacy Policy o contattaci per qualsiasi domanda.
          </p>
        </div>
        <Link href="/impostazioni">
          <Button variant="outline">Torna alle Impostazioni</Button>
        </Link>
      </div>
    </div>
  );
} 