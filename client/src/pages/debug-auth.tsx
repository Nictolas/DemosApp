import React, { useEffect, useState } from "react";
// Firebase rimosso - questo componente è disabilitato
// import { auth } from "@/lib/firebase-stub";

export default function DebugAuth() {
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [firebaseReady, setFirebaseReady] = useState(false);

  return (
    <div style={{ padding: 24 }}>
      <h2>🚧 PAGINA DEBUG DISABILITATA</h2>
      <div style={{ color: '#666', marginBottom: 16 }}>
        Questa pagina è stata disabilitata durante la migrazione da Firebase al nuovo sistema di autenticazione.
      </div>
      <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8 }}>
        <p><strong>Sistema attuale:</strong> Auth.js + Neon PostgreSQL</p>
        <p><strong>Stato:</strong> Funzionante</p>
        <p><strong>Accesso:</strong> Utilizza la pagina di login principale</p>
      </div>
    </div>
  );
} 
