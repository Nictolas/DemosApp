import { Redirect } from "wouter";

// Compatibilità con vecchi link: DEMOS non usa più password locali.
export default function LegacyPasswordRedirect() {
  return <Redirect to="/impostazioni" />;
}
