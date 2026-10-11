# DEMOS - Audit accessibilit? tecnico - 11/10/2026

## Perimetro
Audit statico del frontend React/Vite sulle superfici web/mobile del repository corrente. I file `*-backup`, debug e test non usati nel flusso normale sono esclusi dalla priorit?. Sono stati verificati semantica HTML/JSX, tastiera/focus, viewport/zoom, nomi accessibili, immagini, target interattivi e supporto a `prefers-reduced-motion`.

Questo audit non ? una certificazione WCAG completa: contrasto reale, ridimensionamento a 200%, screen reader, VoiceOver/TalkBack e test su dispositivi reali richiedono prove manuali dedicate.

## Correzioni P0/P1 applicate
1. **Zoom browser bloccato (WCAG 1.4.4):** rimossi `maximum-scale=1.0` e `user-scalable=no`.
2. **Titolo documento assente (WCAG 2.4.2):** aggiunto `<title>DEMOS</title>`.
3. **Azioni testuali non semantiche (WCAG 2.1.1 / 4.1.2):** quattro `<p onClick>` di Candidati/Rappresentanti convertiti in veri pulsanti con focus visibile.
4. **Logo Admin cliccabile come immagine:** convertito in pulsante con nome accessibile.
5. **Pulsanti solo-icona:** aggiunti nomi accessibili ai toggle password, chiusura dettagli Attivista/Organizzazione, Approfondimento, rimozione tipologie e azioni ministeri.
6. **Dialoghi personalizzati:** aggiunti `role="dialog"`, `aria-modal` e `aria-labelledby` ai dettagli Attivista/Organizzazione; il comportamento completo del focus resta da testare manualmente.
7. **Focus legacy:** aggiunto focus ring ai selettori consenso e agli autocomplete dove l'outline era soppresso senza alternativa evidente.
8. **Target piccoli:** Approfondimento portato a 44x44 CSS px; rimozione tipologia portata a 24x24.
9. **Dichiarazione Accessibilit?:** rimossi claim non ancora dimostrati su screen reader, contrasto e piena navigazione da tastiera.

## Aspetti positivi verificati
- `html lang="it"` presente.
- Le immagini principali esaminate hanno `alt` significativo o `alt=""` quando decorative dentro un controllo gi? nominato.
- Il componente Button condiviso espone un ring `focus-visible`.
- I layout principali includono regole `prefers-reduced-motion`.
- Le superfici principali usano componenti Radix/nativi per molti dialoghi, select e controlli.

## Residui P1 - prima della release candidate
- Test manuale completo da tastiera su registrazione/login, Preferiti, Opinioni, Candidati/Rappresentanti, Eventi, Impostazioni e cancellazione account.
- Test dei dialoghi personalizzati: focus iniziale, focus trap, Escape e ritorno del focus al trigger.
- VoiceOver su iPhone reale e TalkBack su Android reale.
- Misurazione del contrasto di testo, stati, focus e grafici con strumenti dedicati.
- Verifica sistematica di label, descrizioni errori e ordine del focus nei form legacy/raw.
- Inventario finale dei pulsanti solo-icona nelle superfici Admin/legacy attive.

## Residui P2
- Skip-link globale quando tutti i layout avranno un target `main-content` stabile.
- Uniformare i target touch verso 44x44 CSS px quando compatibile con il layout.
- Migliorare gli annunci `aria-live` per salvataggi, errori e caricamenti dinamici.
- Valutare titoli pagina dinamici per singola rotta oltre al titolo base `DEMOS`.

## Gate
Le correzioni devono superare smoke test sorgente, TypeScript/build frontend, full gate locale e `git diff --check`. Nessuna modifica di produzione ? inclusa.
