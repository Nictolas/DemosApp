import React, { useEffect } from "react";

export default function AdSenseBanner() {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {}
  }, []);

  return (
    <div style={{ width: "100%", display: "flex", justifyContent: "center", marginTop: 32 }}>
      <ins className="adsbygoogle"
        style={{ display: "block", minWidth: 320, minHeight: 100 }}
        data-ad-client="ca-pub-7488681940015678"
        data-ad-slot="1407380549"
        data-ad-format="auto"
        data-full-width-responsive="true"
      ></ins>
    </div>
  );
} 