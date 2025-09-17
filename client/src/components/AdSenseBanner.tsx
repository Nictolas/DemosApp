import React, { useEffect, useState } from "react";
import { useCookieConsent } from "@/hooks/useCookieConsent";

export default function AdSenseBanner() {
  const [adsLoaded, setAdsLoaded] = useState(false);
  const { hasConsent, isReady } = useCookieConsent();

  useEffect(() => {
    // Carica Google AdSense solo se l'utente ha dato consenso per i cookie di marketing
    if (isReady && hasConsent('marketing')) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        setTimeout(() => setAdsLoaded(true), 2000);
      } catch (e) {
        setAdsLoaded(false);
      }
    }
  }, [isReady, hasConsent]);

  // Se Cookiebot non è ancora pronto, mostra un placeholder
  if (!isReady) {
    return (
      <div style={{ width: "100%", display: "flex", justifyContent: "center", marginTop: 32, minHeight: 120 }}>
        <div style={{
          width: 320,
          height: 100,
          background: "#f3f3f3",
          border: "1px dashed #bbb",
          color: "#888",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14
        }}>
          Caricamento...
        </div>
      </div>
    );
  }

  // Se l'utente non ha dato consenso per i cookie di marketing
  if (!hasConsent('marketing')) {
    return (
      <div style={{ width: "100%", display: "flex", justifyContent: "center", marginTop: 32, minHeight: 120 }}>
        <div style={{
          width: 320,
          height: 100,
          background: "#f8f9fa",
          border: "1px solid #dee2e6",
          borderRadius: "8px",
          color: "#6c757d",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          textAlign: "center",
          padding: "16px"
        }}>
          <div style={{ marginBottom: "8px" }}>
            <strong>Contenuto pubblicitario</strong>
          </div>
          <div style={{ fontSize: "12px" }}>
            Per visualizzare questo contenuto, accetta i cookie di marketing nelle impostazioni
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", display: "flex", justifyContent: "center", marginTop: 32, minHeight: 120 }}>
      <ins className="adsbygoogle"
        style={{ display: "block", minWidth: 320, minHeight: 100 }}
        data-ad-client="ca-pub-7488681940015678"
        data-ad-slot="1407380549"
        data-ad-format="auto"
        data-full-width-responsive="true"
      ></ins>
      {!adsLoaded && (
        <div style={{
          position: "absolute",
          width: 320,
          height: 100,
          background: "#f3f3f3",
          border: "1px dashed #bbb",
          color: "#888",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          zIndex: 0
        }}>
          Spazio riservato per banner pubblicitario
        </div>
      )}
    </div>
  );
} 
