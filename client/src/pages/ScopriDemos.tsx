import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import appIcon from "/icona.png";

const benefits = [
  {
    title: "Come cittadino",
    items: [
      "Trova politici e candidati compatibili con le tue idee",
      "Consulta le opinioni sui temi che ti interessano",
      "Resta aggiornato su votazioni ed eventi dei tuoi rappresentanti",
    ],
  },
  {
    title: "Come politico o candidato",
    items: [
      "Amplia il tuo bacino di elettori e sostenitori",
      "Analizza le preferenze per zona, genere e fasce d'età",
      "Comunica eventi, votazioni e iniziative in tempo reale",
    ],
  },
  {
    title: "Partecipazione democratica",
    items: [
      "Vota, proponi e discuti",
      "Partecipa come elettore, candidato o sostenitore",
      "Segui le attività democratiche in un'unica piattaforma",
    ],
  },
];

export default function ScopriDemos() {
  return (
    <div className="w-full min-h-full overflow-y-auto bg-gradient-to-b from-blue-50 to-white px-4 py-6 text-slate-900 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          Torna all'accesso
        </Link>

        <header className="mb-10 text-center">
          <img src={appIcon} alt="" className="mx-auto mb-3 h-16 w-16" />
          <p className="mb-3 text-lg font-extrabold tracking-tight text-blue-700">DEMOS</p>
          <h1 className="mb-4 text-3xl font-bold leading-tight sm:text-4xl">Cos'è DEMOS?</h1>
          <p className="mx-auto max-w-2xl text-base leading-relaxed text-slate-700">
            DEMOS è un sistema operativo per la democrazia: una piattaforma che collega cittadini,
            elettori e rappresentanti politici in un unico spazio digitale partecipativo.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600">
            Scopri le opinioni dei politici, segui votazioni ed eventi, trova i candidati più
            compatibili con le tue idee e partecipa attivamente alla vita democratica italiana.
          </p>
        </header>

        <main>
          <h2 className="mb-5 text-center text-2xl font-bold">Cosa puoi fare con DEMOS</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {benefits.map(({ title, items }) => (
              <section key={title} className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-lg font-semibold">{title}</h3>
                <ul className="list-inside list-disc space-y-2 text-sm leading-relaxed text-slate-700">
                  {items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </section>
            ))}
          </div>
          <div className="my-8 text-center">
            <p className="mb-4 font-medium">Diventa protagonista della democrazia digitale.</p>
            <Link
              href="/"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-700 px-6 py-3 font-semibold text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Accedi o registrati
            </Link>
          </div>
        </main>

        <footer className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-slate-200 py-5 text-xs text-slate-600">
          <Link href="/privacy-policy" className="underline">Privacy</Link>
          <Link href="/terms-of-service" className="underline">Termini di servizio</Link>
          <Link href="/cookie-policy" className="underline">Cookie</Link>
        </footer>
      </div>
    </div>
  );
}
