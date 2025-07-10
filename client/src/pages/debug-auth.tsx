import React, { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";

export default function DebugAuth() {
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUser() {
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
    }
    fetchUser();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h2>DEBUG /api/user (fetch manuale, senza context)</h2>
      {loading && <div>Caricamento...</div>}
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