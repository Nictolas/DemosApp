# Istruzioni: Aggiungere Riquadro Prossimo Evento nella Pagina Menu

## 📍 File Creati

Ho creato i seguenti file nel repository:
- `components/ProssimoEventoRiquadro.jsx` - Componente React
- `components/ProssimoEventoRiquadro.css` - Stili CSS

## 🔧 Passi per l'Integrazione

### 1. Copia i File nel Tuo Frontend

Se il frontend è in un repository separato, copia questi file:
- `components/ProssimoEventoRiquadro.jsx` → nel tuo progetto frontend
- `components/ProssimoEventoRiquadro.css` → nel tuo progetto frontend

### 2. Trova la Pagina Menu

La pagina menu si trova probabilmente in uno di questi percorsi:
- `pages/menu.js` o `pages/menu.tsx` (Next.js)
- `src/pages/Menu.js` o `src/pages/Menu.tsx` (React)
- `app/menu/page.js` o `app/menu/page.tsx` (Next.js App Router)

### 3. Importa e Aggiungi il Componente

Aggiungi il componente nella pagina menu. Esempio per Next.js:

```jsx
// pages/menu.js o app/menu/page.js
import ProssimoEventoRiquadro from '../components/ProssimoEventoRiquadro';
// oppure se è in una cartella diversa:
// import ProssimoEventoRiquadro from '@/components/ProssimoEventoRiquadro';

export default function MenuPage() {
  return (
    <div className="menu-page">
      <h1>Menu</h1>
      
      {/* Altri contenuti del menu esistenti */}
      
      {/* Aggiungi il riquadro del prossimo evento */}
      <ProssimoEventoRiquadro />
      
      {/* Altri contenuti del menu esistenti */}
    </div>
  );
}
```

### 4. Verifica l'Autenticazione

Il componente cerca il token in:
- `localStorage.getItem('token')`
- `localStorage.getItem('authToken')`

Se usi un sistema di autenticazione diverso, modifica il componente per recuperare il token dal tuo sistema (es. Context API, Redux, ecc.).

### 5. Personalizza l'URL dell'API (se necessario)

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

## 🎨 Personalizzazione

Puoi personalizzare:
- **Colori**: Modifica il gradiente in `ProssimoEventoRiquadro.css`
- **Layout**: Modifica la struttura JSX nel componente
- **Informazioni mostrate**: Aggiungi o rimuovi campi dall'evento
- **Link**: Modifica il link "Vedi tutti gli eventi" per puntare alla pagina corretta

## 📝 Note

- Il componente non mostra nulla se non ci sono eventi futuri
- Il componente gestisce automaticamente lo stato di caricamento
- Gli errori vengono loggati nella console ma non mostrati all'utente
