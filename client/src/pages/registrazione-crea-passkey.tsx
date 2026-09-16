import React from "react";
import RegistrazioneCompletaOAuth from "./registrazione-completa-oauth";

/**
 * Route legacy mantenuta temporaneamente per non rompere il wizard esistente.
 * Le Passkey non sono più disponibili nel frontend: questa route conclude
 * esclusivamente una registrazione iniziata con Google o Apple.
 */
export default function RegistrazioneCreaPasskey() {
  return <RegistrazioneCompletaOAuth />;
}
