import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ChildSafetyStandards() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl pt-20 pb-28">
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center mb-4">
            Standard di sicurezza dei minori
          </CardTitle>
          <p className="text-center text-gray-600">
            <strong>Demos</strong> — Ultimo aggiornamento: 13 ottobre 2026
          </p>
        </CardHeader>

        <CardContent className="space-y-6 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-2xl font-semibold mb-3">1. Ambito e accesso alla piattaforma</h2>
            <p>
              Demos è una piattaforma di partecipazione civica riservata a persone maggiorenni.
              Per registrarsi è necessario avere almeno 18 anni. Demos non è progettata né
              destinata ai minori.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">2. Tolleranza zero per abuso e sfruttamento sessuale di minori</h2>
            <p className="mb-3">
              Demos vieta espressamente qualsiasi forma di abuso o sfruttamento sessuale di minori
              (Child Sexual Abuse and Exploitation, CSAE) e qualsiasi materiale di abuso sessuale
              su minori (Child Sexual Abuse Material, CSAM).
            </p>
            <p className="mb-3">È vietato creare, caricare, condividere, promuovere, richiedere o facilitare:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>contenuti sessuali che coinvolgano o rappresentino minori;</li>
              <li>adescamento, coercizione, ricatto o sfruttamento sessuale di minori;</li>
              <li>materiale che favorisca, normalizzi o incoraggi l'abuso sessuale di minori;</li>
              <li>collegamenti, istruzioni o contatti finalizzati all'accesso o alla diffusione di CSAM;</li>
              <li>qualsiasi comportamento che metta un minore a rischio di abuso o sfruttamento sessuale.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">3. Segnalazioni degli utenti</h2>
            <p>
              Gli utenti registrati possono inviare segnalazioni direttamente nell'app tramite la
              funzione <a href="/segnala-problema" className="text-blue-600 hover:text-blue-800 underline font-medium">Segnala problema</a>.
              Le segnalazioni relative alla sicurezza dei minori ricevono priorità e vengono valutate
              per adottare tempestivamente le misure necessarie.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">4. Azioni in caso di contenuti o condotte vietate</h2>
            <p className="mb-3">
              Quando Demos viene a conoscenza di contenuti o condotte che violano questi standard,
              adotta misure appropriate in base alla gravità e alle circostanze del caso, che possono includere:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>rimozione o disabilitazione dell'accesso ai contenuti;</li>
              <li>sospensione o chiusura degli account coinvolti;</li>
              <li>conservazione delle informazioni necessarie nel rispetto della legge;</li>
              <li>collaborazione con le autorità competenti;</li>
              <li>segnalazione di CSAM confermato al NCMEC o all'autorità regionale competente, quando richiesto dalla normativa applicabile.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">5. Conformità alle leggi sulla sicurezza dei minori</h2>
            <p>
              Demos si impegna a rispettare le leggi e i regolamenti applicabili in materia di
              sicurezza dei minori e a collaborare con le autorità competenti quando necessario.
              Questi standard si applicano anche se Demos è riservata a utenti maggiorenni.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">6. Punto di contatto</h2>
            <p>
              Per segnalazioni o comunicazioni relative alla sicurezza dei minori e alla conformità
              rispetto a CSAE/CSAM, il punto di contatto di Demos è:
            </p>
            <p className="mt-3">
              <a href="mailto:legal@demos.community" className="text-blue-600 hover:text-blue-800 underline font-medium">
                legal@demos.community
              </a>
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
