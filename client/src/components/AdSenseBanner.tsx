import React, { useEffect, useState } from "react";

export default function AdSenseBanner() {
  const [adsLoaded, setAdsLoaded] = useState(false);

  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      setTimeout(() => setAdsLoaded(true), 2000); // Dopo 2s, presumi che l'annuncio sia caricato (o meno)
    } catch (e) {
      setAdsLoaded(false);
    }
  }, []);

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