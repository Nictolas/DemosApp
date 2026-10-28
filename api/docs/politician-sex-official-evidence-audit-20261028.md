# DEMOS — recupero controllato del sesso anagrafico dei politici

**Stato:** progettazione tecnica e strumento di audit in sola lettura. **NON** è una migrazione dati e **NON** aggiorna `users.sesso`.

## Perché non usare il nome

Non attribuire `M/F` in base al suffisso -o/-a, a fotografie, titoli professionali o ipotesi. La presenza di un nome simile non dimostra l'identità né rende un valore **CIE-certificato**.

## Fonti istituzionali individuate (28 ottobre 2026)

- **Senato della Repubblica**: la FAQ ufficiale conferma che i dati anagrafici dei senatori includono **sesso, nome, cognome, data e luogo di nascita**. https://dati.senato.it/sito/faq?testo_generico=16
- **Senato — Linked Open Data**: https://dati.senato.it/sito/home e https://dati.senato.it/sito/23
- **Camera dei deputati**: offre il catalogo istituzionale e un endpoint SPARQL di dati parlamentari/anagrafici. **Verificare che l'attributo sesso sia effettivamente pubblicato nella specifica fonte prima di abilitarla nell'auditor.** https://dati.camera.it/ e https://dati.camera.it/sparql
- **Parlamento europeo**: Open Data API dei deputati, copertura anagrafica da verificare prima di usare qualsiasi attributo sesso. https://data.europarl.europa.eu/en/developer-corner/opendata-api

## Stato attuale Supabase (solo lettura, 28 ottobre 2026)

- `users.sesso` è **NULL per tutti i 1.857 utenti**.
- I politici legacy (`ruolo='P'`): **1.675**, tutti senza `sesso`.
- 812 nomi terminano in -o, 609 in -a. **Questi numeri non sono dati sul sesso e non vanno usati per il popolamento.**
- La tabella `users` non dispone attualmente di un ID istituzionale canonico di Senato/Camera: servirà un collegamento identificativo affidabile.

## Funzionamento dell'auditor

File: `api/utils/officialSexEvidenceAudit.js`; test: `api/tests/officialSexEvidenceAudit.test.js`.

Input: **array di sola lettura**, già ottenuti da un export autorizzato `users` e da record verificati provenienti dal Senato. Ogni record istituzionale deve riportare `nome`, `cognome`, `data_nascita` ISO completa, `sesso` letterale `M/F`, `external_id` della fonte e `source_url` ufficiale HTTPS.

L'auditor genera **solo proposte di verifica manuale**, senza accedere a Supabase né eseguire SQL, senza inferenze e senza convertire `genere`.

Un abbinamento viene considerato solo quando:
- `account_type='PERSON'`, `ruolo='P'`, `users.sesso IS NULL`, con nome, cognome e data di nascita **completa e valida**;
- nome+cognome+data coincidono **esattamente**, senza conversioni fonetiche o euristiche;
- sia il candidato DEMOS sia la fonte istituzionale sono **univoci** su quella terna;
- l'identificativo della fonte non è riutilizzato per altre persone;
- la fonte è HTTPS di `dati.senato.it`, con un valore ufficiale M/F riconoscibile.

Ogni possibile corrispondenza è `REQUIRES_MANUAL_VERIFICATION` e `cie_verified=false`. Non produce mai un aggiornamento in `users.sesso`: questo campo, nella PR #380, è riservato al claim CIE firmato e verificato.

## Passaggi successivi non automatici

1. Verificare l'esatto formato e il significato del campo sesso nel dump/SPARQL ufficiale Senato, la licenza e la freschezza; ripetere per Camera/Parlamento UE prima di ammetterne i domini.
2. Verificare il collegamento stabile dei profili legacy con gli ID dei parlamentari, non solo i nomi, e controllare manualmente omonimie e incongruenze.
3. Definire con il DPO finalità/base giuridica, provenienza, retention, accesso e uso statistico. **Non miscelare provenienza istituzionale e certificazione CIE.**
4. Se si decide di usare i dati ufficiali, definire una registrazione della provenienza **senza un secondo campo `sesso` ridondante** e con migrazione autorizzata, separata e reversibile.
5. Solo dopo revisione, prova con dati realistici, approvazione e collaudo, progettare un import controllato. Mai aggiornare `users.sesso` con una congettura.

### Test automatici

I test simulano nomi che terminano in -a/-o, omonimi, duplicati, date inesistenti, valori non validi, URL falsificati, account organizzazione, sesso già certificato e immutabilità dei dati originali.
