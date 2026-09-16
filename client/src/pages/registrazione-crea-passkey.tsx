import React from "react";
import RegistrazioneCompletaOAuth from "./registrazione-completa-oauth";
import RegistrazionePasskey from "./registrazione-passkey";

const OAUTH_FLOW_KEY = "registrazione_oauth_flow";

/**
 * Route legacy mantenuta temporaneamente per compatibilità.
 * Il completamento OAuth e il flusso Passkey vivono ora in componenti separati.
 */
export default function RegistrazioneCreaPasskey() {
  const isOauthFlow =
    typeof window !== "undefined" &&
    window.localStorage.getItem(OAUTH_FLOW_KEY) === "1";

  return isOauthFlow ? <RegistrazioneCompletaOAuth /> : <RegistrazionePasskey />;
}
