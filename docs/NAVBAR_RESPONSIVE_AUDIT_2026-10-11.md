# DEMOS — Audit Navbar responsive

**Data:** 2026-10-11  
**Task:** F12-06  
**Ambiente:** frontend locale Vite, Chromium isolato, CSS e struttura canonica di `RobustAppLayout`, `Navbar` e `DesktopAppHeader`  
**Produzione:** non modificata

## Esito

La prima matrice ha rilevato un difetto reale specifico Android: le regole legacy in `android-navbar-fix.css` combinavano altezza fissa della navbar con un padding-bottom artificiale di 56 px. Nei viewport Android questo faceva uscire verticalmente le icone dal contenitore e le tagliava.

È stato aggiunto un override canonico che:

- mantiene la navbar Android nel normale flusso del layout;
- rimuove l'altezza fissa conflittuale;
- usa soltanto `env(safe-area-inset-bottom)` con un gap massimo di 14 px;
- mantiene una variante più compatta in landscape sotto i 500 px di altezza.

Dopo la correzione la matrice è **9/9 PASS**.

| Caso | Viewport CSS | Modalità | Esito |
|---|---:|---|---|
| small-web | 320×568 | mobile web | PASS |
| compact-android | 360×640 | Android | PASS |
| android | 360×800 | Android | PASS |
| iphone-web | 390×844 | mobile web | PASS |
| large-web | 430×932 | mobile web | PASS |
| landscape-android | 667×375 | Android landscape | PASS |
| tablet-boundary | 768×1024 | desktop/tablet boundary | PASS |
| desktop | 1024×768 | desktop | PASS |
| desktop-wide | 1440×900 | desktop | PASS |

## Controlli eseguiti

Per ogni viewport l'harness verifica automaticamente:

- assenza di overflow orizzontale della pagina;
- presenza della superficie di navigazione corretta per il breakpoint;
- assenza simultanea della navbar mobile e dell'header desktop;
- navbar mobile interamente contenuta nel viewport;
- area principale che termina sopra la navbar e non viene coperta;
- sette voci nel caso mobile più affollato, senza sovrapposizioni e senza clipping;
- header e controlli desktop contenuti nella larghezza disponibile.

La matrice usa iframe same-origin con dimensioni CSS esatte, così i media query vengono valutati realmente a 320/360/390/430/667/768/1024/1440 px anche quando la finestra del browser di controllo impone una propria larghezza minima.

## Limiti della verifica

Questo checkpoint qualifica il contratto responsive della **navigazione** in Chromium e la logica CSS Android simulata tramite la classe applicata dall'app. Non sostituisce F12-07, che resta dedicato alla verifica delle schermate principali su diversi modelli di smartphone e, dove possibile, su browser/dispositivi reali.

## File di prova

- `client/test-navbar-responsive.html`
- `client/test-navbar-responsive-matrix.html`
- `api/tests/navbarResponsiveContract.test.js`
