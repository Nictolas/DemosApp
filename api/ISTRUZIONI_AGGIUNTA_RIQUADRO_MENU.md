# Istruzioni: Aggiungere Riquadro Prossimo Evento nella Pagina Menu

## 📍 File Creati

Ho creato i seguenti file nel repository:
- `components/ProssimoEventoRiquadro.jsx` - Componente React (cliccabile, naviga a /eventi)
- `components/ProssimoEventoRiquadro.css` - Stili CSS

## ✅ Caratteristiche del Componente

- ✅ **Cliccabile**: L'intero riquadro è cliccabile e naviga a `/eventi`
- ✅ **Hover effect**: Cambia aspetto al passaggio del mouse
- ✅ **Accessibile**: Supporta navigazione da tastiera (Enter/Space)
- ✅ **Responsive**: Si adatta a diversi schermi

## 🔧 Passi per l'Integrazione

### 1. Trova la Pagina Menu

La pagina menu si trova probabilmente in uno di questi percorsi:
- `pages/menu.js` o `pages/menu.tsx` (Next.js)
- `src/pages/Menu.js` o `src/pages/Menu.tsx` (React)
- `app/menu/page.js` o `app/menu/page.tsx` (Next.js App Router)

### 2. Importa e Aggiungi il Componente SOTTO i Pulsanti

Aggiungi il componente **dopo** i pulsanti del menu. Esempio:

```jsx
// pages/menu.js o app/menu/page.js
import ProssimoEventoRiquadro from '../components/ProssimoEventoRiquadro';
// oppure se è in una cartella diversa:
// import ProssimoEventoRiquadro from '@/components/ProssimoEventoRiquadro';

export default function MenuPage() {
  return (
    <div className="menu-page">
      <h1>Menu</h1>
      
      {/* Pulsanti del menu esistenti */}
      <div className="menu-buttons">
        {/* I tuoi pulsanti qui */}
        <button>Pulsante 1</button>
        <button>Pulsante 2</button>
        {/* ... altri pulsanti */}
      </div>
      
      {/* ⬇️ AGGIUNGI IL RIQUADRO QUI, SOTTO I PULSANTI ⬇️ */}
      <ProssimoEventoRiquadro />
      
      {/* Altri contenuti del menu (se presenti) */}
    </div>
  );
}
```

### 3. Verifica l'Autenticazione

Il componente cerca il token in:
- `localStorage.getItem('token')`
- `localStorage.getItem('authToken')`

Se usi un sistema di autenticazione diverso, modifica il componente per recuperare il token dal tuo sistema (es. Context API, Redux, ecc.).

### 4. Personalizza l'URL dell'API (se necessario)

Se l'URL dell'API è diverso da `https://www.demos.community/api/eventi/prossimo`, modifica questa riga nel componente:

```jsx
const response = await fetch('https://www.demos.community/api/eventi/prossimo', {
```

## ✅ Verifica

Dopo l'integrazione:
1. Assicurati che l'utente sia autenticato
2. Verifica che ci sia almeno un evento futuro nel database
3. Controlla la console del browser per eventuali errori
4. Il riquadro dovrebbe apparire automaticamente se c'è un evento futuro
5. **Cliccando sul riquadro** dovresti essere portato a `/eventi`

## 🎨 Personalizzazione

Puoi personalizzare:
- **Colori**: Modifica il gradiente in `ProssimoEventoRiquadro.css`
- **Layout**: Modifica la struttura JSX nel componente
- **Informazioni mostrate**: Aggiungi o rimuovi campi dall'evento
- **URL di destinazione**: Modifica `window.location.href = '/eventi'` nel componente

## 📝 Note

- Il componente non mostra nulla se non ci sono eventi futuri
- Il componente gestisce automaticamente lo stato di caricamento
- Gli errori vengono loggati nella console ma non mostrati all'utente
- **L'intero riquadro è cliccabile** e naviga a `/eventi`
