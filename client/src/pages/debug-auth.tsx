import React, { useEffect, useState } from "react";
import { auth } from "@/lib/firebase-stub";

export default function DebugAuth() {
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [firebaseReady, setFirebaseReady] = useState(false);

  // Aspetta che Firebase Auth sia pronto
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setFirebaseReady(true);
    });
    return () => unsubscribe();
  }, []);

  const fetchUser = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const user = auth.currentUser;
      let idToken = null;
      if (user) {
        idToken = await user.getIdToken();
        setToken(idToken);
      }
      const res = await fetch("/api/user", {
        method: "GET",
        headers: idToken
          ? { Authorization: `Bearer ${idToken}` }
          : {},
      });
      const body = await res.json().catch(() => ({}));
      setResult({ status: res.status, body });
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (firebaseReady && auth.currentUser) {
      fetchUser();
    }
  }, [firebaseReady]);

  return (
    <div style={{ padding: 24 }}>
      <h2>DEBUG /api/user (fetch manuale, senza context)</h2>
      <div style={{ fontSize: 13, marginBottom: 8 }}>
        <b>firebaseReady:</b> {String(firebaseReady)}<br/>
        <b>auth.currentUser:</b> {auth.currentUser ? 'OK' : 'null'}
      </div>
      {!firebaseReady && <div>Inizializzazione Firebase Auth...</div>}
      {firebaseReady && !auth.currentUser && (
        <div style={{ color: 'red', marginBottom: 8 }}>
          Nessun utente autenticato. Effettua il login e poi premi "Riprova".<br/>
          <button onClick={fetchUser} style={{ marginTop: 8, padding: '6px 16px', borderRadius: 4, border: '1px solid #ccc', background: '#fffbe6', color: '#b36b00', cursor: 'pointer' }}>Riprova</button>
        </div>
      )}
      {firebaseReady && auth.currentUser && (
        <button onClick={fetchUser} style={{ marginBottom: 12, padding: '6px 16px', borderRadius: 4, border: '1px solid #ccc', background: '#e6f7ff', color: '#0050b3', cursor: 'pointer' }} disabled={loading}>
          {loading ? 'Caricamento...' : 'Riprova fetch /api/user'}
        </button>
      )}
      {token && (
        <div style={{ fontSize: 12, color: '#888', wordBreak: 'break-all' }}>
          <b>Token Firebase:</b> {token}
        </div>
      )}
      {result && (
        <div style={{ marginTop: 16 }}>
          <b>Status:</b> {result.status}
          <pre>{JSON.stringify(result.body, null, 2)}</pre>
        </div>
      )}
      {error && (
        <div style={{ color: 'red' }}>
          <b>Errore:</b> {error.toString()}
        </div>
      )}
    </div>
  );
} 