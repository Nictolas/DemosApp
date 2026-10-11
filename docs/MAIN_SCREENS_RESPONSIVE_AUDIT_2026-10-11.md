# DEMOS — Audit responsive schermate principali

**Data:** 2026-10-11
**Task:** F12-07
**Prerequisito:** F12-06 chiuso
**Produzione/staging:** nessuna chiamata API e nessuna modifica di ambiente

## Perimetro

L'audit monta le **componenti React reali** delle sei schermate principali:

- Preferiti
- Opinioni
- Eventi
- Menu
- Impostazioni
- Profilo

Le componenti vengono eseguite dentro la shell reale `RobustAppLayout`/`app-main` con una navbar-spacer nella propria riga. Un utente sintetico viene fornito tramite `AuthContext`; tutte le chiamate `fetch` vengono intercettate localmente e ricevono fixture controllate, quindi l'audit non può leggere o modificare produzione o staging.

Eventi e Profilo includono anche fixture con testi volutamente lunghi per stressare wrapping e larghezza.

## Matrice

Ogni schermata è verificata sui seguenti viewport CSS esatti:

| Profilo | Viewport | Modalità |
|---|---:|---|
| Small web | 320×568 | mobile web |
| Compact Android | 360×640 | Android |
| Android | 360×800 | Android |
| iPhone-sized web | 390×844 | mobile web |
| Large mobile web | 430×932 | mobile web |
| Android landscape | 667×375 | Android landscape |

Totale: **6 schermate × 6 viewport = 36 casi**.

## Controlli automatici

Per ogni caso l'audit verifica:

- assenza di overflow orizzontale del documento;
- assenza di overflow orizzontale di `app-main`;
- assenza di overflow orizzontale dell'host della schermata;
- nessun `button`, link, input, select, textarea o elemento `role=button` visibile oltre i bordi del viewport.

Il test usa iframe same-origin con dimensioni CSS esplicite, così i media query vengono realmente valutati ai viewport indicati anche se la finestra del browser di controllo ha una larghezza minima superiore.

## Risultato

Prima esecuzione con fixture vuote: **36/36 PASS**.

Seconda esecuzione con stress fixture (evento con titolo/organizzatore/indirizzo lunghi e profilo con nome/cognome lunghi): **36/36 PASS**.

Non sono rimasti overflow orizzontali o elementi interattivi tagliati nel perimetro F12-07.

## File di audit

- `client/test-main-screens-responsive.html`
- `client/test-main-screens-responsive-matrix.html`
- `client/src/audit/MainScreensResponsiveAudit.tsx`
- `api/tests/mainScreensResponsiveContract.test.js`

## Limiti

Il checkpoint qualifica il layout responsive delle schermate principali in Chromium tramite viewport CSS esatti e modalità Android simulata con le stesse classi usate dall'app. Non equivale a una certificazione hardware/browser universale: eventuali bug specifici di un WebView o di una versione di Safari/Chrome restano materia di test device-specific successivi.
