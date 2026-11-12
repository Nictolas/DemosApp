# Dati geografici offline per la località degli eventi

Il frontend DEMOS usa quattro dataset locali `client/src/data/municipalityCentroids-{1,2,3,4}.json` per stimare **sul dispositivo** il Comune più vicino alle coordinate ricevute dal sistema operativo dopo un consenso esplicito. Non viene eseguita alcuna richiesta di geocodifica inversa né vengono salvate o inviate a DEMOS le coordinate.

## Provenienza e licenza dei dati

- Fonte dei dati: **RP92/comuni-italiani** — https://github.com/RP92/comuni-italiani
- Anagrafica e ripartizione amministrativa: **ISTAT** — https://www.istat.it/
- Coordinate geografiche: **Garda Informatica**, «Database dei comuni italiani» — https://www.gardainformatica.it/database-comuni-italiani
- Licenza dei dati derivati: **Creative Commons Attribution 4.0 International (CC BY 4.0)** — https://creativecommons.org/licenses/by/4.0/
- Licenza e attribuzioni del dataset originario: https://github.com/RP92/comuni-italiani/blob/main/LICENSE-DATA

**Adattamenti DEMOS:** sono stati conservati soltanto nome del Comune, provincia, regione e coordinate del centroide geografico; le coordinate sono state arrotondate a cinque cifre decimali e i dati divisi in quattro file JSON per caricamento condizionale. La selezione è **stimata usando il centroide più vicino**, non verificata sui confini amministrativi; l'utente può correggerla manualmente.

L'elenco dei Comuni e le preferenze (modalità, Comune scelto, stato della prima proposta) rimangono nel browser/app e non costituiscono una verifica del domicilio o della residenza. La preferenza si conserva in `localStorage` separatamente per account su quel dispositivo. Il feed di elezioni usa sempre la residenza elettorale, non la posizione GPS.

## Limiti

L'uso della posizione tramite API del sistema operativo può richiedere interazioni con i servizi di localizzazione del dispositivo, indipendenti dal backend DEMOS. Il consenso è richiesto solo dopo un gesto esplicito dell'utente nella pagina Eventi. Le informazioni del dataset non sostituiscono le registrazioni ufficiali dei confini amministrativi.
